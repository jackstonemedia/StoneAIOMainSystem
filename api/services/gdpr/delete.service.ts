/**
 * GDPR deletion — complete-platform item 5.
 *
 * Two different deletions, deliberately different scopes:
 *
 * - Workspace delete: the BUSINESS's data in one workspace, gone. Owner
 *   only, typed-name confirm. All 50 workspace relations cascade, so one
 *   `db.workspace.delete` removes the workspace and its data; the counts
 *   are taken first so the response can say what was removed.
 *
 * - Account delete: the PERSON's data, everywhere. The `User` row, 2FA
 *   rows, all memberships, their personal agent/assistant data in every
 *   workspace, and workspaces they SOLELY own. Workspaces they own WITH
 *   other members are NOT deleted — ownership transfers to the oldest
 *   remaining admin (or the oldest member, promoted to admin). Shared
 *   business data (contacts, deals, campaigns) stays: it belongs to the
 *   business, not the person.
 */
import { db } from '../../../infrastructure/database/client.js';

/** Tables counted (then deleted by cascade) for a workspace delete. */
const WORKSPACE_DELETE_COUNTS = [
  'contact',
  'company',
  'deal',
  'conversation',
  'campaign',
  'automation',
  'workflow',
  'landingPage',
  'funnel',
  'task',
  'appointment',
  'inboxConversation',
  'channelConnection',
] as const;

export interface WorkspaceDeleteResult {
  deleted: true;
  workspaceId: string;
  workspaceName: string;
  counts: Record<string, number>;
}

export async function deleteWorkspaceWithCounts(
  workspaceId: string,
  userId: string,
  confirmName: string,
): Promise<WorkspaceDeleteResult> {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw Object.assign(new Error('Workspace not found'), { status: 404 });
  if (workspace.ownerId !== userId) {
    throw Object.assign(new Error('Only the workspace owner can delete it'), { status: 403 });
  }
  if (!confirmName || confirmName !== workspace.name) {
    throw Object.assign(new Error('Type the workspace name exactly to confirm deletion'), { status: 400 });
  }

  const counts: Record<string, number> = {};
  for (const delegate of WORKSPACE_DELETE_COUNTS) {
    counts[delegate] = await (db as any)[delegate].count({ where: { workspaceId } });
  }

  // One delete: every workspace relation cascades (verified in the schema).
  await db.workspace.delete({ where: { id: workspaceId } });

  return { deleted: true, workspaceId, workspaceName: workspace.name, counts };
}

/** The person's own rows inside a workspace (agent/assistant + team spots). */
const PERSONAL_TABLES: Array<{ delegate: string; where: (userId: string, workspaceId: string) => any }> = [
  { delegate: 'agentConversation', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'agentMemory', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'agentAuditLog', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'assistantConversation', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'assistantMemory', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'assistantUsage', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'assistantScheduledTask', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'assistantProject', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'inboxAgentSignature', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'userLeadHistory', where: (userId, workspaceId) => ({ userId, workspaceId }) },
  { delegate: 'inboxTeamMember', where: (userId) => ({ userId }) },
  { delegate: 'inboxConversationParticipant', where: (userId) => ({ userId }) },
  { delegate: 'inboxChannelAgent', where: (userId) => ({ userId }) },
];

export interface AccountDeleteResult {
  deleted: true;
  userId: string;
  clerkDeleted: boolean;
  clerkNote: string | null;
  workspacesDeleted: string[];
  workspacesTransferred: Array<{ workspaceId: string; newOwnerId: string }>;
  membershipsRemoved: number;
}

export async function deleteAccount(
  userId: string,
  deleteClerkUser?: (clerkId: string) => Promise<void>,
): Promise<AccountDeleteResult> {
  const user = await db.user.findFirst({ where: { clerkId: userId } });
  if (!user) throw Object.assign(new Error('Account not found'), { status: 404 });

  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });

  const workspacesDeleted: string[] = [];
  const workspacesTransferred: Array<{ workspaceId: string; newOwnerId: string }> = [];

  for (const m of memberships as any[]) {
    const ws = m.workspace;
    const others = await db.workspaceMember.findMany({
      where: { workspaceId: ws.id, userId: { not: userId } },
      orderBy: { createdAt: 'asc' },
    });

    if (ws.ownerId === userId && others.length === 0) {
      // Sole owner, sole member: the workspace is theirs alone — delete it.
      await db.workspace.delete({ where: { id: ws.id } });
      workspacesDeleted.push(ws.id);
      continue;
    }

    if (ws.ownerId === userId && others.length > 0) {
      // Owned with others: transfer ownership, never delete their data.
      const nextOwner = (others as any[]).find((o) => o.role === 'admin') ?? others[0];
      if (nextOwner.role !== 'admin') {
        await db.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId: ws.id, userId: nextOwner.userId } },
          data: { role: 'admin' },
        });
      }
      await db.workspace.update({ where: { id: ws.id }, data: { ownerId: nextOwner.userId } });
      workspacesTransferred.push({ workspaceId: ws.id, newOwnerId: nextOwner.userId });
    }

    // Remove the person's own rows inside this workspace.
    for (const table of PERSONAL_TABLES) {
      await (db as any)[table.delegate].deleteMany({ where: table.where(userId, ws.id) });
    }
  }

  // Memberships in workspaces already deleted above are gone with the
  // cascade; remove the rest, then the person's account rows.
  await db.workspaceMember.deleteMany({ where: { userId } });
  await db.userTwoFactor.deleteMany({ where: { userId } });
  await db.twoFactorSession.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: user.id } });

  // Clerk: the identity provider holds the login itself. Delete it when
  // configured (this revokes the user's sessions); otherwise say so.
  let clerkDeleted = false;
  let clerkNote: string | null = null;
  if (deleteClerkUser) {
    try {
      await deleteClerkUser(userId);
      clerkDeleted = true;
    } catch (err: any) {
      clerkNote = `Clerk account could not be deleted automatically (${err?.message ?? 'unknown error'}). Remove it in the Clerk dashboard.`;
    }
  } else {
    clerkNote = 'Clerk account deletion is not configured on this server. Remove the login in the Clerk dashboard.';
  }

  return {
    deleted: true,
    userId,
    clerkDeleted,
    clerkNote,
    workspacesDeleted,
    workspacesTransferred,
    membershipsRemoved: memberships.length,
  };
}
