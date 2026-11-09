/**
 * Sequence graph model — chain mapping + branch vocabulary (round 2).
 * The graph only ever renders the engine's own conditions and actions:
 * there is no OPENED branch anywhere in the vocabulary.
 */
import { describe, it, expect } from 'vitest';
import {
  buildChain,
  branchConditionLabel,
  branchActionLabel,
  type GraphEmail,
} from '../sequenceGraphModel';
import type { DraftEmailState, ReactionRuleState } from '../../../lib/createWithAiApi';

function email(order: number, subject: string): DraftEmailState {
  return {
    id: `e${order}`,
    draftId: 'd1',
    campaignId: null,
    kind: 'scheduled',
    order,
    name: `Email ${order}`,
    purpose: `Purpose ${order}`,
    subjectVariants: [subject],
    subjectSelected: 0,
    previewText: null,
    bodyHtml: '',
    bodyText: '',
    cta: null,
    factMap: [],
    versions: [],
    status: 'draft',
    scheduledAtUtc: null,
    coldAck: false,
    recipientCount: null,
    placeholders: [],
    removedClaims: [],
    newClaims: [],
  } as DraftEmailState;
}

function rule(overrides: Partial<ReactionRuleState>): ReactionRuleState {
  return {
    id: 'r1',
    priority: 0,
    sourceOrder: 1,
    condition: 'NOT_CLICKED',
    conditionParams: {},
    action: 'send_next',
    actionParams: {},
    decisionWindowHours: 72,
    delayMinutes: 60,
    readback: '',
    ...overrides,
  };
}

const sequence = {
  count: 3,
  emails: [
    { order: 1, offsetDays: 0, purpose: 'Welcome' },
    { order: 2, offsetDays: 2, purpose: 'Value' },
    { order: 3, offsetDays: 5, purpose: 'Offer' },
  ],
};

describe('buildChain', () => {
  it('renders a linear chain: email, wait, email, wait, email', () => {
    const chain = buildChain(sequence, [email(1, 'Hi'), email(2, 'More'), email(3, 'Last')], []);
    expect(chain.map((c) => c.kind)).toEqual(['email', 'wait', 'email', 'wait', 'email']);
    const waits = chain.filter((c) => c.kind === 'wait') as { kind: 'wait'; afterOrder: number; days: number }[];
    expect(waits).toEqual([
      { kind: 'wait', afterOrder: 1, days: 2 },
      { kind: 'wait', afterOrder: 2, days: 3 },
    ]);
    const first = chain[0] as { kind: 'email'; email: GraphEmail };
    expect(first.email.subject).toBe('Hi');
    expect(first.email.purpose).toBe('Welcome');
  });

  it('marks emails with no generated draft as not generated yet', () => {
    const chain = buildChain(sequence, [], []);
    const first = chain[0] as { kind: 'email'; email: GraphEmail };
    expect(first.email.status).toBe('not generated yet');
    expect(first.email.subject).toBeNull();
  });

  it('attaches branches after the wait that follows their source email', () => {
    const chain = buildChain(sequence, [email(1, 'Hi'), email(2, 'More'), email(3, 'Last')], [
      rule({ id: 'r1', sourceOrder: 1, condition: 'CLICKED', action: 'send_next' }),
      rule({ id: 'r2', sourceOrder: 2, condition: 'NOT_OPENED', action: 'stop' }),
    ]);
    expect(chain.map((c) => c.kind)).toEqual([
      'email', 'wait', 'branch', 'email', 'wait', 'branch', 'email',
    ]);
    const branches = chain.filter((c) => c.kind === 'branch') as { kind: 'branch'; rule: ReactionRuleState }[];
    expect(branches[0].rule.id).toBe('r1');
    expect(branches[1].rule.id).toBe('r2');
  });

  it('attaches a rule watching the last email after that email', () => {
    const chain = buildChain(sequence, [], [
      rule({ id: 'r9', sourceOrder: 3, condition: 'NOT_CLICKED', action: 'notify' }),
    ]);
    expect(chain[chain.length - 1]).toEqual({ kind: 'branch', rule: expect.objectContaining({ id: 'r9' }) });
  });

  it('returns an empty chain when there is no sequence plan', () => {
    expect(buildChain(null, [], [])).toEqual([]);
    expect(buildChain({}, [], [])).toEqual([]);
  });
});

describe('branch vocabulary', () => {
  it('labels every engine condition in plain words', () => {
    expect(branchConditionLabel(rule({ condition: 'NOT_OPENED' }))).toBe("Didn't open Email 1");
    expect(branchConditionLabel(rule({ condition: 'NOT_CLICKED' }))).toBe("Didn't click Email 1");
    expect(branchConditionLabel(rule({ condition: 'CLICKED' }))).toBe('Clicked Email 1');
    expect(
      branchConditionLabel(rule({ condition: 'CLICKED_LINK', conditionParams: { link: 'https://example.com/pricing' } })),
    ).toBe('Clicked https://example.com/pricing in Email 1');
    expect(branchConditionLabel(rule({ condition: 'CLICKED_NOT_REPLIED' }))).toBe(
      "Clicked Email 1 but didn't reply",
    );
  });

  it('labels every engine action in plain words', () => {
    expect(branchActionLabel(rule({ action: 'send_next' }))).toBe('Send the next email in the sequence');
    expect(branchActionLabel(rule({ action: 'stop' }))).toBe('Stop the sequence for this contact');
    expect(branchActionLabel(rule({ action: 'notify' }))).toBe('Notify me');
    expect(
      branchActionLabel(rule({ action: 'resend', actionParams: { newSubject: 'Still thinking it over?' } })),
    ).toBe('Resend with a new subject: "Still thinking it over?"');
    expect(branchActionLabel(rule({ action: 'tag', actionParams: { tagName: 'engaged' } }))).toBe(
      'Tag the contact "engaged"',
    );
    expect(
      branchActionLabel(rule({ action: 'send_reaction', actionParams: { emailPurpose: 'Nudge the clickers' } })),
    ).toBe('Send a reaction email — Nudge the clickers');
    expect(branchActionLabel(rule({ action: 'send_reaction', actionParams: {} }))).toBe(
      'Send a reaction email (not written yet)',
    );
  });

  it('never offers an opened branch', () => {
    const labels = ['NOT_OPENED', 'NOT_CLICKED', 'CLICKED', 'CLICKED_LINK', 'CLICKED_NOT_REPLIED'].map((c) =>
      branchConditionLabel(rule({ condition: c })),
    );
    expect(labels.join(' ')).not.toMatch(/opened but/i);
    expect(labels.join(' ')).not.toContain('Opened Email');
  });
});
