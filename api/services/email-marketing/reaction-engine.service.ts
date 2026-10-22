/**
 * Create-with-AI Milestone 5 — Reaction engine (spec §10 + §10.1 + §18).
 *
 * Rules live in ReactionRule rows (one per source scheduled email, priority
 * ordered). Evaluation priority, per spec: always-on exits first (they are
 * NOT rows — reply/book/unsubscribe stop immediately, bounce/complaint
 * suppress globally; the sequence guards enforce them), then click rules,
 * then NOT_CLICKED and CLICKED_NOT_REPLIED, then NOT_OPENED.
 *
 * Two conditions from the spec are deliberately NOT creatable here, and
 * validation rejects them with plain-words reasons:
 * - OPENED_NOT_CLICKED: opens cannot be attributed per email under
 *   Gmail-only app tracking (the open pixel is campaign-level), and the
 *   recorded §22 default 17 says to disable it when the provider cannot
 *   distinguish machine opens. NOT_CLICKED is the reliable replacement
 *   (it works for everyone, opened or not).
 * - CLICKED_NOT_ACTED: booking events do not exist (no Appointment event
 *   is emitted on booking). CLICKED_NOT_REPLIED is the reply-tracked
 *   cousin that B3 uses (click + no reply within N days → alert).
 * Machine opens therefore never trigger OPENED_NOT_CLICKED (it does not
 * exist) or NOT_OPENED (NOT_OPENED means no open events at all in the
 * window, and a machine-opened email HAS an open event).
 *
 * Opens are campaign-level by spec §10.1's own definition ("no open events
 * at all"): NOT_OPENED(source) = no OPENED event for this contact in this
 * campaign inside [sentAt(source), sentAt(source) + W]. Clicks ARE
 * per-email: signed tracking tokens carry the CampaignEmail id (M5), UTM
 * utm_content carries the sequence order, and tokenless worker links
 * (Email 1 campaign sends) attribute to order 1.
 *
 * State lives on RecipientState.signals (Json):
 * - firedRuleIds: string[] — rules that already fired for this contact
 *   (each rule fires at most once). divertedSources: number[] — sources
 *   with a diverting rule fired (send_reaction, resend, stop); no other
 *   diverting rule fires for them, but notify/tag rules still may.
 * - evaluatedSources: number[] — window sources fully evaluated (so the
 *   default path is not re-evaluated every tick).
 * - processedClickEventIds: string[] — clicks already checked for rules
 *   (first click per link only).
 * - sentEmailIds: string[] — reaction/resend emails already sent to this
 *   contact (no email twice, except an explicit resend action, which is
 *   allowed once per rule via firedRuleIds).
 * - reactionPending: { emailId, ruleId, sourceOrder, sendAt, subject? } |
 *   null — a reaction send the tick owns (the sequence runner skips these
 *   states). sequenceResume: the sequence position saved when a reaction
 *   preempts it, restored after the reaction send.
 * - reactionOnly: true for single-email campaigns with rules (M4 enroll).
 *
 * Caps (spec §10.1): at most 8 emails per contact per campaign; at least
 * 24h between emails except a click reaction sent after its delay D; the
 * cross-campaign frequency cap (3/7 days) and the conflict rule come from
 * guardNextSend. Reaction sends respect the sequence deadline and re-check
 * exits + suppression immediately before sending (spec §18).
 */

import { db } from '../../../infrastructure/database/client.js';
import {
  detectExitSignals,
  exitStatusFor,
  guardNextSend,
  FREQUENCY_CAP_PER_7_DAYS,
  type ValidatedSequence,
} from './sequence.service.js';
import { renderFinalHtml } from './send-orchestration.service.js';

export const REACTION_CONDITIONS = [
  'NOT_OPENED',
  'NOT_CLICKED',
  'CLICKED',
  'CLICKED_LINK',
  'CLICKED_NOT_REPLIED',
] as const;
export type ReactionCondition = (typeof REACTION_CONDITIONS)[number];

export const REACTION_ACTIONS = [
  'send_reaction',
  'send_next',
  'resend',
  'notify',
  'tag',
  'stop',
] as const;
export type ReactionAction = (typeof REACTION_ACTIONS)[number];

/** Conditions the spec names but this build refuses, with plain reasons. */
export const UNAVAILABLE_CONDITIONS: Record<string, string> = {
  OPENED_NOT_CLICKED:
    'Open-based rules are not offered: opens cannot be attributed to one email under Gmail-only tracking (the open pixel is campaign-level), so use NOT_CLICKED instead — it works for everyone.',
  CLICKED_NOT_ACTED:
    'Booking-based rules are not offered: the platform does not emit booking events, so use CLICKED_NOT_REPLIED (click + no reply within N days) instead.',
};

export const DEFAULT_WINDOW_HOURS = 72;
export const DEFAULT_CLICK_DELAY_MINUTES = 60;
export const DEFAULT_NO_REPLY_DAYS = 3;
export const MAX_EMAILS_PER_CONTACT_PER_CAMPAIGN = 8;
export const MIN_GAP_HOURS = 24;

export interface ReactionRuleInput {
  sourceOrder: number;
  condition: string;
  conditionParams?: Record<string, unknown>;
  action: string;
  actionParams?: Record<string, unknown>;
  decisionWindowHours?: number;
  delayMinutes?: number;
  readback?: string;
}

export interface ReactionRuleRow extends ReactionRuleInput {
  id: string;
  priority: number;
}

/** Priority tier: lower evaluates first (spec §10.1). */
export function conditionTier(condition: string): number {
  if (condition === 'CLICKED' || condition === 'CLICKED_LINK') return 1;
  if (condition === 'NOT_CLICKED' || condition === 'CLICKED_NOT_REPLIED') return 2;
  if (condition === 'NOT_OPENED') return 3;
  return 9;
}

/**
 * Validate a rule set before it is saved. Returns the first problem in
 * plain words, or null when the set is valid. Priority is assigned by
 * orderRulesByPriority, not by the caller.
 */
export function validateReactionRules(
  rules: ReactionRuleInput[],
  sequenceCount: number,
): string | null {
  for (const r of rules) {
    if (UNAVAILABLE_CONDITIONS[r.condition]) return UNAVAILABLE_CONDITIONS[r.condition];
    if (!(REACTION_CONDITIONS as readonly string[]).includes(r.condition)) {
      return `Unknown reaction condition "${r.condition}".`;
    }
    if (!(REACTION_ACTIONS as readonly string[]).includes(r.action)) {
      return `Unknown reaction action "${r.action}".`;
    }
    if (!Number.isInteger(r.sourceOrder) || r.sourceOrder < 1 || r.sourceOrder > sequenceCount) {
      return `Reaction source email ${r.sourceOrder} is outside the sequence (1–${sequenceCount}).`;
    }
    if (r.action === 'resend' && !String(r.actionParams?.newSubject || '').trim()) {
      return `A resend rule needs a new subject line — resending with the same subject would look like a duplicate.`;
    }
    if (r.action === 'send_reaction' && !String(r.actionParams?.emailPurpose || '').trim()) {
      return `A reaction-email rule needs to say what that email should say and do.`;
    }
    if (r.action === 'tag' && !String(r.actionParams?.tagName || '').trim()) {
      return `A tag rule needs a tag name.`;
    }
    if (r.condition === 'CLICKED_LINK' && !String(r.conditionParams?.link || '').trim()) {
      return `A per-link click rule needs to say which link it watches.`;
    }
    if (r.decisionWindowHours !== undefined && (!Number.isFinite(r.decisionWindowHours) || r.decisionWindowHours < 1 || r.decisionWindowHours > 168)) {
      return `A decision window must be between 1 and 168 hours (1 week).`;
    }
    if (r.delayMinutes !== undefined && (!Number.isFinite(r.delayMinutes) || r.delayMinutes < 0 || r.delayMinutes > 10080)) {
      return `A reaction delay must be between 0 and 10080 minutes (1 week).`;
    }
  }
  return null;
}

/** Stable priority sort: click rules, then NOT_CLICKED/NO_REPLY, then NOT_OPENED. */
export function orderRulesByPriority(rules: ReactionRuleInput[]): ReactionRuleInput[] {
  return rules
    .map((r, i) => ({ r, i }))
    .sort((a, b) => conditionTier(a.r.condition) - conditionTier(b.r.condition) || a.i - b.i)
    .map(({ r }) => r);
}

// ── Assembly from the Phase 5 checklist (lenient, like M4's sequence assembly) ──

function firstInt(text: string): number | null {
  const m = String(text || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function wordToNumber(word: string): number | null {
  const map: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 };
  return map[word.toLowerCase()] ?? null;
}

/** Email numbers named in a fact ("email 2", "the second email", "emails 1 and 3"). */
export function emailsNamedIn(text: string): number[] {
  const found = new Set<number>();
  for (const m of String(text || '').matchAll(/email\s+(\d+)/gi)) found.add(parseInt(m[1], 10));
  for (const m of String(text || '').matchAll(/\b(first|second|third|fourth|fifth|sixth)\s+email\b/gi)) {
    const n = wordToNumber(m[1]);
    if (n) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

function daysIn(text: string, fallback: number): number {
  const m = String(text || '').match(/(\d+)\s*days?/i);
  return m ? parseInt(m[1], 10) : fallback;
}

function hoursIn(text: string, fallback: number): number {
  const m = String(text || '').match(/(\d+)\s*hours?/i);
  return m ? parseInt(m[1], 10) : fallback;
}

function saysNothing(text: string): boolean {
  return /\b(nothing|skip|leave (them|it)|do nothing|no follow)/i.test(String(text || ''));
}

export interface AssembledReactions {
  rules: ReactionRuleInput[];
  readback: string;
  skipped: string[];
  plannedEmails: Array<{ purpose: string; facts: string[] }>;
}

/**
 * Assemble reaction rules from the Phase 5 checklist facts. Lenient by
 * design (mirrors M4's sequence assembly): missing data skips that rule
 * with a note, never fails. Only truly contradictory data fails — and
 * since facts are free text, the only hard failure is a rule set that
 * fails validateReactionRules for a reason assembly cannot soften (an
 * unavailable condition is softened to a skip, never an error).
 */
export function assembleReactionsFromChecklist(
  items: Array<Record<string, unknown>>,
  sequenceCount: number,
): { ok: true; assembled: AssembledReactions } | { ok: false; error: string } {
  const byId = new Map<string, Record<string, unknown>>();
  for (const it of items) byId.set(String(it.id || ''), it);
  const factOf = (id: string): string => String(byId.get(id)?.fact || byId.get(id)?.userWords || '');
  const statusOf = (id: string): string => String(byId.get(id)?.status || 'missing');

  const rules: ReactionRuleInput[] = [];
  const skipped: string[] = [];
  const plannedEmails: Array<{ purpose: string; facts: string[] }> = [];

  // Reaction email jobs: numbered purposes (+ facts) from the jobs item.
  const jobsFact = factOf('reaction_jobs');
  if (jobsFact && statusOf('reaction_jobs') === 'complete') {
    const parts = jobsFact.split(/\n|;\s*(?=\d+\.)/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      const purpose = p.replace(/^\d+[\.\)]\s*/, '').trim();
      if (purpose) plannedEmails.push({ purpose, facts: [purpose] });
    }
    if (plannedEmails.length === 0 && jobsFact.trim()) plannedEmails.push({ purpose: jobsFact.trim(), facts: [jobsFact.trim()] });
  }

  const pushRule = (rule: ReactionRuleInput) => {
    const targets = rule.sourceOrder > 0 ? [rule.sourceOrder] : [1];
    for (const order of targets) {
      if (order < 1 || order > sequenceCount) {
        skipped.push(`Rule for Email ${order} skipped — the sequence has ${sequenceCount} email${sequenceCount === 1 ? '' : 's'}.`);
        continue;
      }
      rules.push({ ...rule, sourceOrder: order });
    }
  };

  // People who do not open → next email, resend, or nothing.
  const noOpen = factOf('no_open');
  if (noOpen && statusOf('no_open') === 'complete' && !saysNothing(noOpen)) {
    const named = emailsNamedIn(noOpen);
    const windowDays = daysIn(noOpen, 3);
    if (/resend/i.test(noOpen)) {
      const subj = (noOpen.match(/subject[:\s]+["“]([^"”]+)["”]/i) || [])[1] || '';
      if (subj) {
        pushRule({ sourceOrder: named[0] || 1, condition: 'NOT_OPENED', action: 'resend', actionParams: { newSubject: subj }, decisionWindowHours: windowDays * 24, readback: '' });
      } else {
        skipped.push('Non-opener resend skipped — no new subject line was given (resending with the same subject would look like a duplicate).');
      }
    } else {
      pushRule({ sourceOrder: named[0] || 1, condition: 'NOT_OPENED', action: 'send_next', decisionWindowHours: windowDays * 24, readback: '' });
    }
  }

  // People who open but do not click → recommended skip (see header note).
  // An explicit open-only rule is never created; the readback says so.
  const openNoClick = factOf('open_no_click');
  if (openNoClick && statusOf('open_no_click') === 'complete' && !saysNothing(openNoClick)) {
    skipped.push('Open-but-no-click rule not created — open-based rules are not offered (opens cannot be attributed to one email); those readers are covered by the NOT_CLICKED rule instead.');
  }

  // People who click → reaction email, alert, tag, or nothing.
  const clicked = factOf('clicked');
  if (clicked && statusOf('clicked') === 'complete' && !saysNothing(clicked)) {
    const named = emailsNamedIn(clicked);
    const delayH = hoursIn(clicked, 1);
    const linkMatch = (clicked.match(/link[:\s]+["“]?([^"”\n,]+)["”]?/i) || [])[1]?.trim();
    if (/alert|notify|tell me|let me know/i.test(clicked)) {
      pushRule({ sourceOrder: named[0] || 1, condition: linkMatch ? 'CLICKED_LINK' : 'CLICKED', conditionParams: linkMatch ? { link: linkMatch } : {}, action: 'notify', delayMinutes: delayH * 60, readback: '' });
    } else if (/tag/i.test(clicked)) {
      const tagName = (clicked.match(/tag(?:ged)?(?: as| with)?\s+["“]?([A-Za-z0-9 _-]+)["”]?/i) || [])[1]?.trim() || 'clicked';
      pushRule({ sourceOrder: named[0] || 1, condition: linkMatch ? 'CLICKED_LINK' : 'CLICKED', conditionParams: linkMatch ? { link: linkMatch } : {}, action: 'tag', actionParams: { tagName }, delayMinutes: delayH * 60, readback: '' });
    } else {
      const purpose = plannedEmails[0]?.purpose || clicked.trim();
      pushRule({ sourceOrder: named[0] || 1, condition: linkMatch ? 'CLICKED_LINK' : 'CLICKED', conditionParams: linkMatch ? { link: linkMatch } : {}, action: 'send_reaction', actionParams: { emailPurpose: purpose, emailFacts: plannedEmails[0]?.facts || [clicked.trim()] }, delayMinutes: delayH * 60, readback: '' });
    }
  }

  // People who click but do not reply within N days → alert (B3).
  const noReply = factOf('clicked_no_reply');
  if (noReply && statusOf('clicked_no_reply') === 'complete' && !saysNothing(noReply)) {
    const named = emailsNamedIn(noReply);
    const days = daysIn(noReply, DEFAULT_NO_REPLY_DAYS);
    pushRule({ sourceOrder: named[0] || 1, condition: 'CLICKED_NOT_REPLIED', conditionParams: { days }, action: /nothing|skip/i.test(noReply) ? 'send_next' : 'notify', readback: '' });
  }

  const ordered = orderRulesByPriority(rules);
  const withPriority = ordered.map((r, i) => ({ ...r, readback: ruleReadback(r, i) }));
  const validation = validateReactionRules(withPriority, sequenceCount);
  if (validation) return { ok: false, error: validation };
  return {
    ok: true,
    assembled: {
      rules: withPriority,
      readback: reactionsReadback(withPriority, skipped),
      skipped,
      plannedEmails,
    },
  };
}

function emailName(order: number): string {
  return `Email ${order}`;
}

function ruleReadback(r: ReactionRuleInput, _index: number): string {
  const src = emailName(r.sourceOrder);
  const windowDays = Math.round((r.decisionWindowHours ?? DEFAULT_WINDOW_HOURS) / 24);
  const delayH = Math.round((r.delayMinutes ?? DEFAULT_CLICK_DELAY_MINUTES) / 60);
  const actionText =
    r.action === 'send_next'
      ? `they get the next scheduled email`
      : r.action === 'send_reaction'
        ? `they get "${String(r.actionParams?.emailPurpose || 'a follow-up email')}"`
        : r.action === 'resend'
          ? `${src} is sent again with the subject "${String(r.actionParams?.newSubject || '')}"`
          : r.action === 'notify'
            ? `you get an alert`
            : r.action === 'tag'
              ? `they get tagged "${String(r.actionParams?.tagName || '')}"`
              : `they stop receiving this campaign`;
  switch (r.condition) {
    case 'NOT_OPENED':
      return `If someone has not opened ${src} after ${windowDays} day${windowDays === 1 ? '' : 's'}, ${actionText}.`;
    case 'NOT_CLICKED':
      return `If someone has not clicked ${src} after ${windowDays} day${windowDays === 1 ? '' : 's'}, ${actionText}.`;
    case 'CLICKED':
      return `If someone clicks ${src}, ${actionText}${delayH ? ` ${delayH} hour${delayH === 1 ? '' : 's'} later` : ''}.`;
    case 'CLICKED_LINK':
      return `If someone clicks the link "${String(r.conditionParams?.link || '')}" in ${src}, ${actionText}${delayH ? ` ${delayH} hour${delayH === 1 ? '' : 's'} later` : ''}.`;
    case 'CLICKED_NOT_REPLIED':
      return `If someone clicks ${src} and has not replied after ${Number(r.conditionParams?.days ?? DEFAULT_NO_REPLY_DAYS)} day${Number(r.conditionParams?.days ?? DEFAULT_NO_REPLY_DAYS) === 1 ? '' : 's'}, ${actionText}.`;
    default:
      return `${r.condition} on ${src}: ${actionText}.`;
  }
}

/** Plain-language readback for the whole rule set + always-on exits. */
export function reactionsReadback(rules: ReactionRuleInput[], skipped: string[]): string {
  const parts = rules.map((r) => ruleReadback(r, 0));
  if (parts.length === 0) parts.push('No reaction rules — everyone follows the scheduled emails.');
  parts.push('Anyone who replies, books, or unsubscribes stops receiving emails from this campaign immediately. Anyone who bounces is suppressed from all campaigns.');
  for (const s of skipped) parts.push(`Note: ${s}`);
  return parts.join(' ');
}

// ── Click attribution (M5) ────────────────────────────────────────────────────

export interface AttributedClick {
  eventId: string;
  emailId: string | null;
  order: number | null;
  linkUrl: string | null;
  at: Date;
  bot: boolean;
}

/**
 * Attribute a CLICKED EmailEvent to a source email. Order of evidence:
 * signed token email id (M5 sends), UTM utm_content order (renderFinalHtml
 * sends), tokenless worker link → order 1 (Email 1 campaign sends only).
 */
export function attributeClick(
  event: { id: string; linkUrl: string | null; metadata: unknown; occurredAt: Date; isBotSuspected: boolean },
  emails: Array<{ id: string; order: number }>,
): AttributedClick {
  const meta = (event.metadata || {}) as Record<string, unknown>;
  const tokenEmailId = typeof meta.emailId === 'string' && meta.emailId !== 'email' ? meta.emailId : null;
  let order: number | null = null;
  let emailId: string | null = null;
  if (tokenEmailId) {
    const hit = emails.find((e) => e.id === tokenEmailId);
    if (hit) {
      emailId = hit.id;
      order = hit.order;
    }
  }
  if (order === null && event.linkUrl) {
    try {
      const utm = new URL(event.linkUrl).searchParams.get('utm_content');
      const n = utm ? parseInt(utm, 10) : NaN;
      if (Number.isInteger(n)) {
        const hit = emails.find((e) => e.order === n);
        if (hit) {
          order = hit.order;
          emailId = hit.id;
        }
      }
    } catch {
      /* non-URL link — fall through to tokenless rule */
    }
  }
  if (order === null) {
    const first = emails.find((e) => e.order === 1);
    if (first) {
      order = 1;
      emailId = first.id;
    }
  }
  return { eventId: event.id, emailId, order, linkUrl: event.linkUrl, at: event.occurredAt, bot: !!event.isBotSuspected };
}

// ── Signal loading (DB) ───────────────────────────────────────────────────────

export interface SentEmailRecord {
  emailId: string;
  order: number;
  kind: 'scheduled' | 'reaction' | 'resend';
  sentAt: Date;
}

export interface ContactSignalSet {
  sent: SentEmailRecord[];
  clicks: AttributedClick[];
  opens: Date[];
  replied: boolean;
}

/** Load everything the engine needs for one contact in one draft. */
export async function loadContactSignals(
  workspaceId: string,
  draftId: string,
  contactId: string,
  campaignId: string | null,
  emails: Array<{ id: string; order: number; kind: string }>,
): Promise<ContactSignalSet> {
  const sent: SentEmailRecord[] = [];
  if (campaignId) {
    const recipients = await db.campaignRecipient.findMany({
      where: { campaignId, contactId, status: 'SENT', sentAt: { not: null } },
      select: { sentAt: true },
    });
    const first = emails.find((e) => e.order === 1);
    for (const r of recipients) {
      if (r.sentAt && first) sent.push({ emailId: first.id, order: 1, kind: 'scheduled', sentAt: r.sentAt });
    }
  }
  const stepEvents = campaignId
    ? await db.emailEvent.findMany({
        where: { workspaceId, contactId, campaignId, eventType: 'SENT' },
        select: { metadata: true, occurredAt: true },
      })
    : [];
  for (const e of stepEvents) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    if (typeof meta.sequenceOrder === 'number') {
      const hit = emails.find((x) => x.order === meta.sequenceOrder);
      if (hit && !sent.some((s) => s.emailId === hit.id)) {
        sent.push({ emailId: hit.id, order: hit.order, kind: 'scheduled', sentAt: e.occurredAt });
      }
    }
    if (typeof meta.reactionEmailId === 'string') {
      const hit = emails.find((x) => x.id === meta.reactionEmailId);
      if (hit && !sent.some((s) => s.emailId === hit.id)) {
        sent.push({ emailId: hit.id, order: hit.order, kind: 'reaction', sentAt: e.occurredAt });
      }
    }
  }
  sent.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  const clickEvents = campaignId
    ? await db.emailEvent.findMany({
        where: { workspaceId, contactId, campaignId, eventType: 'CLICKED' },
        select: { id: true, linkUrl: true, metadata: true, occurredAt: true, isBotSuspected: true },
        orderBy: { occurredAt: 'asc' },
      })
    : [];
  const clicks = clickEvents.map((e) =>
    attributeClick(
      { id: e.id, linkUrl: e.linkUrl, metadata: e.metadata, occurredAt: e.occurredAt, isBotSuspected: e.isBotSuspected },
      emails,
    ),
  );
  const openEvents = campaignId
    ? await db.emailEvent.findMany({
        where: { workspaceId, contactId, campaignId, eventType: 'OPENED' },
        select: { occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      })
    : [];
  // Reply signal: any non-auto-reply inbox message from this contact, or a
  // manual mark-as-replied (exited_reply state), at any time in this draft.
  const state = await db.recipientState.findFirst({ where: { workspaceId, draftId, contactId }, select: { status: true } });
  const exitSignals = await detectExitSignals(workspaceId, contactId, new Date(0)).catch(() => null);
  const replied = state?.status === 'exited_reply' || !!exitSignals?.replied;
  return { sent, clicks, opens: openEvents.map((o) => o.occurredAt), replied };
}

// ── Pure evaluation ───────────────────────────────────────────────────────────

/** Does the contact match a window condition for one source email? */
export function matchesWindowCondition(
  condition: string,
  signals: ContactSignalSet,
  source: SentEmailRecord,
  windowEnd: Date,
): boolean {
  if (condition === 'NOT_CLICKED') {
    return !signals.clicks.some((c) => !c.bot && c.order === source.order && c.at.getTime() <= windowEnd.getTime());
  }
  if (condition === 'NOT_OPENED') {
    return !signals.opens.some((o) => o.getTime() >= source.sentAt.getTime() && o.getTime() <= windowEnd.getTime());
  }
  return false;
}

export interface SimEvent {
  at: Date;
  type: 'sent' | 'clicked' | 'opened' | 'replied' | 'booked' | 'unsubscribed' | 'bounced' | 'complained';
  emailOrder?: number;
  link?: string;
  bot?: boolean;
}

export interface SimStep {
  at: string;
  what: string;
  ruleId?: string;
  reason?: string;
}

/**
 * Path simulator (spec §13): pure walk of a scenario timeline through a
 * rule set. Mirrors the live engine's decisions (priority, one path per
 * source, first click per link, caps, gaps, exits) so the simulator and
 * the live behavior agree. Scenario events use email orders, not ids.
 */
export function simulatePath(args: {
  rules: ReactionRuleInput[];
  sequenceCount: number;
  events: SimEvent[];
  windowHoursDefault?: number;
  /** Simulation end time. Defaults to the last event's time. */
  horizon?: Date;
}): { steps: SimStep[]; finalState: string } {
  const rules = orderRulesByPriority(args.rules);
  const steps: SimStep[] = [];
  const sent = new Map<number, Date>();
  const firedRuleIds = new Set<string>();
  const divertedSources = new Set<number>();
  const clickedLinks = new Set<string>();
  const clicks: Array<{ order: number; at: Date; link?: string }> = [];
  const opens: Date[] = [];
  let sentCount = 0;
  let lastSentAt: Date | null = null;
  let stopped = false;
  let state = 'active';
  const pendingSendAts: Date[] = [];

  const byTime = [...args.events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const windowEndFor = (order: number): Date | null => {
    const s = sent.get(order);
    if (!s) return null;
    const rule = rules.find((r) => r.sourceOrder === order);
    const hours = rule?.decisionWindowHours ?? args.windowHoursDefault ?? DEFAULT_WINDOW_HOURS;
    return new Date(s.getTime() + hours * 3600_000);
  };
  const isDiverting = (r: ReactionRuleInput) => r.action === 'send_reaction' || r.action === 'resend' || r.action === 'stop';

  const fireRule = (rule: ReactionRuleInput & { id?: string }, at: Date, why: string) => {
    firedRuleIds.add(rule.id || `${rule.sourceOrder}:${rule.condition}:${rule.action}`);
    if (isDiverting(rule)) divertedSources.add(rule.sourceOrder);
    const actionText =
      rule.action === 'send_next'
        ? 'next scheduled email (default path continues)'
        : rule.action === 'send_reaction'
          ? `reaction email "${String(rule.actionParams?.emailPurpose || '')}"`
          : rule.action === 'resend'
            ? `resend of Email ${rule.sourceOrder} with new subject`
            : rule.action === 'notify'
              ? 'owner alert'
              : rule.action === 'tag'
                ? `tag "${String(rule.actionParams?.tagName || '')}"`
                : 'stop for this contact';
    steps.push({ at: at.toISOString(), what: `Rule fired: ${ruleReadback(rule, 0)}`, reason: why });
    if (rule.action === 'stop') {
      stopped = true;
      state = 'stopped';
      return;
    }
    if (rule.action === 'send_reaction' || rule.action === 'resend') {
      const delayMs = (rule.delayMinutes ?? DEFAULT_CLICK_DELAY_MINUTES) * 60_000;
      let sendAt = new Date(at.getTime() + delayMs);
      if (rule.condition === 'CLICKED' || rule.condition === 'CLICKED_LINK') {
        // Click reactions are exempt from the 24h gap (spec §10.1).
      } else if (lastSentAt && sendAt.getTime() < lastSentAt.getTime() + MIN_GAP_HOURS * 3600_000) {
        sendAt = new Date(lastSentAt.getTime() + MIN_GAP_HOURS * 3600_000);
      }
      if (sentCount >= MAX_EMAILS_PER_CONTACT_PER_CAMPAIGN) {
        steps.push({ at: at.toISOString(), what: 'Reaction send skipped: 8-email cap reached.', reason: 'cap' });
        return;
      }
      steps.push({ at: sendAt.toISOString(), what: `Sends ${actionText}.` });
      pendingSendAts.push(sendAt);
      sentCount += 1;
      lastSentAt = sendAt;
    } else if (rule.action === 'notify' || rule.action === 'tag') {
      steps.push({ at: at.toISOString(), what: `Executes ${actionText}.` });
    }
  };
  // Rules in the simulator carry no db ids; give each a stable key.
  const keyed = rules.map((r, i) => ({ ...r, id: `rule-${i}` }));

  for (const ev of byTime) {
    if (stopped) break;
    if (ev.type === 'sent' && ev.emailOrder) {
      sent.set(ev.emailOrder, ev.at);
      sentCount += 1;
      lastSentAt = ev.at;
      steps.push({ at: ev.at.toISOString(), what: `Email ${ev.emailOrder} sent.` });
      continue;
    }
    if (ev.type === 'replied' || ev.type === 'unsubscribed' || ev.type === 'bounced' || ev.type === 'complained' || ev.type === 'booked') {
      stopped = true;
      state = ev.type === 'replied' ? 'exited_reply' : ev.type === 'unsubscribed' ? 'exited_unsubscribed' : ev.type === 'bounced' ? 'exited_bounced' : ev.type === 'booked' ? 'exited_booked' : 'exited_complained';
      steps.push({ at: ev.at.toISOString(), what: `Exit: ${ev.type} — campaign stops for this contact.` });
      continue;
    }
    if (ev.type === 'opened') {
      opens.push(ev.at);
      continue;
    }
    if (ev.type === 'clicked' && ev.emailOrder && !ev.bot) {
      const linkKey = `${ev.emailOrder}:${ev.link || '*'}`;
      if (clickedLinks.has(linkKey)) continue; // first click per link only
      clickedLinks.add(linkKey);
      clicks.push({ order: ev.emailOrder, at: ev.at, link: ev.link });
      const candidates = keyed.filter(
        (r) =>
          r.sourceOrder === ev.emailOrder &&
          !firedRuleIds.has(r.id) &&
          !(isDiverting(r) && divertedSources.has(r.sourceOrder)) &&
          (r.condition === 'CLICKED' || (r.condition === 'CLICKED_LINK' && ev.link && ev.link.includes(String(r.conditionParams?.link || '')))),
      );
      if (candidates.length > 0) fireRule(candidates[0], ev.at, 'click trigger');
      continue;
    }
  }

  if (!stopped) {
    const horizon = args.horizon || (byTime.length ? byTime[byTime.length - 1].at : new Date());
    // No-reply triggers (B3): click + N days with no reply after the click.
    // Non-diverting, so they fire even when a click rule already fired.
    for (const rule of keyed.filter((r) => r.condition === 'CLICKED_NOT_REPLIED')) {
      if (firedRuleIds.has(rule.id)) continue;
      const click = clicks.find((c) => c.order === rule.sourceOrder);
      if (!click) continue;
      const days = Number(rule.conditionParams?.days ?? DEFAULT_NO_REPLY_DAYS);
      const dueAt = new Date(click.at.getTime() + days * 86_400_000);
      if (horizon.getTime() < dueAt.getTime()) continue;
      const repliedAfter = byTime.some((e) => e.type === 'replied' && e.at.getTime() > click.at.getTime());
      if (repliedAfter) continue;
      fireRule(rule, dueAt, 'no-reply delay elapsed');
      if (stopped) break;
    }
    // Window triggers: only sources with NO fired rule (the fallback).
    if (!stopped) {
      for (const [order, sentAt] of [...sent.entries()].sort((a, b) => a[0] - b[0])) {
        const anyFired = keyed.some((r) => r.sourceOrder === order && firedRuleIds.has(r.id));
        if (anyFired) continue;
        const wEnd = windowEndFor(order);
        if (!wEnd || horizon.getTime() < wEnd.getTime()) continue;
        const clicked = clicks.some((c) => c.order === order && c.at.getTime() <= wEnd.getTime());
        const opened = opens.some((o) => o.getTime() >= sentAt.getTime() && o.getTime() <= wEnd.getTime());
        const candidates = keyed.filter((r) => r.sourceOrder === order && (r.condition === 'NOT_CLICKED' || r.condition === 'NOT_OPENED'));
        const notClicked = candidates.find((r) => r.condition === 'NOT_CLICKED');
        const notOpened = candidates.find((r) => r.condition === 'NOT_OPENED');
        if (!clicked && notClicked) fireRule(notClicked, wEnd, 'window end');
        else if (!opened && notOpened) fireRule(notOpened, wEnd, 'window end');
        else steps.push({ at: wEnd.toISOString(), what: `Window for Email ${order} ended — no rule matched; default path continues.` });
      }
    }
    // Completion (mirrors the live tick): every sequence email sent, every
    // source resolved (a rule fired, or its window ended), no reaction send
    // still scheduled past the horizon, and no no-reply alert still pending.
    // A pending no-reply blocks completion — completing early would silently
    // drop the alert, the same bug the live tick guards against.
    if (!stopped) {
      let resolved = true;
      for (let order = 1; order <= args.sequenceCount; order++) {
        if (!sent.has(order)) { resolved = false; break; }
        const anyFired = keyed.some((r) => r.sourceOrder === order && firedRuleIds.has(r.id));
        const wEnd = windowEndFor(order);
        const windowEnded = !!wEnd && horizon.getTime() >= wEnd.getTime();
        if (!anyFired && !windowEnded) { resolved = false; break; }
        const pendingNoReply = keyed.some((r) => r.condition === 'CLICKED_NOT_REPLIED' && r.sourceOrder === order && !firedRuleIds.has(r.id) && clicks.some((c) => c.order === order));
        if (pendingNoReply) { resolved = false; break; }
      }
      const pendingSend = pendingSendAts.some((d) => d.getTime() > horizon.getTime());
      if (resolved && !pendingSend) state = 'completed';
    }
  }
  return { steps, finalState: state };
}

/** Canonical simulator scenario names (spec §13: 7 scenarios). */
export const SIMULATOR_SCENARIOS = [
  'did_not_open',
  'opened_no_click',
  'clicked',
  'clicked_link',
  'clicked_not_replied',
  'replied',
  'bounced',
] as const;

/**
 * Event timelines for the canonical scenarios, relative to T0 (the source
 * email's send). The caller passes a horizon past the decision window for
 * window scenarios. Extra accepted names (booked, unsubscribed) share the
 * exit behavior of replied/bounced.
 */
export function buildScenarioEvents(
  scenario: string,
  opts: { clickLink?: string } = {},
): { events: SimEvent[]; horizon: Date } {
  const T0 = new Date('2026-10-01T08:00:00.000Z');
  const h = (n: number) => new Date(T0.getTime() + n * 3600_000);
  const d = (n: number) => new Date(T0.getTime() + n * 86_400_000);
  const sent = { at: T0, type: 'sent' as const, emailOrder: 1 };
  const wrap = (events: SimEvent[], horizonDays: number) => ({ events, horizon: d(horizonDays) });
  switch (scenario) {
    case 'did_not_open':
      return wrap([sent], 4);
    case 'opened_no_click':
      return wrap([sent, { at: h(1), type: 'opened', emailOrder: 1 }], 4);
    case 'clicked':
      return wrap([sent, { at: h(2), type: 'clicked', emailOrder: 1, link: 'https://example.com/book' }], 8);
    case 'clicked_link':
      return wrap([sent, { at: h(2), type: 'clicked', emailOrder: 1, link: opts.clickLink || 'https://example.com/pricing' }], 8);
    case 'clicked_not_replied':
      return wrap([sent, { at: h(2), type: 'clicked', emailOrder: 1, link: 'https://example.com/book' }], 8);
    case 'replied':
      return wrap([sent, { at: d(1), type: 'replied', emailOrder: 1 }], 2);
    case 'booked':
      return wrap([sent, { at: d(2), type: 'booked', emailOrder: 1 }], 3);
    case 'unsubscribed':
      return wrap([sent, { at: d(1), type: 'unsubscribed', emailOrder: 1 }], 2);
    case 'bounced':
      return wrap([sent, { at: h(1), type: 'bounced', emailOrder: 1 }], 2);
    default:
      return wrap([sent], 4);
  }
}

// ── Tick: evaluate + send (DB) ────────────────────────────────────────────────

interface SignalsJson {
  /**
   * Rule ids that already fired for this contact (each rule fires at most
   * once per contact). Diverting rules (send_reaction, resend, stop) also
   * record their source in divertedSources: once a source is diverted, no
   * other DIVERTING rule fires for it — but non-diverting rules (notify,
   * tag) may still fire, which is how B3's click note + later no-reply
   * alert both happen for one contact. Window rules only evaluate sources
   * with no fired rule at all (they are the fallback).
   */
  firedRuleIds?: string[];
  divertedSources?: number[];
  evaluatedSources?: number[];
  processedClickEventIds?: string[];
  sentEmailIds?: string[];
  reactionPending?: {
    emailId: string;
    ruleId: string;
    sourceOrder: number;
    sendAt: string;
    subject?: string;
    isResend?: boolean;
    resendSourceOrder?: number;
  } | null;
  sequenceResume?: { nextEmailOrder: number; nextSendAt: string | null; currentEmailId: string | null } | null;
  reactionOnly?: boolean;
}

function sigOf(state: { signals: unknown }): SignalsJson {
  const s = (state.signals || {}) as SignalsJson;
  return {
    firedRuleIds: s.firedRuleIds || [],
    divertedSources: s.divertedSources || [],
    evaluatedSources: s.evaluatedSources || [],
    processedClickEventIds: s.processedClickEventIds || [],
    sentEmailIds: s.sentEmailIds || [],
    reactionPending: s.reactionPending || null,
    sequenceResume: s.sequenceResume || null,
    reactionOnly: s.reactionOnly,
  };
}

function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

function historyAppend(history: unknown, entry: Record<string, unknown>): unknown[] {
  const arr = Array.isArray(history) ? history : [];
  return [...arr, entry];
}

export interface ReactionSenderArgs {
  workspaceId: string;
  campaignId: string;
  email: { id: string; subjectVariants: unknown; subjectSelected: number | null; bodyHtml: string; bodyText: string };
  contact: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  html: string;
  text: string;
  subject: string;
  senderName: string;
}

export type ReactionSender = (args: ReactionSenderArgs) => Promise<{ messageId: string | null }>;

async function gmailReactionSender(args: ReactionSenderArgs): Promise<{ messageId: string | null }> {
  let gmailConn = await db.channelConnection.findFirst({
    where: { workspaceId: args.workspaceId, provider: 'gmail', isActive: true },
  }).catch(() => null);
  if (!gmailConn) {
    gmailConn = await db.channelConnection.findFirst({ where: { provider: 'gmail', isActive: true } }).catch(() => null);
  }
  if (!gmailConn) throw new Error('No active Gmail connection found for this workspace. A connected Gmail account is required to send.');
  const { sendGmailMessage } = await import('../channels/gmail.service.js');
  const result = await sendGmailMessage(gmailConn.id, args.contact.email, args.subject, args.text, undefined, args.html, args.senderName);
  return { messageId: result.messageId || null };
}

async function notifyOwner(
  workspaceId: string,
  draftId: string,
  contactEmail: string,
  message: string,
  senderName: string,
): Promise<void> {
  await db.notification.create({ data: { workspaceId, title: 'Email campaign reaction', body: message, type: 'campaign_reaction', link: undefined } }).catch(() => null);
  // Email via the Gmail channel (M5, Gmail-only): best-effort — a missing
  // connection must not break the reaction tick; the in-app alert stands.
  try {
    const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
    const snap = (draft?.profileSnapshot || {}) as Record<string, unknown>;
    const ownerEmail = String(snap.replyToEmail || '');
    if (!ownerEmail) return;
    let gmailConn = await db.channelConnection.findFirst({ where: { workspaceId, provider: 'gmail', isActive: true } }).catch(() => null);
    if (!gmailConn) gmailConn = await db.channelConnection.findFirst({ where: { provider: 'gmail', isActive: true } }).catch(() => null);
    if (!gmailConn) return;
    const { sendGmailMessage } = await import('../channels/gmail.service.js');
    await sendGmailMessage(gmailConn.id, ownerEmail, 'Email campaign reaction', message, undefined, `<p>${message}</p>`, senderName);
  } catch (err) {
    console.error('[ReactionEngine] Owner email alert failed:', (err as Error).message);
  }
}

async function tagContact(workspaceId: string, contactId: string, tagName: string): Promise<void> {
  const name = tagName.trim();
  if (!name) return;
  try {
    // The Tag row (workspace tag list) AND the contact's tagsJson array:
    // Contact has no relation to Tag — ContactDetail reads tagsJson, so
    // both writes are needed for the tag to actually show on the contact.
    await db.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {},
      create: { workspaceId, name },
    }).catch(() => null);
    const contact = await db.contact.findFirst({ where: { id: contactId }, select: { tagsJson: true } });
    if (!contact) return;
    let tags: string[] = [];
    try {
      const parsed = JSON.parse(contact.tagsJson || '[]');
      if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      tags = [];
    }
    if (!tags.includes(name)) {
      tags.push(name);
      await db.contact.update({ where: { id: contactId }, data: { tagsJson: JSON.stringify(tags) } });
    }
  } catch (err) {
    console.error('[ReactionEngine] Tag failed:', (err as Error).message);
  }
}

/**
 * Execute one reaction action for a contact. send_reaction/resend actions
 * schedule a reactionPending send (they go through the same guard + cap +
 * deadline checks at send time); notify/tag/stop execute immediately.
 * Returns a short description for the history trail.
 */
async function executeRuleAction(
  workspaceId: string,
  draftId: string,
  state: { id: string; contactId: string; signals: unknown; history: unknown },
  rule: ReactionRuleRow,
  signals: SignalsJson,
  now: Date,
  contact: { id: string; email: string },
  emails: Array<{ id: string; order: number; kind: string; bodyHtml: string; bodyText: string; subjectVariants: unknown; subjectSelected: number | null }>,
  isClickRule: boolean,
): Promise<string> {
  const firedRuleIds = [...new Set([...(signals.firedRuleIds || []), rule.id])];
  const isDiverting = rule.action === 'send_reaction' || rule.action === 'resend' || rule.action === 'stop';
  const divertedSources = isDiverting
    ? [...new Set([...(signals.divertedSources || []), rule.sourceOrder])]
    : [...(signals.divertedSources || [])];
  const base = { ...signals, firedRuleIds, divertedSources };
  const at = now.toISOString();
  if (rule.action === 'stop') {
    await db.recipientState.update({
      where: { id: state.id },
      data: { status: 'stopped', nextSendAt: null, signals: toJson(base), history: toJson(historyAppend(state.history, { at, from: 'active', to: 'stopped', reason: `Reaction rule stopped the campaign (source Email ${rule.sourceOrder}).` })) },
    });
    return 'stopped';
  }
  if (rule.action === 'notify') {
    await notifyOwner(workspaceId, draftId, contact.email, `Reaction: ${rule.readback || `rule for Email ${rule.sourceOrder}`}`, 'Stone AIO');
    await db.recipientState.update({
      where: { id: state.id },
      data: { signals: toJson(base), history: toJson(historyAppend(state.history, { at, from: 'active', to: 'active', reason: `Owner alert sent (rule for Email ${rule.sourceOrder}).` })) },
    });
    return 'owner alert sent';
  }
  if (rule.action === 'tag') {
    await tagContact(workspaceId, contact.id, String(rule.actionParams?.tagName || ''));
    await db.recipientState.update({
      where: { id: state.id },
      data: { signals: toJson(base), history: toJson(historyAppend(state.history, { at, from: 'active', to: 'active', reason: `Tagged "${String(rule.actionParams?.tagName || '')}" (rule for Email ${rule.sourceOrder}).` })) },
    });
    return 'tagged';
  }
  if (rule.action === 'send_next') {
    // Default path: nothing to schedule; the sequence runner proceeds.
    await db.recipientState.update({
      where: { id: state.id },
      data: { signals: toJson(base), history: toJson(historyAppend(state.history, { at, from: 'active', to: 'active', reason: `Reaction rule: default path continues (source Email ${rule.sourceOrder}).` })) },
    });
    return 'default path continues';
  }
  // send_reaction / resend: schedule the send (delay + gap rules applied).
  const delayMs = (rule.delayMinutes ?? DEFAULT_CLICK_DELAY_MINUTES) * 60_000;
  let sendAt = new Date(now.getTime() + delayMs);
  if (!isClickRule) {
    // 24h gap applies to window-triggered sends, not click reactions.
    const st = await db.recipientState.findFirst({ where: { id: state.id }, select: { lastSentAt: true } });
    if (st?.lastSentAt && sendAt.getTime() < st.lastSentAt.getTime() + MIN_GAP_HOURS * 3600_000) {
      sendAt = new Date(st.lastSentAt.getTime() + MIN_GAP_HOURS * 3600_000);
    }
  }
  const current = await db.recipientState.findFirst({ where: { id: state.id } });
  if (!current) return 'state vanished';
  const resume = signals.sequenceResume || {
    nextEmailOrder: current.nextEmailOrder,
    nextSendAt: current.nextSendAt?.toISOString() || null,
    currentEmailId: current.currentEmailId,
  };
  let pending: SignalsJson['reactionPending'];
  if (rule.action === 'resend') {
    const src = emails.find((e) => e.order === rule.sourceOrder);
    if (!src) return 'resend source email not found';
    pending = { emailId: src.id, ruleId: rule.id, sourceOrder: rule.sourceOrder, sendAt: sendAt.toISOString(), subject: String(rule.actionParams?.newSubject || ''), isResend: true, resendSourceOrder: rule.sourceOrder };
  } else {
    const target = emails.find((e) => e.kind === 'reaction' && String((e as unknown as Record<string, unknown>).purpose || '') === String(rule.actionParams?.emailPurpose || ''));
    const byPurpose = target || emails.find((e) => e.kind === 'reaction');
    if (!byPurpose) return 'reaction email not drafted yet';
    pending = { emailId: byPurpose.id, ruleId: rule.id, sourceOrder: rule.sourceOrder, sendAt: sendAt.toISOString(), isResend: false };
  }
  await db.recipientState.update({
    where: { id: state.id },
    data: {
      signals: toJson({ ...base, reactionPending: pending, sequenceResume: resume }),
      history: toJson(historyAppend(state.history, { at, from: 'active', to: 'active', reason: `Reaction send scheduled for ${sendAt.toISOString()} (rule for Email ${rule.sourceOrder}).` })),
    },
  });
  return `reaction send scheduled for ${sendAt.toISOString()}`;
}

/**
 * One tick of the reaction engine. Returns counts for observability.
 * Never throws for a single bad draft — it logs and continues.
 */
export async function processDueReactions(
  now: Date = new Date(),
  opts?: { sender?: ReactionSender },
): Promise<{ drafts: number; fired: number; sent: number; failed: number; exited: number; skipped: number }> {
  const sender = opts?.sender || gmailReactionSender;
  const totals = { drafts: 0, fired: 0, sent: 0, failed: 0, exited: 0, skipped: 0 };
  const draftsWithRules = await db.reactionRule.findMany({ select: { draftId: true }, distinct: ['draftId'] });
  for (const { draftId } of draftsWithRules) {
    try {
      const draft = await db.campaignDraft.findFirst({ where: { id: draftId }, include: { reactionRules: { orderBy: { priority: 'asc' } } } });
      if (!draft) continue;
      const sequence = (draft.sequence || {}) as unknown as ValidatedSequence & { count?: number };
      const emails = await db.campaignEmail.findMany({ where: { draftId, workspaceId: draft.workspaceId }, orderBy: { order: 'asc' } });
      const firstEmail = emails.find((e) => e.order === 1);
      if (!firstEmail?.campaignId) continue;
      const campaign = await db.campaign.findFirst({ where: { id: firstEmail.campaignId } });
      if (!campaign || campaign.status !== 'SENT') continue;
      totals.drafts += 1;
      const rules = (draft.reactionRules || []).map((r) => ({
        id: r.id,
        priority: r.priority,
        sourceOrder: r.sourceOrder,
        condition: r.condition,
        conditionParams: (r.conditionParams || {}) as Record<string, unknown>,
        action: r.action,
        actionParams: (r.actionParams || {}) as Record<string, unknown>,
        decisionWindowHours: r.decisionWindowHours,
        delayMinutes: r.delayMinutes,
        readback: r.readback,
      }));
      const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
      const senderName = String(snap.senderName || 'Stone AIO');
      const states = await db.recipientState.findMany({ where: { workspaceId: draft.workspaceId, draftId, status: 'active' }, include: { contact: { select: { email: true, firstName: true, lastName: true } } } });
      for (const st of states) {
        try {
          if (!st.contact?.email) continue;
          const signals = sigOf(st);
          // Exits first (spec §10.1 priority): a reply/book/unsubscribe
          // since the sequence started stops this contact immediately.
          const since = st.firstSentAt || st.lastSentAt || now;
          const exit = exitStatusFor(await detectExitSignals(draft.workspaceId, st.contactId, since));
          if (exit) {
            await db.recipientState.update({ where: { id: st.id }, data: { status: exit, nextSendAt: null, history: toJson(historyAppend(st.history, { at: now.toISOString(), from: 'active', to: exit, reason: 'Always-on exit detected by the reaction engine.' })) } });
            totals.exited += 1;
            continue;
          }
          const sig = await loadContactSignals(draft.workspaceId, draftId, st.contactId, campaign.id, emails.map((e) => ({ id: e.id, order: e.order, kind: e.kind })));

          // 1. Pending reaction sends due → send (guards re-checked).
          if (signals.reactionPending && new Date(signals.reactionPending.sendAt).getTime() <= now.getTime()) {
            const pending = signals.reactionPending;
            const target = emails.find((e) => e.id === pending.emailId);
            if (!target) {
              totals.skipped += 1;
            } else {
              const guard = await guardNextSend(draft.workspaceId, draftId, st.contactId, st.contact.email, since, now);
              const deadline = (sequence as { deadlineUtc?: string }).deadlineUtc ? new Date((sequence as { deadlineUtc: string }).deadlineUtc) : null;
              const sentCount = await db.emailEvent.count({ where: { workspaceId: draft.workspaceId, contactId: st.contactId, campaignId: campaign.id, eventType: 'SENT' } });
              const alreadySent = (signals.sentEmailIds || []).includes(target.id) && !pending.isResend;
              if (guard.exitStatus) {
                await db.recipientState.update({ where: { id: st.id }, data: { status: guard.exitStatus, nextSendAt: null, signals: toJson({ ...signals, reactionPending: null }), history: toJson(historyAppend(st.history, { at: now.toISOString(), from: 'active', to: guard.exitStatus, reason: guard.reason || '' })) } });
                totals.exited += 1;
              } else if (!guard.allowed || (deadline && now.getTime() > deadline.getTime()) || sentCount >= MAX_EMAILS_PER_CONTACT_PER_CAMPAIGN || alreadySent) {
                const reason = !guard.allowed ? guard.reason : deadline && now.getTime() > deadline.getTime() ? 'Past the sequence deadline.' : sentCount >= MAX_EMAILS_PER_CONTACT_PER_CAMPAIGN ? '8-email cap reached.' : 'Email already sent to this contact.';
                await db.recipientState.update({ where: { id: st.id }, data: { signals: toJson({ ...signals, reactionPending: null, sequenceResume: null }), nextSendAt: signals.sequenceResume?.nextSendAt ? new Date(signals.sequenceResume.nextSendAt) : st.nextSendAt, nextEmailOrder: signals.sequenceResume?.nextEmailOrder ?? st.nextEmailOrder, currentEmailId: signals.sequenceResume?.currentEmailId ?? st.currentEmailId, history: toJson(historyAppend(st.history, { at: now.toISOString(), from: 'active', to: 'active', reason: `Reaction send skipped: ${reason}` })) } });
                totals.skipped += 1;
              } else {
                try {
                  const subjects = (Array.isArray(target.subjectVariants) ? target.subjectVariants : []).filter((s): s is string => typeof s === 'string');
                  const subject = pending.subject || subjects[target.subjectSelected ?? 0] || `Email ${target.order}`;
                  const trackBase = `${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/email-marketing/track/click`;
                  const { html, text } = renderFinalHtml(draft.workspaceId, campaign.id, { bodyHtml: String(target.bodyHtml || ''), bodyText: String(target.bodyText || '') }, { businessName: String(snap.businessName || ''), physicalAddress: String(snap.physicalAddress || '') }, st.contactId, trackBase, { emailOrder: target.order, emailId: target.id });
                  const sent = await sender({ workspaceId: draft.workspaceId, campaignId: campaign.id, email: { id: target.id, subjectVariants: target.subjectVariants, subjectSelected: target.subjectSelected, bodyHtml: String(target.bodyHtml || ''), bodyText: String(target.bodyText || '') }, contact: { id: st.contactId, email: st.contact.email, firstName: st.contact.firstName, lastName: st.contact.lastName }, html, text, subject, senderName });
                  await db.emailEvent.create({ data: { workspaceId: draft.workspaceId, contactId: st.contactId, campaignId: campaign.id, eventType: 'SENT', metadata: JSON.parse(JSON.stringify({ reactionEmailId: pending.isResend ? undefined : target.id, resendOfOrder: pending.isResend ? pending.resendSourceOrder : undefined, ruleId: pending.ruleId, draftId, messageId: sent.messageId })) as never } });
                  await db.contact.updateMany({ where: { id: st.contactId, workspaceId: draft.workspaceId }, data: { totalEmailsReceived: { increment: 1 }, lastContactedAt: now } });
                  const restored = signals.sequenceResume;
                  await db.recipientState.update({
                    where: { id: st.id },
                    data: {
                      signals: toJson({ ...signals, reactionPending: null, sequenceResume: null, sentEmailIds: [...(signals.sentEmailIds || []), target.id] }),
                      lastSentAt: now,
                      nextSendAt: restored?.nextSendAt ? new Date(restored.nextSendAt) : null,
                      nextEmailOrder: restored?.nextEmailOrder ?? st.nextEmailOrder,
                      currentEmailId: restored?.currentEmailId ?? st.currentEmailId,
                      history: toJson(historyAppend(st.history, { at: now.toISOString(), from: 'active', to: 'active', reason: `Reaction email sent (rule ${pending.ruleId}).` })),
                    },
                  });
                  totals.sent += 1;
                } catch (err) {
                  console.error(`[ReactionEngine] Reaction send failed (draft ${draftId}, contact ${st.contactId}):`, (err as Error).message);
                  const cur = await db.recipientState.findFirst({ where: { id: st.id } });
                  if (cur && cur.status === 'active') {
                    const curSig = sigOf(cur);
                    await db.recipientState.update({ where: { id: cur.id }, data: { signals: toJson({ ...curSig, reactionPending: { ...pending, sendAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString() } }), history: toJson(historyAppend(cur.history, { at: now.toISOString(), from: 'active', to: 'active', reason: `Reaction send failed, retry in 1h: ${(err as Error).message}` })) } });
                  }
                  totals.failed += 1;
                }
              }
            }
            continue; // a pending send owns this tick for this contact
          }
          // A pending (not yet due) reaction also owns the contact's tick:
          // a second rule must never overwrite the queued reaction send.
          if (signals.reactionPending) continue;

          // 2. Click triggers (first click per link, non-bot only).
          const freshSignals = sigOf((await db.recipientState.findFirst({ where: { id: st.id } })) || st);
          const firedThisTick = new Set<string>();
          const unprocessed = sig.clicks.filter((c) => !c.bot && !(freshSignals.processedClickEventIds || []).includes(c.eventId));
          for (const click of unprocessed) {
            if (click.order === null) continue;
            // A source whose window already decided (send_next or evaluated)
            // is closed: a later click must not reopen it.
            if ((freshSignals.evaluatedSources || []).includes(click.order)) continue;
            const candidates = rules
              .filter((r) => r.sourceOrder === click.order && (r.condition === 'CLICKED' || (r.condition === 'CLICKED_LINK' && click.linkUrl && click.linkUrl.includes(String(r.conditionParams?.link || '')))))
              .sort((a, b) => a.priority - b.priority);
            // First matching rule wins (priority order). A rule fires at
            // most once per contact; a diverting rule never fires for an
            // already-diverted source.
            const match = candidates.find((r) => {
              if (freshSignals.firedRuleIds?.includes(r.id) || firedThisTick.has(r.id)) return false;
              const diverting = r.action === 'send_reaction' || r.action === 'resend' || r.action === 'stop';
              if (diverting && (freshSignals.divertedSources || []).includes(r.sourceOrder)) return false;
              return true;
            });
            if (match) {
              const cur = (await db.recipientState.findFirst({ where: { id: st.id } })) || st;
              const curSig = sigOf(cur);
              await executeRuleAction(draft.workspaceId, draftId, cur, match, { ...curSig, processedClickEventIds: [...(curSig.processedClickEventIds || []), click.eventId] }, now, { id: st.contactId, email: st.contact.email }, emails as never, true);
              firedThisTick.add(match.id);
              totals.fired += 1;
            }
          }
          // Mark all unprocessed clicks processed (even without a rule, so
          // the tick never re-scans them).
          {
            const cur = await db.recipientState.findFirst({ where: { id: st.id } });
            if (cur && cur.status === 'active') {
              const curSig = sigOf(cur);
              const allIds = [...new Set([...(curSig.processedClickEventIds || []), ...unprocessed.map((c) => c.eventId)])];
              if (allIds.length !== (curSig.processedClickEventIds || []).length) {
                await db.recipientState.update({ where: { id: cur.id }, data: { signals: toJson({ ...curSig, processedClickEventIds: allIds }) } });
              }
            }
          }

          // 3. Clicked-but-no-reply triggers (B3). Non-diverting (notify)
          // rules fire even when a click rule already fired for the source
          // — the contact's path evolves (note, then later alert). Each
          // rule still fires at most once per contact.
          {
            const cur = await db.recipientState.findFirst({ where: { id: st.id } });
            if (cur && cur.status === 'active') {
              const curSig = sigOf(cur);
              for (const rule of rules.filter((r) => r.condition === 'CLICKED_NOT_REPLIED')) {
                if ((curSig.firedRuleIds || []).includes(rule.id)) continue;
                const click = sig.clicks.find((c) => !c.bot && c.order === rule.sourceOrder);
                if (!click) continue;
                const days = Number(rule.conditionParams?.days ?? DEFAULT_NO_REPLY_DAYS);
                if (now.getTime() < click.at.getTime() + days * 86_400_000) continue;
                const repliedAfterClick = (await detectExitSignals(draft.workspaceId, st.contactId, click.at).catch(() => null))?.replied;
                if (repliedAfterClick) continue;
                await executeRuleAction(draft.workspaceId, draftId, cur, rule, curSig, now, { id: st.contactId, email: st.contact.email }, emails as never, false);
                totals.fired += 1;
                break;
              }
            }
          }

          // 4. Window triggers (NOT_CLICKED, then NOT_OPENED, at end of W).
          // Window rules are the fallback: they only evaluate sources with
          // NO fired rule at all (a click rule already won that source).
          {
            const cur = await db.recipientState.findFirst({ where: { id: st.id } });
            if (cur && cur.status === 'active') {
              const curSig = sigOf(cur);
              for (const source of sig.sent.filter((s) => s.kind === 'scheduled')) {
                if ((curSig.evaluatedSources || []).includes(source.order)) continue;
                const anyFiredForSource = rules.some((r) => r.sourceOrder === source.order && (curSig.firedRuleIds || []).includes(r.id));
                if (anyFiredForSource) continue;
                const wRule = rules.find((r) => r.sourceOrder === source.order);
                const windowHours = wRule?.decisionWindowHours ?? DEFAULT_WINDOW_HOURS;
                const windowEnd = new Date(source.sentAt.getTime() + windowHours * 3600_000);
                if (now.getTime() < windowEnd.getTime()) continue;
                const windowRules = rules.filter((r) => r.sourceOrder === source.order && (r.condition === 'NOT_CLICKED' || r.condition === 'NOT_OPENED')).sort((a, b) => a.priority - b.priority);
                let matched: ReactionRuleRow | null = null;
                for (const r of windowRules) {
                  if (matchesWindowCondition(r.condition, sig, source, windowEnd)) {
                    matched = r;
                    break;
                  }
                }
                if (matched) {
                  await executeRuleAction(draft.workspaceId, draftId, cur, matched, curSig, now, { id: st.contactId, email: st.contact.email }, emails as never, false);
                  totals.fired += 1;
                } else {
                  await db.recipientState.update({ where: { id: cur.id }, data: { signals: toJson({ ...curSig, evaluatedSources: [...(curSig.evaluatedSources || []), source.order] }), history: toJson(historyAppend(cur.history, { at: now.toISOString(), from: 'active', to: 'active', reason: `Window for Email ${source.order} ended — no rule matched; default path continues.` })) } });
                }
              }
            }
          }

          // 5. Completion: single-email reaction-only states finish when
          // every sent source is evaluated or fired and nothing is pending.
          {
            const cur = await db.recipientState.findFirst({ where: { id: st.id } });
            if (cur && cur.status === 'active') {
              const curSig = sigOf(cur);
              const isReactionOnly = !!curSig.reactionOnly;
              const seqDone = (sequence.count || 1) > 0 && cur.nextEmailOrder > (sequence.count || 1);
              if ((isReactionOnly || seqDone) && !curSig.reactionPending) {
                const sources = sig.sent.filter((s) => s.kind === 'scheduled').map((s) => s.order);
                const allDone = sources.every(
                  (o) =>
                    rules.some((r) => r.sourceOrder === o && (curSig.firedRuleIds || []).includes(r.id)) ||
                    (curSig.evaluatedSources || []).includes(o),
                );
                const windowsPassed = sources.every((o) => {
                  const s = sig.sent.find((x) => x.order === o);
                  if (!s) return true;
                  const wRule = rules.find((r) => r.sourceOrder === o);
                  return now.getTime() >= s.sentAt.getTime() + (wRule?.decisionWindowHours ?? DEFAULT_WINDOW_HOURS) * 3600_000;
                });
                // B3: a contact who clicked but whose no-reply delay has
                // not elapsed yet is NOT done — the no-reply alert is still
                // to come. Completing early would silently drop that alert.
                const pendingNoReply = rules.some((r) => {
                  if (r.condition !== 'CLICKED_NOT_REPLIED') return false;
                  if ((curSig.firedRuleIds || []).includes(r.id)) return false;
                  const click = sig.clicks.find((c) => !c.bot && c.order === r.sourceOrder);
                  if (!click) return false;
                  const days = Number(r.conditionParams?.days ?? DEFAULT_NO_REPLY_DAYS);
                  return now.getTime() < click.at.getTime() + days * 86_400_000;
                });
                if (sources.length > 0 && allDone && windowsPassed && !pendingNoReply) {
                  await db.recipientState.update({ where: { id: cur.id }, data: { status: 'completed', nextSendAt: null, history: toJson(historyAppend(cur.history, { at: now.toISOString(), from: 'active', to: 'completed', reason: 'All reaction windows evaluated; no sends pending.' })) } });
                }
              }
            }
          }
        } catch (err) {
          console.error(`[ReactionEngine] State failed (draft ${draftId}):`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`[ReactionEngine] Draft failed (${draftId}):`, (err as Error).message);
    }
  }
  return totals;
}

/** Replace a draft's rules with an assembled set (priority order preserved). */
export async function syncReactionRules(workspaceId: string, draftId: string, rules: ReactionRuleInput[]): Promise<void> {
  const ordered = orderRulesByPriority(rules);
  await db.reactionRule.deleteMany({ where: { workspaceId, draftId } });
  for (let i = 0; i < ordered.length; i++) {
    const r = ordered[i];
    await db.reactionRule.create({
      data: {
        workspaceId,
        draftId,
        priority: i,
        sourceOrder: r.sourceOrder,
        condition: r.condition,
        conditionParams: JSON.parse(JSON.stringify(r.conditionParams || {})) as never,
        action: r.action,
        actionParams: JSON.parse(JSON.stringify(r.actionParams || {})) as never,
        decisionWindowHours: r.decisionWindowHours ?? DEFAULT_WINDOW_HOURS,
        delayMinutes: r.delayMinutes ?? DEFAULT_CLICK_DELAY_MINUTES,
        readback: r.readback || ruleReadback(r, i),
      },
    });
  }
}

/** Reaction status for the UI: rules in priority order + per-contact paths. */
export async function getReactionStatus(workspaceId: string, draftId: string) {
  const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!draft) throw new Error('Campaign draft not found.');
  const rules = await db.reactionRule.findMany({ where: { workspaceId, draftId }, orderBy: { priority: 'asc' } });
  const states = await db.recipientState.findMany({
    where: { workspaceId, draftId },
    include: { contact: { select: { email: true, firstName: true, lastName: true } } },
  });
  return {
    draftId,
    draftStatus: draft.status,
    rules: rules.map((r) => ({
      id: r.id,
      priority: r.priority,
      sourceOrder: r.sourceOrder,
      condition: r.condition,
      conditionParams: r.conditionParams,
      action: r.action,
      actionParams: r.actionParams,
      decisionWindowHours: r.decisionWindowHours,
      delayMinutes: r.delayMinutes,
      readback: r.readback,
    })),
    states: states.map((s) => {
      const sig = sigOf(s);
      return {
        contactId: s.contactId,
        email: s.contact?.email || null,
        firstName: s.contact?.firstName || null,
        lastName: s.contact?.lastName || null,
        status: s.status,
        currentEmailOrder: s.nextEmailOrder,
        nextSendAt: s.nextSendAt,
        rulesFired: sig.firedRuleIds,
        divertedSources: sig.divertedSources,
        reactionPending: sig.reactionPending,
        history: s.history,
      };
    }),
  };
}

// Re-exported for tests and the tick wiring.
export { FREQUENCY_CAP_PER_7_DAYS };
export type { ValidatedSequence };
