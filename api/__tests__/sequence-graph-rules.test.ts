/**
 * Sequence graph endpoints — round 2 (2026-11-08).
 *
 * Covers the rules the graph depends on without HTTP plumbing (the live
 * Playwright run exercises the endpoints end to end):
 * - validateReactionRules refuses the "Opened" branch in plain words and
 *   rejects a rule whose source email is outside the sequence.
 * - updateDraftSequence moves waits (re-validating with the plan's own
 *   start as the reference time), and refuses a launched draft / a draft
 *   with no plan / an email-count change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDraft: Record<string, unknown> = {};
const mockUpdate = vi.fn();

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    campaignDraft: {
      findFirst: vi.fn(() => Promise.resolve({ ...mockDraft })),
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return Promise.resolve({ ...mockDraft });
      },
    },
    reactionRule: {
      findMany: vi.fn(() => Promise.resolve([])),
      count: vi.fn(() => Promise.resolve(0)),
    },
    recipientState: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
  },
}));

import { validateReactionRules } from '../services/email-marketing/reaction-engine.service.js';
import { updateDraftSequence } from '../services/email-marketing/sequence.service.js';

function planDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    status: 'reactions_confirmed',
    sequence: {
      count: 3,
      spanDays: 5,
      emails: [
        { order: 1, name: 'Email 1', offsetDays: 0, purpose: 'Welcome', plannedAtUtc: '2026-11-09T15:00:00.000Z' },
        { order: 2, name: 'Email 2', offsetDays: 2, purpose: 'Value', plannedAtUtc: '2026-11-11T15:00:00.000Z' },
        { order: 3, name: 'Email 3', offsetDays: 5, purpose: 'Offer', plannedAtUtc: '2026-11-14T15:00:00.000Z' },
      ],
      startUtc: '2026-11-09T15:00:00.000Z',
      deadlineUtc: null,
      sendWindow: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17, timeZone: 'UTC' },
      pattern: null,
      compressed: false,
      compressionNote: null,
      notes: [],
    },
    ...overrides,
  };
}

describe('validateReactionRules (graph vocabulary)', () => {
  it('refuses the OPENED branch in plain words', () => {
    const problem = validateReactionRules(
      [{ sourceOrder: 1, condition: 'OPENED_NOT_CLICKED', action: 'send_next' }],
      3,
    );
    expect(problem).toMatch(/opens cannot be attributed to one email/i);
    expect(problem).toMatch(/NOT_CLICKED/);
  });

  it('rejects a rule whose source email is outside the sequence', () => {
    const problem = validateReactionRules(
      [{ sourceOrder: 4, condition: 'NOT_CLICKED', action: 'stop' }],
      3,
    );
    expect(problem).toMatch(/outside the sequence \(1–3\)/);
  });

  it('accepts every engine-real condition', () => {
    for (const condition of ['NOT_OPENED', 'NOT_CLICKED', 'CLICKED', 'CLICKED_LINK', 'CLICKED_NOT_REPLIED']) {
      const problem = validateReactionRules(
        [
          {
            sourceOrder: 1,
            condition,
            conditionParams: condition === 'CLICKED_LINK' ? { link: 'https://example.com/x' } : {},
            action: 'send_next',
          },
        ],
        3,
      );
      expect(problem).toBeNull();
    }
  });

  it('requires a new subject for a resend rule', () => {
    const problem = validateReactionRules(
      [{ sourceOrder: 1, condition: 'NOT_OPENED', action: 'resend', actionParams: {} }],
      3,
    );
    expect(problem).toMatch(/new subject line/);
  });
});

describe('updateDraftSequence (graph wait edits)', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    Object.assign(mockDraft, planDraft());
  });

  it('moves a wait and stores the re-validated plan', async () => {
    const next = await updateDraftSequence('ws-1', 'draft-1', [
      { order: 1, offsetDays: 0, purpose: 'Welcome' },
      { order: 2, offsetDays: 4, purpose: 'Value' },
      { order: 3, offsetDays: 7, purpose: 'Offer' },
    ]);
    expect(next.emails.map((e) => e.offsetDays)).toEqual([0, 4, 7]);
    expect(next.spanDays).toBe(7);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const written = (mockUpdate.mock.calls[0][0] as { data: { sequence: { emails: { offsetDays: number }[] } } }).data.sequence;
    expect(written.emails.map((e) => e.offsetDays)).toEqual([0, 4, 7]);
  });

  it('does not fail when the stored start is in the past (the plan has not launched)', async () => {
    Object.assign(mockDraft, planDraft());
    // The stored start (2026-11-09) is in the past relative to any later
    // edit; re-validation must use the plan's own start as "now".
    const next = await updateDraftSequence('ws-1', 'draft-1', [
      { order: 1, offsetDays: 0, purpose: 'Welcome' },
      { order: 2, offsetDays: 3, purpose: 'Value' },
      { order: 3, offsetDays: 6, purpose: 'Offer' },
    ]);
    expect(next.emails.map((e) => e.offsetDays)).toEqual([0, 3, 6]);
  });

  it('refuses a wait that breaks the 1-day gap', async () => {
    await expect(
      updateDraftSequence('ws-1', 'draft-1', [
        { order: 1, offsetDays: 0, purpose: 'Welcome' },
        { order: 2, offsetDays: 0, purpose: 'Value' },
        { order: 3, offsetDays: 5, purpose: 'Offer' },
      ]),
    ).rejects.toThrow(/At least 1 day must separate scheduled emails/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('refuses an email-count change (the graph edits waits only)', async () => {
    await expect(
      updateDraftSequence('ws-1', 'draft-1', [
        { order: 1, offsetDays: 0, purpose: 'Welcome' },
        { order: 2, offsetDays: 2, purpose: 'Value' },
      ]),
    ).rejects.toThrow(/edits waits only/);
  });

  it('refuses a launched draft', async () => {
    Object.assign(mockDraft, planDraft({ status: 'scheduled' }));
    await expect(
      updateDraftSequence('ws-1', 'draft-1', [
        { order: 1, offsetDays: 0, purpose: 'Welcome' },
        { order: 2, offsetDays: 2, purpose: 'Value' },
        { order: 3, offsetDays: 5, purpose: 'Offer' },
      ]),
    ).rejects.toThrow(/already launched/);
  });

  it('refuses a draft with no sequence plan', async () => {
    Object.assign(mockDraft, planDraft({ sequence: null }));
    await expect(
      updateDraftSequence('ws-1', 'draft-1', [{ order: 1, offsetDays: 0, purpose: 'Welcome' }]),
    ).rejects.toThrow(/no sequence plan/);
  });
});
