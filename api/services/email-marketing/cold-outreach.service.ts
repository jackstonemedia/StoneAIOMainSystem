/**
 * M7 — Cold outreach (spec §13) for Create-with-AI campaigns.
 *
 * Rules enforced here, all Gmail-only (no Resend anywhere):
 * - Daily send cap with ramp-up from a single mailbox: 20/day days 1–3,
 *   40/day days 4–7, 75/day week 2, 100/day after.
 * - Randomized spacing: the initial send shuffles recipients and waits a
 *   human jitter (30–90s, the existing range) between sends; the drip tick
 *   shuffles pending recipients and waits a short random delay between sends.
 * - Stop on reply: the drip tick re-checks exits + suppression immediately
 *   before every send (spec §18); a contact who replied, unsubscribed,
 *   bounced, or complained is skipped, never sent. Auto-replies do NOT stop
 *   (detectExitSignals excludes them via AUTO_REPLY_HINTS).
 * - Plain-text format, 50–100 words, no images: enforced as blocking Phase 8
 *   checks (validateColdFormat) and as text-only sending in the worker.
 * - US business contacts only (v1) + separate domain/mailbox recommended:
 *   enforced by attestation — the acknowledgment checkbox (blocking, already
 *   in runSendChecks) plus the main-domain warning (already in runSendChecks).
 *   Contacts and CSV rows carry no reliable country field, so there is no
 *   code-level country filter to add; the checkbox is the attestation.
 *
 * Drip model: sendCampaign sends up to today's cap and leaves the rest
 * PENDING (never failed); the campaign still transitions to SENT, and
 * processColdDrip (30s tick) finishes the PENDING recipients day by day.
 * Claims are atomic (PENDING → SENDING with sentAt set at claim time, so a
 * claimed row counts toward the day's cap even before its send lands), and
 * stale claims (>2h, e.g. after a restart) are reclaimed to PENDING.
 * The tick only drips inside the send window (weekdays 8–17 business TZ).
 */
import { db } from '../../../infrastructure/database/client.js';
import { Prisma } from '@prisma/client';
import { detectExitSignals } from './sequence.service.js';

/** Ramp table (spec §13): [last day in band, cap]. */
export const COLD_RAMP: Array<{ throughDay: number; cap: number }> = [
  { throughDay: 3, cap: 20 },
  { throughDay: 7, cap: 40 },
  { throughDay: 14, cap: 75 },
  { throughDay: Number.POSITIVE_INFINITY, cap: 100 },
];

export function coldDailyCap(dayNumber: number): number {
  const d = Math.max(1, Math.floor(dayNumber) || 1);
  for (const band of COLD_RAMP) if (d <= band.throughDay) return band.cap;
  return 100;
}

/** Day 1 = the anchor's calendar day; never below 1. */
export function coldDayNumber(anchor: Date, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - anchor.getTime()) / 86400000) + 1;
  return Math.max(1, days);
}

export function coldWordCount(text: string): number {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Blocking Phase 8 messages for a cold email's format. Empty when the
 * format is fine (or when the caller passes cold=false, which disables all).
 */
export function validateColdFormat(bodyHtml: string, bodyText: string, cold = true): string[] {
  if (!cold) return [];
  const blocking: string[] = [];
  if (/<img[\s>]/i.test(bodyHtml || '')) {
    blocking.push('Cold outreach must be plain text with no images — remove the image from this email.');
  }
  const words = coldWordCount(bodyText || '');
  if (words < 50 || words > 100) {
    blocking.push(
      `Cold outreach must be 50 to 100 words (this email is ${words} words) — shorten it or add a line so it reads like one person writing to one person.`,
    );
  }
  return blocking;
}

/** Small random delay (ms) between drip sends. */
export function coldDripDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 2000);
}

/** Human jitter (ms) between initial cold sends — the existing 30–90s range. */
export function coldHumanDelayMs(): number {
  return 30000 + Math.floor(Math.random() * 60000);
}

/**
 * One cold-gate per send invocation: detects the campaign once, then
 * allowed() re-checks today's room before every send and jitter() waits
 * between cold sends (not before the first). Non-cold campaigns get a
 * pass-through gate (allowed always true, jitter a no-op).
 */
export async function coldSendContext(
  workspaceId: string,
  campaignId: string,
): Promise<{ isCold: boolean; allowed: () => Promise<boolean>; jitter: () => Promise<void> }> {
  const isCold = await isColdCampaign(workspaceId, campaignId).catch(() => false);
  let sentFirst = false;
  return {
    isCold,
    allowed: async () => {
      if (!isCold) return true;
      const room = await coldRoomToday(workspaceId, campaignId);
      return room.room > 0;
    },
    jitter: async () => {
      if (!isCold) return;
      if (sentFirst) await new Promise((r) => setTimeout(r, coldHumanDelayMs()));
      sentFirst = true;
    },
  };
}

/** Weekdays 8:00–17:00 in the business timezone (spec §9 send window). */
export function withinColdWindow(timezone: string, now: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    if (['Sat', 'Sun'].includes(weekday)) return false;
    return hour >= 8 && hour < 17;
  } catch {
    return true; // Unknown timezone: do not block sending on a formatting guess.
  }
}

function utcDayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86400000) };
}

/** Resolve a campaign's Create-with-AI draft (null for old campaigns). */
export async function coldDraftForCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<{ draftId: string; draft: any } | null> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) return null;
  const bj = (campaign.blockJson as Record<string, unknown> | null) || {};
  let emailId = typeof bj.campaignEmailId === 'string' ? bj.campaignEmailId : null;
  if (!emailId) {
    const email = await db.campaignEmail.findFirst({
      where: { campaignId, kind: 'scheduled' },
      orderBy: { order: 'asc' },
      select: { id: true, draftId: true },
    });
    if (email) return { draftId: email.draftId, draft: await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId } }) };
    return null;
  }
  const email = await db.campaignEmail.findFirst({ where: { id: emailId, workspaceId } });
  if (!email) return null;
  const draft = await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId } });
  return draft ? { draftId: draft.id, draft } : null;
}

export async function isColdCampaign(workspaceId: string, campaignId: string): Promise<boolean> {
  try {
    const found = await coldDraftForCampaign(workspaceId, campaignId);
    if (!found?.draft) return false;
    const brief = (found.draft.brief as Record<string, any> | null) || {};
    return (brief.audience as Record<string, unknown> | undefined)?.cold_contacts === true;
  } catch {
    return false;
  }
}

/** SENT + claimed (SENDING) recipients stamped today (UTC). */
export async function coldSentToday(workspaceId: string, campaignId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = utcDayBounds(now);
  return db.campaignRecipient.count({
    where: {
      campaignId,
      status: { in: ['SENT', 'SENDING'] },
      sentAt: { gte: start, lt: end },
    },
  });
}

/** Anchor: campaign sentAt, else earliest SENT recipient, else now (day 1). */
export async function coldAnchor(workspaceId: string, campaignId: string, now: Date = new Date()): Promise<Date> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId, sentAtUtc: { not: null } }, select: { sentAtUtc: true } });
  if (campaign?.sentAtUtc) return campaign.sentAtUtc;
  const first = await db.campaignRecipient.findFirst({
    where: { campaignId, status: 'SENT', sentAt: { not: null } },
    orderBy: { sentAt: 'asc' },
    select: { sentAt: true },
  });
  return first?.sentAt || now;
}

export async function coldRoomToday(
  workspaceId: string,
  campaignId: string,
  now: Date = new Date(),
): Promise<{ day: number; cap: number; sent: number; room: number }> {
  const anchor = await coldAnchor(workspaceId, campaignId, now);
  const day = coldDayNumber(anchor, now);
  const cap = coldDailyCap(day);
  const sent = await coldSentToday(workspaceId, campaignId, now);
  return { day, cap, sent, room: Math.max(0, cap - sent) };
}

/** Contacts that must never receive another cold email from this campaign. */
export async function coldShouldSkip(
  workspaceId: string,
  draftId: string,
  contact: { id: string; email: string | null },
  since: Date,
): Promise<string | null> {
  if (contact.email) {
    const suppressed = await db.suppressionEntry.findFirst({
      where: { workspaceId, email: contact.email },
      select: { id: true },
    }).catch(() => null);
    if (suppressed) return 'SUPPRESSED';
    const membership = await db.contactListMembership.findFirst({
      where: { workspaceId, contactId: contact.id, status: { in: ['UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED'] as any } },
      select: { id: true },
    }).catch(() => null);
    if (membership) return 'UNSUBSCRIBED_OR_BOUNCED';
  }
  const state = await db.recipientState.findFirst({
    where: { workspaceId, draftId, contactId: contact.id, status: { startsWith: 'exited_' } },
    select: { id: true },
  }).catch(() => null);
  if (state) return 'EXITED';
  try {
    const signals = await detectExitSignals(workspaceId, contact.id, since);
    if (signals.replied) return 'REPLIED';
    if (signals.unsubscribed) return 'UNSUBSCRIBED';
    if (signals.bounced) return 'BOUNCED';
    if (signals.complained) return 'COMPLAINED';
  } catch {
    /* exit-signal read failure must not block the drip; the worker re-checks */
  }
  return null;
}

// In-process guard: one drip run per campaign at a time (single-process API).
const dripping = new Set<string>();

/**
 * 30s tick worker: finish PENDING recipients of SENT cold campaigns, up to
 * today's ramp room, inside the send window. Stale claims (>2h) are
 * reclaimed to PENDING first. A drip-sent recipient in a multi-email
 * sequence is enrolled into the sequence (per-person timing from its own
 * first send) — the SENT-transition enrollment only covers recipients who
 * were already SENT, so without this, dripped recipients would never get
 * follow-ups.
 */
export async function processColdDrip(now: Date = new Date()): Promise<{ dripped: number; skipped: number; campaigns: number }> {
  const out = { dripped: 0, skipped: 0, campaigns: 0 };
  const camps = await db.campaign.findMany({
    where: { status: 'SENT', blockJson: { not: Prisma.JsonNull } },
    select: { id: true, workspaceId: true, sentAtUtc: true },
  }).catch(() => []);
  for (const camp of camps) {
    if (dripping.has(camp.id)) continue;
    let found: { draftId: string; draft: any } | null = null;
    try {
      found = await coldDraftForCampaign(camp.workspaceId, camp.id);
    } catch {
      continue;
    }
    if (!found?.draft) continue;
    const brief = (found.draft.brief as Record<string, any> | null) || {};
    if (brief.audience?.cold_contacts !== true) continue;
    const snap = (found.draft.profileSnapshot as Record<string, unknown> | null) || {};
    const tz = typeof snap.timezone === 'string' ? snap.timezone : 'America/Los_Angeles';
    if (!withinColdWindow(tz, now)) continue;

    // Reclaim stale claims (process died mid-batch) so they are retried.
    await db.campaignRecipient.updateMany({
      where: {
        campaignId: camp.id,
        status: 'SENDING',
        sentAt: { lt: new Date(now.getTime() - 2 * 3600000) },
      },
      data: { status: 'PENDING', sentAt: null },
    }).catch(() => null);

    const pending = await db.campaignRecipient.findMany({
      where: { campaignId: camp.id, status: 'PENDING' },
      select: { id: true, contactId: true, variant: true },
    });
    if (pending.length === 0) continue;
    const room = await coldRoomToday(camp.workspaceId, camp.id, now);
    if (room.room <= 0) continue;

    dripping.add(camp.id);
    out.campaigns += 1;
    try {
      const shuffled = [...pending].sort(() => Math.random() - 0.5);
      const batch = shuffled.slice(0, room.room);
      const { processEmailSendJobDirectly } = await import('./email-send-worker.service.js');
      const since = camp.sentAtUtc || now;
      for (const r of batch) {
        // Atomic claim: only the run that flips PENDING → SENDING sends it.
        const claimed = await db.campaignRecipient.updateMany({
          where: { id: r.id, status: 'PENDING' },
          data: { status: 'SENDING', sentAt: now },
        });
        if (claimed.count === 0) continue;
        // Cold + A/B test-then-winner: if the winner was decided after this
        // recipient was sampled, it gets the winner — never a stale variant.
        // (Split mode sends both variants fully, so no flip there.)
        try {
          const campNow = await db.campaign.findFirst({ where: { id: camp.id }, select: { abTestConfig: true } });
          const abNow = (campNow?.abTestConfig as Record<string, unknown> | null) || {};
          if (abNow.mode === 'test_then_winner' && typeof abNow.winnerVariant === 'string' && r.variant && r.variant !== abNow.winnerVariant) {
            await db.campaignRecipient.updateMany({ where: { id: r.id }, data: { variant: abNow.winnerVariant as string } });
          }
        } catch {
          /* winner re-check failure must not block the drip */
        }
        const contact = await db.contact.findFirst({ where: { id: r.contactId, workspaceId: camp.workspaceId } });
        const skip = contact ? await coldShouldSkip(camp.workspaceId, found.draftId, contact, since) : 'NO_CONTACT';
        if (skip) {
          await db.campaignRecipient.updateMany({
            where: { id: r.id },
            data: { status: `SKIPPED:${skip}` },
          });
          out.skipped += 1;
          continue;
        }
        const result = await processEmailSendJobDirectly({
          workspaceId: camp.workspaceId,
          campaignId: camp.id,
          campaignRecipientId: r.id,
          contactId: r.contactId,
          type: 'CAMPAIGN',
        });
        // NOTE: processEmailSendJobDirectly resolves ok:true even when the
        // worker marked the recipient FAILED (its last-attempt path resolves
        // after marking — pre-existing semantics shared with sendCampaign's
        // queued count). Only a recipient that actually reached SENT may be
        // enrolled into a sequence; a FAILED send must never start timing.
        const after = await db.campaignRecipient.findFirst({ where: { id: r.id }, select: { status: true, sentAt: true } });
        if (result.ok && after?.status === 'SENT') {
          out.dripped += 1;
          // Enroll dripped recipients into multi-email sequences (the
          // SENT-transition enrollment only covered day-1 recipients).
          try {
            const seq = (found.draft.sequence as any) || null;
            if (seq && Number(seq.count) > 1) {
              const { enrollSequenceRecipients, validateSequence } = await import('./sequence.service.js');
              const validated = validateSequence(seq);
              await enrollSequenceRecipients(camp.workspaceId, found.draftId, validated, [
                { contactId: r.contactId, sentAt: after.sentAt || now },
              ]);
            }
          } catch {
            /* enrollment failure must not un-send a sent email; the next
               SENT-transition check can enroll it (states upsert) */
          }
        }
        await new Promise((res) => setTimeout(res, coldDripDelayMs()));
      }
    } finally {
      dripping.delete(camp.id);
    }
  }
  return out;
}
