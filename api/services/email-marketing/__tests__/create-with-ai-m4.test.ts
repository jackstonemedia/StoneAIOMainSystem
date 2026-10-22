/**
 * Create with AI — Milestone 4 unit tests (pure logic, no DB, no network).
 * Covers: validateSequence (counts/gaps/deadline compression/DST/window
 * snap), scheduleForPerson (per-person timing from firstSentAt, deadline
 * block), the interview sequence phase (base items, cap 4, assembly
 * validation, escape-hatch defaults), applyTurn sequence completion, and
 * the sequence runner with an injected sender (the engine's DB-bound
 * functions are mocked at the module boundary; live behavior is verified
 * against the running build, see the M4 evidence log).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateSequence,
  scheduleForPerson,
  zonedTimeToUtc,
  wallTimeExists,
  SequenceError,
  type SequenceInput,
  type ValidatedSequence,
} from '../sequence.service.js';
import {
  baseChecklist,
  phaseQuestionCap,
  assembleSequenceFromChecklist,
  applyTurn,
  type DraftState,
  type InterviewTurnOutput,
} from '../interview.service.js';

const TZ = 'America/Los_Angeles';
const NOW = new Date('2026-10-21T15:00:00.000Z'); // 08:00 PDT

function seqInput(overrides: Partial<SequenceInput> = {}): SequenceInput {
  return {
    count: 3,
    spanDays: 14,
    emails: [
      { offsetDays: 0, purpose: 'Announce the offer' },
      { offsetDays: 7, purpose: 'Remind non-clickers' },
      { offsetDays: 14, purpose: 'Last chance before the deadline' },
    ],
    start: '2026-10-26T15:00:00.000Z', // Monday 08:00 PDT
    deadline: null,
    sendWindow: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, timeZone: TZ },
    ...overrides,
  };
}

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    currentPhase: 'sequence',
    status: 'interviewing',
    profileSnapshot: { businessName: 'Sparkling Homes', timezone: TZ, updatedAt: '2026-10-21T00:00:00.000Z' },
    conversation: [],
    checklists: {},
    brief: null,
    briefVersion: 1,
    sequence: null,
    plan: null,
    planVersion: 0,
    profileNotedAt: null,
    expiresAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateSequence', () => {
  it('accepts a valid 3-email sequence', () => {
    const v = validateSequence(seqInput(), NOW);
    expect(v.count).toBe(3);
    expect(v.emails.map((e) => e.offsetDays)).toEqual([0, 7, 14]);
    expect(v.compressed).toBe(false);
  });

  it('rejects count 0 and count 7', () => {
    expect(() => validateSequence(seqInput({ count: 0, emails: [] }), NOW)).toThrow(SequenceError);
    expect(() =>
      validateSequence(
        seqInput({ count: 7, emails: Array.from({ length: 7 }, (_, i) => ({ offsetDays: i, purpose: `Email ${i + 1}` })) }),
        NOW,
      ),
    ).toThrow(SequenceError);
  });

  it('rejects a gap under 1 day and a first offset that is not 0', () => {
    expect(() =>
      validateSequence(seqInput({ emails: [
        { offsetDays: 0, purpose: 'A' },
        { offsetDays: 0, purpose: 'B' },
        { offsetDays: 14, purpose: 'C' },
      ] }), NOW),
    ).toThrow(SequenceError);
    expect(() =>
      validateSequence(seqInput({ emails: [
        { offsetDays: 1, purpose: 'A' },
        { offsetDays: 7, purpose: 'B' },
        { offsetDays: 14, purpose: 'C' },
      ] }), NOW),
    ).toThrow(SequenceError);
  });

  it('rejects a start in the past', () => {
    expect(() => validateSequence(seqInput({ start: '2026-10-20T15:00:00.000Z' }), NOW)).toThrow(SequenceError);
  });

  it('compresses offsets when the last email falls past the deadline', () => {
    // Deadline Nov 3: the original last email (Nov 9) is past it, so the
    // plan compresses; the compressed last email lands ON the deadline
    // date at the window time (08:00 PST) — the deadline rule is date-
    // granular, not instant-granular.
    const v = validateSequence(seqInput({ deadline: '2026-11-03T15:00:00.000Z' }), NOW);
    expect(v.compressed).toBe(true);
    expect(v.compressionNote).toBeTruthy();
    expect(v.emails[v.emails.length - 1].plannedAtUtc.slice(0, 10) <= '2026-11-03').toBe(true);
  });

  it('rejects a DST-gap wall time (02:30 on spring-forward day) at the zone helper', () => {
    // zonedTimeToUtc converges to a guess; the gap check is wallTimeExists,
    // which validateSequence uses to reject a gap start (defensive — an ISO
    // instant always maps to a real wall time, so the check fires for
    // wall-time inputs that fall in the gap).
    expect(wallTimeExists({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, TZ)).toBe(false);
    expect(wallTimeExists({ year: 2026, month: 3, day: 8, hour: 8, minute: 0, second: 0 }, TZ)).toBe(true);
    const ok = zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 8, minute: 0, second: 0 }, TZ);
    expect(ok.toISOString()).toBe('2026-03-08T15:00:00.000Z');
  });

  it('keeps the wall time across spring-forward (calendar days, not 24h steps)', () => {
    // Friday 2026-03-06 10:00 PST = 18:00Z; +7 calendar days = Friday
    // 2026-03-13 10:00 PDT = 17:00Z (the UTC hour shifts, the wall time stays).
    const spring = validateSequence(
      seqInput({ start: '2026-03-06T18:00:00.000Z' }),
      new Date('2026-03-01T00:00:00.000Z'),
    );
    const scheduled = scheduleForPerson(new Date('2026-03-06T18:00:00.000Z'), spring);
    expect(scheduled[1].scheduledAtUtc).toBe('2026-03-13T17:00:00.000Z');
  });

  it('snaps a start outside the send window into the window', () => {
    // Saturday 08:00 PDT is outside the weekday window.
    const v = validateSequence(seqInput({ start: '2026-10-24T15:00:00.000Z' }), NOW);
    expect(v.notes.join(' ')).toMatch(/window/i);
    expect(new Date(v.startUtc).getDay()).not.toBe(0);
    expect(new Date(v.startUtc).getDay()).not.toBe(6);
  });
});

describe('scheduleForPerson', () => {
  const sequence = validateSequence(seqInput(), NOW);

  it('times later emails from THAT person\'s first send, not a campaign clock', () => {
    // Oct 26 (PDT) and Oct 28 (PDT) first sends, 7 days later, across the
    // Nov 1 fall-back: both land at 08:00 PST (16:00Z), not 15:00Z — the
    // wall time is preserved, and the two dues differ per person.
    const a = scheduleForPerson(new Date('2026-10-26T15:00:00.000Z'), sequence);
    const b = scheduleForPerson(new Date('2026-10-28T15:00:00.000Z'), sequence);
    expect(a[1].scheduledAtUtc).toBe('2026-11-02T16:00:00.000Z');
    expect(b[1].scheduledAtUtc).toBe('2026-11-04T16:00:00.000Z');
    expect(a[1].scheduledAtUtc).not.toBe(b[1].scheduledAtUtc);
  });

  it('blocks a step that would fall after the deadline', () => {
    const tight = validateSequence(seqInput({ deadline: '2026-11-02T15:00:00.000Z' }), NOW);
    // A person whose Email 1 goes out late has no room for Email 3.
    const late = scheduleForPerson(new Date('2026-11-01T15:00:00.000Z'), tight);
    const blocked = late.filter((s) => s.scheduledAtUtc === null);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0].blockedReason).toMatch(/deadline/i);
  });
});

describe('interview sequence phase', () => {
  it('has 6 base items and a question cap of 4', () => {
    expect(baseChecklist('sequence').items).toHaveLength(6);
    expect(baseChecklist('sequence').items.map((i) => i.id)).toEqual([
      'one_or_series', 'how_many', 'span_gap', 'start_deadline', 'jobs', 'send_timing',
    ]);
    expect(phaseQuestionCap('sequence')).toBe(4);
  });

  it('assembles a valid sequence from a complete checklist', () => {
    const items = [
      { id: 'one_or_series', fact: 'A series of emails' },
      { id: 'how_many', fact: '3 emails' },
      { id: 'span_gap', fact: 'span: 14 days; gaps: 7, 7' },
      { id: 'start_deadline', fact: 'start: 2026-10-26; deadline: 2026-11-09' },
      { id: 'jobs', fact: '1. Announce the offer\n2. Remind non-clickers\n3. Last chance' },
      { id: 'send_timing', fact: 'weekdays 8am to 5pm' },
    ];
    const result = assembleSequenceFromChecklist(items, { timeZone: TZ, now: NOW });
    expect(result.ok).toBe(true);
    const seq = result.sequence;
    if (result.ok && seq) {
      expect(seq.count).toBe(3);
      expect(seq.emails.map((e) => e.offsetDays)).toEqual([0, 7, 14]);
      expect(seq.emails[0].purpose).toBe('Announce the offer');
    } else {
      throw new Error('Expected a valid sequence assembly.');
    }
  });

  it('escape-hatch defaults to a single email, never fails on missing data', () => {
    const result = assembleSequenceFromChecklist([], { timeZone: TZ, now: NOW, fromEscapeHatch: true });
    expect(result.ok).toBe(true);
    const seq = result.sequence;
    if (result.ok && seq) {
      expect(seq.count).toBe(1);
      expect(seq.fromEscapeHatch).toBe(true);
    } else {
      throw new Error('Expected a valid sequence assembly.');
    }
  });

  it('fails on contradictory data (past start) rather than silently overriding', () => {
    const items = [
      { id: 'one_or_series', fact: 'A series' },
      { id: 'how_many', fact: '3 emails' },
      { id: 'span_gap', fact: 'span: 14 days; gaps: 7, 7' },
      { id: 'start_deadline', fact: 'start: 2020-01-01; deadline: none' },
      { id: 'jobs', fact: '1. A\n2. B\n3. C' },
      { id: 'send_timing', fact: 'weekdays 8 to 5' },
    ];
    const result = assembleSequenceFromChecklist(items, { timeZone: TZ, now: NOW });
    expect(result.ok).toBe(false);
  });
});

describe('applyTurn sequence completion', () => {
  it('sequence phase_complete sets sequence_confirmed + the sequence object', () => {
    const draft = makeDraft({
      checklists: {
        sequence: {
          items: [
            { id: 'one_or_series', label: 'One or series', kind: 'base', status: 'complete', userWords: 'A series', fact: 'A series', attempts: 1, blocksSending: false },
            { id: 'how_many', label: 'How many', kind: 'base', status: 'complete', userWords: '3 emails', fact: '3 emails', attempts: 1, blocksSending: false },
            { id: 'span_gap', label: 'Span and gaps', kind: 'base', status: 'complete', userWords: '14 days, gaps 7, 7', fact: 'span: 14 days; gaps: 7, 7', attempts: 1, blocksSending: false },
            { id: 'start_deadline', label: 'Start and deadline', kind: 'base', status: 'complete', userWords: 'Start Oct 26, deadline Nov 9', fact: 'start: 2026-10-26; deadline: 2026-11-09', attempts: 1, blocksSending: false },
            { id: 'jobs', label: 'Jobs', kind: 'base', status: 'complete', userWords: 'Announce, remind, last chance', fact: '1. Announce the offer\n2. Remind non-clickers\n3. Last chance', attempts: 1, blocksSending: false },
            { id: 'send_timing', label: 'Send timing', kind: 'base', status: 'complete', userWords: 'Weekdays 8am to 5pm', fact: 'weekdays 8am to 5pm', attempts: 1, blocksSending: false },
          ],
          needsReview: false,
        },
      },
    });
    const output: InterviewTurnOutput = {
      phase: 'sequence',
      checklist: [],
      acknowledgment: 'Got it.',
      next_question: null,
      next_question_target: null,
      recommendation: null,
      phase_complete: true,
      recap: 'Three emails over two weeks.',
    };
    const result = applyTurn(draft, output, '2026-10-21T15:00:00.000Z');
    expect(result.draft.currentPhase).toBe('sequence_confirmed');
    expect(result.draft.status).toBe('sequence_confirmed');
    expect(result.draft.sequence).not.toBeNull();
    const seq = result.draft.sequence as unknown as ValidatedSequence;
    expect(seq.count).toBe(3);
  });
});

// ── Runner (injected sender; engine + render mocked at the module boundary) ──

vi.mock('../sequence.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sequence.service.js')>();
  return {
    ...actual,
    advanceSequence: vi.fn(),
    recordStepSent: vi.fn(),
    isSuppressed: vi.fn(),
  };
});
vi.mock('../send-orchestration.service.js', () => ({
  renderFinalHtml: vi.fn(() => ({ html: '<html>Hi</html>', text: 'Hi' })),
}));
vi.mock('../../../../infrastructure/database/client.js', () => {
  const calls: Record<string, unknown[]> = {};
  const db = {
    __calls: calls,
    recipientState: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      update: vi.fn(async (_args: unknown) => ({})),
    },
    campaignEmail: { findFirst: vi.fn(async () => null) },
    campaign: { findFirst: vi.fn(async () => null) },
    contact: {
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    emailEvent: { create: vi.fn(async () => ({})) },
    contactEvent: { create: vi.fn(async () => ({})) },
  };
  return { db };
});

import { advanceSequence, recordStepSent, isSuppressed } from '../sequence.service.js';
import { processDueSequenceSteps } from '../sequence-runner.service.js';
import { db } from '../../../../infrastructure/database/client.js';

const mockedAdvance = vi.mocked(advanceSequence);
const mockedRecord = vi.mocked(recordStepSent);
const mockedSuppressed = vi.mocked(isSuppressed);
const fakeDb = db as unknown as {
  recipientState: { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  campaignEmail: { findFirst: ReturnType<typeof vi.fn> };
  campaign: { findFirst: ReturnType<typeof vi.fn> };
  contact: { findFirst: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  emailEvent: { create: ReturnType<typeof vi.fn> };
  contactEvent: { create: ReturnType<typeof vi.fn> };
};

const SEQUENCE_FIXTURE = {
  count: 3,
  spanDays: 14,
  emails: [
    { order: 1, name: 'Email 1', offsetDays: 0, purpose: 'Announce', plannedAtUtc: '2026-10-26T15:00:00.000Z' },
    { order: 2, name: 'Email 2', offsetDays: 7, purpose: 'Remind', plannedAtUtc: '2026-11-02T15:00:00.000Z' },
    { order: 3, name: 'Email 3', offsetDays: 14, purpose: 'Last chance', plannedAtUtc: '2026-11-09T15:00:00.000Z' },
  ],
  startUtc: '2026-10-26T15:00:00.000Z',
  deadlineUtc: null,
  sendWindow: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, timeZone: TZ },
  pattern: null,
  compressed: false,
  compressionNote: null,
  notes: [],
};

function setupRunnerDb(opts: { campaignStatus: string; senderThrows?: boolean }) {
  const draft = {
    id: 'draft-1',
    workspaceId: 'ws-1',
    sequence: SEQUENCE_FIXTURE,
    profileSnapshot: { businessName: 'Sparkling Homes', physicalAddress: '1 Main St', senderName: 'Jack Stone' },
  };
  fakeDb.recipientState.findMany.mockResolvedValue([{ draftId: 'draft-1', contactId: 'c-1', draft }]);
  fakeDb.campaignEmail.findFirst.mockImplementation(async (args: unknown) => {
    const where = (args as { where: { order?: number } }).where;
    if (where.order === 1) return { id: 'email-1', campaignId: 'cmp-1' };
    if (where.order === 2) return { id: 'email-2', campaignId: null, subjectVariants: ['Second'], subjectSelected: 0, bodyHtml: '<p>Hi</p>', bodyText: 'Hi' };
    return null;
  });
  fakeDb.campaign.findFirst.mockResolvedValue({ id: 'cmp-1', status: opts.campaignStatus });
  fakeDb.recipientState.findFirst.mockResolvedValue({
    id: 'state-1', status: 'active', nextEmailOrder: 2, nextSendAt: new Date('2026-11-02T15:00:00.000Z'), history: [],
  });
  fakeDb.contact.findFirst.mockResolvedValue({ id: 'c-1', email: 'a@example.com', firstName: 'Ann', lastName: 'Lee' });
  mockedAdvance.mockResolvedValue({
    due: 1, exited: 0, skipped: 0,
    details: [{ contactId: 'c-1', to: 'due', reason: 'Email 2 is due.', nextSendAt: '2026-11-02T15:00:00.000Z', nextEmailOrder: 2 }],
  });
  mockedSuppressed.mockResolvedValue(false);
  mockedRecord.mockResolvedValue({ status: 'active', nextEmailOrder: 3, nextSendAt: '2026-11-09T15:00:00.000Z' });
}

describe('processDueSequenceSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a due step via the injected sender, records the event, and advances', async () => {
    setupRunnerDb({ campaignStatus: 'SENT' });
    const sent: unknown[] = [];
    const totals = await processDueSequenceSteps(new Date('2026-11-02T15:00:00.000Z'), {
      sender: async (args) => {
        sent.push(args);
        return { messageId: 'gmail-1' };
      },
    });
    expect(totals.sent).toBe(1);
    expect(sent).toHaveLength(1);
    const call = sent[0] as { contact: { email: string }; subject: string };
    expect(call.contact.email).toBe('a@example.com');
    expect(call.subject).toBe('Second');
    expect(fakeDb.emailEvent.create).toHaveBeenCalled();
    expect(mockedRecord).toHaveBeenCalled();
  });

  it('skips the whole sequence when the Email 1 campaign is PAUSED, leaving states due', async () => {
    setupRunnerDb({ campaignStatus: 'PAUSED' });
    const sent: unknown[] = [];
    const totals = await processDueSequenceSteps(new Date('2026-11-02T15:00:00.000Z'), {
      sender: async (args) => {
        sent.push(args);
        return { messageId: 'gmail-1' };
      },
    });
    expect(totals.sent).toBe(0);
    expect(sent).toHaveLength(0);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('backs off 1h on send failure and does NOT advance', async () => {
    setupRunnerDb({ campaignStatus: 'SENT' });
    const totals = await processDueSequenceSteps(new Date('2026-11-02T15:00:00.000Z'), {
      sender: async () => {
        throw new Error('Gmail down');
      },
    });
    expect(totals.failed).toBe(1);
    expect(mockedRecord).not.toHaveBeenCalled();
    const updateCall = fakeDb.recipientState.update.mock.calls[0]?.[0] as { data: { nextSendAt: Date } } | undefined;
    expect(updateCall).toBeDefined();
    expect(updateCall?.data.nextSendAt.getTime()).toBe(
      new Date('2026-11-02T16:00:00.000Z').getTime(),
    );
  });
});
