/**
 * M6 unit tests (pure logic, no DB, no network): mode selection, plan
 * assembly, Phase 8 re-check, winner rule, CTA body variant, health
 * thresholds, and the numbers-only summary rule.
 */
import { describe, expect, it } from 'vitest';
import {
  AB_MODE_LABELS,
  assembleAbTestFromChecklist,
  buildAbTestConfig,
  buildCtaVariantBody,
  checkHealth,
  effectiveAbMode,
  evaluateWinnerRule,
  modeForCount,
  resultsSummaryText,
  type AbTestPlan,
} from '../ab-test.service.js';

const item = (id: string, fact: string, status = 'complete') => ({ id, fact, user_words: fact, status });

function yesPlan(overrides: Partial<AbTestPlan> = {}): AbTestPlan {
  return {
    decision: 'yes',
    variable: 'subject',
    testEmailOrder: 1,
    variantA: 'Your home could shine again',
    variantB: 'A free estimate this week?',
    waitHours: 24,
    metric: 'clicks',
    estimatedCount: 3000,
    mode: 'test_then_winner',
    readback: 'A/B test on Email 1.',
    ...overrides,
  };
}

describe('modeForCount — spec §11 boundaries', () => {
  it('499 → none, 500 → split, 1999 → split, 2000 → test_then_winner', () => {
    expect(modeForCount(499)).toBe('none');
    expect(modeForCount(500)).toBe('split');
    expect(modeForCount(1999)).toBe('split');
    expect(modeForCount(2000)).toBe('test_then_winner');
  });
  it('labels name the split mode "small sample, directional only"', () => {
    expect(AB_MODE_LABELS.split).toContain('directional only');
  });
});

describe('assembleAbTestFromChecklist', () => {
  const base = [
    item('test_decision', 'yes, let us test'),
    item('audience_size', 'about 3000 people'),
    item('variable', 'the subject line'),
    item('test_email', 'email 1'),
    item('variant_a', 'Your home could shine again'),
    item('variant_b', 'A free estimate this week?'),
    item('win_metric', 'clicks'),
    item('wait_hours', '24 hours'),
  ];
  it('assembles a test_then_winner plan for 3000 people', () => {
    const out = assembleAbTestFromChecklist(base, 1);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.assembled.plan.mode).toBe('test_then_winner');
    expect(out.assembled.plan.waitHours).toBe(24);
    expect(out.assembled.plan.metric).toBe('clicks');
    expect(out.assembled.plan.readback).toContain('10%');
  });
  it('B4a: "no test" is a valid plan (mode none)', () => {
    const out = assembleAbTestFromChecklist(
      [item('test_decision', 'yes, skip it'), item('audience_size', 'about 300 people')],
      2,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.assembled.plan.decision).toBe('no');
    expect(out.assembled.plan.mode).toBe('none');
  });
  it('missing variable is an error, never a guessed plan', () => {
    const out = assembleAbTestFromChecklist(base.filter((i) => i.id !== 'variable'), 1);
    expect(out.ok).toBe(false);
  });
  it('identical versions are an error (must differ in exactly one thing)', () => {
    const items = base.map((i) => (i.id === 'variant_b' ? item('variant_b', 'Your home could shine again') : i));
    expect(assembleAbTestFromChecklist(items, 1).ok).toBe(false);
  });
  it('opens as the metric is an error (never the winning metric)', () => {
    const items = base.map((i) => (i.id === 'win_metric' ? item('win_metric', 'opens') : i));
    const out = assembleAbTestFromChecklist(items, 1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain('opens');
  });
  it('bookings as the metric is an error (no booking events exist)', () => {
    const items = base.map((i) => (i.id === 'win_metric' ? item('win_metric', 'bookings') : i));
    expect(assembleAbTestFromChecklist(items, 1).ok).toBe(false);
  });
  it('wait outside 4–72h is an error', () => {
    const items = base.map((i) => (i.id === 'wait_hours' ? item('wait_hours', '100 hours') : i));
    expect(assembleAbTestFromChecklist(items, 1).ok).toBe(false);
  });
  it('test email outside the sequence is an error', () => {
    const items = base.map((i) => (i.id === 'test_email' ? item('test_email', 'email 3') : i));
    expect(assembleAbTestFromChecklist(items, 1).ok).toBe(false);
  });
  it('missing audience size → decide_at_send (mode decided at send time)', () => {
    const out = assembleAbTestFromChecklist(base.filter((i) => i.id !== 'audience_size'), 1);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.assembled.plan.mode).toBe('decide_at_send');
    expect(out.assembled.plan.estimatedCount).toBeNull();
  });
});

describe('effectiveAbMode — Phase 8 re-check', () => {
  it('planned test_then_winner + real 800 → split with a reason', () => {
    const eff = effectiveAbMode(yesPlan(), 800);
    expect(eff.mode).toBe('split');
    expect(eff.changed).toBe(true);
    expect(eff.reason).toContain('800');
  });
  it('planned test_then_winner + real 300 → no test (under 500, results would be noise)', () => {
    const eff = effectiveAbMode(yesPlan(), 300);
    expect(eff.mode).toBe('none');
    expect(eff.changed).toBe(true);
  });
  it('planned split + real 2500 → test_then_winner with a reason', () => {
    const eff = effectiveAbMode(yesPlan({ estimatedCount: 800, mode: 'split' }), 2500);
    expect(eff.mode).toBe('test_then_winner');
    expect(eff.changed).toBe(true);
  });
  it('unchanged mode → no warning', () => {
    const eff = effectiveAbMode(yesPlan(), 3000);
    expect(eff.changed).toBe(false);
    expect(eff.reason).toBe('');
  });
  it('a "no test" decision never gains a mode', () => {
    const eff = effectiveAbMode(yesPlan({ decision: 'no', mode: 'none' }), 5000);
    expect(eff.mode).toBe('none');
  });
  it('decide_at_send resolves from the real count', () => {
    const eff = effectiveAbMode(yesPlan({ estimatedCount: null, mode: 'decide_at_send' }), 3000);
    expect(eff.mode).toBe('test_then_winner');
    expect(eff.changed).toBe(true);
  });
});

describe('evaluateWinnerRule — spec §11 winner rule', () => {
  it('fewer than 20 total clicks → no clear winner', () => {
    expect(evaluateWinnerRule({ clicksA: 12, clicksB: 6, sentA: 100, sentB: 100 }).winner).toBe('no_clear_winner');
  });
  it('relative difference under 10% → no clear winner', () => {
    expect(evaluateWinnerRule({ clicksA: 20, clicksB: 21, sentA: 100, sentB: 100 }).winner).toBe('no_clear_winner');
  });
  it('clear winner by rate (B higher)', () => {
    const r = evaluateWinnerRule({ clicksA: 20, clicksB: 30, sentA: 100, sentB: 100 });
    expect(r.winner).toBe('B');
    expect(r.totalClicks).toBe(50);
  });
  it('tie → no clear winner', () => {
    expect(evaluateWinnerRule({ clicksA: 25, clicksB: 25, sentA: 100, sentB: 100 }).winner).toBe('no_clear_winner');
  });
});

describe('buildAbTestConfig + CTA body variant', () => {
  it('split → testPercentage 100, test_then_winner → 20', () => {
    expect(buildAbTestConfig(yesPlan(), 'split', '<p>Hi</p>', '<p>Hi</p>', 'd1').testPercentage).toBe(100);
    expect(buildAbTestConfig(yesPlan(), 'test_then_winner', '<p>Hi</p>', '<p>Hi</p>', 'd1').testPercentage).toBe(20);
  });
  it('M6 campaigns are marked createWithAi and never autoRollout', () => {
    const cfg = buildAbTestConfig(yesPlan(), 'test_then_winner', '<p>Hi</p>', '<p>Hi</p>', 'd1');
    expect(cfg.createWithAi).toBe(true);
    expect(cfg.autoRollout).toBeUndefined();
    expect(cfg.winnerMetric).toBe('clicks');
  });
  it('CTA variant replaces every occurrence of the A wording', () => {
    const body = '<a href="https://x.book">Book now</a> or Book now below.';
    expect(buildCtaVariantBody(body, 'Book now', 'Claim your spot')).toBe(
      '<a href="https://x.book">Claim your spot</a> or Claim your spot below.',
    );
  });
  it('CTA variant leaves the body alone when A is absent', () => {
    expect(buildCtaVariantBody('<p>Hi</p>', 'Book now', 'Claim')).toBe('<p>Hi</p>');
  });
});

describe('checkHealth — spec §14 thresholds', () => {
  it('bounce 2% warns, 5% auto-pauses', () => {
    expect(checkHealth({ delivered: 1000, bounced: 20, complaints: 0 }).warnings.length).toBe(1);
    expect(checkHealth({ delivered: 1000, bounced: 20, complaints: 0 }).autoPause).toBe(false);
    const p = checkHealth({ delivered: 1000, bounced: 50, complaints: 0 });
    expect(p.autoPause).toBe(true);
    expect(p.warnings[0]).toContain('5%');
  });
  it('complaint 0.1% warns, 0.3% auto-pauses (when data ever exists)', () => {
    expect(checkHealth({ delivered: 10000, bounced: 0, complaints: 10 }).warnings.length).toBe(1);
    expect(checkHealth({ delivered: 10000, bounced: 0, complaints: 30 }).autoPause).toBe(true);
  });
});

describe('resultsSummaryText — only real numbers', () => {
  it('uses only the metrics given, in 2–4 sentences', () => {
    const text = resultsSummaryText({
      delivered: 2500,
      bounced: 40,
      uniqueClicks: 300,
      clickRate: 0.12,
      replies: 12,
      unsubscribes: 5,
      approximateOpens: 900,
      abOutcome: 'Version B won the A/B test (140 vs 160 unique clicks).',
    });
    expect(text).toContain('2500');
    expect(text).toContain('300');
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(4);
    // Every number in the output must come from the inputs above.
    const nums = text.match(/\d[\d,]*(\.\d+)?%?/g) || [];
    const allowed = ['2500', '40', '300', '12.0%', '12', '5', '900', '140', '160'];
    for (const n of nums) expect(allowed).toContain(n);
  });
});
