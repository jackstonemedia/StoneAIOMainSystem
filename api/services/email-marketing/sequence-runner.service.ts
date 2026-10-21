/**
 * Create-with-AI Milestone 4 — Sequence runner (spec §9 + §13 + §18).
 *
 * The runner turns an approved sequence into per-contact sends. It runs on
 * the same 30s tick as the campaign scheduler (email-marketing.routes.ts).
 *
 * Flow:
 * 1. enrollSequenceIfNeeded (called from the campaign SENT transitions):
 *    when a sequence's Email 1 campaign reaches SENT, every recipient with
 *    an actual sent time is enrolled into RecipientStates — later emails
 *    timed PER PERSON from that recipient's first send (not a campaign
 *    clock). First enroll only: re-sends never re-enroll (existing states
 *    govern, so timing is never reset).
 * 2. processDueSequenceSteps (the tick): for each launched sequence, run
 *    advanceSequence (guards: exits, suppression, frequency cap, conflict,
 *    deadline — all recorded, never silent), then send each due step
 *    per contact via the Gmail channel (same path as the campaign worker:
 *    renderFinalHtml for tokens + locked footer + HMAC tracking links,
 *    sendGmailMessage, EmailEvent, recordStepSent). A paused or cancelled
 *    sequence campaign stops all unsent steps (the states stay due, so a
 *    resume sends them). A failed send never advances the state: the
 *    failure is recorded in history and the due time backs off 1h (no
 *    hammering every 30s).
 *
 * The sender is injectable (opts.sender) so tests can verify the runner's
 * logic without Gmail. Production uses the Gmail channel; without a Gmail
 * connection the step fails honestly (backoff, no fake delivery).
 */

import { db } from '../../../infrastructure/database/client.js';
import {
  advanceSequence,
  enrollSequenceRecipients,
  recordStepSent,
  isSuppressed,
  type ValidatedSequence,
} from './sequence.service.js';
import { renderFinalHtml } from './send-orchestration.service.js';

export interface SequenceStepSendArgs {
  workspaceId: string;
  campaignId: string;
  email: { id: string; subjectVariants: unknown; subjectSelected: number | null; bodyHtml: string; bodyText: string };
  contact: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  html: string;
  text: string;
  subject: string;
  senderName: string;
}

export type SequenceStepSender = (args: SequenceStepSendArgs) => Promise<{ messageId: string | null }>;

async function gmailStepSender(args: SequenceStepSendArgs): Promise<{ messageId: string | null }> {
  let gmailConn = await db.channelConnection.findFirst({
    where: { workspaceId: args.workspaceId, provider: 'gmail', isActive: true },
  }).catch(() => null);
  if (!gmailConn) {
    gmailConn = await db.channelConnection.findFirst({
      where: { provider: 'gmail', isActive: true },
    }).catch(() => null);
  }
  if (!gmailConn) throw new Error('No active Gmail connection found for this workspace. A connected Gmail account is required to send.');
  const { sendGmailMessage } = await import('../channels/gmail.service.js');
  const result = await sendGmailMessage(
    gmailConn.id,
    args.contact.email,
    args.subject,
    args.text,
    undefined,
    args.html,
    args.senderName,
  );
  return { messageId: result.messageId || null };
}

function historyAppend(history: unknown, entry: Record<string, unknown>): never {
  const arr = Array.isArray(history) ? history : [];
  return JSON.parse(JSON.stringify([...arr, entry])) as never;
}

/**
 * Enrolls a sequence's Email 1 recipients after the Email 1 campaign
 * reaches SENT. First enroll only (existing RecipientStates mean this
 * sequence already enrolled — a re-send must not reset per-person timing).
 * Never throws: enroll failures are logged, never break send completion.
 */
export async function enrollSequenceIfNeeded(workspaceId: string, campaignId: string): Promise<void> {
  try {
    const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
    if (!campaign || !campaign.draftId) return;
    const draft = await db.campaignDraft.findFirst({ where: { id: campaign.draftId, workspaceId } });
    if (!draft) return;
    const sequence = (draft.sequence || {}) as unknown as ValidatedSequence & { count?: number };
    if (!sequence.count || sequence.count <= 1) return;
    const existing = await db.recipientState.count({ where: { workspaceId, draftId: draft.id } });
    if (existing > 0) return;
    const sent = await db.campaignRecipient.findMany({
      where: { campaignId, status: 'SENT', sentAt: { not: null } },
      select: { contactId: true, sentAt: true },
    });
    const recipients = sent
      .filter((r) => r.sentAt)
      .map((r) => ({ contactId: r.contactId, sentAt: r.sentAt as Date }));
    if (recipients.length === 0) return;
    await enrollSequenceRecipients(workspaceId, draft.id, sequence as ValidatedSequence, recipients);
  } catch (err) {
    console.error(`[SequenceRunner] Enroll failed for campaign ${campaignId}:`, (err as Error).message);
  }
}

interface DraftSequenceInfo {
  draftId: string;
  workspaceId: string;
  sequence: ValidatedSequence;
  campaignId: string;
  campaignStatus: string;
  profile: { businessName: string; physicalAddress: string; senderName: string };
}

/**
 * One tick of the sequence runner. Returns counts for observability.
 * Never throws for a single bad sequence — it logs and continues.
 */
export async function processDueSequenceSteps(
  now: Date = new Date(),
  opts?: { sender?: SequenceStepSender },
): Promise<{ sequences: number; sent: number; failed: number; exited: number; skipped: number }> {
  const sender = opts?.sender || gmailStepSender;
  const totals = { sequences: 0, sent: 0, failed: 0, exited: 0, skipped: 0 };
  const dueStates = await db.recipientState.findMany({
    where: { status: 'active', nextSendAt: { lte: now } },
    include: { draft: true },
  });
  const draftIds = [...new Set(dueStates.map((s) => s.draftId))];
  const infos = new Map<string, DraftSequenceInfo>();
  for (const draftId of draftIds) {
    try {
      const draft = dueStates.find((s) => s.draftId === draftId)?.draft as unknown as Record<string, unknown> | null;
      if (!draft) continue;
      const sequence = (draft.sequence || {}) as unknown as ValidatedSequence & { count?: number };
      if (!sequence.count || sequence.count <= 1) continue;
      const firstEmail = await db.campaignEmail.findFirst({
        where: { draftId, workspaceId: String(draft.workspaceId), order: 1 },
      });
      if (!firstEmail?.campaignId) continue;
      const campaign = await db.campaign.findFirst({ where: { id: firstEmail.campaignId } });
      if (!campaign) continue;
      const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
      infos.set(draftId, {
        draftId,
        workspaceId: String(draft.workspaceId),
        sequence: sequence as ValidatedSequence,
        campaignId: campaign.id,
        campaignStatus: campaign.status,
        profile: {
          businessName: String(snap.businessName || ''),
          physicalAddress: String(snap.physicalAddress || ''),
          senderName: String(snap.senderName || ''),
        },
      });
    } catch (err) {
      console.error(`[SequenceRunner] Sequence info failed for draft ${draftId}:`, (err as Error).message);
    }
  }
  for (const draftId of draftIds) {
    const info = infos.get(draftId);
    if (!info) continue;
    totals.sequences += 1;
    // Pause/cancel stops all unsent steps (states stay due, so resume sends).
    if (info.campaignStatus === 'PAUSED' || info.campaignStatus === 'CANCELLED') continue;
    let advanced;
    try {
      advanced = await advanceSequence(info.workspaceId, draftId, now);
    } catch (err) {
      console.error(`[SequenceRunner] advance failed for draft ${draftId}:`, (err as Error).message);
      continue;
    }
    totals.exited += advanced.exited;
    totals.skipped += advanced.skipped;
    const trackBase = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/email-marketing/track/click`;
    for (const due of advanced.details.filter((d) => d.to === 'due')) {
      // advanceSequence leaves due states untouched (still active, still
      // due) — re-fetch for the state id + a final active check.
      const state = await db.recipientState.findFirst({
        where: { workspaceId: info.workspaceId, draftId, contactId: due.contactId, status: 'active' },
      });
      if (!state || state.nextSendAt === null || state.nextSendAt.getTime() > now.getTime()) continue;
      const order = state.nextEmailOrder;
      try {
        const email = await db.campaignEmail.findFirst({ where: { workspaceId: info.workspaceId, draftId, order } });
        if (!email) throw new Error(`Sequence email order ${order} not found for draft ${draftId}.`);
        const contact = await db.contact.findFirst({ where: { id: due.contactId, workspaceId: info.workspaceId } });
        if (!contact || !contact.email) throw new Error(`Contact ${due.contactId} not found or has no email.`);
        // Re-check exits + suppression immediately before sending (spec §18).
        if (await isSuppressed(info.workspaceId, contact.email)) {
          await db.recipientState.update({
            where: { id: state.id },
            data: { status: 'exited_bounced', nextSendAt: null, history: historyAppend(state.history, { at: now.toISOString(), from: 'active', to: 'exited_bounced', reason: 'Suppressed at send time.' }) },
          });
          totals.exited += 1;
          continue;
        }
        const subjects = (Array.isArray(email.subjectVariants) ? email.subjectVariants : []).filter(
          (s: unknown): s is string => typeof s === 'string',
        ) as string[];
        const subject = subjects[email.subjectSelected ?? 0] || `Email ${order}`;
        const { html, text } = renderFinalHtml(
          info.workspaceId,
          info.campaignId,
          { bodyHtml: String(email.bodyHtml || ''), bodyText: String(email.bodyText || '') },
          { businessName: info.profile.businessName, physicalAddress: info.profile.physicalAddress },
          contact.id,
          trackBase,
        );
        const sent = await sender({
          workspaceId: info.workspaceId,
          campaignId: info.campaignId,
          email: { id: email.id, subjectVariants: email.subjectVariants, subjectSelected: email.subjectSelected, bodyHtml: String(email.bodyHtml || ''), bodyText: String(email.bodyText || '') },
          contact: { id: contact.id, email: contact.email, firstName: contact.firstName, lastName: contact.lastName },
          html,
          text,
          subject,
          senderName: info.profile.senderName,
        });
        await db.emailEvent.create({
          data: {
            workspaceId: info.workspaceId,
            contactId: contact.id,
            campaignId: info.campaignId,
            eventType: 'SENT',
            metadata: JSON.parse(JSON.stringify({ sequenceOrder: order, draftId, messageId: sent.messageId })) as never,
          },
        });
        try {
          await db.contactEvent.create({
            data: {
              contactId: contact.id,
              type: 'email',
              title: `Sequence: ${subject}`,
              content: html,
              metadataJson: JSON.stringify({ campaignId: info.campaignId, draftId, sequenceOrder: order, provider: 'gmail', messageId: sent.messageId }),
            },
          });
        } catch {
          /* timeline write never blocks delivery */
        }
        await db.contact.updateMany({
          where: { id: contact.id, workspaceId: info.workspaceId },
          data: { totalEmailsReceived: { increment: 1 }, lastContactedAt: now },
        });
        await recordStepSent(info.workspaceId, state.id, info.sequence, now);
        totals.sent += 1;
      } catch (err) {
        // Never advance on failure: record it, back off 1h, retry next tick.
        const msg = (err as Error).message;
        console.error(`[SequenceRunner] Step send failed (draft ${draftId}, contact ${due.contactId}):`, msg);
        try {
          const cur = await db.recipientState.findFirst({ where: { workspaceId: info.workspaceId, draftId, contactId: due.contactId } });
          if (cur && cur.status === 'active') {
            await db.recipientState.update({
              where: { id: cur.id },
              data: {
                nextSendAt: new Date(now.getTime() + 60 * 60 * 1000),
                history: historyAppend(cur.history, { at: now.toISOString(), from: 'active', to: 'active', reason: `Send failed, retry in 1h: ${msg}` }),
              },
            });
          }
        } catch {
          /* history write failure must not throw the tick */
        }
        totals.failed += 1;
      }
    }
  }
  return totals;
}

/**
 * Sequence progress for the UI (M4): the plan + the sequence campaign's
 * status + every recipient's state (per-person timing, exits, skips).
 */
export async function getSequenceStatus(workspaceId: string, draftId: string) {
  const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!draft) throw new Error('Campaign draft not found.');
  const sequence = (draft.sequence || {}) as unknown as ValidatedSequence & { count?: number };
  const firstEmail = await db.campaignEmail.findFirst({ where: { draftId, workspaceId, order: 1 } });
  const campaign = firstEmail?.campaignId
    ? await db.campaign.findFirst({ where: { id: firstEmail.campaignId } })
    : null;
  const states = await db.recipientState.findMany({
    where: { workspaceId, draftId },
    include: { contact: { select: { email: true, firstName: true, lastName: true } } },
  });
  return {
    draftId,
    draftStatus: draft.status,
    sequence: draft.sequence || null,
    campaign: campaign ? { id: campaign.id, status: campaign.status, scheduledAtUtc: campaign.scheduledAtUtc } : null,
    states: states.map((s) => ({
      contactId: s.contactId,
      email: s.contact?.email || null,
      firstName: s.contact?.firstName || null,
      lastName: s.contact?.lastName || null,
      status: s.status,
      currentEmailOrder: s.nextEmailOrder,
      nextSendAt: s.nextSendAt,
      firstSentAt: s.firstSentAt,
      lastSentAt: s.lastSentAt,
      history: s.history,
    })),
  };
}

/**
 * Owner manual exit (M4, spec §18 "mark as replied" family): stops all
 * future steps for one contact with an owner-chosen exit reason. The
 * contact's queued steps are cancelled; already-sent emails are untouched.
 */
export async function exitSequenceContact(
  workspaceId: string,
  draftId: string,
  contactId: string,
  reason: 'replied' | 'booked' | 'unsubscribed',
) {
  const state = await db.recipientState.findFirst({
    where: { workspaceId, draftId, contactId, status: 'active' },
  });
  if (!state) throw new Error('No active sequence state for this contact.');
  const status = `exited_${reason}` as const;
  const updated = await db.recipientState.update({
    where: { id: state.id },
    data: {
      status,
      nextSendAt: null,
      history: historyAppend(state.history, {
        at: new Date().toISOString(),
        from: 'active',
        to: status,
        reason: `Owner marked as ${reason}.`,
      }),
    },
  });
  return { contactId, status: updated.status };
}
