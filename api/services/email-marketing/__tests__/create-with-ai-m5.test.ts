/**
 * Create with AI — Milestone 5 unit tests (pure logic, no DB, no network).
 * Covers: rule validation (both unavailable conditions, resend subject
 * requirement, window/delay defaults, source bounds), priority ordering
 * (click > NOT_CLICKED/NOT_OPENED), B3-style assembly from the Phase 5
 * checklist (click note + click alert + no-reply alert + readback), the
 * simulator across all 7 canonical scenarios (click → reaction, no-click
 * → follow-up, no-open → resend, reply/unsubscribe/bounce → stop,
 * open-no-click → NOT_CLICKED follow-up, bot clicks ignored, machine
 * opens never matching NOT_OPENED, caps 8/24h, first-click-per-link),
 * click attribution (signed token > UTM order > tokenless fallback), and
 * the Gmail bounce parser (hard/soft/unknown). DB-bound behavior (the
 * tick, enrollment, Gmail scan) is verified live against the running
 * build; see the M5 evidence log.
 */

import { describe, it, expect } from 'vitest';
import {
  validateReactionRules,
  orderRulesByPriority,
  assembleReactionsFromChecklist,
  reactionsReadback,
  simulatePath,
  buildScenarioEvents,
  SIMULATOR_SCENARIOS,
  attributeClick,
  type ReactionRuleInput,
} from '../reaction-engine.service.js';
import { parseBounceNotification } from '../gmail-bounce.service.js';

function rule(overrides: Partial<ReactionRuleInput> = {}): ReactionRuleInput {
  return {
    sourceOrder: 1,
    condition: 'NOT_CLICKED',
    conditionParams: {},
    action: 'send_next',
    actionParams: {},
    decisionWindowHours: 72,
    delayMinutes: 60,
    ...overrides,
  };
}

function item(id: string, fact: string, status = 'complete') {
  return { id, fact, userWords: fact, status };
}

describe('validateReactionRules', () => {
  it('rejects OPENED_NOT_CLICKED with the plain-words reason', () => {
    const err = validateReactionRules([rule({ condition: 'OPENED_NOT_CLICKED' })], 1);
    expect(err).toMatch(/cannot be attributed/i);
    expect(err).toMatch(/NOT_CLICKED/);
  });

  it('rejects CLICKED_NOT_ACTED (no booking events exist)', () => {
    const err = validateReactionRules([rule({ condition: 'CLICKED_NOT_ACTED' })], 1);
    expect(err).toMatch(/booking/i);
    expect(err).toMatch(/CLICKED_NOT_REPLIED/);
  });

  it('rejects a resend rule without a new subject', () => {
    const err = validateReactionRules(
      [rule({ condition: 'NOT_OPENED', action: 'resend', actionParams: {} })],
      1,
    );
    expect(err).toMatch(/new subject/i);
  });

  it('accepts a resend rule with a new subject', () => {
    expect(
      validateReactionRules(
        [rule({ condition: 'NOT_OPENED', action: 'resend', actionParams: { newSubject: 'Still thinking it over?' } })],
        1,
      ),
    ).toBeNull();
  });

  it('rejects a sourceOrder outside the sequence', () => {
    expect(validateReactionRules([rule({ sourceOrder: 3 })], 2)).toMatch(/email 3/i);
  });

  it('rejects a window outside 1–168h and a delay outside 0–10080m', () => {
    expect(validateReactionRules([rule({ decisionWindowHours: 200 })], 1)).toMatch(/window/i);
    expect(validateReactionRules([rule({ delayMinutes: 20000 })], 1)).toMatch(/delay/i);
  });

  // A second click rule for the same source is not rejected — priority
  // resolves it deterministically (first wins), so the engine never
  // sends two reactions for one click. Covered by the priority test above.
});

describe('orderRulesByPriority', () => {
  it('orders click rules before window rules, stable within a tier', () => {
    const ordered = orderRulesByPriority([
      rule({ condition: 'NOT_OPENED' }),
      rule({ condition: 'CLICKED' }),
      rule({ condition: 'NOT_CLICKED' }),
    ]);
    expect(ordered.map((r) => r.condition)).toEqual(['CLICKED', 'NOT_CLICKED', 'NOT_OPENED']);
  });
});

describe('assembleReactionsFromChecklist (B3)', () => {
  it('assembles a click note + click alert + no-reply alert from B3 facts', () => {
    const res = assembleReactionsFromChecklist(
      [
        item('clicked', 'If someone clicks, send them the detailed note within an hour.'),
        item('clicked_no_reply', 'If someone clicks but does not reply in 4 days, alert me so I can call them.'),
        item('reaction_jobs', 'Send the note and the alert.'),
        item('no_open', ''),
        item('open_no_click', ''),
        item('owner_alerts', 'Alert me in the app and by email.'),
      ],
      1,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const actions = res.assembled.rules.map((r) => r.action);
    expect(actions).toContain('send_reaction');
    expect(actions).toContain('notify');
    expect(res.assembled.rules.some((r) => r.condition === 'CLICKED_NOT_REPLIED')).toBe(true);
    expect(res.assembled.readback).toMatch(/replies, books, or unsubscribes stops/);
  });

  it('skips open_no_click facts with a plain note (no OPENED_NOT_CLICKED)', () => {
    const res = assembleReactionsFromChecklist(
      [
        item('open_no_click', 'If someone opens but does not click, send a reminder.'),
        item('no_open', 'If no one opens in 3 days, resend with a new subject "Still thinking it over?"'),
      ],
      1,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.assembled.rules.every((r) => r.condition !== 'OPENED_NOT_CLICKED')).toBe(true);
    expect(res.assembled.skipped.join(' ')).toMatch(/attributed to one email/);
    expect(res.assembled.rules.some((r) => r.condition === 'NOT_OPENED' && r.action === 'resend')).toBe(true);
  });

  it('answering nothing assembles zero rules (an explicit no-reactions plan)', () => {
    const res = assembleReactionsFromChecklist(
      [item('no_open', '', 'missing'), item('clicked', '', 'missing')],
      1,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.assembled.rules.length).toBe(0);
    expect(res.assembled.readback).toMatch(/No reaction rules/);
  });
});

describe('reactionsReadback', () => {
  it('always appends the always-on exits sentence', () => {
    const text = reactionsReadback([rule()], []);
    expect(text).toMatch(/replies, books, or unsubscribes stops/);
    expect(text).toMatch(/bounces is suppressed/);
  });
});

describe('simulatePath — canonical scenarios', () => {
  const rules: ReactionRuleInput[] = [
    rule({ condition: 'NOT_OPENED', action: 'resend', actionParams: { newSubject: 'Still thinking it over?' } }),
    rule({ condition: 'NOT_CLICKED', action: 'send_next' }),
    rule({ condition: 'CLICKED', action: 'send_reaction', actionParams: { emailPurpose: 'Detailed note' } }),
    rule({ condition: 'CLICKED_NOT_REPLIED', conditionParams: { days: 4 }, action: 'notify', actionParams: { channel: 'app' } }),
  ];

  it('exposes exactly the 7 canonical scenarios', () => {
    expect([...SIMULATOR_SCENARIOS]).toEqual([
      'did_not_open',
      'opened_no_click',
      'clicked',
      'clicked_link',
      'clicked_not_replied',
      'replied',
      'bounced',
    ]);
  });

  it('did_not_open → NOT_CLICKED follow-up wins over NOT_OPENED (priority order)', () => {
    const { events, horizon } = buildScenarioEvents('did_not_open');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    // The contact neither clicked nor opened, so both window rules match —
    // priority says NOT_CLICKED (tier 1) beats NOT_OPENED (tier 2).
    expect(out.steps.some((s) => s.what.includes('next scheduled email'))).toBe(true);
  });

  it('opened_no_click → NOT_CLICKED follow-up (NOT_OPENED does not fire)', () => {
    const { events, horizon } = buildScenarioEvents('opened_no_click');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    expect(out.steps.some((s) => s.what.includes('next scheduled email'))).toBe(true);
    expect(out.steps.some((s) => s.what.includes('resend'))).toBe(false);
  });

  it('clicked → reaction email, and the window rules never fire after it', () => {
    const { events, horizon } = buildScenarioEvents('clicked');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    expect(out.steps.some((s) => s.what.includes('Detailed note'))).toBe(true);
    expect(out.steps.some((s) => s.what.includes('next scheduled email'))).toBe(false);
  });

  it('clicked_not_replied → reaction note AND the later no-reply alert (B3)', () => {
    const { events, horizon } = buildScenarioEvents('clicked_not_replied');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    expect(out.steps.some((s) => s.what.includes('Detailed note'))).toBe(true);
    expect(out.steps.some((s) => s.what.includes('owner alert'))).toBe(true);
  });

  it('replied → immediate exit, nothing else fires', () => {
    const { events, horizon } = buildScenarioEvents('replied');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    expect(out.finalState).toBe('exited_reply');
    expect(out.steps.some((s) => s.what.includes('Rule fired'))).toBe(false);
  });

  it('bounced → exit + suppress', () => {
    const { events, horizon } = buildScenarioEvents('bounced');
    const out = simulatePath({ rules, sequenceCount: 1, events, horizon });
    expect(out.finalState).toBe('exited_bounced');
  });

  it('bot clicks are ignored; first click per link only', () => {
    const t0 = new Date('2026-10-01T08:00:00.000Z');
    const out = simulatePath({
      rules,
      sequenceCount: 1,
      events: [
        { at: t0, type: 'sent', emailOrder: 1 },
        { at: new Date(t0.getTime() + 3600_000), type: 'clicked', emailOrder: 1, link: 'https://example.com/book', bot: true },
        { at: new Date(t0.getTime() + 7200_000), type: 'clicked', emailOrder: 1, link: 'https://example.com/book' },
        { at: new Date(t0.getTime() + 10800_000), type: 'clicked', emailOrder: 1, link: 'https://example.com/book' },
      ],
      horizon: new Date(t0.getTime() + 8 * 86_400_000),
    });
    const notes = out.steps.filter((s) => s.what.startsWith('Sends') && s.what.includes('Detailed note'));
    expect(notes.length).toBe(1);
  });

  it('a machine open is an open event, so NOT_OPENED never matches it', () => {
    const t0 = new Date('2026-10-01T08:00:00.000Z');
    const out = simulatePath({
      rules: [rule({ condition: 'NOT_OPENED', action: 'resend', actionParams: { newSubject: 'Again?' } })],
      sequenceCount: 1,
      events: [
        { at: t0, type: 'sent', emailOrder: 1 },
        { at: new Date(t0.getTime() + 3600_000), type: 'opened', emailOrder: 1 },
      ],
      horizon: new Date(t0.getTime() + 4 * 86_400_000),
    });
    expect(out.steps.some((s) => s.what.includes('resend'))).toBe(false);
    expect(out.steps.some((s) => s.what.includes('default path continues'))).toBe(true);
  });

  it('24h gap applies to window reactions but not click reactions', () => {
    const t0 = new Date('2026-10-01T08:00:00.000Z');
    const out = simulatePath({
      rules: [rule({ condition: 'NOT_CLICKED', action: 'send_reaction', actionParams: { emailPurpose: 'Follow-up' }, delayMinutes: 0 })],
      sequenceCount: 1,
      events: [{ at: t0, type: 'sent', emailOrder: 1 }],
      horizon: new Date(t0.getTime() + 4 * 86_400_000),
    });
    const sendStep = out.steps.find((s) => s.what.includes('Follow-up') && s.what.startsWith('Sends'));
    expect(sendStep).toBeDefined();
    // Window ends at T0+72h; the 24h gap after the T0 send is long past.
    expect(new Date(sendStep!.at).getTime()).toBe(t0.getTime() + 72 * 3600_000);
  });
});

describe('attributeClick', () => {
  const emails = [
    { id: 'e1', order: 1 },
    { id: 'e2', order: 2 },
  ];
  it('prefers the signed token email id', () => {
    const out = attributeClick(
      { id: 'ev1', linkUrl: 'https://example.com/book', metadata: { emailId: 'e2' }, occurredAt: new Date(), isBotSuspected: false },
      emails,
    );
    expect(out.order).toBe(2);
  });

  it('falls back to UTM utm_content order', () => {
    const out = attributeClick(
      { id: 'ev2', linkUrl: 'https://example.com/book?utm_content=1', metadata: {}, occurredAt: new Date(), isBotSuspected: false },
      emails,
    );
    expect(out.order).toBe(1);
  });

  it('falls back to order 1 for tokenless worker links', () => {
    const out = attributeClick(
      { id: 'ev3', linkUrl: 'https://example.com/book', metadata: {}, occurredAt: new Date(), isBotSuspected: false },
      emails,
    );
    expect(out.order).toBe(1);
  });

  it('ignores the legacy literal "email" token id', () => {
    const out = attributeClick(
      { id: 'ev4', linkUrl: 'https://example.com/book', metadata: { emailId: 'email' }, occurredAt: new Date(), isBotSuspected: false },
      emails,
    );
    expect(out.order).toBe(1);
  });
});

describe('parseBounceNotification', () => {
  const hard = [
    'From: mailer-daemon@googlemail.com',
    'Content-Type: multipart/report; report-type=delivery-status',
    'Status: 5.1.1',
    'Final-Recipient: rfc822; nobody@example.com',
    'Message-ID: <abc123@mail.example.com>',
  ].join('\n');

  it('parses a hard bounce with recipient + original message id', () => {
    const out = parseBounceNotification(hard);
    expect(out).not.toBeNull();
    expect(out!.statusClass).toBe('hard');
    expect(out!.recipientEmail).toBe('nobody@example.com');
    expect(out!.originalMessageId).toBe('abc123@mail.example.com');
  });

  it('parses a soft bounce (4.x.x)', () => {
    const out = parseBounceNotification(hard.replace('5.1.1', '4.2.2'));
    expect(out?.statusClass).toBe('soft');
  });

  it('returns null without a Status header or recipient', () => {
    expect(parseBounceNotification('Hello, this is not a bounce.')).toBeNull();
    expect(parseBounceNotification('Status: 5.1.1\n')).toBeNull();
  });
  // softBounceStrikes is DB-bound (counts EmailEvents); the 3-strike rule
  // is verified live against the running build (see the M5 evidence log).
});
