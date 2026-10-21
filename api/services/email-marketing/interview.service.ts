/**
 * Create with AI — Interview engine core (Milestone 2, spec §5, §6–§8, §16).
 *
 * Pure logic lives here and is unit-tested without a DB or network:
 * base checklists, Interview JSON validation, the two-attempt rule, question
 * caps, the escape hatch, Brief assembly, and phase transitions.
 *
 * The DB + Gemini wrapper lives at the bottom of this file (runTurn etc.).
 * Production LLM calls go through the platform's existing Gemini integration
 * (packages/ai/client.js, server-side only). When AI is unconfigured or the
 * call fails, the user's answers are already saved and the turn returns a
 * 503-style error — never a fabricated interview.
 *
 * M4 (spec §9): the sequence phase reuses the pre-existing sequence engine
 * (sequence.service.ts) — validateSequence is pure (no DB), so importing it
 * here keeps the pure section testable. The engine's DB functions
 * (enroll/advance/record) are used by the sequence runner, not the interview.
 */

import {
  validateSequence,
  SequenceError,
  zonedTimeToUtc,
  assertValidTimeZone,
  type SequenceInput,
  type ValidatedSequence,
} from './sequence.service.js';
import { recommendedStart } from './fact-validator.js';
import {
  assembleReactionsFromChecklist,
  type AssembledReactions,
} from './reaction-engine.service.js';

export type PhaseId = 'goal' | 'audience' | 'cta' | 'sequence' | 'reactions';
export type PhaseStatus = 'missing' | 'vague' | 'complete' | 'placeholder';

export interface ChecklistItem {
  id: string;
  label: string;
  kind: 'base' | 'extra';
  reason?: string;
  status: PhaseStatus;
  userWords: string;
  fact: string;
  attempts: number;
  /** False for audience items: thin audience details never block sending (§7). */
  blocksSending: boolean;
}

export interface PhaseFlags {
  coldContacts?: boolean | null;
  listHints?: {
    relationship?: string;
    recency?: string;
    location?: string;
    status?: string;
    exclusions?: string;
  };
  estimatedSize?: number | null;
}

export interface PhaseChecklist {
  items: ChecklistItem[];
  needsReview: boolean;
  flags?: PhaseFlags;
}

export type MessageKind = 'answer' | 'question' | 'recap' | 'transition' | 'brief' | 'system';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  phase: PhaseId | 'brief_confirm' | 'sequence_confirmed' | 'reactions_confirm' | 'reactions_confirmed';
  kind: MessageKind;
  /** For AI questions: the checklist item the question targets (attempts logic). */
  target?: string;
  at: string;
}

export interface InterviewTurnOutput {
  phase: string;
  checklist: Array<{
    id: string;
    label: string;
    kind: 'base' | 'extra';
    reason?: string;
    status: PhaseStatus;
    user_words: string;
    fact: string;
    attempts?: number;
  }>;
  acknowledgment: string;
  next_question: string | null;
  next_question_target: string | null;
  recommendation: string | null;
  phase_complete: boolean;
  recap: string | null;
  flags?: {
    cold_contacts?: boolean | null;
    list_hints?: PhaseFlags['listHints'];
    estimated_size?: number | null;
  };
}

export interface BriefObject {
  campaign_definition: { user_words: string; summary: string };
  outcome: string;
  why_now: string;
  must_include_facts: string[];
  limits: string[];
  only_you_detail: string;
  audience: {
    description: string;
    answers: Record<string, string>;
    cold_contacts: boolean | null;
    list_hints: PhaseFlags['listHints'];
    estimated_size: number | null;
  };
  cta: {
    action: string;
    destination: string;
    deadline: string;
    next_step: string;
    reader_needs: string;
  };
  version: number;
  /** Plain-language text for the typed confirmation screen (assembled by code). */
  text: string;
}

/** Plain-object draft state the pure functions operate on (mirrors the Prisma row). */
export interface DraftState {
  id: string;
  workspaceId: string;
  currentPhase: PhaseId | 'brief_confirm' | 'sequence_confirmed' | 'reactions_confirm' | 'reactions_confirmed';
  status: string;
  profileSnapshot: Record<string, unknown>;
  conversation: ChatMessage[];
  checklists: Partial<Record<PhaseId, PhaseChecklist>>;
  brief: BriefObject | null;
  briefVersion: number;
  /** M4 sequence object (Phase 4, spec §9) — null until Phase 4 completes. */
  sequence: Record<string, unknown> | null;
  profileNotedAt: string | null;
  expiresAt: string;
  /**
   * M5 transient marker (NEVER persisted by saveDraftState): an assembled
   * Phase 5 plan waiting for its ReactionRule rows to be synced by the DB
   * wrapper after save. Fresh loads never carry it — rows are the truth.
   */
  reactionsAssembled?: AssembledReactions | null;
}

export const PHASE_ORDER: PhaseId[] = ['goal', 'audience', 'cta', 'sequence', 'reactions'];
export const PHASE_LABELS: Record<PhaseId, string> = {
  goal: 'Goal',
  audience: 'Audience',
  cta: 'Call to Action',
  sequence: 'Sequence and Timing',
  reactions: 'Reactions',
};
/** UI phase numbers: "Phase N of 8" (Phase 0 profile is not counted). */
export const PHASE_NUMBERS: Record<PhaseId, number> = { goal: 1, audience: 2, cta: 3, sequence: 4, reactions: 5 };

/** Question caps (spec §5.5): 8 per phase for Phases 1–3, 4 per phase for
 * Phases 4–6, 24 across Phases 1–6. */
export function phaseQuestionCap(phase: PhaseId): number {
  return phase === 'sequence' || phase === 'reactions' ? 4 : 8;
}
export const QUESTIONS_PER_PHASE_CAP = 8;
export const QUESTIONS_TOTAL_CAP = 24;
/** Extra checklist items per phase (spec §5.2). */
export const EXTRA_ITEMS_CAP = 6;
/** Unfinished drafts expire 30 days after the last edit (spec §3 rule 2). */
export const DRAFT_TTL_DAYS = 30;

const BASE_ITEMS: Record<PhaseId, Array<{ id: string; label: string }>> = {
  goal: [
    { id: 'campaign', label: 'The campaign, specifically' },
    { id: 'outcome', label: 'The outcome' },
    { id: 'why_now', label: 'Why now' },
    { id: 'must_include_facts', label: 'Must-include facts' },
    { id: 'limits', label: 'Limits' },
    { id: 'only_you', label: 'The "only you" detail' },
  ],
  audience: [
    { id: 'who', label: 'Who they are, specifically' },
    { id: 'how_they_know', label: 'How they know the business' },
    { id: 'struggles', label: 'What they struggle with, want or care about' },
    { id: 'interesting', label: 'What would make this interesting to them' },
    { id: 'familiarity', label: 'How familiar they are with the business' },
    { id: 'in_out', label: 'Who is in and who is out' },
    { id: 'how_many', label: 'Roughly how many people' },
  ],
  cta: [
    { id: 'action', label: 'The one action' },
    { id: 'where_how', label: 'Where or how' },
    { id: 'by_when', label: 'By when' },
    { id: 'what_next', label: 'What happens next' },
    { id: 'reader_needs', label: 'What the reader needs ready' },
  ],
  sequence: [
    { id: 'one_or_series', label: 'One email or a series' },
    { id: 'how_many', label: 'How many emails' },
    { id: 'span_gap', label: 'Over how many days, and the gap between emails' },
    { id: 'start_deadline', label: 'Start and deadline' },
    { id: 'jobs', label: 'The job of each email' },
    { id: 'send_timing', label: 'Send timing' },
  ],
  reactions: [
    { id: 'no_open', label: 'People who do not open' },
    { id: 'open_no_click', label: 'People who open but do not click' },
    { id: 'clicked', label: 'People who click' },
    { id: 'clicked_no_reply', label: 'People who click but do not reply' },
    { id: 'reaction_jobs', label: 'The job of each reaction email' },
    { id: 'owner_alerts', label: 'Alerts to the owner' },
  ],
};

export function baseChecklist(phase: PhaseId): PhaseChecklist {
  return {
    items: BASE_ITEMS[phase].map((b) => ({
      id: b.id,
      label: b.label,
      kind: 'base' as const,
      status: 'missing' as const,
      userWords: '',
      fact: '',
      attempts: 0,
      // Audience items never block sending (spec §7); all other placeholders do.
      blocksSending: phase !== 'audience',
    })),
    needsReview: false,
  };
}

export function nextPhase(phase: PhaseId): PhaseId | 'brief_confirm' | 'sequence_confirmed' | 'reactions_confirmed' {
  if (phase === 'goal') return 'audience';
  if (phase === 'audience') return 'cta';
  if (phase === 'cta') return 'brief_confirm';
  if (phase === 'reactions') return 'reactions_confirmed';
  return 'sequence_confirmed';
}

export function countQuestions(conversation: ChatMessage[], phase: PhaseId): number {
  return conversation.filter((m) => m.role === 'ai' && m.phase === phase && m.kind === 'question').length;
}

export function countTotalQuestions(conversation: ChatMessage[]): number {
  return conversation.filter((m) => m.role === 'ai' && m.kind === 'question').length;
}

export function countUserAnswers(conversation: ChatMessage[], phase: PhaseId): number {
  return conversation.filter((m) => m.role === 'user' && m.phase === phase).length;
}

function normQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').replace(/[?.!]+$/g, '').trim();
}

/**
 * Validates one Interview JSON output (spec §5.3 step 3 + §16).
 * Returns a list of problems; empty means valid. Never throws on bad input.
 */
/** Checklist fact text: raw model output uses user_words, merged items use userWords. */
function sequenceFactText(items: Array<Record<string, unknown>>, id: string): string {
  const it = items.find((i) => i.id === id);
  if (!it) return '';
  const fact = typeof it.fact === 'string' ? it.fact.trim() : '';
  const words = typeof (it as { userWords?: unknown }).userWords === 'string' ? ((it as { userWords: string }).userWords || '').trim() : '';
  const snake = typeof (it as { user_words?: unknown }).user_words === 'string' ? ((it as { user_words: string }).user_words || '').trim() : '';
  return fact || words || snake;
}

function firstIntIn(text: string): number | null {
  const m = text.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/**
 * Parses a wall-clock date (YYYY-MM-DD) or datetime into an absolute instant.
 * Date-only values are interpreted in the business time zone: a start date
 * means 08:00 (the send-window opening) on that day; a deadline date means
 * 23:59 (end of that day, so a send on the deadline day is still allowed).
 * Datetimes without an offset are business-zone wall times. Returns null
 * when no date can be parsed — the caller asks the user instead of guessing.
 */
function parseSequenceDate(text: string, timeZone: string, isDeadline: boolean): string | null {
  const iso = text.match(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?/);
  if (!iso) return null;
  const raw = iso[0];
  const [y, m, d] = raw.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const timePart = raw.match(/[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (hasOffset) {
    const dt = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  if (timePart) {
    return zonedTimeToUtc(
      { year: y, month: m, day: d, hour: parseInt(timePart[1], 10), minute: parseInt(timePart[2], 10), second: 0 },
      timeZone,
    ).toISOString();
  }
  if (isDeadline) {
    return zonedTimeToUtc({ year: y, month: m, day: d, hour: 23, minute: 59, second: 0 }, timeZone).toISOString();
  }
  return zonedTimeToUtc({ year: y, month: m, day: d, hour: 8, minute: 0, second: 0 }, timeZone).toISOString();
}

function parseSendWindow(fact: string, timeZone: string): { days: number[]; startHour: number; endHour: number; timeZone: string } {
  const days = /every day|daily|7 days/i.test(fact) ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const hourNums = [...fact.matchAll(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/gi)]
    .map((mm) => {
      let h = parseInt(mm[1], 10);
      const ap = (mm[3] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return h;
    })
    .filter((h) => h >= 0 && h <= 23);
  let startHour = 8;
  let endHour = 17;
  if (hourNums.length >= 2) {
    startHour = Math.min(hourNums[0], hourNums[1]);
    endHour = Math.max(hourNums[0], hourNums[1]);
    if (endHour <= startHour) endHour = 17;
  } else if (hourNums.length === 1) {
    startHour = hourNums[0];
  }
  return { days, startHour, endHour, timeZone };
}

export interface SequenceAssembly {
  ok: boolean;
  sequence?: ValidatedSequence & { fromEscapeHatch: boolean };
  error?: string;
}

/**
 * Assembles a validated sequence from Phase 4 checklist facts (spec §9).
 * Missing pieces get safe defaults (count 1, 1-day gaps, next in-window
 * start, no deadline, generic purposes, weekday 8–17 window) — it only
 * FAILS on contradictory or invalid data (count/span out of range, a
 * deadline the plan cannot meet, a past or DST-gap start), which the
 * interview must ask the user to fix. Never guesses a date: an unparsable
 * start falls back to the next in-window slot, never to an invented day.
 */
export function assembleSequenceFromChecklist(
  items: Array<Record<string, unknown>>,
  opts: { timeZone?: string; now?: Date; fromEscapeHatch?: boolean },
): SequenceAssembly {
  const timeZone = opts.timeZone || 'UTC';
  const now = opts.now || new Date();
  try {
    assertValidTimeZone(timeZone);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const oneOrSeries = sequenceFactText(items, 'one_or_series');
  const howMany = sequenceFactText(items, 'how_many');
  let count = firstIntIn(howMany);
  if (count === null) {
    const word = Object.keys(WORD_NUMBERS).find((w) => new RegExp(`\\b${w}\\b`, 'i').test(howMany));
    count = word ? WORD_NUMBERS[word] : /series|more than one|multiple/i.test(oneOrSeries) ? 2 : 1;
  }
  const spanGap = sequenceFactText(items, 'span_gap');
  const spanMatch = spanGap.match(/(\d+)\s*days?/i);
  const gapsPart = spanGap.split(/gaps?:/i)[1] || '';
  const gapNums = [...gapsPart.matchAll(/\d+/g)].map((g) => parseInt(g[0], 10)).filter((n) => n >= 1);
  const offsets: number[] = [0];
  for (let i = 1; i < count; i++) {
    offsets.push(offsets[i - 1] + (gapNums[i - 1] ?? 1));
  }
  const spanDays = spanMatch ? parseInt(spanMatch[1], 10) : offsets[offsets.length - 1];
  const jobsFact = sequenceFactText(items, 'jobs');
  const purposes: string[] = [];
  for (const part of jobsFact.split(/\n|;/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    for (const piece of trimmed.split(/(?=\b\d+[.)]\s+)/)) {
      const cleaned = piece.replace(/^\d+[.)]\s*/, '').replace(/\.$/, '').trim();
      if (cleaned && !/^\d+$/.test(cleaned)) purposes.push(cleaned);
    }
  }
  const emails = offsets.map((offsetDays, i) => ({
    offsetDays,
    purpose: purposes[i] || `Follow-up email ${i + 1}`,
    name: `Email ${i + 1}`,
  }));
  const sdFact = sequenceFactText(items, 'start_deadline');
  let start: string | null = parseSequenceDate(sdFact, timeZone, false);
  if (!start) {
    start = recommendedStart(now, timeZone).atUtc.toISOString();
  }
  let deadline: string | null = null;
  const allDates = [...sdFact.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((g) => g[0]);
  if (allDates.length >= 2) {
    deadline = parseSequenceDate(sdFact.slice(sdFact.indexOf(allDates[1])), timeZone, true);
  }
  const sendWindow = parseSendWindow(sequenceFactText(items, 'send_timing'), timeZone);
  const input: SequenceInput = {
    count,
    spanDays,
    emails,
    start,
    deadline,
    sendWindow,
    pattern: oneOrSeries || undefined,
  };
  try {
    const validated = validateSequence(input, now);
    return { ok: true, sequence: { ...validated, fromEscapeHatch: opts.fromEscapeHatch || false, pattern: input.pattern ?? null } };
  } catch (e) {
    if (e instanceof SequenceError) return { ok: false, error: e.message };
    return { ok: false, error: (e as Error).message };
  }
}

export function validateTurnOutput(
  output: unknown,
  phase: PhaseId,
  previousQuestions: string[],
  opts?: { timeZone?: string; now?: Date },
): string[] {
  const errors: string[] = [];
  if (!output || typeof output !== 'object') return ['Output is not a JSON object.'];
  const o = output as Partial<InterviewTurnOutput>;
  if (o.phase !== phase) errors.push(`phase must be "${phase}", got "${String(o.phase)}".`);
  if (!Array.isArray(o.checklist)) {
    errors.push('checklist must be an array.');
    return errors;
  }
  const baseIds = BASE_ITEMS[phase].map((b) => b.id);
  const seen = new Set<string>();
  let extras = 0;
  for (const item of o.checklist) {
    if (!item || typeof item !== 'object') {
      errors.push('checklist contains a non-object item.');
      continue;
    }
    if (!item.id || typeof item.id !== 'string') errors.push('checklist item is missing an id.');
    if (seen.has(item.id)) errors.push(`duplicate checklist item id "${item.id}".`);
    seen.add(item.id);
    if (item.kind === 'extra') extras += 1;
    if (item.kind !== 'base' && item.kind !== 'extra') errors.push(`item "${item.id}" has invalid kind "${String(item.kind)}".`);
    if (!['missing', 'vague', 'complete', 'placeholder'].includes(item.status)) {
      errors.push(`item "${item.id}" has invalid status "${String(item.status)}".`);
    }
    if (typeof item.user_words !== 'string' || typeof item.fact !== 'string') {
      errors.push(`item "${item.id}" must have string user_words and fact.`);
    }
  }
  for (const id of baseIds) {
    if (!seen.has(id)) errors.push(`base checklist item "${id}" is missing.`);
  }
  if (extras > EXTRA_ITEMS_CAP) errors.push(`extra items exceed the cap of ${EXTRA_ITEMS_CAP} (got ${extras}).`);
  if (typeof o.acknowledgment !== 'string') errors.push('acknowledgment must be a string.');
  if (o.next_question !== null && typeof o.next_question !== 'string') {
    errors.push('next_question must be a string or null.');
  }
  if (o.phase_complete && !o.next_question && !o.recap) {
    errors.push('phase_complete is true but recap is missing.');
  }
  if (!o.phase_complete && !o.next_question) {
    errors.push('phase is not complete but next_question is null.');
  }
  if (o.next_question) {
    const n = normQuestion(o.next_question);
    if (previousQuestions.some((q) => normQuestion(q) === n)) {
      errors.push('next_question repeats a previous question in this phase.');
    }
  }
  if (phase === 'sequence' && o.phase_complete && opts?.timeZone) {
    const items = Array.isArray(o.checklist) ? (o.checklist as Array<Record<string, unknown>>) : [];
    const asm = assembleSequenceFromChecklist(items, { timeZone: opts.timeZone, now: opts.now || new Date() });
    if (!asm.ok) {
      errors.push(`Sequence plan cannot be assembled: ${asm.error} Ask for the missing or corrected detail.`);
    }
  }
  return errors;
}

function splitFacts(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function itemWords(checklist: PhaseChecklist | undefined, id: string): string {
  return checklist?.items.find((i) => i.id === id)?.userWords || '';
}

/** Assembles the Brief object + plain-language text from the three checklists. */
export function assembleBrief(draft: DraftState): BriefObject {
  const g = draft.checklists.goal;
  const a = draft.checklists.audience;
  const c = draft.checklists.cta;
  const answers: Record<string, string> = {};
  for (const item of a?.items || []) answers[item.id] = item.userWords;
  const flags = a?.flags || {};
  const brief: BriefObject = {
    campaign_definition: {
      user_words: itemWords(g, 'campaign'),
      summary: itemWords(g, 'campaign') || 'A campaign described in the interview.',
    },
    outcome: itemWords(g, 'outcome'),
    why_now: itemWords(g, 'why_now'),
    must_include_facts: splitFacts(itemWords(g, 'must_include_facts')),
    limits: splitFacts(itemWords(g, 'limits')),
    only_you_detail: itemWords(g, 'only_you'),
    audience: {
      description: itemWords(a, 'who'),
      answers,
      cold_contacts: flags.coldContacts ?? null,
      list_hints: flags.listHints,
      estimated_size: flags.estimatedSize ?? null,
    },
    cta: {
      action: itemWords(c, 'action'),
      destination: itemWords(c, 'where_how'),
      deadline: itemWords(c, 'by_when'),
      next_step: itemWords(c, 'what_next'),
      reader_needs: itemWords(c, 'reader_needs'),
    },
    version: draft.briefVersion,
    text: '',
  };
  brief.text =
    `Here is the campaign as I understand it.\n` +
    `Campaign: ${brief.campaign_definition.user_words || '(not specified)'}\n` +
    `Outcome: ${brief.outcome || '(not specified)'}\n` +
    `Why now: ${brief.why_now || '(no particular reason)'}\n` +
    `Key facts: ${brief.must_include_facts.length ? brief.must_include_facts.join('; ') : '(none recorded)'}\n` +
    `Limits: ${brief.limits.length ? brief.limits.join('; ') : '(none)'}\n` +
    `What makes it yours: ${brief.only_you_detail || '(not specified)'}\n` +
    `Audience: ${brief.audience.description || '(not specified)'}\n` +
    `Call to action: ${brief.cta.action || '(not specified)'} — ${brief.cta.destination || '(no destination recorded)'}\n` +
    `Type "looks good", or tell me what to change.`;
  return brief;
}

/** The opening question for a phase (spec §5.1 + phase openings). */
export function phaseOpening(phase: PhaseId): string {
  if (phase === 'goal') return 'What do you want to send? Tell me in your own words, with as much detail as you like.';
  if (phase === 'audience') return 'Now tell me about the people who will read this email.';
  if (phase === 'sequence') return "Now let's decide how many emails go out, and over how many days.";
  if (phase === 'reactions') return "Now let's decide what happens depending on what each person does with your emails. Open tracking is approximate, so I lean on clicks for important decisions and use opens only where they help.";
  return "Now let's decide what you want readers to do after reading this.";
}

/** The phase banner line (spec §3 rule 4 + Appendix A). */
export function phaseBanner(phase: PhaseId): string {
  return `Phase ${PHASE_NUMBERS[phase]} of 8: ${PHASE_LABELS[phase]}.`;
}

export function transitionMessage(phase: PhaseId, recap: string, audienceThinNote: boolean): string {
  const next = nextPhase(phase);
  const nextLabel =
    next === 'brief_confirm'
      ? 'the Campaign Brief confirmation'
      : next === 'sequence_confirmed' || next === 'reactions_confirmed'
        ? 'drafting your emails (Phase 7)'
        : `Phase ${PHASE_NUMBERS[next as PhaseId]} of 8: ${PHASE_LABELS[next as PhaseId]}`;
  let msg =
    `Phase ${PHASE_NUMBERS[phase]} of 8 complete: ${PHASE_LABELS[phase]}. ` +
    `Here is what I understand so far: ${recap} Next up, ${nextLabel}.`;
  if (audienceThinNote) {
    msg +=
      ` Note: the audience details were thin, so the email may read as generic — unlike a missing price or date, thin audience details never block sending.`;
  }
  return msg;
}

/** Fallback recap assembled from completed items (used when a cap forces completion). */
export function recapFromChecklist(items: ChecklistItem[]): string {
  const done = items.filter((i) => i.status === 'complete' && i.userWords);
  if (!done.length) return 'I have enough to move on with what you have shared so far.';
  return done.map((i) => `${i.label}: ${i.userWords}`).join(' ');
}

/** The result of applying one turn: the new draft plus what happened. */
export interface ApplyTurnResult {
  draft: DraftState;
  /** True when this turn completed the phase (recap + transition appended). */
  phaseCompleted: boolean;
  /** True when the phase was force-completed by hitting a question cap. */
  capped: boolean;
  /** True when any audience item became a placeholder via the two-attempt rule. */
  audienceThin: boolean;
  /** The AI message text to show (acknowledgment + question, or recap). */
  aiText: string;
}

/**
 * Applies one validated Interview JSON output to a draft (pure).
 * Handles: checklist merge, attempts + the two-attempt rule, question caps,
 * phase completion + transitions, and Brief assembly at the end of Phase 3.
 * The caller must have validated the output first (validateTurnOutput).
 */
export function applyTurn(draft: DraftState, output: InterviewTurnOutput, nowIso: string): ApplyTurnResult {
  const phase = output.phase as PhaseId;
  const prev = draft.checklists[phase] || baseChecklist(phase);
  // The question the user just answered (targets the attempts logic).
  const lastAi = [...draft.conversation].reverse().find((m) => m.role === 'ai' && m.phase === phase && m.kind === 'question');
  const prevTarget = lastAi?.target;
  const mergedItems: ChecklistItem[] = [];
  let audienceThin = false;
  for (const out of output.checklist) {
    const old = prev.items.find((i) => i.id === out.id);
    let status = out.status;
    let attempts = old?.attempts || 0;
    // Attempts count only when we asked about this item and it stayed vague.
    if (status === 'vague' && old && (old.id === prevTarget || old.status === 'vague')) {
      attempts = old.attempts + 1;
    }
    if (status === 'complete') attempts = 0;
    // Two-attempt rule (spec §5.5): still vague after two attempts → placeholder.
    if (status === 'vague' && attempts >= 2) {
      status = 'placeholder';
      if (phase === 'audience') audienceThin = true;
    }
    mergedItems.push({
      id: out.id,
      label: out.label,
      kind: out.kind,
      reason: out.reason,
      status,
      userWords: out.user_words,
      fact: out.fact,
      attempts,
      blocksSending: old?.blocksSending ?? phase !== 'audience',
    });
  }
  // Preserve base items the model dropped (validation should have caught this,
  // but never lose a base item silently).
  for (const old of prev.items) {
    if (!mergedItems.find((i) => i.id === old.id)) mergedItems.push(old);
  }

  const next: DraftState = {
    ...draft,
    checklists: {
      ...draft.checklists,
      [phase]: {
        items: mergedItems,
        needsReview: false,
        flags:
          phase === 'audience' && output.flags
            ? {
                coldContacts: output.flags.cold_contacts ?? prev.flags?.coldContacts ?? null,
                listHints: output.flags.list_hints || prev.flags?.listHints,
                estimatedSize: output.flags.estimated_size ?? prev.flags?.estimatedSize ?? null,
              }
            : prev.flags,
      },
    },
  };

  const questionsSoFar = countQuestions(next.conversation, phase);
  const totalSoFar = countTotalQuestions(next.conversation);
  const capped = questionsSoFar >= phaseQuestionCap(phase) || totalSoFar >= QUESTIONS_TOTAL_CAP;
  const allResolved = mergedItems.every((i) => i.status === 'complete' || i.status === 'placeholder');
  const phaseComplete = output.phase_complete && allResolved;

  if (capped && !phaseComplete) {
    // At the cap the AI says it has enough and moves on (spec §5.5).
    for (const item of mergedItems) {
      if (item.status === 'missing' || item.status === 'vague') {
        item.status = 'placeholder';
        if (phase === 'audience') audienceThin = true;
      }
    }
  }

  let aiText = '';
  let completed = false;
  if (phaseComplete || capped) {
    if (phase === 'sequence') {
      // Assemble BEFORE announcing completion: an unassemblable plan must
      // never advance the phase (defensive — validation should have caught
      // it, but applyTurn never crashes or advances on a bad plan).
      const timeZone =
        typeof (draft.profileSnapshot as { timezone?: unknown }).timezone === 'string'
          ? ((draft.profileSnapshot as { timezone: string }).timezone as string)
          : 'UTC';
      const asm = assembleSequenceFromChecklist(
        mergedItems as unknown as Array<Record<string, unknown>>,
        { timeZone, now: new Date(nowIso) },
      );
      if (!asm.ok) {
        const clarification = `I could not put that sequence together yet: ${asm.error} Could you confirm or correct the count, timing, start, or deadline?`;
        next.conversation = [
          ...next.conversation,
          { role: 'ai', text: clarification, phase, kind: 'question', at: nowIso },
        ];
        return { draft: next, phaseCompleted: false, capped, audienceThin, aiText: clarification };
      }
      const seqRecap = output.recap || recapFromChecklist(mergedItems);
      let seqMsg = transitionMessage(phase, seqRecap, audienceThin);
      if (capped) {
        seqMsg += ' I have asked enough questions for this phase, so I will move on with what you have shared.';
      }
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: seqMsg, phase, kind: 'transition', at: nowIso },
      ];
      const seq = asm.sequence as ValidatedSequence & { compressed: boolean; compressionNote: string | null };
      next.sequence = asm.sequence as unknown as Record<string, unknown>;
      next.status = 'sequence_confirmed';
      next.currentPhase = 'sequence_confirmed';
      const timeline = seq.emails.map((e) => `Email ${e.order} (${e.purpose}) on ${e.plannedAtUtc.slice(0, 10)}`).join('; ');
      const confirmMsg =
        `Sequence confirmed: ${seq.count} email${seq.count === 1 ? '' : 's'} over ${seq.spanDays} days. ${timeline}` +
        `${seq.compressed && seq.compressionNote ? ` ${seq.compressionNote}` : ''} Next up, drafting your emails (Phase 7).`;
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: confirmMsg, phase: 'sequence_confirmed', kind: 'system', at: nowIso },
      ];
      return { draft: next, phaseCompleted: true, capped, audienceThin, aiText: seqMsg };
    }
    if (phase === 'reactions') {
      // Assemble BEFORE announcing completion (same defensive rule as the
      // sequence gate): an unassemblable plan must never advance the phase.
      const sequence = (draft.sequence || {}) as { count?: number };
      const count = Number(sequence.count || 0);
      if (!count) {
        const clarification = 'Reactions need a confirmed sequence first — please complete Phase 4 before deciding reactions.';
        next.conversation = [
          ...next.conversation,
          { role: 'ai', text: clarification, phase, kind: 'question', at: nowIso },
        ];
        return { draft: next, phaseCompleted: false, capped, audienceThin, aiText: clarification };
      }
      const asm = assembleReactionsFromChecklist(
        mergedItems as unknown as Array<Record<string, unknown>>,
        count,
      );
      if (!asm.ok) {
        const clarification = `I could not put those reactions together yet: ${asm.error} Could you confirm or correct what should happen for non-openers, non-clickers, and clickers?`;
        next.conversation = [
          ...next.conversation,
          { role: 'ai', text: clarification, phase, kind: 'question', at: nowIso },
        ];
        return { draft: next, phaseCompleted: false, capped, audienceThin, aiText: clarification };
      }
      const reactRecap = output.recap || recapFromChecklist(mergedItems);
      let reactMsg = transitionMessage(phase, reactRecap, audienceThin);
      if (capped) {
        reactMsg += ' I have asked enough questions for this phase, so I will move on with what you have shared.';
      }
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: reactMsg, phase, kind: 'transition', at: nowIso },
      ];
      // The assembled plan rides the transient marker to the DB wrapper,
      // which syncs ReactionRule rows after save (never persisted on the
      // draft row — rows are the source of truth).
      next.reactionsAssembled = asm.assembled;
      next.currentPhase = 'reactions_confirm';
      const readbackMsg =
        `Here is how reactions will work, in plain words: ${asm.assembled.readback} ` +
        `Type "looks good" to confirm, or tell me what to change.`;
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: readbackMsg, phase: 'reactions_confirm', kind: 'system', at: nowIso },
      ];
      return { draft: next, phaseCompleted: true, capped, audienceThin, aiText: reactMsg };
    }
    const recap = output.recap || recapFromChecklist(mergedItems);
    let msg = transitionMessage(phase, recap, audienceThin);
    if (capped) {
      msg += ' I have asked enough questions for this phase, so I will move on with what you have shared.';
    }
    next.conversation = [
      ...next.conversation,
      { role: 'ai', text: msg, phase, kind: 'transition', at: nowIso },
    ];
    next.checklists[phase] = { ...(next.checklists[phase] as PhaseChecklist), items: mergedItems };
    const np = nextPhase(phase);
    next.currentPhase = np;
    if (np === 'brief_confirm') {
      next.brief = assembleBrief(next);
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: next.brief.text, phase: 'brief_confirm', kind: 'brief', at: nowIso },
      ];
    } else {
      // Open the next phase with its banner question (counts as a question).
      const opening = phaseOpening(np as PhaseId);
      next.conversation = [
        ...next.conversation,
        { role: 'ai', text: `${phaseBanner(np as PhaseId)} ${opening}`, phase: np as PhaseId, kind: 'question', at: nowIso },
      ];
    }
    completed = true;
    aiText = msg;
  } else {
    const ack = output.acknowledgment ? `${output.acknowledgment} ` : '';
    const rec = output.recommendation ? `${output.recommendation} ` : '';
    const q = output.next_question || '';
    aiText = `${ack}${rec}${q}`.trim();
    next.conversation = [
      ...next.conversation,
      {
        role: 'ai',
        text: aiText,
        phase,
        kind: 'question',
        target: output.next_question_target || undefined,
        at: nowIso,
      },
    ];
  }
  return { draft: next, phaseCompleted: completed, capped, audienceThin, aiText };
}

/** Escape hatch (spec §3 rule 7): mark every missing item a blocking placeholder. */
export function applyEscapeHatch(draft: DraftState, nowIso: string): DraftState {
  const phase = draft.currentPhase;
  if (phase === 'brief_confirm' || phase === 'sequence_confirmed' || phase === 'reactions_confirm' || phase === 'reactions_confirmed') return draft;
  const prev = draft.checklists[phase] || baseChecklist(phase);
  let audienceThin = false;
  const items = prev.items.map((i) => {
    if (i.status === 'missing' || i.status === 'vague') {
      if (phase === 'audience') audienceThin = true;
      return { ...i, status: 'placeholder' as const };
    }
    return i;
  });
  const next: DraftState = {
    ...draft,
    checklists: { ...draft.checklists, [phase]: { items, needsReview: false, flags: prev.flags } },
    conversation: [
      ...draft.conversation,
      {
        role: 'ai',
        text: `Continuing with what you have — missing details are marked and will block sending until filled.${audienceThin ? ' Thin audience details never block sending.' : ''}`,
        phase,
        kind: 'system',
        at: nowIso,
      },
    ],
  };
  const np = nextPhase(phase);
  next.currentPhase = np;
  if (np === 'brief_confirm') {
    next.brief = assembleBrief(next);
    next.conversation = [
      ...next.conversation,
      { role: 'ai', text: next.brief.text, phase: 'brief_confirm', kind: 'brief', at: nowIso },
    ];
  } else if (np === 'sequence_confirmed') {
    // Escape hatch for Phase 4: assemble with defaults for anything missing
    // (count 1, 1-day gaps, next in-window start, no deadline). Invalid data
    // (a past start, an unmeetable deadline) still blocks with a clear
    // message — the hatch never silently overrides the user's dates.
    const timeZone =
      typeof (draft.profileSnapshot as { timezone?: unknown }).timezone === 'string'
        ? ((draft.profileSnapshot as { timezone: string }).timezone as string)
        : 'UTC';
    const asm = assembleSequenceFromChecklist(
      (next.checklists[phase] as PhaseChecklist).items as unknown as Array<Record<string, unknown>>,
      { timeZone, now: new Date(nowIso), fromEscapeHatch: true },
    );
    if (asm.ok) {
      next.sequence = asm.sequence as unknown as Record<string, unknown>;
      next.status = 'sequence_confirmed';
      const seq = asm.sequence as ValidatedSequence;
      next.conversation = [
        ...next.conversation,
        {
          role: 'ai',
          text: `Continuing with what you have — sequence confirmed: ${seq.count} email${seq.count === 1 ? '' : 's'} over ${seq.spanDays} days. Next up, drafting your emails (Phase 7).`,
          phase: 'sequence_confirmed',
          kind: 'system',
          at: nowIso,
        },
      ];
    } else {
      next.currentPhase = phase;
      next.conversation = [
        ...next.conversation,
        {
          role: 'ai',
          text: `I could not put that sequence together yet: ${asm.error} Please correct the count, timing, start, or deadline and continue.`,
          phase,
          kind: 'system',
          at: nowIso,
        },
      ];
    }
  } else if (np === 'reactions_confirmed') {
    // Escape hatch for Phase 5: assemble from whatever facts exist and
    // confirm directly (mirrors the sequence hatch). Missing items are
    // skipped, never blocking — reactions enhance a campaign, they never
    // gate sending. An empty plan is a valid plan (default path for all).
    const sequence = (draft.sequence || {}) as { count?: number };
    const count = Number(sequence.count || 0);
    const rasm = assembleReactionsFromChecklist(
      (next.checklists[phase] as PhaseChecklist).items as unknown as Array<Record<string, unknown>>,
      count || 1,
    );
    if (rasm.ok) {
      next.reactionsAssembled = rasm.assembled;
      next.status = 'reactions_confirmed';
      next.conversation = [
        ...next.conversation,
        {
          role: 'ai',
          text: `Continuing with what you have — reactions confirmed: ${rasm.assembled.readback} Next up, drafting your emails (Phase 7).`,
          phase: 'reactions_confirmed',
          kind: 'system',
          at: nowIso,
        },
      ];
    } else {
      next.currentPhase = phase;
      next.conversation = [
        ...next.conversation,
        {
          role: 'ai',
          text: `I could not put those reactions together yet: ${rasm.error} Please correct what should happen for non-openers, non-clickers, and clickers and continue.`,
          phase,
          kind: 'system',
          at: nowIso,
        },
      ];
    }
  } else {
    const opening = phaseOpening(np as PhaseId);
    next.conversation = [
      ...next.conversation,
      { role: 'ai', text: `${phaseBanner(np as PhaseId)} ${opening}`, phase: np as PhaseId, kind: 'question', at: nowIso },
    ];
  }
  return next;
}

/** Reopen a finished phase; later phases are marked "needs review" (spec §3 rule 8). */
export function applyReopen(draft: DraftState, phase: PhaseId, nowIso: string): DraftState {
  const idx = PHASE_ORDER.indexOf(phase);
  const checklists = { ...draft.checklists };
  for (let i = idx; i < PHASE_ORDER.length; i++) {
    const p = PHASE_ORDER[i];
    if (checklists[p]) checklists[p] = { ...checklists[p] as PhaseChecklist, needsReview: true };
  }
  return {
    ...draft,
    currentPhase: phase,
    status: 'interviewing',
    checklists,
    conversation: [
      ...draft.conversation,
      { role: 'ai', text: `Reopened Phase ${PHASE_NUMBERS[phase]} of 8: ${PHASE_LABELS[phase]} for corrections.`, phase, kind: 'system', at: nowIso },
    ],
  };
}

/** Full interview order (spec §3 rule 8): the Brief confirmation sits between
 * Phase 3 (CTA) and Phase 4 (Sequence) — it is not a checklist phase, so it
 * is absent from PHASE_ORDER but present here for reopen ordering. The
 * reactions confirmation sits between Phase 5 and drafting the same way. */
export const INTERVIEW_ORDER: Array<PhaseId | 'brief_confirm' | 'sequence_confirmed' | 'reactions_confirm' | 'reactions_confirmed'> = [
  'goal',
  'audience',
  'cta',
  'brief_confirm',
  'sequence',
  'sequence_confirmed',
  'reactions',
  'reactions_confirm',
  'reactions_confirmed',
];

/** True when a reopen target is strictly before the current phase. */
export function canReopen(currentPhase: DraftState['currentPhase'], target: PhaseId): boolean {
  return INTERVIEW_ORDER.indexOf(target) < INTERVIEW_ORDER.indexOf(currentPhase);
}

/** True when the profile changed after the snapshot and the user has not noted it. */
export function profileChangedSinceSnapshot(draft: DraftState, profileUpdatedAt: string): boolean {
  const snapUpdated = (draft.profileSnapshot as { updatedAt?: string }).updatedAt;
  if (!snapUpdated) return false;
  if (new Date(profileUpdatedAt).getTime() <= new Date(snapUpdated).getTime()) return false;
  if (draft.profileNotedAt && new Date(profileUpdatedAt).getTime() <= new Date(draft.profileNotedAt).getTime()) return false;
  return true;
}

export function isExpired(draft: DraftState, nowMs: number): boolean {
  return new Date(draft.expiresAt).getTime() <= nowMs;
}

/* ── Gemini provider + DB wrapper ─────────────────────────────────────────── */

import { db } from '../../../infrastructure/database/client.js';
import { getProfile } from './business-profile.service.js';

export class InterviewError extends Error {
  status: number;
  saved: boolean;
  constructor(message: string, status = 500, saved = false) {
    super(message);
    this.status = status;
    this.saved = saved;
  }
}

export const AI_TURN_TIMEOUT_MS = 30_000;
export const AI_TURN_MAX_REPAIRS = 2;
/** Per-workspace AI call budget (spec §16: per-account rate limits, configurable). */
export const AI_CALLS_PER_HOUR = Number(process.env.INTERVIEW_AI_PER_HOUR || 60);

const aiCallLog = new Map<string, number[]>();

/** Rolling 1-hour per-workspace budget. Returns false when exceeded. */
export function checkAiRateLimit(workspaceId: string, nowMs = Date.now()): boolean {
  const windowStart = nowMs - 60 * 60 * 1000;
  const calls = (aiCallLog.get(workspaceId) || []).filter((t) => t > windowStart);
  if (calls.length >= AI_CALLS_PER_HOUR) {
    aiCallLog.set(workspaceId, calls);
    return false;
  }
  calls.push(nowMs);
  aiCallLog.set(workspaceId, calls);
  return true;
}

/** Test helper: clear the in-memory rate-limit log. */
export function resetAiRateLimit(): void {
  aiCallLog.clear();
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(msg);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI call timed out')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function parseJsonText(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

/** Builds the system instruction for one interview phase (spec §5.4, §5.7, §16). */
export function buildSystemPrompt(phase: PhaseId, wordsToAvoid: string[]): string {
  const baseItems = BASE_ITEMS[phase].map((b) => `- ${b.id}: ${b.label}`).join('\n');
  return [
    'You are an experienced email marketer interviewing a business owner about their next email campaign.',
    'Rules you MUST follow:',
    '- Ask exactly ONE question per turn, in plain language, built from the user\'s own words.',
    '- NEVER offer categories, answer choices, buttons, chips, dropdowns, option lists, or suggested answers to tap.',
    '- NEVER ask for anything already in the Business Profile or already answered. If the user answers several things at once, extract all of it.',
    '- NEVER sort the campaign into a fixed type (promo, announcement, win-back). Work from the user\'s own description.',
    '- Only use facts from the profile, the conversation, and the Brief so far. NEVER invent prices, dates, offers, results, or claims.',
    '- If the user says "not sure", offer a recommendation in plain text with a one-sentence reason; the user replies in their own words.',
    '- If two answers contradict, ask which one is correct.',
    '- If the user states a risky claim (guaranteed lowest price, health outcomes, "free" with conditions), ask for the exact terms and do not amplify the claim.',
    '- No hype, no praise padding, no jargon without a one-sentence explanation. US English. Warm and direct.',
    wordsToAvoid.length ? `- NEVER use these words or phrases: ${wordsToAvoid.join(', ')}.` : '',
    `Base checklist items for this phase (all must appear in your output checklist):\n${baseItems}`,
    'You may add up to 6 extra items when the conversation shows they are needed; each records a short reason.',
    'An item is complete ONLY if it holds detail that could go into an email as written (numbers, dates, names, places, concrete actions).',
    'Vague examples: "a great deal", "soon", "some customers", "everyone", "our usual service".',
    phase === 'sequence'
      ? [
          'Sequence rules (spec §9) — recommend first, with a reason, then ask:',
          '- Recommend a sequence FIRST (one email or a series, how many, over how many days) with a one-sentence reason, then ask the user to confirm or change it. Patterns are starting points only, never categories to pick from: a single email for a simple offer; a short series (2–3 emails) for a deadline or a reminder; a longer series (up to 6) for a story that needs room.',
          '- Safeguards you must respect and explain in plain words when they bite: sends only on weekdays 8:00–17:00 in the business time zone; at most 3 emails per contact per 7 days across all campaigns; a contact already in another active sequence is skipped, not double-mailed; nothing is sent after the deadline (if the plan would run past it, compress the gaps and say so); at most 6 emails, at most 30 days, at least 1 day between emails; timing is per person from that person\'s first send.',
          '- Fact formatting (so the plan can be assembled exactly): how_many fact = just the number. span_gap fact = "span: N days; gaps: a, b, ..." (gaps in days between consecutive emails). start_deadline fact = "start: YYYY-MM-DD; deadline: YYYY-MM-DD or none" (dates only, no times — sends go out in the morning send window; if the user gives a month and day without a year, ask for the year, never guess it). jobs fact = numbered purposes, one per email, in order (e.g. "1. Announce the offer. 2. Remind before the deadline."). send_timing fact = the send window in plain words (e.g. "weekdays 8 to 5" or "weekday mornings").',
          '- If the user is unsure about the series, recommend the smallest sequence that does the job and say why.',
        ].join('\n')
      : '',
    phase === 'reactions'
      ? [
          'Reaction rules (spec §10) — recommend first, with a reason, then ask. Go through the scheduled emails in order (from the confirmed sequence in this conversation) and ask about each one that can lead somewhere:',
          '- Recommend a reaction FIRST for each email, with a one-sentence reason, then ask the user to confirm or change it. The reliable default: people who have not clicked after 3 days get the next scheduled email; people who click get a short follow-up note an hour later plus an owner alert.',
          '- What you can react to: whether someone did not open, did not click, clicked (optionally a specific link), or clicked but has not replied within some days. Always-on exits are NOT questions — state them once in plain words: anyone who replies, books, or unsubscribes stops immediately; anyone who bounces is suppressed from all campaigns; auto-replies do not count.',
          '- Two reactions are NOT offered, and you must say so in plain words if the user asks: open-only rules (opens cannot be attributed to one email under Gmail-only tracking, so use not-clicked instead — it works for everyone, opened or not) and booking-based rules (the platform does not track bookings; click-plus-no-reply within N days is the supported version, because replies ARE tracked).',
          '- Caps you must respect and explain in plain words when they bite: at most 8 emails per contact per campaign; at least 24 hours between emails except a click reaction sent after its chosen delay; one path per contact per email (if more than one rule could match, the first listed wins); a contact never gets the same email twice, except an explicit resend with a new subject line.',
          '- Open caution (say it once, briefly): open tracking is approximate — some email apps mark every email as opened automatically — so lean on clicks for important decisions.',
          '- Fact formatting (so the plan can be assembled exactly): no_open fact = "action: send-next | resend | nothing; window: N days; email: N" (resend needs a new subject in quotes). open_no_click fact = "skip" unless the user insists (then record the insistence — the plan will still skip it and say why). clicked fact = "action: send-note | alert | tag | nothing; delay: N hours; link: <substring or none>; email: N". clicked_no_reply fact = "days: N; action: alert | nothing; email: N". reaction_jobs fact = numbered purposes, one per reaction email, in order (e.g. "1. Short thank-you note offering the free estimate."). owner_alerts fact = which events the owner hears about (clicks, replies) — alerts always go in-app and email.',
          '- If the user is unsure, recommend the smallest reaction set that does the job and say why.',
        ].join('\n')
      : '',
    'When every item is complete or a placeholder, set phase_complete true, next_question null, and write a 2 to 4 sentence recap.',
    'Return ONLY the JSON object matching the schema. No markdown fences, no extra text.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The Interview JSON schema for Gemini structured output (spec §16). */
export function interviewResponseSchema(): Record<string, unknown> {
  const item = {
    type: 'OBJECT',
    properties: {
      id: { type: 'STRING' },
      label: { type: 'STRING' },
      kind: { type: 'STRING', enum: ['base', 'extra'] },
      reason: { type: 'STRING' },
      status: { type: 'STRING', enum: ['missing', 'vague', 'complete', 'placeholder'] },
      user_words: { type: 'STRING' },
      fact: { type: 'STRING' },
    },
    required: ['id', 'label', 'kind', 'status', 'user_words', 'fact'],
  };
  return {
    type: 'OBJECT',
    properties: {
      phase: { type: 'STRING', enum: ['goal', 'audience', 'cta', 'sequence'] },
      checklist: { type: 'ARRAY', items: item },
      acknowledgment: { type: 'STRING' },
      next_question: { type: 'STRING', nullable: true },
      next_question_target: { type: 'STRING', nullable: true },
      recommendation: { type: 'STRING', nullable: true },
      phase_complete: { type: 'BOOLEAN' },
      recap: { type: 'STRING', nullable: true },
      flags: {
        type: 'OBJECT',
        nullable: true,
        properties: {
          cold_contacts: { type: 'BOOLEAN', nullable: true },
          list_hints: {
            type: 'OBJECT',
            nullable: true,
            properties: {
              relationship: { type: 'STRING' },
              recency: { type: 'STRING' },
              location: { type: 'STRING' },
              status: { type: 'STRING' },
              exclusions: { type: 'STRING' },
            },
          },
          estimated_size: { type: 'INTEGER', nullable: true },
        },
      },
    },
    required: ['phase', 'checklist', 'acknowledgment', 'next_question', 'phase_complete'],
  };
}

export interface TurnContext {
  phase: PhaseId;
  profileSnapshot: Record<string, unknown>;
  conversation: ChatMessage[];
  checklist: PhaseChecklist;
  briefSoFar: BriefObject | null;
}

/** One LLM interview turn. Throws InterviewError(503) when AI is unavailable. */
export async function geminiTurn(
  ctx: TurnContext,
  repair?: { badOutput: unknown; errors: string[] },
): Promise<InterviewTurnOutput> {
  const { tryGetAIClient, INTERVIEW_MODEL } = await import('../../../packages/ai/client.js');
  const ai = tryGetAIClient();
  if (!ai) {
    throw new InterviewError('AI is not configured on this server (GOOGLE_AI_API_KEY is missing). Your answers are saved — try again once AI is configured.', 503, true);
  }
  const snapshot = ctx.profileSnapshot as Record<string, unknown>;
  const wordsToAvoid = String(snapshot.wordsToAvoid || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const contents = repair
    ? [
        {
          role: 'user',
          parts: [
            {
              text: `Your previous Interview JSON output failed validation:\n${repair.errors.join('\n')}\nPrevious output:\n${JSON.stringify(repair.badOutput)}\nFix ONLY those issues and return the full corrected JSON object matching the schema.`,
            },
          ],
        },
      ]
    : [
        {
          role: 'user',
          parts: [
            {
              text: [
                `Business Profile: ${JSON.stringify(snapshot)}`,
                `Current phase: ${ctx.phase}. Current checklist: ${JSON.stringify(ctx.checklist)}`,
                `Brief so far: ${ctx.briefSoFar ? JSON.stringify(ctx.briefSoFar) : 'none yet'}`,
                `Conversation so far:\n${ctx.conversation.map((m) => `${m.role}: ${m.text}`).join('\n')}`,
                'Now produce the next Interview JSON output for the latest user message.',
              ].join('\n\n'),
            },
          ],
        },
      ];
  const call = async (): Promise<InterviewTurnOutput> => {
    const response = await withTimeout(
      ai.models.generateContent({
        model: INTERVIEW_MODEL,
        contents,
        config: {
          systemInstruction: buildSystemPrompt(ctx.phase, wordsToAvoid),
          temperature: repair ? 0.3 : 0.65,
          responseMimeType: 'application/json',
          responseSchema: interviewResponseSchema(),
        },
      }) as Promise<{ text?: string }>,
      AI_TURN_TIMEOUT_MS,
    );
    // Parsing only — validation + repair live in resolveOutput (uniform path).
    return parseJsonText((response.text || '').trim()) as InterviewTurnOutput;
  };
  // Attempt 1 + one retry on transient errors (spec §16: timeout → retry once).
  try {
    return await call();
  } catch (err) {
    if (isAuthError(err)) {
      throw new InterviewError('AI is not configured or the key is invalid. Your answers are saved — try again once AI is configured.', 503, true);
    }
    try {
      return await call();
    } catch (err2) {
      if (isAuthError(err2)) {
        throw new InterviewError('AI is not configured or the key is invalid. Your answers are saved — try again once AI is configured.', 503, true);
      }
      throw new InterviewError('Something went wrong. Your answers are saved.', 503, true);
    }
  }
}

/** Provider signature: the second arg carries a repair request (spec §16). */
export type InterviewProvider = (
  ctx: TurnContext,
  repair?: { badOutput: unknown; errors: string[] },
) => Promise<InterviewTurnOutput>;

/**
 * Calls the provider, validates the output, and repairs up to 2 times.
 * Throws InterviewError(503) when the output never validates (answers saved).
 */
export async function resolveOutput(
  provider: InterviewProvider,
  ctx: TurnContext,
): Promise<InterviewTurnOutput> {
  const previousQuestions = ctx.conversation
    .filter((m) => m.role === 'ai' && m.phase === ctx.phase && m.kind === 'question')
    .map((m) => m.text);
  const validationOpts = {
    timeZone:
      typeof (ctx.profileSnapshot as { timezone?: unknown }).timezone === 'string'
        ? ((ctx.profileSnapshot as { timezone: string }).timezone as string)
        : 'UTC',
    now: new Date(),
  };
  let output = await provider(ctx);
  let errors = validateTurnOutput(output, ctx.phase, previousQuestions, validationOpts);
  let repairs = 0;
  while (errors.length && repairs < AI_TURN_MAX_REPAIRS) {
    repairs += 1;
    try {
      output = await provider(ctx, { badOutput: output, errors });
    } catch {
      break;
    }
    errors = validateTurnOutput(output, ctx.phase, previousQuestions, validationOpts);
  }
  if (errors.length) {
    throw new InterviewError('Something went wrong. Your answers are saved.', 503, true);
  }
  return output;
}

/* ── Draft persistence ─────────────────────────────────────────────────────── */

function toDraftState(row: Record<string, unknown>): DraftState {
  return {
    id: row.id as string,
    workspaceId: row.workspaceId as string,
    currentPhase: row.currentPhase as DraftState['currentPhase'],
    status: row.status as string,
    profileSnapshot: (row.profileSnapshot as Record<string, unknown>) || {},
    conversation: (row.conversation as ChatMessage[]) || [],
    checklists: (row.checklists as DraftState['checklists']) || {},
    brief: (row.brief as BriefObject | null) || null,
    briefVersion: (row.briefVersion as number) || 0,
    sequence: (row.sequence as Record<string, unknown> | null) || null,
    profileNotedAt: row.profileNotedAt ? new Date(row.profileNotedAt as string).toISOString() : null,
    expiresAt: new Date(row.expiresAt as string).toISOString(),
  };
}

function expiryFromNow(): Date {
  return new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Round-trips a value through JSON so Prisma accepts it as a Json field
 * (plain JSON values only — no class instances, no undefined).
 */
function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

async function saveDraftState(draft: DraftState): Promise<void> {
  await db.campaignDraft.update({
    where: { id: draft.id },
    data: {
      currentPhase: draft.currentPhase,
      status: draft.status,
      profileSnapshot: toJson(draft.profileSnapshot),
      conversation: toJson(draft.conversation),
      checklists: toJson(draft.checklists),
      brief: toJson(draft.brief),
      briefVersion: draft.briefVersion,
      sequence: toJson(draft.sequence),
      profileNotedAt: draft.profileNotedAt ? new Date(draft.profileNotedAt) : null,
      expiresAt: expiryFromNow(),
    },
  });
}

export async function createDraft(workspaceId: string): Promise<DraftState> {
  const profile = await getProfile(workspaceId);
  if (!profile) throw new InterviewError('No Business Profile found. Create one first.', 404);
  const { samples, ...rest } = profile as typeof profile & { samples: Array<Record<string, unknown>> };
  const approvedSamples = (samples || [])
    .filter((s) => s.approved)
    .slice(0, 3)
    .map((s) => ({ title: s.title, styleSummary: s.styleSummary }));
  const snapshot = { ...rest, approvedSamples };
  const nowIso = new Date().toISOString();
  const row = await db.campaignDraft.create({
    data: {
      workspaceId,
      currentPhase: 'goal',
      status: 'interviewing',
      profileSnapshot: toJson(snapshot),
      conversation: toJson([
        {
          role: 'ai',
          text: `${phaseBanner('goal')} ${phaseOpening('goal')}`,
          phase: 'goal',
          kind: 'question',
          at: nowIso,
        },
      ]),
      checklists: toJson({ goal: baseChecklist('goal') }),
      sequence: toJson(null),
      expiresAt: expiryFromNow(),
    },
  });
  return toDraftState(row as unknown as Record<string, unknown>);
}

export async function getDraft(workspaceId: string, draftId: string): Promise<DraftState> {
  const row = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!row) throw new InterviewError('Draft not found.', 404);
  const draft = toDraftState(row as unknown as Record<string, unknown>);
  if (isExpired(draft, Date.now())) {
    await db.campaignDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
    throw new InterviewError('This draft expired after 30 days without edits.', 410);
  }
  return draft;
}

export async function listDrafts(workspaceId: string): Promise<DraftState[]> {
  const rows = await db.campaignDraft.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
  const out: DraftState[] = [];
  for (const row of rows) {
    const draft = toDraftState(row as unknown as Record<string, unknown>);
    if (isExpired(draft, Date.now())) {
      await db.campaignDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
      continue;
    }
    out.push(draft);
  }
  return out;
}

export async function deleteDraft(workspaceId: string, draftId: string): Promise<void> {
  await getDraft(workspaceId, draftId);
  await db.campaignDraft.delete({ where: { id: draftId } });
}

export interface TurnResult {
  draft: DraftState;
  aiText: string;
  phaseCompleted: boolean;
  capped: boolean;
  briefReady: boolean;
}

/**
 * Runs one interview turn. The user message is saved BEFORE the LLM call, so a
 * 503 (AI unavailable) never loses an answer — retry re-runs from it.
 * `provider` is injectable for tests (defaults to the Gemini provider).
 */
export async function runTurn(
  workspaceId: string,
  draftId: string,
  message: string,
  provider: InterviewProvider = geminiTurn,
): Promise<TurnResult> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.status !== 'interviewing') {
    throw new InterviewError('This draft is no longer interviewing (status: ' + draft.status + ').', 400);
  }
  const phase = draft.currentPhase;
  if (phase === 'brief_confirm') {
    throw new InterviewError('The Brief is ready for confirmation — use confirm-brief.', 400);
  }
  if (phase === 'sequence_confirmed') {
    throw new InterviewError('The sequence is confirmed — drafting comes next.', 400);
  }
  if (phase === 'reactions_confirm') {
    throw new InterviewError('The reaction plan is ready for confirmation — use confirm-reactions.', 400);
  }
  if (phase === 'reactions_confirmed') {
    throw new InterviewError('Reactions are confirmed — drafting comes next.', 400);
  }
  const text = (message || '').trim();
  if (!text) throw new InterviewError('Type your answer to continue.', 400);
  const nowIso = new Date().toISOString();
  // Autosave first: the answer survives any later AI failure or rate limit.
  const withAnswer: DraftState = {
    ...draft,
    conversation: [...draft.conversation, { role: 'user', text, phase, kind: 'answer', at: nowIso }],
  };
  await saveDraftState(withAnswer);
  if (!checkAiRateLimit(workspaceId)) {
    throw new InterviewError('Too many AI requests for this workspace right now. Try again shortly.', 429, true);
  }
  const checklist = withAnswer.checklists[phase] || baseChecklist(phase);
  const ctx: TurnContext = {
    phase,
    profileSnapshot: withAnswer.profileSnapshot,
    conversation: withAnswer.conversation,
    checklist,
    briefSoFar: withAnswer.brief,
  };
  let output: InterviewTurnOutput;
  try {
    output = await resolveOutput(provider, ctx);
  } catch (err) {
    if (err instanceof InterviewError) throw err;
    throw new InterviewError('Something went wrong. Your answers are saved.', 503, true);
  }
  const applied = applyTurn(withAnswer, output, nowIso);
  await saveDraftState(applied.draft);
  if (applied.draft.reactionsAssembled) {
    const { syncReactionRules } = await import('./reaction-engine.service.js');
    await syncReactionRules(workspaceId, applied.draft.id, applied.draft.reactionsAssembled.rules);
    applied.draft.reactionsAssembled = null;
  }
  return {
    draft: applied.draft,
    aiText: applied.aiText,
    phaseCompleted: applied.phaseCompleted,
    capped: applied.capped,
    briefReady: applied.draft.currentPhase === 'brief_confirm',
  };
}

/** Re-runs the LLM for the last unanswered user message (Retry after a 503). */
export async function retryTurn(
  workspaceId: string,
  draftId: string,
  provider: InterviewProvider = geminiTurn,
): Promise<TurnResult> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.status !== 'interviewing') {
    throw new InterviewError('This draft is no longer interviewing.', 400);
  }
  const lastUserIdx = draft.conversation.map((m) => m.role).lastIndexOf('user');
  if (lastUserIdx < 0) throw new InterviewError('Nothing to retry — no answer has been sent yet.', 400);
  // Already answered if a real AI reply (question/recap/transition/brief) came after.
  const answered = draft.conversation
    .slice(lastUserIdx + 1)
    .some((m) => m.role === 'ai' && m.kind !== 'system');
  if (answered) {
    throw new InterviewError('The last answer already has a reply.', 400);
  }
  const phase = draft.currentPhase;
  if (phase === 'brief_confirm') {
    throw new InterviewError('The Brief is ready for confirmation — use confirm-brief.', 400);
  }
  if (phase === 'sequence_confirmed') {
    throw new InterviewError('The sequence is confirmed — drafting comes next.', 400);
  }
  if (phase === 'reactions_confirm') {
    throw new InterviewError('The reaction plan is ready for confirmation — use confirm-reactions.', 400);
  }
  if (phase === 'reactions_confirmed') {
    throw new InterviewError('Reactions are confirmed — drafting comes next.', 400);
  }
  if (!checkAiRateLimit(workspaceId)) {
    throw new InterviewError('Too many AI requests for this workspace right now. Try again shortly.', 429, true);
  }
  const checklist = draft.checklists[phase] || baseChecklist(phase);
  const ctx: TurnContext = {
    phase,
    profileSnapshot: draft.profileSnapshot,
    conversation: draft.conversation,
    checklist,
    briefSoFar: draft.brief,
  };
  let output: InterviewTurnOutput;
  try {
    output = await resolveOutput(provider, ctx);
  } catch (err) {
    if (err instanceof InterviewError) throw err;
    throw new InterviewError('Something went wrong. Your answers are saved.', 503, true);
  }
  const applied = applyTurn(draft, output, new Date().toISOString());
  await saveDraftState(applied.draft);
  if (applied.draft.reactionsAssembled) {
    const { syncReactionRules } = await import('./reaction-engine.service.js');
    await syncReactionRules(workspaceId, applied.draft.id, applied.draft.reactionsAssembled.rules);
    applied.draft.reactionsAssembled = null;
  }
  return {
    draft: applied.draft,
    aiText: applied.aiText,
    phaseCompleted: applied.phaseCompleted,
    capped: applied.capped,
    briefReady: applied.draft.currentPhase === 'brief_confirm',
  };
}

/** Escape hatch: mark missing items as placeholders and move on (spec §3 rule 7). */
export async function escapeHatch(workspaceId: string, draftId: string): Promise<DraftState> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.status !== 'interviewing') {
    throw new InterviewError('This draft is no longer interviewing.', 400);
  }
  const phase = draft.currentPhase;
  if (phase === 'brief_confirm') {
    throw new InterviewError('The Brief is already ready for confirmation.', 400);
  }
  if (phase === 'sequence_confirmed') {
    throw new InterviewError('The sequence is already confirmed.', 400);
  }
  if (phase === 'reactions_confirm' || phase === 'reactions_confirmed') {
    throw new InterviewError('The reactions are already confirmed.', 400);
  }
  if (countUserAnswers(draft.conversation, phase) < 1) {
    throw new InterviewError('Type at least one answer in this phase first.', 400);
  }
  const next = applyEscapeHatch(draft, new Date().toISOString());
  await saveDraftState(next);
  if (next.reactionsAssembled) {
    const { syncReactionRules } = await import('./reaction-engine.service.js');
    await syncReactionRules(workspaceId, next.id, next.reactionsAssembled.rules);
    next.reactionsAssembled = null;
  }
  return next;
}

/** Reopen a finished phase; later phases are marked "needs review". */
export async function reopenPhase(workspaceId: string, draftId: string, phase: PhaseId): Promise<DraftState> {
  const draft = await getDraft(workspaceId, draftId);
  if (!PHASE_ORDER.includes(phase)) throw new InterviewError('Unknown phase.', 400);
  // Only backward moves are valid: a forward reopen would strand the draft
  // in a phase with no checklist.
  if (!canReopen(draft.currentPhase, phase)) {
    throw new InterviewError('You can only go back to a phase you already completed.', 400);
  }
  const next = applyReopen(draft, phase, new Date().toISOString());
  await saveDraftState(next);
  // A reopen before Phase 5 invalidates the assembled reaction plan: the
  // sequence (or Brief) it was built on may change, so stale rules must
  // never fire against the new plan. They are re-assembled when Phase 5
  // completes again.
  if (INTERVIEW_ORDER.indexOf(phase) < INTERVIEW_ORDER.indexOf('reactions')) {
    await db.reactionRule.deleteMany({ where: { workspaceId, draftId: draft.id } }).catch(() => null);
  }
  return next;
}

function looksGood(text: string): boolean {
  return text.trim().toLowerCase().replace(/[.!]+$/g, '') === 'looks good';
}

/**
 * Brief confirmation (typed only — no Approve buttons, spec default 7).
 * "looks good" locks the Brief as a numbered version. Any other text is a
 * correction: it re-opens Phase 3 and re-runs the digging checks.
 */
export async function confirmBrief(
  workspaceId: string,
  draftId: string,
  confirmation: string,
  provider: InterviewProvider = geminiTurn,
): Promise<{ draft: DraftState; turn?: TurnResult }> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.currentPhase !== 'brief_confirm' || !draft.brief) {
    throw new InterviewError('The Brief is not ready for confirmation yet.', 400);
  }
  // A locked Brief cannot be re-locked: confirm only while interviewing.
  if (draft.status !== 'interviewing') {
    throw new InterviewError('This Brief is already confirmed.', 400);
  }
  const text = (confirmation || '').trim();
  if (!text) throw new InterviewError('Type "looks good", or tell me what to change.', 400);
  const nowIso = new Date().toISOString();
  if (looksGood(text)) {
    const locked: DraftState = {
      ...draft,
      status: 'brief_confirmed',
      briefVersion: draft.briefVersion + 1,
      brief: { ...draft.brief, version: draft.briefVersion + 1 },
      conversation: [
        ...draft.conversation,
        { role: 'user', text, phase: 'brief_confirm', kind: 'answer', at: nowIso },
        { role: 'ai', text: 'Brief confirmed.', phase: 'brief_confirm', kind: 'brief', at: nowIso },
      ],
    };
    await saveDraftState(locked);
    return { draft: locked };
  }
  // Corrections re-run the digging checks in Phase 3 (spec §8).
  const reopened = applyReopen(draft, 'cta', nowIso);
  const withCorrection: DraftState = {
    ...reopened,
    conversation: [...reopened.conversation, { role: 'user', text, phase: 'cta', kind: 'answer', at: nowIso }],
  };
  await saveDraftState(withCorrection);
  const turn = await runTurnFromState(workspaceId, withCorrection, provider);
  return { draft: turn.draft, turn };
}

/**
 * Starts Phase 4 (Sequence and Timing) on a brief_confirmed draft (M4).
 * The locked Brief is never rewritten by Phase 4; the sequence is stored
 * on draft.sequence and the Plan (M6) assembles sequence + reactions + A/B.
 * A brief_confirmed draft WITHOUT a sequence routes here on resume — a
 * 1-email sequence answer behaves exactly like the M3 single-email flow.
 */
export async function startSequence(workspaceId: string, draftId: string): Promise<DraftState> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.status !== 'brief_confirmed' || draft.currentPhase !== 'brief_confirm') {
    throw new InterviewError('Phase 4 starts from a confirmed Brief (status brief_confirmed).', 400);
  }
  if (draft.sequence) {
    throw new InterviewError('This draft already has a sequence.', 400);
  }
  const nowIso = new Date().toISOString();
  const next: DraftState = {
    ...draft,
    currentPhase: 'sequence',
    status: 'interviewing',
    checklists: { ...draft.checklists, sequence: baseChecklist('sequence') },
    conversation: [
      ...draft.conversation,
      { role: 'ai', text: `${phaseBanner('sequence')} ${phaseOpening('sequence')}`, phase: 'sequence', kind: 'question', at: nowIso },
    ],
  };
  await saveDraftState(next);
  return next;
}

/**
 * Starts Phase 5 (Reactions) on a sequence_confirmed draft (M5).
 * The locked Brief and the confirmed sequence are never rewritten by
 * Phase 5; the assembled rules live in ReactionRule rows (synced by the
 * turn/hatch wrappers from the transient marker), and the Plan (M6)
 * assembles sequence + reactions + A/B.
 */
export async function startReactions(workspaceId: string, draftId: string): Promise<DraftState> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.status !== 'sequence_confirmed' || draft.currentPhase !== 'sequence_confirmed') {
    throw new InterviewError('Phase 5 starts from a confirmed sequence (status sequence_confirmed).', 400);
  }
  if (!draft.sequence) {
    throw new InterviewError('This draft has no sequence to react to.', 400);
  }
  const nowIso = new Date().toISOString();
  const next: DraftState = {
    ...draft,
    currentPhase: 'reactions',
    status: 'interviewing',
    checklists: { ...draft.checklists, reactions: baseChecklist('reactions') },
    conversation: [
      ...draft.conversation,
      { role: 'ai', text: `${phaseBanner('reactions')} ${phaseOpening('reactions')}`, phase: 'reactions', kind: 'question', at: nowIso },
    ],
  };
  await saveDraftState(next);
  return next;
}

/**
 * Reaction readback confirmation (typed only — no Approve buttons, spec
 * default 7, mirroring confirmBrief). "looks good" confirms the assembled
 * rules. Any other text is a correction: it re-opens Phase 5 and re-runs
 * the interview from the correction.
 */
export async function confirmReactions(
  workspaceId: string,
  draftId: string,
  confirmation: string,
  provider: InterviewProvider = geminiTurn,
): Promise<{ draft: DraftState; turn?: TurnResult }> {
  const draft = await getDraft(workspaceId, draftId);
  if (draft.currentPhase !== 'reactions_confirm') {
    throw new InterviewError('The reactions readback is not ready for confirmation yet.', 400);
  }
  if (draft.status !== 'interviewing') {
    throw new InterviewError('These reactions are already confirmed.', 400);
  }
  const text = (confirmation || '').trim();
  if (!text) throw new InterviewError('Type "looks good", or tell me what to change.', 400);
  const nowIso = new Date().toISOString();
  if (looksGood(text)) {
    const locked: DraftState = {
      ...draft,
      status: 'reactions_confirmed',
      currentPhase: 'reactions_confirmed',
      conversation: [
        ...draft.conversation,
        { role: 'user', text, phase: 'reactions_confirm', kind: 'answer', at: nowIso },
        { role: 'ai', text: 'Reactions confirmed. Next up, drafting your emails (Phase 7).', phase: 'reactions_confirmed', kind: 'system', at: nowIso },
      ],
    };
    await saveDraftState(locked);
    return { draft: locked };
  }
  // Corrections re-open Phase 5; the rules are re-assembled (replacing the
  // old rows) when Phase 5 completes again.
  const reopened = applyReopen(draft, 'reactions', nowIso);
  const withCorrection: DraftState = {
    ...reopened,
    conversation: [...reopened.conversation, { role: 'user', text, phase: 'reactions', kind: 'answer', at: nowIso }],
  };
  await saveDraftState(withCorrection);
  const turn = await runTurnFromState(workspaceId, withCorrection, provider);
  return { draft: turn.draft, turn };
}

/** Runs a turn from an already-saved draft state (used by confirmBrief). */
async function runTurnFromState(
  workspaceId: string,
  draft: DraftState,
  provider: InterviewProvider,
): Promise<TurnResult> {
  const phase = draft.currentPhase as PhaseId;
  if (!checkAiRateLimit(workspaceId)) {
    throw new InterviewError('Too many AI requests for this workspace right now. Try again shortly.', 429, true);
  }
  const checklist = draft.checklists[phase] || baseChecklist(phase);
  const ctx: TurnContext = {
    phase,
    profileSnapshot: draft.profileSnapshot,
    conversation: draft.conversation,
    checklist,
    briefSoFar: draft.brief,
  };
  let output: InterviewTurnOutput;
  try {
    output = await resolveOutput(provider, ctx);
  } catch (err) {
    if (err instanceof InterviewError) throw err;
    throw new InterviewError('Something went wrong. Your answers are saved.', 503, true);
  }
  const applied = applyTurn(draft, output, new Date().toISOString());
  await saveDraftState(applied.draft);
  if (applied.draft.reactionsAssembled) {
    const { syncReactionRules } = await import('./reaction-engine.service.js');
    await syncReactionRules(workspaceId, applied.draft.id, applied.draft.reactionsAssembled.rules);
    applied.draft.reactionsAssembled = null;
  }
  return {
    draft: applied.draft,
    aiText: applied.aiText,
    phaseCompleted: applied.phaseCompleted,
    capped: applied.capped,
    briefReady: applied.draft.currentPhase === 'brief_confirm',
  };
}

/** Profile-change choice (spec §4): regenerate the snapshot, or keep it as is. */
export async function refreshSnapshot(
  workspaceId: string,
  draftId: string,
  action: 'regenerate' | 'keep',
): Promise<DraftState> {
  const draft = await getDraft(workspaceId, draftId);
  const nowIso = new Date().toISOString();
  if (action === 'regenerate') {
    const profile = await getProfile(workspaceId);
    if (!profile) throw new InterviewError('No Business Profile found.', 404);
    const { samples, ...rest } = profile as typeof profile & { samples: Array<Record<string, unknown>> };
    const approvedSamples = (samples || [])
      .filter((s) => s.approved)
      .slice(0, 3)
      .map((s) => ({ title: s.title, styleSummary: s.styleSummary }));
    const next: DraftState = {
      ...draft,
      profileSnapshot: { ...rest, approvedSamples },
      profileNotedAt: null,
      conversation: [
        ...draft.conversation,
        { role: 'ai', text: 'Profile updated — this draft now uses the new profile.', phase: draft.currentPhase, kind: 'system', at: nowIso },
      ],
    };
    await saveDraftState(next);
    return next;
  }
  const next: DraftState = {
    ...draft,
    profileNotedAt: nowIso,
    conversation: [
      ...draft.conversation,
      { role: 'ai', text: 'Keeping this draft on the original profile snapshot.', phase: draft.currentPhase, kind: 'system', at: nowIso },
    ],
  };
  await saveDraftState(next);
  return next;
}
