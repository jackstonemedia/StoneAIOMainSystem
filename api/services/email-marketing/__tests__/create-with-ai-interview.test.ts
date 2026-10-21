/**
 * Create with AI — Milestone 2 unit tests (pure logic, no DB, no network).
 * Covers: base checklists, Interview JSON validation, the two-attempt rule,
 * question caps, the escape hatch, reopen/needs-review, Brief assembly,
 * profile-change detection, the repair loop, and the Appendix B fixture
 * conversations B1 (thin answers), B2 (audience + cold contacts) and B5
 * (detailed first answer → exactly one follow-up).
 * Live Gemini turns and live API routes are verified against the running
 * build (see the M2 evidence log), not here, because the dev key is a stub.
 */

import { describe, it, expect } from 'vitest';
import {
  baseChecklist,
  validateTurnOutput,
  applyTurn,
  applyEscapeHatch,
  applyReopen,
  canReopen,
  assembleBrief,
  recapFromChecklist,
  profileChangedSinceSnapshot,
  resolveOutput,
  checkAiRateLimit,
  resetAiRateLimit,
  AI_CALLS_PER_HOUR,
  type DraftState,
  type InterviewTurnOutput,
  type TurnContext,
} from '../interview.service.js';

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    currentPhase: 'goal',
    status: 'interviewing',
    profileSnapshot: { businessName: 'Sparkling Homes', updatedAt: '2026-10-21T00:00:00.000Z' },
    conversation: [],
    checklists: {},
    brief: null,
    briefVersion: 0,
    profileNotedAt: null,
    expiresAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

function goalOutput(overrides: Partial<InterviewTurnOutput> = {}): InterviewTurnOutput {
  return {
    phase: 'goal',
    checklist: [
      { id: 'campaign', label: 'The campaign, specifically', kind: 'base', status: 'complete', user_words: 'Outreach to realtors', fact: 'Outreach to realtors' },
      { id: 'outcome', label: 'The outcome', kind: 'base', status: 'complete', user_words: 'Get referrals', fact: 'Get referrals' },
      { id: 'why_now', label: 'Why now', kind: 'base', status: 'complete', user_words: 'Fall pickup', fact: 'Fall pickup' },
      { id: 'must_include_facts', label: 'Must-include facts', kind: 'base', status: 'complete', user_words: 'Free estimate', fact: 'Free estimate' },
      { id: 'limits', label: 'Limits', kind: 'base', status: 'complete', user_words: 'No brand new promise', fact: 'No brand new promise' },
      { id: 'only_you', label: 'The "only you" detail', kind: 'base', status: 'complete', user_words: '40 builds, one day', fact: '40 builds, one day' },
    ],
    acknowledgment: 'Got it.',
    next_question: null,
    next_question_target: null,
    recommendation: null,
    phase_complete: true,
    recap: 'You want to reach realtors for referrals.',
    ...overrides,
  };
}

describe('baseChecklist', () => {
  it('has 6 goal, 7 audience, 5 cta base items, all missing', () => {
    expect(baseChecklist('goal').items).toHaveLength(6);
    expect(baseChecklist('audience').items).toHaveLength(7);
    expect(baseChecklist('cta').items).toHaveLength(5);
    for (const p of ['goal', 'audience', 'cta'] as const) {
      expect(baseChecklist(p).items.every((i) => i.status === 'missing')).toBe(true);
    }
  });

  it('audience items never block sending; others do', () => {
    expect(baseChecklist('audience').items.every((i) => !i.blocksSending)).toBe(true);
    expect(baseChecklist('goal').items.every((i) => i.blocksSending)).toBe(true);
    expect(baseChecklist('cta').items.every((i) => i.blocksSending)).toBe(true);
  });
});

describe('validateTurnOutput', () => {
  it('passes a valid output', () => {
    expect(validateTurnOutput(goalOutput(), 'goal', [])).toEqual([]);
  });

  it('rejects a missing base item', () => {
    const out = goalOutput();
    out.checklist = out.checklist.filter((i) => i.id !== 'limits');
    expect(validateTurnOutput(out, 'goal', [])).toEqual(
      expect.arrayContaining([expect.stringContaining('limits')]),
    );
  });

  it('rejects more than 6 extra items', () => {
    const out = goalOutput();
    for (let i = 0; i < 7; i++) {
      out.checklist.push({ id: `extra-${i}`, label: `Extra ${i}`, kind: 'extra', status: 'missing', user_words: '', fact: '' });
    }
    expect(validateTurnOutput(out, 'goal', [])).toEqual(
      expect.arrayContaining([expect.stringContaining('extra items exceed')]),
    );
  });

  it('rejects a repeated question', () => {
    const out = goalOutput({ phase_complete: false, next_question: 'What is the goal?', next_question_target: 'campaign' });
    expect(validateTurnOutput(out, 'goal', ['What is the goal?'])).toEqual(
      expect.arrayContaining([expect.stringContaining('repeats')]),
    );
  });

  it('rejects a bad status and a wrong phase', () => {
    const out = goalOutput();
    (out.checklist[0] as { status: string }).status = 'done';
    expect(validateTurnOutput(out, 'goal', []).length).toBeGreaterThan(0);
    expect(validateTurnOutput(goalOutput(), 'audience', []).length).toBeGreaterThan(0);
  });

  it('requires a recap when complete and a question when not', () => {
    const completeNoRecap = goalOutput({ recap: null });
    expect(validateTurnOutput(completeNoRecap, 'goal', []).length).toBeGreaterThan(0);
    const openNoQuestion = goalOutput({ phase_complete: false, next_question: null });
    expect(validateTurnOutput(openNoQuestion, 'goal', []).length).toBeGreaterThan(0);
  });
});

describe('applyTurn + two-attempt rule', () => {
  it('merges statuses and advances the phase on completion', () => {
    const draft = makeDraft({
      conversation: [
        { role: 'ai', text: 'Phase 1 of 8: Goal. What do you want to send?', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
        { role: 'user', text: 'Outreach to realtors', phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' },
      ],
      checklists: { goal: baseChecklist('goal') },
    });
    const { draft: next, phaseCompleted } = applyTurn(draft, goalOutput(), '2026-10-21T00:02:00.000Z');
    expect(phaseCompleted).toBe(true);
    expect(next.currentPhase).toBe('audience');
    expect(next.conversation.some((m) => m.kind === 'transition')).toBe(true);
    expect(next.conversation.some((m) => m.phase === 'audience' && m.kind === 'question')).toBe(true);
  });

  it('marks an item placeholder after two vague attempts', () => {
    const prev = baseChecklist('goal');
    prev.items.find((i) => i.id === 'campaign')!.status = 'vague';
    prev.items.find((i) => i.id === 'campaign')!.attempts = 1;
    prev.items.find((i) => i.id === 'campaign')!.userWords = 'Outreach';
    const draft = makeDraft({
      conversation: [
        { role: 'ai', text: 'Outreach to whom?', phase: 'goal', kind: 'question', target: 'campaign', at: '2026-10-21T00:00:00.000Z' },
        { role: 'user', text: 'Realtors', phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' },
      ],
      checklists: { goal: prev },
    });
    const out = goalOutput({ phase_complete: false, recap: null, next_question: 'What should happen?', next_question_target: 'outcome' });
    out.checklist.find((i) => i.id === 'campaign')!.status = 'vague';
    out.checklist.find((i) => i.id === 'campaign')!.user_words = 'Realtors';
    const { draft: next } = applyTurn(draft, out, '2026-10-21T00:02:00.000Z');
    expect(next.checklists.goal!.items.find((i) => i.id === 'campaign')!.status).toBe('placeholder');
  });

  it('audience placeholders from the two-attempt rule never block sending', () => {
    const prev = baseChecklist('audience');
    prev.items.find((i) => i.id === 'who')!.status = 'vague';
    prev.items.find((i) => i.id === 'who')!.attempts = 1;
    const draft = makeDraft({
      currentPhase: 'audience',
      conversation: [
        { role: 'ai', text: 'Who will read this?', phase: 'audience', kind: 'question', target: 'who', at: '2026-10-21T00:00:00.000Z' },
        { role: 'user', text: 'Everyone', phase: 'audience', kind: 'answer', at: '2026-10-21T00:01:00.000Z' },
      ],
      checklists: { audience: prev },
    });
    const out: InterviewTurnOutput = {
      phase: 'audience',
      checklist: prev.items.map((i) => ({
        id: i.id, label: i.label, kind: i.kind, status: i.id === 'who' ? 'vague' : 'missing', user_words: '', fact: '',
      })),
      acknowledgment: '',
      next_question: 'Picture one typical person. Who are they?',
      next_question_target: 'who',
      recommendation: null,
      phase_complete: false,
      recap: null,
    };
    const { draft: next, audienceThin } = applyTurn(draft, out, '2026-10-21T00:02:00.000Z');
    const item = next.checklists.audience!.items.find((i) => i.id === 'who')!;
    expect(item.status).toBe('placeholder');
    expect(item.blocksSending).toBe(false);
    expect(audienceThin).toBe(true);
  });

  it('forces completion at the 8-question phase cap', () => {
    const conversation = [];
    for (let i = 0; i < 8; i++) {
      conversation.push({ role: 'ai', text: `Question ${i}?`, phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' });
      conversation.push({ role: 'user', text: 'An answer', phase: 'goal', kind: 'answer', at: '2026-10-21T00:00:00.000Z' });
    }
    const draft = makeDraft({
      conversation: conversation as never,
      checklists: { goal: baseChecklist('goal') },
    });
    const out = goalOutput({ phase_complete: false, recap: null, next_question: 'One more?', next_question_target: 'campaign' });
    out.checklist.forEach((i) => { i.status = 'missing'; });
    const { draft: next, capped, phaseCompleted } = applyTurn(draft, out, '2026-10-21T00:02:00.000Z');
    expect(capped).toBe(true);
    expect(phaseCompleted).toBe(true);
    expect(next.checklists.goal!.items.every((i) => i.status === 'placeholder' || i.status === 'complete')).toBe(true);
  });
});

describe('escape hatch, reopen, brief', () => {
  it('escape hatch placeholders missing items and advances', () => {
    const draft = makeDraft({
      conversation: [
        { role: 'ai', text: 'Phase 1 of 8: Goal. What do you want to send?', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
        { role: 'user', text: 'Something', phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' },
      ],
      checklists: { goal: baseChecklist('goal') },
    });
    const next = applyEscapeHatch(draft, '2026-10-21T00:02:00.000Z');
    expect(next.currentPhase).toBe('audience');
    expect(next.checklists.goal!.items.every((i) => i.status === 'placeholder')).toBe(true);
  });

  it('reopen marks later phases needs-review and unlocks the brief', () => {
    const draft = makeDraft({
      currentPhase: 'brief_confirm',
      status: 'brief_confirmed',
      checklists: { goal: baseChecklist('goal'), audience: baseChecklist('audience'), cta: baseChecklist('cta') },
    });
    const next = applyReopen(draft, 'audience', '2026-10-21T00:02:00.000Z');
    expect(next.currentPhase).toBe('audience');
    expect(next.status).toBe('interviewing');
    expect(next.checklists.audience!.needsReview).toBe(true);
    expect(next.checklists.cta!.needsReview).toBe(true);
    expect(next.checklists.goal!.needsReview).toBe(false);
  });

  it('canReopen allows only strictly backward moves', () => {
    expect(canReopen('brief_confirm', 'cta')).toBe(true);
    expect(canReopen('brief_confirm', 'goal')).toBe(true);
    expect(canReopen('cta', 'goal')).toBe(true);
    expect(canReopen('cta', 'cta')).toBe(false);
    expect(canReopen('goal', 'audience')).toBe(false);
    expect(canReopen('audience', 'audience')).toBe(false);
  });

  it('assembles the Brief from checklists with plain-language text', () => {
    const g = baseChecklist('goal');
    g.items.find((i) => i.id === 'campaign')!.userWords = 'Email past customers about the $149 wash';
    g.items.find((i) => i.id === 'outcome')!.userWords = 'Get bookings';
    g.items.find((i) => i.id === 'why_now')!.userWords = 'Offer ends Nov 15';
    const a = baseChecklist('audience');
    a.items.find((i) => i.id === 'who')!.userWords = 'Past customers from 2022 and 2023';
    a.flags = { coldContacts: false, listHints: { relationship: 'past customers' }, estimatedSize: 400 };
    const c = baseChecklist('cta');
    c.items.find((i) => i.id === 'action')!.userWords = 'Book through the link';
    c.items.find((i) => i.id === 'where_how')!.userWords = 'https://sparkling.example/book';
    const draft = makeDraft({ checklists: { goal: g, audience: a, cta: c } });
    const brief = assembleBrief(draft);
    expect(brief.campaign_definition.user_words).toContain('$149 wash');
    expect(brief.audience.estimated_size).toBe(400);
    expect(brief.audience.cold_contacts).toBe(false);
    expect(brief.cta.destination).toContain('sparkling.example');
    expect(brief.text).toContain('Type "looks good"');
  });

  it('recapFromChecklist joins completed items', () => {
    const items = baseChecklist('goal').items;
    items[0].status = 'complete';
    items[0].userWords = 'Email past customers';
    expect(recapFromChecklist(items)).toContain('Email past customers');
  });

  it('profileChangedSinceSnapshot respects updates and noted choices', () => {
    const draft = makeDraft();
    expect(profileChangedSinceSnapshot(draft, '2026-10-22T00:00:00.000Z')).toBe(true);
    expect(profileChangedSinceSnapshot(draft, '2026-10-20T00:00:00.000Z')).toBe(false);
    const noted = makeDraft({ profileNotedAt: '2026-10-22T00:00:00.000Z' });
    expect(profileChangedSinceSnapshot(noted, '2026-10-22T00:00:00.000Z')).toBe(false);
  });
});

describe('resolveOutput repair loop', () => {
  it('repairs an invalid output and resolves the valid one', async () => {
    const valid = goalOutput();
    const calls: Array<unknown> = [];
    const provider = async (_ctx: TurnContext, repair?: { badOutput: unknown; errors: string[] }) => {
      calls.push(repair ? 'repair' : 'initial');
      if (!repair) {
        const bad = goalOutput();
        bad.checklist = bad.checklist.filter((i) => i.id !== 'limits');
        return bad;
      }
      return valid;
    };
    const out = await resolveOutput(provider, {
      phase: 'goal',
      profileSnapshot: {},
      conversation: [],
      checklist: baseChecklist('goal'),
      briefSoFar: null,
    });
    expect(out.checklist.find((i) => i.id === 'limits')).toBeTruthy();
    expect(calls).toEqual(['initial', 'repair']);
  });

  it('throws a 503-style error when output never validates', async () => {
    const provider = async () => {
      const bad = goalOutput();
      bad.checklist = bad.checklist.filter((i) => i.id !== 'limits');
      return bad;
    };
    await expect(
      resolveOutput(provider, {
        phase: 'goal',
        profileSnapshot: {},
        conversation: [],
        checklist: baseChecklist('goal'),
        briefSoFar: null,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe('rate limit', () => {
  it('allows up to the hourly budget, then blocks, and resets', () => {
    resetAiRateLimit();
    for (let i = 0; i < AI_CALLS_PER_HOUR; i++) {
      expect(checkAiRateLimit('ws-rate')).toBe(true);
    }
    expect(checkAiRateLimit('ws-rate')).toBe(false);
    resetAiRateLimit();
    expect(checkAiRateLimit('ws-rate')).toBe(true);
  });
});

/* ── Appendix B fixture transcripts ────────────────────────────────────────── */

function scriptedProvider(outputs: InterviewTurnOutput[]) {
  let i = 0;
  return async (_ctx: TurnContext, repair?: { badOutput: unknown; errors: string[] }) => {
    if (repair) return outputs[Math.min(i, outputs.length - 1)];
    const out = outputs[Math.min(i, outputs.length - 1)];
    i += 1;
    return out;
  };
}

function goalItem(id: string, label: string, status: 'missing' | 'vague' | 'complete', words: string) {
  return { id, label, kind: 'base' as const, status, user_words: words, fact: words };
}

describe('Appendix B fixtures', () => {
  it('B5: a detailed first answer leads to exactly one follow-up', async () => {
    const draft = makeDraft({
      conversation: [
        { role: 'ai', text: 'Phase 1 of 8: Goal. What do you want to send?', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
      ],
      checklists: { goal: baseChecklist('goal') },
    });
    const detailed =
      "I want to email my past customers from 2022 and 2023 who haven't booked since, offering a flat $149 driveway and walkway pressure wash through Nov 15. They book through my link. We bring our own water, we're a two-person crew, and we've done about 600 driveways in San Jose. Don't promise it removes every stain.";
    const outputs: InterviewTurnOutput[] = [
      {
        phase: 'goal',
        checklist: [
          goalItem('campaign', 'The campaign, specifically', 'complete', 'Email past customers from 2022 and 2023 about the $149 wash'),
          goalItem('outcome', 'The outcome', 'complete', 'Get them to book'),
          goalItem('why_now', 'Why now', 'complete', 'Offer through Nov 15'),
          goalItem('must_include_facts', 'Must-include facts', 'complete', '$149 driveway and walkway pressure wash, through Nov 15, book through link, own water, two-person crew, 600 driveways in San Jose'),
          goalItem('limits', 'Limits', 'complete', "Don't promise it removes every stain"),
          goalItem('only_you', 'The "only you" detail', 'complete', '600 driveways, own water, two-person crew'),
        ],
        acknowledgment: 'Got it.',
        next_question: 'One quick check: does the $149 cover the driveway and walkway together, up to any size?',
        next_question_target: 'must_include_facts',
        recommendation: null,
        phase_complete: false,
        recap: null,
      },
      {
        phase: 'goal',
        checklist: [
          goalItem('campaign', 'The campaign, specifically', 'complete', 'Email past customers from 2022 and 2023 about the $149 wash'),
          goalItem('outcome', 'The outcome', 'complete', 'Get them to book'),
          goalItem('why_now', 'Why now', 'complete', 'Offer through Nov 15'),
          goalItem('must_include_facts', 'Must-include facts', 'complete', '$149 driveway and walkway together up to 1,000 square feet combined; larger gets a quote'),
          goalItem('limits', 'Limits', 'complete', "Don't promise it removes every stain"),
          goalItem('only_you', 'The "only you" detail', 'complete', '600 driveways, own water, two-person crew'),
        ],
        acknowledgment: 'Got it.',
        next_question: null,
        next_question_target: null,
        recommendation: null,
        phase_complete: true,
        recap: 'You want to email past customers from 2022 and 2023 about a $149 driveway and walkway wash through Nov 15, together up to 1,000 square feet.',
      },
    ];
    const provider = scriptedProvider(outputs);
    // Turn 1: detailed answer → exactly one follow-up question.
    let state = { ...draft, conversation: [...draft.conversation, { role: 'user', text: detailed, phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' }] } as DraftState;
    const out1 = await resolveOutput(provider, { phase: 'goal', profileSnapshot: {}, conversation: state.conversation, checklist: baseChecklist('goal'), briefSoFar: null });
    const applied1 = applyTurn(state, out1, '2026-10-21T00:02:00.000Z');
    expect(applied1.phaseCompleted).toBe(false);
    expect(applied1.draft.conversation.filter((m) => m.role === 'ai' && m.kind === 'question')).toHaveLength(2); // opening + 1 follow-up
    // Turn 2: follow-up answer → complete.
    state = { ...applied1.draft, conversation: [...applied1.draft.conversation, { role: 'user', text: 'Together, up to 1,000 square feet combined. Larger gets a quote.', phase: 'goal', kind: 'answer', at: '2026-10-21T00:03:00.000Z' }] } as DraftState;
    const out2 = await resolveOutput(provider, { phase: 'goal', profileSnapshot: {}, conversation: state.conversation, checklist: applied1.draft.checklists.goal!, briefSoFar: null });
    const applied2 = applyTurn(state, out2, '2026-10-21T00:04:00.000Z');
    expect(applied2.phaseCompleted).toBe(true);
    expect(applied2.draft.currentPhase).toBe('audience');
    expect(applied2.draft.checklists.goal!.items.every((i) => i.status === 'complete')).toBe(true);
  });

  it('B1: thin answers keep getting follow-ups until the campaign is specific', async () => {
    const draft = makeDraft({
      conversation: [
        { role: 'ai', text: 'Phase 1 of 8: Goal. What do you want to send?', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
      ],
      checklists: { goal: baseChecklist('goal') },
    });
    const thin = (q: string, target: string, campaign: string, campaignStatus: 'vague' | 'complete'): InterviewTurnOutput => ({
      phase: 'goal',
      checklist: [
        goalItem('campaign', 'The campaign, specifically', campaignStatus, campaign),
        goalItem('outcome', 'The outcome', 'missing', ''),
        goalItem('why_now', 'Why now', 'missing', ''),
        goalItem('must_include_facts', 'Must-include facts', 'missing', ''),
        goalItem('limits', 'Limits', 'missing', ''),
        goalItem('only_you', 'The "only you" detail', 'missing', ''),
      ],
      acknowledgment: 'Got it.',
      next_question: q,
      next_question_target: target,
      recommendation: null,
      phase_complete: false,
      recap: null,
    });
    const outputs: InterviewTurnOutput[] = [
      thin('Outreach to whom, and what do you want to come out of it?', 'campaign', 'Outreach', 'vague'),
      thin('Any realtors, or a particular kind?', 'campaign', 'Realtors', 'vague'),
      {
        phase: 'goal',
        checklist: [
          goalItem('campaign', 'The campaign, specifically', 'complete', 'Outreach to new-construction realtors in San Jose and Santa Clara for pre-closing exterior cleaning referrals'),
          goalItem('outcome', 'The outcome', 'complete', 'Realtors send buyers for cleaning right before closing'),
          goalItem('why_now', 'Why now', 'complete', 'New construction is picking up this fall'),
          goalItem('must_include_facts', 'Must-include facts', 'complete', 'Free estimate for any home sent; construction dust and stains buyers notice at walkthrough'),
          goalItem('limits', 'Limits', 'complete', "Don't promise it will look brand new, just clean"),
          goalItem('only_you', 'The "only you" detail', 'complete', '40 new builds in San Jose, finish in one day before the walkthrough'),
        ],
        acknowledgment: 'Got it.',
        next_question: null,
        next_question_target: null,
        recommendation: null,
        phase_complete: true,
        recap: 'You want to introduce your exterior cleaning service to new-construction realtors in San Jose and Santa Clara, so they send you buyers for a cleaning right before closing. You have done 40 new builds in San Jose and can finish in one day. You offer a free estimate and will not promise it looks brand new.',
      },
    ];
    const provider = scriptedProvider(outputs);
    let state = draft;
    const answers = ['Outreach', 'Realtors', 'The ones who sell new construction homes in San Jose and Santa Clara.'];
    for (const answer of answers) {
      state = { ...state, conversation: [...state.conversation, { role: 'user', text: answer, phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' }] } as DraftState;
      const out = await resolveOutput(provider, { phase: 'goal', profileSnapshot: {}, conversation: state.conversation, checklist: state.checklists.goal || baseChecklist('goal'), briefSoFar: null });
      state = applyTurn(state, out, '2026-10-21T00:02:00.000Z').draft;
    }
    expect(state.currentPhase).toBe('audience');
    const campaign = state.checklists.goal!.items.find((i) => i.id === 'campaign')!;
    expect(campaign.userWords).toContain('San Jose');
    const onlyYou = state.checklists.goal!.items.find((i) => i.id === 'only_you')!;
    expect(onlyYou.userWords).toContain('40');
    const questions = state.conversation.filter((m) => m.role === 'ai' && m.kind === 'question');
    expect(questions.length).toBeGreaterThan(1); // thin answers → multiple follow-ups
  });

  it('B2: audience sets cold_contacts, size 300, and exclusions', async () => {
    const g = baseChecklist('goal');
    g.items.forEach((i) => { i.status = 'complete'; i.userWords = 'filled'; });
    const draft = makeDraft({
      currentPhase: 'audience',
      conversation: [
        { role: 'ai', text: 'Phase 2 of 8: Audience. Now tell me about the people who will read this email.', phase: 'audience', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
      ],
      checklists: { goal: g, audience: baseChecklist('audience') },
    });
    const audItem = (id: string, label: string, status: 'missing' | 'vague' | 'complete', words: string) => ({
      id, label, kind: 'base' as const, status, user_words: words, fact: words,
    });
    const outputs: InterviewTurnOutput[] = [
      {
        phase: 'audience',
        checklist: [
          audItem('who', 'Who they are, specifically', 'complete', 'Agents and team leads at builder sales offices, independent agents who list new communities'),
          audItem('how_they_know', 'How they know the business', 'missing', ''),
          audItem('struggles', 'What they struggle with, want or care about', 'missing', ''),
          audItem('interesting', 'What would make this interesting to them', 'missing', ''),
          audItem('familiarity', 'How familiar they are with the business', 'missing', ''),
          audItem('in_out', 'Who is in and who is out', 'missing', ''),
          audItem('how_many', 'Roughly how many people', 'missing', ''),
        ],
        acknowledgment: 'Got it.',
        next_question: 'Have they ever heard of your business?',
        next_question_target: 'how_they_know',
        recommendation: null,
        phase_complete: false,
        recap: null,
      },
      {
        phase: 'audience',
        checklist: [
          audItem('who', 'Who they are, specifically', 'complete', 'Agents and team leads at builder sales offices, independent agents who list new communities'),
          audItem('how_they_know', 'How they know the business', 'complete', "Most haven't heard of us"),
          audItem('struggles', 'What they struggle with, want or care about', 'complete', 'Delays, punch list items, buyers complaining at the walkthrough'),
          audItem('interesting', 'What would make this interesting to them', 'complete', 'Removes one punch list item without coordination'),
          audItem('familiarity', 'How familiar they are with the business', 'complete', 'Strangers'),
          audItem('in_out', 'Who is in and who is out', 'complete', 'Leave out the three realtors already worked with'),
          audItem('how_many', 'Roughly how many people', 'complete', 'About 300'),
        ],
        acknowledgment: 'Got it.',
        next_question: null,
        next_question_target: null,
        recommendation: null,
        phase_complete: true,
        recap: 'Agents and team leads at builder sales offices and independent agents listing new communities, about 300 people, most of whom have never heard of you.',
        flags: {
          cold_contacts: true,
          list_hints: { relationship: 'strangers', exclusions: 'three realtors already worked with' },
          estimated_size: 300,
        },
      },
    ];
    const provider = scriptedProvider(outputs);
    let state = draft;
    for (const answer of [
      'Agents and team leads at builder sales offices, and independent agents who list new communities.',
      "Most haven't.",
    ]) {
      state = { ...state, conversation: [...state.conversation, { role: 'user', text: answer, phase: 'audience', kind: 'answer', at: '2026-10-21T00:01:00.000Z' }] } as DraftState;
      const out = await resolveOutput(provider, { phase: 'audience', profileSnapshot: {}, conversation: state.conversation, checklist: state.checklists.audience!, briefSoFar: null });
      state = applyTurn(state, out, '2026-10-21T00:02:00.000Z').draft;
    }
    expect(state.currentPhase).toBe('cta');
    const flags = state.checklists.audience!.flags!;
    expect(flags.coldContacts).toBe(true);
    expect(flags.estimatedSize).toBe(300);
    expect(flags.listHints?.exclusions).toContain('three realtors');
  });
});
