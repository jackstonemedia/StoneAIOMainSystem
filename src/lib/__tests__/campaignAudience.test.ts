/**
 * Campaign audience display derivation — Tier 2 follow-ups (Fix A).
 * The editor, the send modal, and the launch button all derive from this
 * one rule, so it is pinned here as a pure function: direct recipients
 * count only when no list / segment / smartList audience is set.
 */
import { describe, it, expect } from 'vitest';
import { deriveAudienceCount, getDirectRecipientCount } from '../campaignAudience';

const list = { contactCount: 120 };

describe('deriveAudienceCount', () => {
  it('a 2-recipient direct draft shows 2, not the first list', () => {
    const campaign = { recipients: [{ id: 'r1' }, { id: 'r2' }] };
    expect(deriveAudienceCount(campaign, list, { smartListId: '', segmentId: '', listId: '' })).toEqual({
      count: 2,
      isDirect: true,
    });
  });

  it('direct rows lose to a set smart list', () => {
    const campaign = { recipients: [{ id: 'r1' }, { id: 'r2' }] };
    expect(deriveAudienceCount(campaign, list, { smartListId: 'sl_1', segmentId: '', listId: '' })).toEqual({
      count: 120,
      isDirect: false,
    });
  });

  it('a smart-list campaign with no direct recipients shows the list count', () => {
    const campaign = { recipients: [] };
    expect(deriveAudienceCount(campaign, list, { smartListId: 'sl_1', segmentId: '', listId: '' })).toEqual({
      count: 120,
      isDirect: false,
    });
  });

  it('falls back to _count.items when contactCount is missing', () => {
    const campaign = { recipients: [] };
    expect(
      deriveAudienceCount(campaign, { _count: { items: 7 } }, { smartListId: 'sl_1', segmentId: '', listId: '' })
    ).toEqual({ count: 7, isDirect: false });
  });

  it('no list and no direct recipients shows All (the send fallback)', () => {
    const campaign = { recipients: [] };
    expect(deriveAudienceCount(campaign, undefined, { smartListId: '', segmentId: '', listId: '' })).toEqual({
      count: 'All',
      isDirect: false,
    });
  });

  it('a campaign without a recipients field is not treated as direct', () => {
    expect(deriveAudienceCount({}, list, { smartListId: '', segmentId: '', listId: '' })).toEqual({
      count: 120,
      isDirect: false,
    });
  });
});

describe('getDirectRecipientCount', () => {
  it('counts the recipients array, 0 when absent', () => {
    expect(getDirectRecipientCount({ recipients: [{ id: 'r1' }] })).toBe(1);
    expect(getDirectRecipientCount({})).toBe(0);
    expect(getDirectRecipientCount(null)).toBe(0);
  });
});
