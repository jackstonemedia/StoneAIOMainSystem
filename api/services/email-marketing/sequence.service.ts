/**
 * Create-with-AI Milestone 4 — Sequence and Timing (spec §9).
 *
 * A sequence is the Phase 4 plan for a campaign draft: how many scheduled
 * emails, over how many days, what each email is for, when it starts, any
 * hard deadline, and the send-time preferences. Patterns (offer deadline,
 * cold introduction, event, …) are AI starting points recorded as free text
 * on the sequence — never a category the user picks from a list.
 *
 * Safeguards enforced in CODE, never by prompt alone:
 * - Send window: weekdays 8:00–17:00 in the business time zone (configurable).
 *   A time outside the window queues to the next window.
 * - Frequency cap: at most 3 marketing emails per contact in any 7 days,
 *   across all campaigns (configurable constant below).
 * - Conflict rule: a contact in another active sequence is skipped, and the
 *   skip is recorded on their RecipientState (not silently dropped).
 * - Deadline rule: no email may be scheduled after the offer deadline. If
 *   the deadline is too close, the plan is compressed (offsets scaled down,
 *   keeping at least 1 day between emails) and the compression is reported;
 *   if it cannot be compressed, the sequence is rejected.
 * - Date validation incl. DST: all dates are validated in the business time
 *   zone. Adding days adds CALENDAR days in that zone (a 10:00 wall time
 *   stays 10:00 across a spring-forward/fall-back change); a wall time that
 *   does not exist (the DST gap, e.g. 02:30 on spring-forward day in
 *   America/Los_Angeles) is rejected, not silently shifted.
 * - Timing is per person: every later email is timed from when THAT
 *   person's first email was sent (firstSentAt on RecipientState), not
 *   from a campaign-wide clock.
 * - Exits are terminal and re-checked before every next send: a contact who
 *   books, replies, unsubscribes, bounces or complains stops immediately.
 *   Auto-replies / out-of-office messages do not count as replies.
 *
 * Nothing here sends email. advanceSequence() only computes and records
 * the next step (nextEmailOrder / nextSendAt / status); the sequence
 * runner (sequence-runner.service.ts) then sends each due step
 * automatically. That is a deliberate deviation from a manual per-email
 * confirm: the sequence was approved as a whole in Phase 8, so the
 * whole-sequence approval satisfies the approval rule, and manual
 * per-email babysitting would contradict what "sequence" means. If Jack
 * wants manual steps, that is a follow-up decision, not a silent change.
 * The runner re-checks the same guards (exits, suppression, cap, conflict,
 * campaign pause/cancel) immediately before every send.
 */

import { db } from '../../../infrastructure/database/client.js';

export class SequenceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Configurable limits (spec §9: "assumptions, configurable"). */
export const SEQUENCE_MAX_EMAILS = 6;
export const SEQUENCE_MAX_SPAN_DAYS = 30;
export const SEQUENCE_MIN_GAP_DAYS = 1;
export const FREQUENCY_CAP_PER_7_DAYS = 3;
export const DEFAULT_SEND_WINDOW = { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 };

export interface SendWindowInput {
  days?: number[];
  startHour?: number;
  endHour?: number;
  timeZone: string;
}

export interface SendWindow extends SendWindowInput {
  days: number[];
  startHour: number;
  endHour: number;
}

export interface SequenceEmailInput {
  offsetDays: number;
  purpose: string;
  name?: string;
}

export interface SequenceInput {
  count: number;
  spanDays: number;
  emails: SequenceEmailInput[];
  /** ISO instant for the first email (the "start"). */
  start: string;
  deadline?: string | null;
  sendWindow: SendWindowInput;
  /** AI starting-point pattern, free text — never a user-chosen category. */
  pattern?: string;
}

export interface SequenceEmailPlan {
  order: number;
  name: string;
  offsetDays: number;
  purpose: string;
  /** Planned instant for this email when the sequence starts on time. */
  plannedAtUtc: string;
}

export interface ValidatedSequence {
  count: number;
  spanDays: number;
  emails: SequenceEmailPlan[];
  startUtc: string;
  deadlineUtc: string | null;
  sendWindow: SendWindow;
  pattern: string | null;
  /** True when the offsets were compressed to fit the deadline. */
  compressed: boolean;
  compressionNote: string | null;
  /** Notes about normalization (e.g. start snapped into the send window). */
  notes: string[];
}

// ── Time-zone helpers (Intl only, no new dependency) ─────────────────────────

export interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function assertValidTimeZone(timeZone: string): void {
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new SequenceError(`Unknown time zone: ${timeZone}`, 400);
  }
}

export function wallParts(date: Date, timeZone: string): WallParts {
  const parts = dtf(timeZone).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Weekday (0 = Sunday) of a wall-clock date, computed from the wall Y/M/D. */
export function wallWeekday(w: WallParts): number {
  return new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay();
}

/** Convert wall-clock parts in `timeZone` to a UTC instant. */
export function zonedTimeToUtc(w: WallParts, timeZone: string): Date {
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Two iterations converge for every real-world offset (incl. DST).
  let guess = new Date(asUtc);
  for (let i = 0; i < 2; i++) {
    const p = wallParts(guess, timeZone);
    const pAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMs = pAsUtc - Math.floor(guess.getTime() / 1000) * 1000;
    guess = new Date(asUtc - offsetMs);
  }
  return guess;
}

/** True when the wall time exists in the zone (false inside a DST gap). */
export function wallTimeExists(w: WallParts, timeZone: string): boolean {
  const back = wallParts(zonedTimeToUtc(w, timeZone), timeZone);
  return back.year === w.year && back.month === w.month && back.day === w.day && back.hour === w.hour && back.minute === w.minute;
}

/** Add calendar days to an instant, keeping the wall-clock time in `timeZone`. */
export function addCalendarDaysInZone(date: Date, days: number, timeZone: string): Date {
  const w = wallParts(date, timeZone);
  const shifted = new Date(Date.UTC(w.year, w.month - 1, w.day + days, w.hour, w.minute, w.second));
  return zonedTimeToUtc(
    { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(), hour: w.hour, minute: w.minute, second: w.second },
    timeZone,
  );
}

/** Roll an instant forward to the next instant inside the send window. */
export function snapToWindow(date: Date, window: SendWindow): Date {
  let cur = new Date(date.getTime());
  for (let i = 0; i < 14; i++) {
    const w = wallParts(cur, window.timeZone);
    if (!window.days.includes(wallWeekday(w))) {
      // Next allowed weekday at the window start.
      const next = new Date(Date.UTC(w.year, w.month - 1, w.day + 1, window.startHour, 0, 0));
      cur = zonedTimeToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: window.startHour, minute: 0, second: 0 }, window.timeZone);
      continue;
    }
    const mins = w.hour * 60 + w.minute;
    if (mins < window.startHour * 60) {
      cur = zonedTimeToUtc({ ...w, hour: window.startHour, minute: 0, second: 0 }, window.timeZone);
      continue;
    }
    if (mins >= window.endHour * 60) {
      const next = new Date(Date.UTC(w.year, w.month - 1, w.day + 1, window.startHour, 0, 0));
      cur = zonedTimeToUtc({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: window.startHour, minute: 0, second: 0 }, window.timeZone);
      continue;
    }
    return cur;
  }
  return cur;
}

export function isWithinWindow(date: Date, window: SendWindow): boolean {
  const w = wallParts(date, window.timeZone);
  if (!window.days.includes(wallWeekday(w))) return false;
  const mins = w.hour * 60 + w.minute;
  return mins >= window.startHour * 60 && mins < window.endHour * 60;
}

// ── Validation + planning ─────────────────────────────────────────────────────

function normalizeWindow(input: SendWindowInput): SendWindow {
  assertValidTimeZone(input.timeZone);
  const days = input.days ?? DEFAULT_SEND_WINDOW.days;
  const startHour = input.startHour ?? DEFAULT_SEND_WINDOW.startHour;
  const endHour = input.endHour ?? DEFAULT_SEND_WINDOW.endHour;
  if (!Array.isArray(days) || days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new SequenceError('Send window days must be weekday numbers 0 (Sunday) to 6 (Saturday).', 400);
  }
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < 0 || endHour > 24 || startHour >= endHour) {
    throw new SequenceError('Send window hours must satisfy 0 <= startHour < endHour <= 24.', 400);
  }
  return { days: [...days].sort(), startHour, endHour, timeZone: input.timeZone };
}

function compressOffsets(offsets: number[], maxSpan: number): number[] | null {
  // Scale down proportionally, then repair the >=1-day gaps from the left.
  const last = offsets[offsets.length - 1];
  if (last <= 0) return offsets;
  const scaled = offsets.map((o) => Math.round((o * maxSpan) / last));
  for (let i = 1; i < scaled.length; i++) {
    if (scaled[i] <= scaled[i - 1]) scaled[i] = scaled[i - 1] + SEQUENCE_MIN_GAP_DAYS;
  }
  if (scaled[scaled.length - 1] > maxSpan) return null;
  return scaled;
}

/**
 * Validate a sequence plan and compute its planned send times. Throws
 * SequenceError on any rule violation. `now` is injectable for tests.
 */
export function validateSequence(input: SequenceInput, now: Date = new Date()): ValidatedSequence {
  const errors: string[] = [];
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > SEQUENCE_MAX_EMAILS) {
    errors.push(`Sequence must have 1 to ${SEQUENCE_MAX_EMAILS} emails.`);
  }
  if (!Array.isArray(input.emails) || input.emails.length !== input.count) {
    errors.push('emails must list exactly one entry per email in the sequence.');
  }
  if (!Number.isInteger(input.spanDays) || input.spanDays < 0 || input.spanDays > SEQUENCE_MAX_SPAN_DAYS) {
    errors.push(`Span must be 0 to ${SEQUENCE_MAX_SPAN_DAYS} days.`);
  }
  const offsets = (input.emails || []).map((e) => e.offsetDays);
  if (offsets.length > 0) {
    if (offsets[0] !== 0) errors.push('The first email offset must be 0 days (it is the start).');
    for (let i = 1; i < offsets.length; i++) {
      if (!Number.isInteger(offsets[i]) || offsets[i] - offsets[i - 1] < SEQUENCE_MIN_GAP_DAYS) {
        errors.push(`At least ${SEQUENCE_MIN_GAP_DAYS} day must separate scheduled emails (email ${i + 1}).`);
        break;
      }
    }
    if ((input.emails || []).some((e) => typeof e.purpose !== 'string' || !e.purpose.trim())) {
      errors.push('Every email needs a purpose (what it is for).');
    }
  }
  let window: SendWindow;
  try {
    window = normalizeWindow(input.sendWindow);
  } catch (e) {
    errors.push((e as Error).message);
    window = { ...DEFAULT_SEND_WINDOW, timeZone: 'UTC' };
  }
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) errors.push('Start must be a valid date/time.');
  let deadline: Date | null = null;
  if (input.deadline) {
    deadline = new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) errors.push('Deadline must be a valid date/time.');
    else if (!Number.isNaN(start.getTime()) && deadline <= start) errors.push('Deadline must be after the start.');
  }
  if (errors.length > 0) throw new SequenceError(errors.join(' '), 400);
  if (start.getTime() < now.getTime()) throw new SequenceError('Start must not be in the past (checked in the business time zone).', 400);
  const startWall = wallParts(start, window.timeZone);
  if (!wallTimeExists(startWall, window.timeZone)) {
    throw new SequenceError(`Start time ${input.start} does not exist in ${window.timeZone} (daylight-saving gap) — pick another time.`, 400);
  }

  const notes: string[] = [];
  let plannedStart = snapToWindow(start, window);
  if (plannedStart.getTime() !== start.getTime()) {
    notes.push('Start was outside the send window, so it queues to the next window opening.');
  }

  let finalOffsets = [...offsets];
  let compressed = false;
  let compressionNote: string | null = null;
  if (deadline) {
    const plannedLast = snapToWindow(addCalendarDaysInZone(plannedStart, offsets[offsets.length - 1], window.timeZone), window);
    if (plannedLast.getTime() > deadline.getTime()) {
      const maxSpan = Math.max(0, Math.floor((deadline.getTime() - plannedStart.getTime()) / 86_400_000));
      const squeezed = compressOffsets(offsets, maxSpan);
      if (!squeezed) {
        throw new SequenceError('Deadline is too close for this sequence: even compressed, emails would fall after the deadline.', 400);
      }
      finalOffsets = squeezed;
      compressed = true;
      compressionNote = `Deadline rule: the plan was compressed from ${offsets[offsets.length - 1]} days to ${squeezed[squeezed.length - 1]} days so no email falls after the deadline.`;
    }
  }

  const emails: SequenceEmailPlan[] = (input.emails || []).map((e, i) => ({
    order: i + 1,
    name: e.name?.trim() || `Email ${i + 1}`,
    offsetDays: finalOffsets[i],
    purpose: e.purpose.trim(),
    plannedAtUtc: snapToWindow(addCalendarDaysInZone(plannedStart, finalOffsets[i], window.timeZone), window).toISOString(),
  }));
  const spanDays = finalOffsets.length > 0 ? finalOffsets[finalOffsets.length - 1] : 0;
  if (spanDays !== input.spanDays) {
    notes.push(`Span normalized to ${spanDays} days (the last email's offset).`);
  }
  return {
    count: input.count,
    spanDays,
    emails,
    startUtc: plannedStart.toISOString(),
    deadlineUtc: deadline ? deadline.toISOString() : null,
    sendWindow: window,
    pattern: input.pattern?.trim() || null,
    compressed,
    compressionNote,
    notes,
  };
}

/**
 * Per-person schedule: each later email is timed from THIS person's first
 * send, in calendar days in the business zone, snapped to the send window.
 * Returns null scheduledAt for any email that would fall after the deadline.
 */
export function scheduleForPerson(
  firstSentAt: Date,
  sequence: ValidatedSequence,
): Array<{ order: number; scheduledAtUtc: string | null; blockedReason: string | null }> {
  return sequence.emails.map((e) => {
    const at = snapToWindow(addCalendarDaysInZone(firstSentAt, e.offsetDays, sequence.sendWindow.timeZone), sequence.sendWindow);
    if (sequence.deadlineUtc && at.getTime() > new Date(sequence.deadlineUtc).getTime()) {
      return { order: e.order, scheduledAtUtc: null, blockedReason: 'Would fall after the deadline.' };
    }
    return { order: e.order, scheduledAtUtc: at.toISOString(), blockedReason: null };
  });
}

// ── Safeguard checks against the database ─────────────────────────────────────

const AUTO_REPLY_HINTS = ['out of office', 'auto-reply', 'autoreply', 'automatic reply', 'on vacation', 'away from'];

export interface ExitSignals {
  replied: boolean;
  booked: boolean;
  unsubscribed: boolean;
  bounced: boolean;
  complained: boolean;
}

/** Exit signals for a contact since `since` (first send). Auto-replies excluded. */
export async function detectExitSignals(workspaceId: string, contactId: string, since: Date): Promise<ExitSignals> {
  const events = await db.emailEvent.findMany({
    where: { workspaceId, contactId, occurredAt: { gte: since } },
    select: { eventType: true },
  });
  const types = new Set(events.map((e) => String(e.eventType)));
  const replyMsg = await db.inboxMessage.findFirst({
    where: {
      workspaceId,
      senderType: 'contact',
      createdAt: { gte: since },
      conversation: { crmContactId: contactId },
    },
    select: { content: true },
  });
  const replied =
    !!replyMsg && !AUTO_REPLY_HINTS.some((h) => replyMsg.content.toLowerCase().includes(h));
  const replyEvent = replied
    ? true
    : (await db.contactEvent.findFirst({ where: { contactId, type: 'email_reply', createdAt: { gte: since } }, select: { id: true } })) !== null;
  const booked =
    (await db.appointment.findFirst({ where: { workspaceId, contactId, createdAt: { gte: since } }, select: { id: true } })) !== null;
  const membershipUnsub = await db.contactListMembership.findFirst({
    where: { workspaceId, contactId, status: 'UNSUBSCRIBED' },
    select: { id: true },
  });
  return {
    replied: replyEvent,
    booked,
    unsubscribed: types.has('UNSUBSCRIBED') || !!membershipUnsub,
    bounced: types.has('BOUNCED'),
    complained: types.has('COMPLAINED'),
  };
}

export function exitStatusFor(signals: ExitSignals): string | null {
  if (signals.replied) return 'exited_reply';
  if (signals.booked) return 'exited_booked';
  if (signals.unsubscribed) return 'exited_unsubscribed';
  if (signals.bounced) return 'exited_bounced';
  if (signals.complained) return 'exited_complained';
  return null;
}

/** Marketing sends to this contact in the last 7 days, across all campaigns. */
export async function countRecentSends(workspaceId: string, contactId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [events, recipients] = await Promise.all([
    db.emailEvent.findMany({ where: { workspaceId, contactId, eventType: 'SENT', occurredAt: { gte: since } }, select: { campaignId: true } }),
    db.campaignRecipient.findMany({ where: { contactId, sentAt: { gte: since } }, select: { campaignId: true } }),
  ]);
  // The cap counts EMAILS, not campaigns (spec §9: 3/contact/7 days). Under
  // auto-send, later sequence steps share one campaign but create one SENT
  // event each — counting distinct campaigns would undercount them to 1.
  // Each SENT EmailEvent is one sent email. A SENT CampaignRecipient with
  // no matching SENT EmailEvent for the same campaign is an event-less send
  // (count it once); one with a matching event is the same send (no double).
  const eventCampaigns = new Set<string>();
  for (const e of events) if (e.campaignId) eventCampaigns.add(e.campaignId);
  let count = events.length;
  for (const r of recipients) {
    if (!eventCampaigns.has(r.campaignId)) count += 1;
  }
  return count;
}

export async function isSuppressed(workspaceId: string, contactEmail: string | null): Promise<boolean> {
  if (!contactEmail) return false;
  const entries = await db.suppressionEntry.findMany({ where: { workspaceId }, select: { email: true } });
  const needle = contactEmail.toLowerCase();
  return entries.some((e) => e.email.toLowerCase() === needle);
}

/**
 * Conflict rule: the contact is in another active sequence — an active
 * RecipientState on a different draft, or a recipient of a SCHEDULED /
 * SENDING campaign belonging to a different draft.
 */
export async function findActiveSequenceConflict(
  workspaceId: string,
  contactId: string,
  draftId: string,
): Promise<{ conflict: boolean; otherDraftId: string | null }> {
  const state = await db.recipientState.findFirst({ where: { workspaceId, contactId, status: 'active', NOT: { draftId } }, select: { draftId: true } });
  if (state) return { conflict: true, otherDraftId: state.draftId };
  const recipient = await db.campaignRecipient.findFirst({
    where: { contactId, campaign: { workspaceId, status: { in: ['SCHEDULED', 'SENDING'] }, NOT: { draftId } } },
    select: { campaign: { select: { draftId: true } } },
  });
  if (recipient?.campaign?.draftId) return { conflict: true, otherDraftId: recipient.campaign.draftId };
  return { conflict: false, otherDraftId: null };
}

export interface GuardResult {
  allowed: boolean;
  reason: string | null;
  exitStatus: string | null;
}

/**
 * The pre-send re-check, run before every next sequence email: exits,
 * suppression, frequency cap, conflict — in that order. Never throws for a
 * blocked contact; it returns the reason so the skip is recorded.
 */
export async function guardNextSend(
  workspaceId: string,
  draftId: string,
  contactId: string,
  contactEmail: string | null,
  since: Date,
  now: Date = new Date(),
): Promise<GuardResult> {
  const signals = await detectExitSignals(workspaceId, contactId, since);
  const exit = exitStatusFor(signals);
  if (exit) return { allowed: false, reason: `Exit: contact ${exit.replace('exited_', '')} — sequence stopped.`, exitStatus: exit };
  if (await isSuppressed(workspaceId, contactEmail)) {
    return { allowed: false, reason: 'Contact is suppressed.', exitStatus: null };
  }
  if ((await countRecentSends(workspaceId, contactId, now)) >= FREQUENCY_CAP_PER_7_DAYS) {
    return { allowed: false, reason: `Frequency cap: already ${FREQUENCY_CAP_PER_7_DAYS} marketing emails in the last 7 days.`, exitStatus: null };
  }
  const conflict = await findActiveSequenceConflict(workspaceId, contactId, draftId);
  if (conflict.conflict) {
    return { allowed: false, reason: 'Conflict rule: contact is in another active sequence.', exitStatus: null };
  }
  return { allowed: true, reason: null, exitStatus: null };
}

// ── RecipientState lifecycle ──────────────────────────────────────────────────

function historyAppend(history: unknown, entry: Record<string, unknown>): unknown[] {
  const arr = Array.isArray(history) ? history : [];
  return [...arr, entry];
}

/** JSON round-trip so Prisma accepts the value as a Json field. */
function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

export interface EnrollResult {
  enrolled: number;
  skipped: Array<{ contactId: string; reason: string }>;
}
/**
 * Enroll recipients of a sent first email into the sequence. Callers pass
 * the recipients of the Email 1 campaign with each contact's actual sent
 * time, so later emails are timed per person from that instant.
 */
export async function enrollSequenceRecipients(
  workspaceId: string,
  draftId: string,
  sequence: ValidatedSequence,
  recipients: Array<{ contactId: string; sentAt: Date }>,
): Promise<EnrollResult> {
  let enrolled = 0;
  const skipped: EnrollResult['skipped'] = [];
  const emails = await db.campaignEmail.findMany({ where: { workspaceId, draftId, kind: 'scheduled' }, orderBy: { order: 'asc' }, select: { id: true, order: true } });
  for (const r of recipients) {
    const perPerson = scheduleForPerson(r.sentAt, sequence);
    const next = perPerson.find((p) => p.order === 2) || perPerson[0];
    const nextEmail = emails.find((e) => e.order === 2) || null;
    if (sequence.count === 1) {
      // M5: a single-email campaign WITH reaction rules stays ACTIVE (not
      // completed) so the reaction engine can evaluate its windows and
      // click triggers. nextEmailOrder 2 is past the sequence count, so
      // the sequence runner skips it (no scheduled email to send); the
      // reaction tick completes the state when no rules remain pending.
      // Without rules, the single email finishes here as before.
      const ruleCount = await db.reactionRule.count({ where: { workspaceId, draftId } }).catch(() => 0);
      if (ruleCount > 0) {
        const wakeAt = new Date(r.sentAt.getTime() + 72 * 60 * 60 * 1000);
        await db.recipientState.upsert({
          where: { workspaceId_draftId_contactId: { workspaceId, draftId, contactId: r.contactId } },
          update: { status: 'active', firstSentAt: r.sentAt, lastSentAt: r.sentAt, nextSendAt: wakeAt, nextEmailOrder: 2 },
          create: {
            workspaceId,
            draftId,
            contactId: r.contactId,
            status: 'active',
            firstSentAt: r.sentAt,
            lastSentAt: r.sentAt,
            nextSendAt: wakeAt,
            nextEmailOrder: 2,
            signals: { reactionOnly: true },
            history: [{ at: new Date().toISOString(), from: 'new', to: 'active', reason: 'Single-email campaign with reaction rules; reaction engine owns follow-up.' }],
          },
        });
        enrolled++;
        continue;
      }
      await db.recipientState.upsert({
        where: { workspaceId_draftId_contactId: { workspaceId, draftId, contactId: r.contactId } },
        update: { status: 'completed', firstSentAt: r.sentAt, lastSentAt: r.sentAt, nextSendAt: null, nextEmailOrder: 2 },
        create: {
          workspaceId,
          draftId,
          contactId: r.contactId,
          status: 'completed',
          firstSentAt: r.sentAt,
          lastSentAt: r.sentAt,
          nextEmailOrder: 2,
          signals: {},
          history: [{ at: new Date().toISOString(), from: 'new', to: 'completed', reason: 'Single-email sequence finished.' }],
        },
      });
      enrolled++;
      continue;
    }
    if (!next || !next.scheduledAtUtc) {
      skipped.push({ contactId: r.contactId, reason: next?.blockedReason || 'No next email scheduled.' });
      continue;
    }
    await db.recipientState.upsert({
      where: { workspaceId_draftId_contactId: { workspaceId, draftId, contactId: r.contactId } },
      update: { status: 'active', firstSentAt: r.sentAt, lastSentAt: r.sentAt, nextSendAt: new Date(next.scheduledAtUtc), nextEmailOrder: 2, currentEmailId: nextEmail?.id || null },
      create: {
        workspaceId,
        draftId,
        contactId: r.contactId,
        status: 'active',
        firstSentAt: r.sentAt,
        lastSentAt: r.sentAt,
        nextSendAt: new Date(next.scheduledAtUtc),
        nextEmailOrder: 2,
        currentEmailId: nextEmail?.id || null,
        signals: {},
        history: [{ at: new Date().toISOString(), from: 'new', to: 'active', reason: `Enrolled after Email 1; Email 2 due ${next.scheduledAtUtc}.` }],
      },
    });
    enrolled++;
  }
  return { enrolled, skipped };
}

export interface AdvanceResult {
  due: number;
  exited: number;
  skipped: number;
  details: Array<{ contactId: string; to: string; reason: string; nextSendAt: string | null; nextEmailOrder: number }>;
}

/**
 * Check every active RecipientState whose nextSendAt is due, WITHOUT moving
 * anyone past their due email: for each contact re-check exits /
 * suppression / cap / conflict. Exits and blocks are recorded terminally;
 * contacts that pass stay active at the same nextEmailOrder and are
 * reported as due (details to 'due') — the sequence runner then sends
 * each due step automatically and recordStepSent() (below) moves the
 * contact to the following step. Advance never skips a due email.
 */
export async function advanceSequence(
  workspaceId: string,
  draftId: string,
  now: Date = new Date(),
): Promise<AdvanceResult> {
  const states = await db.recipientState.findMany({
    where: { workspaceId, draftId, status: 'active', nextSendAt: { lte: now } },
    include: { contact: { select: { email: true } } },
  });
  const result: AdvanceResult = { due: 0, exited: 0, skipped: 0, details: [] };
  for (const st of states) {
    const since = st.firstSentAt || st.lastSentAt || now;
    const guard = await guardNextSend(workspaceId, draftId, st.contactId, st.contact?.email || null, since, now);
    const at = now.toISOString();
    if (guard.exitStatus) {
      await db.recipientState.update({
        where: { id: st.id },
        data: { status: guard.exitStatus, nextSendAt: null, history: toJson(historyAppend(st.history, { at, from: 'active', to: guard.exitStatus, reason: guard.reason })) },
      });
      result.exited++;
      result.details.push({ contactId: st.contactId, to: guard.exitStatus, reason: guard.reason || '', nextSendAt: null, nextEmailOrder: st.nextEmailOrder });
      continue;
    }
    if (!guard.allowed) {
      const skippedStatus = guard.reason?.includes('Conflict rule') ? 'skipped_conflict' : guard.reason?.includes('Frequency cap') ? 'skipped_frequency_cap' : 'skipped_deadline';
      await db.recipientState.update({
        where: { id: st.id },
        data: { status: skippedStatus, nextSendAt: null, history: toJson(historyAppend(st.history, { at, from: 'active', to: skippedStatus, reason: guard.reason })) },
      });
      result.skipped++;
      result.details.push({ contactId: st.contactId, to: skippedStatus, reason: guard.reason || '', nextSendAt: null, nextEmailOrder: st.nextEmailOrder });
      continue;
    }
    result.due++;
    result.details.push({ contactId: st.contactId, to: 'due', reason: `Email ${st.nextEmailOrder} is due and passed all guards.`, nextSendAt: st.nextSendAt?.toISOString() || null, nextEmailOrder: st.nextEmailOrder });
  }
  return result;
}

/**
 * Record that a contact's due email was sent (by the sequence runner) and
 * move them to the following step, timed per person from firstSentAt.
 * Returns the new state summary.
 */
export async function recordStepSent(
  workspaceId: string,
  stateId: string,
  sequence: ValidatedSequence,
  sentAt: Date = new Date(),
): Promise<{ status: string; nextEmailOrder: number; nextSendAt: string | null }> {
  const st = await db.recipientState.findFirst({ where: { id: stateId, workspaceId }, include: { contact: { select: { email: true } } } });
  if (!st) throw new SequenceError('RecipientState not found.', 404);
  if (st.status !== 'active') throw new SequenceError(`RecipientState is ${st.status}, not active.`, 400);
  if (!st.firstSentAt) throw new SequenceError('RecipientState has no firstSentAt to time later emails from.', 400);
  const perPerson = scheduleForPerson(st.firstSentAt, sequence);
  const following = perPerson.find((p) => p.order === st.nextEmailOrder + 1);
  const emails = await db.campaignEmail.findMany({ where: { workspaceId, draftId: st.draftId, kind: 'scheduled' }, orderBy: { order: 'asc' }, select: { id: true, order: true } });
  const at = sentAt.toISOString();
  if (!following || !following.scheduledAtUtc) {
    const done = !following ? 'completed' : 'skipped_deadline';
    await db.recipientState.update({
      where: { id: st.id },
      data: {
        status: done,
        nextSendAt: null,
        nextEmailOrder: sequence.count + 1,
        lastSentAt: sentAt,
        history: toJson(historyAppend(st.history, { at, from: 'active', to: done, reason: following?.blockedReason || 'No further emails in the sequence.' })),
      },
    });
    return { status: done, nextEmailOrder: sequence.count + 1, nextSendAt: null };
  }
  const nextEmail = emails.find((e) => e.order === st.nextEmailOrder + 1) || null;
  await db.recipientState.update({
    where: { id: st.id },
    data: {
      status: 'active',
      nextEmailOrder: st.nextEmailOrder + 1,
      nextSendAt: new Date(following.scheduledAtUtc),
      currentEmailId: nextEmail?.id || null,
      lastSentAt: sentAt,
      history: toJson(historyAppend(st.history, { at, from: 'active', to: 'active', reason: `Email ${st.nextEmailOrder} sent; Email ${st.nextEmailOrder + 1} due ${following.scheduledAtUtc}.` })),
    },
  });
  return { status: 'active', nextEmailOrder: st.nextEmailOrder + 1, nextSendAt: following.scheduledAtUtc };
}
