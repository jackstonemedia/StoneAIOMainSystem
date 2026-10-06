/**
 * Mailbox Pool Service — Native Outreach Engine
 *
 * Manages the multi-inbox pool for a workspace:
 * 1. Tracks daily quotas per connected Gmail/Outlook inbox (hard cap of 40/day by default).
 * 2. Provides round-robin & least-loaded selection across active inboxes.
 * 3. Monitors mailbox health and auto-pauses on consecutive bounces.
 * 4. Resets daily counters at midnight UTC.
 *
 * Multi-tenant isolation: all mailbox selections strictly scoped to workspaceId.
 */

import { db } from '../../../infrastructure/database/client.js';

export interface MailboxCapacitySummary {
  connectedMailboxes: number;
  activeMailboxes: number;
  totalDailyLimit: number;
  sentToday: number;
  remainingToday: number;
  mailboxes: Array<{
    id: string;
    email: string | null;
    label: string | null;
    provider: string;
    dailySendLimit: number;
    sentTodayCount: number;
    remainingToday: number;
    status: string;
    lastSentAt: Date | null;
    consecutiveBounces: number;
    minDelaySeconds: number;
    maxDelaySeconds: number;
  }>;
}

export interface AvailableMailbox {
  id: string;
  email: string | null;
  label: string | null;
  provider: string;
  dailySendLimit: number;
  sentTodayCount: number;
  remaining: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
}

/**
 * Returns all active mailboxes in the workspace with available quota for today.
 */
export async function getAvailableMailboxes(workspaceId: string): Promise<AvailableMailbox[]> {
  const connections = await db.channelConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ['gmail', 'outlook'] },
      isActive: true,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      label: true,
      provider: true,
      dailySendLimit: true,
      sentTodayCount: true,
      minDelaySeconds: true,
      maxDelaySeconds: true,
    },
    orderBy: [
      { sentTodayCount: 'asc' },
      { lastSentAt: 'asc' },
    ],
  });

  return connections
    .filter(conn => conn.sentTodayCount < conn.dailySendLimit)
    .map(conn => ({
      ...conn,
      remaining: Math.max(0, conn.dailySendLimit - conn.sentTodayCount),
    }));
}

/**
 * Returns full capacity and health summary for outreach mailboxes in a workspace.
 */
export async function getWorkspaceOutreachCapacity(workspaceId: string): Promise<MailboxCapacitySummary> {
  const connections = await db.channelConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ['gmail', 'outlook'] },
    },
    select: {
      id: true,
      email: true,
      label: true,
      provider: true,
      dailySendLimit: true,
      sentTodayCount: true,
      status: true,
      isActive: true,
      lastSentAt: true,
      consecutiveBounces: true,
      minDelaySeconds: true,
      maxDelaySeconds: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const activeMailboxes = connections.filter(c => c.isActive && c.status === 'ACTIVE');
  const totalDailyLimit = activeMailboxes.reduce((sum, c) => sum + c.dailySendLimit, 0);
  const sentToday = activeMailboxes.reduce((sum, c) => sum + c.sentTodayCount, 0);
  const remainingToday = Math.max(0, totalDailyLimit - sentToday);

  return {
    connectedMailboxes: connections.length,
    activeMailboxes: activeMailboxes.length,
    totalDailyLimit,
    sentToday,
    remainingToday,
    mailboxes: connections.map(c => ({
      id: c.id,
      email: c.email,
      label: c.label,
      provider: c.provider,
      dailySendLimit: c.dailySendLimit,
      sentTodayCount: c.sentTodayCount,
      remainingToday: c.isActive && c.status === 'ACTIVE' ? Math.max(0, c.dailySendLimit - c.sentTodayCount) : 0,
      status: c.status,
      lastSentAt: c.lastSentAt,
      consecutiveBounces: c.consecutiveBounces,
      minDelaySeconds: c.minDelaySeconds,
      maxDelaySeconds: c.maxDelaySeconds,
    })),
  };
}

/**
 * Selects the next available mailbox for sending.
 * Balances load across active inboxes by picking the mailbox with least sends today.
 *
 * @param workspaceId Scoped workspace ID
 * @param preferredConnectionId Optional connection ID requested by caller
 */
export async function selectNextMailbox(
  workspaceId: string,
  preferredConnectionId?: string | null
): Promise<AvailableMailbox | null> {
  if (preferredConnectionId) {
    const conn = await db.channelConnection.findFirst({
      where: {
        id: preferredConnectionId,
        workspaceId,
        provider: { in: ['gmail', 'outlook'] },
        isActive: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        label: true,
        provider: true,
        dailySendLimit: true,
        sentTodayCount: true,
        minDelaySeconds: true,
        maxDelaySeconds: true,
      },
    });

    if (conn && conn.sentTodayCount < conn.dailySendLimit) {
      return {
        ...conn,
        remaining: conn.dailySendLimit - conn.sentTodayCount,
      };
    }
  }

  const available = await getAvailableMailboxes(workspaceId);
  if (available.length === 0) return null;

  // The list is already ordered by sentTodayCount asc, lastSentAt asc
  return available[0];
}

/**
 * Atomically records a successful send for a mailbox.
 * Increments sentTodayCount, updates lastSentAt, and resets bounce counter.
 */
export async function recordSendSuccess(connectionId: string): Promise<void> {
  await db.channelConnection.update({
    where: { id: connectionId },
    data: {
      sentTodayCount: { increment: 1 },
      lastSentAt: new Date(),
      consecutiveBounces: 0,
    },
  });
}

/**
 * Records a bounce or delivery failure for a mailbox.
 * If 3 consecutive bounces occur, automatically PAUSES the mailbox to protect domain health.
 */
export async function recordSendBounce(connectionId: string): Promise<{ paused: boolean }> {
  const updated = await db.channelConnection.update({
    where: { id: connectionId },
    data: {
      consecutiveBounces: { increment: 1 },
    },
    select: { consecutiveBounces: true, email: true, workspaceId: true },
  });

  if (updated.consecutiveBounces >= 3) {
    await db.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: 'PAUSED',
        isActive: false,
      },
    });
    console.warn(
      `[MailboxPool] Auto-paused mailbox ${updated.email} (${connectionId}) in workspace ${updated.workspaceId} due to ${updated.consecutiveBounces} consecutive bounces.`
    );
    return { paused: true };
  }

  return { paused: false };
}

/**
 * Checks for token or auth errors and marks mailbox as ERROR if credentials expired.
 */
export async function recordSendAuthError(connectionId: string, errorMsg: string): Promise<void> {
  const isAuthError =
    errorMsg.includes('invalid_grant') ||
    errorMsg.includes('Token has been expired or revoked') ||
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('Authentication failed');

  if (isAuthError) {
    await db.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: 'ERROR',
        isActive: false,
      },
    });
    console.error(`[MailboxPool] Mailbox ${connectionId} marked ERROR due to auth failure: ${errorMsg}`);
  }
}

/**
 * Daily quota reset worker.
 * Resets sentTodayCount = 0 for mailboxes whose last reset was before today's start (UTC).
 */
export async function resetDailyQuotas(targetDate: Date = new Date()): Promise<{ resetCount: number }> {
  const startOfTodayUtc = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  ));

  const result = await db.channelConnection.updateMany({
    where: {
      provider: { in: ['gmail', 'outlook'] },
      OR: [
        { lastResetAt: null },
        { lastResetAt: { lt: startOfTodayUtc } },
      ],
    },
    data: {
      sentTodayCount: 0,
      lastResetAt: new Date(),
    },
  });

  return { resetCount: result.count };
}
