import { describe, expect, it } from 'vitest';
import { draftSummary, relativeEdited } from '../draftSummary';
import type { CampaignDraftState } from '../../../lib/createWithAiApi';

function draft(over: Partial<CampaignDraftState>): CampaignDraftState {
  return {
    id: 'd1',
    workspaceId: 'ws',
    currentPhase: 'goal',
    status: 'interviewing',
    profileSnapshot: {},
    conversation: [],
    checklists: {},
    brief: null,
    briefVersion: 0,
    sequence: null,
    profileNotedAt: null,
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  } as CampaignDraftState;
}

describe('draftSummary', () => {
  it('uses the first user answer, in the user’s own words', () => {
    const d = draft({
      conversation: [
        { role: 'ai', text: 'What do you want to send?', phase: 'goal', kind: 'question', at: '' },
        { role: 'user', text: 'Reach dental practices and book a demo.', phase: 'goal', kind: 'answer', at: '' },
      ],
    });
    expect(draftSummary(d)).toBe('Reach dental practices and book a demo.');
  });

  it('truncates a long first answer', () => {
    const d = draft({
      conversation: [{ role: 'user', text: 'x'.repeat(200), phase: 'goal', kind: 'answer', at: '' }],
    });
    const s = draftSummary(d);
    expect(s.length).toBeLessThanOrEqual(90);
    expect(s.endsWith('…')).toBe(true);
  });

  it('falls back to New campaign with no answers yet', () => {
    expect(draftSummary(draft({}))).toBe('New campaign');
  });
});

describe('relativeEdited', () => {
  it('reads just now / minutes / hours / days', () => {
    const now = Date.now();
    expect(relativeEdited(new Date(now - 30 * 1000).toISOString())).toBe('Edited just now');
    expect(relativeEdited(new Date(now - 5 * 60000).toISOString())).toBe('Edited 5m ago');
    expect(relativeEdited(new Date(now - 3 * 3600000).toISOString())).toBe('Edited 3h ago');
    expect(relativeEdited(new Date(now - 2 * 86400000).toISOString())).toBe('Edited 2d ago');
    expect(relativeEdited(null)).toBe('');
    expect(relativeEdited('not-a-date')).toBe('');
  });
});
