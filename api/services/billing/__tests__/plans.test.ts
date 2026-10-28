// Billing Core — plan definitions unit tests.
import { describe, it, expect } from 'vitest';
import {
  PLAN_CONFIGS,
  normalizePlan,
  isKnownPlan,
  planRank,
  meetsPlan,
  qualifiesForTrial,
  TRIAL_DAYS,
} from '../plans.js';

describe('canonical plans', () => {
  it('settled launch prices: $19 / $49 / $99', () => {
    expect(PLAN_CONFIGS.basic.amount).toBe(1900);
    expect(PLAN_CONFIGS.plus.amount).toBe(4900);
    expect(PLAN_CONFIGS.complete.amount).toBe(9900);
    expect(PLAN_CONFIGS.free.amount).toBe(0);
  });

  it('token budgets match Phase 5 metering', () => {
    expect(PLAN_CONFIGS.free.tokenBudget).toBe(100_000);
    expect(PLAN_CONFIGS.basic.tokenBudget).toBe(500_000);
    expect(PLAN_CONFIGS.plus.tokenBudget).toBe(2_500_000);
    expect(PLAN_CONFIGS.complete.tokenBudget).toBe(10_000_000);
  });

  it('legacy aliases normalize to canonical', () => {
    expect(normalizePlan('starter')).toBe('basic');
    expect(normalizePlan('pro')).toBe('plus');
    expect(normalizePlan('ultra')).toBe('complete');
    expect(normalizePlan('team')).toBe('complete');
    expect(normalizePlan('PLUS')).toBe('plus');
    expect(normalizePlan('garbage')).toBe('free');
    expect(normalizePlan(null)).toBe('free');
  });

  it('isKnownPlan rejects garbage', () => {
    expect(isKnownPlan('pro')).toBe(true);
    expect(isKnownPlan('garbage')).toBe(false);
    expect(isKnownPlan(null)).toBe(false);
  });

  it('rank order free < basic < plus < complete', () => {
    expect(planRank('free')).toBeLessThan(planRank('basic'));
    expect(planRank('basic')).toBeLessThan(planRank('plus'));
    expect(planRank('plus')).toBeLessThan(planRank('complete'));
  });

  it('email + automations require Complete', () => {
    expect(meetsPlan('plus', 'complete')).toBe(false);
    expect(meetsPlan('complete', 'complete')).toBe(true);
    expect(meetsPlan('pro', 'complete')).toBe(false); // legacy pro maps to plus
    expect(meetsPlan('ultra', 'complete')).toBe(true); // legacy ultra maps to complete
  });
});

describe('trial qualification', () => {
  it('trial is 7 days', () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it('qualifies only when never trialed and never subscribed', () => {
    expect(qualifiesForTrial({})).toBe(true);
    expect(qualifiesForTrial({ trialEndsAt: new Date() })).toBe(false);
    expect(qualifiesForTrial({ stripeSubscriptionId: 'sub_123' })).toBe(false);
  });
});
