/**
 * A/B Split Testing Utilities
 *
 * Core mathematical and algorithmic logic for:
 * 1. Recipient partitioning (50/50 split or sample test groups with holdout)
 * 2. Variant performance metric calculation
 * 3. Statistical significance (Z-score & confidence calculation)
 * 4. Winner determination and auto-rollout helpers
 */

import { ABTestConfig } from '../types/emailCampaign';

export interface PartitionResult {
  variantAContactIds: string[];
  variantBContactIds: string[];
  heldContactIds: string[];
  samplePercentage: number;
}

export interface VariantStats {
  sent: number;
  delivered: number;
  uniqueOpens: number;
  totalOpens: number;
  openRate: number; // 0.0 to 1.0
  uniqueClicks: number;
  totalClicks: number;
  clickRate: number; // 0.0 to 1.0
  clickToOpenRate: number; // 0.0 to 1.0
  bounces: number;
  unsubscribes: number;
}

export interface ABSignificanceResult {
  winner: 'A' | 'B' | 'TIED' | 'INSUFFICIENT_DATA';
  metricUsed: 'open_rate' | 'click_rate';
  rateA: number;
  rateB: number;
  differencePercent: number; // e.g. +24.5%
  isSignificant: boolean; // confidence >= 95%
  confidenceScore: number; // 0 to 100%
  zScore: number;
  sampleSizeA: number;
  sampleSizeB: number;
  recommendation: string;
}

/**
 * Shuffles an array with a deterministic or random seed (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Partitions contact IDs into Variant A, Variant B, and optionally Held group.
 * @param contactIds List of unique contact IDs
 * @param config A/B Test configuration
 */
export function partitionRecipients(contactIds: string[], config: ABTestConfig): PartitionResult {
  if (!contactIds || contactIds.length === 0) {
    return { variantAContactIds: [], variantBContactIds: [], heldContactIds: [], samplePercentage: 0 };
  }

  const shuffled = shuffleArray(contactIds);
  const total = shuffled.length;
  const testPct = Math.min(100, Math.max(1, config.splitPercentage ?? config.testPercentage ?? 100));

  if (testPct >= 100) {
    // 50/50 full split across all contacts
    const half = Math.ceil(total / 2);
    return {
      variantAContactIds: shuffled.slice(0, half),
      variantBContactIds: shuffled.slice(half),
      heldContactIds: [],
      samplePercentage: 100,
    };
  }

  // Sample test mode: testPct is split equally between A and B, rest is held
  const sampleCount = Math.max(2, Math.round((total * testPct) / 100));
  const halfSample = Math.floor(sampleCount / 2);

  const variantA = shuffled.slice(0, halfSample);
  const variantB = shuffled.slice(halfSample, halfSample * 2);
  const held = shuffled.slice(halfSample * 2);

  return {
    variantAContactIds: variantA,
    variantBContactIds: variantB,
    heldContactIds: held,
    samplePercentage: testPct,
  };
}

/**
 * Standard two-proportion Z-test for statistical significance.
 * @param conversionsA Number of opens/clicks for A
 * @param sampleA Number of delivered emails for A
 * @param conversionsB Number of opens/clicks for B
 * @param sampleB Number of delivered emails for B
 */
export function calculateStatisticalSignificance(
  conversionsA: number,
  sampleA: number,
  conversionsB: number,
  sampleB: number,
  metricName: 'open_rate' | 'click_rate' = 'open_rate'
): ABSignificanceResult {
  if (sampleA <= 0 || sampleB <= 0) {
    return {
      winner: 'INSUFFICIENT_DATA',
      metricUsed: metricName,
      rateA: 0,
      rateB: 0,
      differencePercent: 0,
      isSignificant: false,
      confidenceScore: 0,
      zScore: 0,
      sampleSizeA: sampleA,
      sampleSizeB: sampleB,
      recommendation: 'Not enough sends to determine a statistically reliable winner yet.',
    };
  }

  const pA = conversionsA / sampleA;
  const pB = conversionsB / sampleB;

  if (pA === pB) {
    return {
      winner: 'TIED',
      metricUsed: metricName,
      rateA: pA,
      rateB: pB,
      differencePercent: 0,
      isSignificant: false,
      confidenceScore: 50,
      zScore: 0,
      sampleSizeA: sampleA,
      sampleSizeB: sampleB,
      recommendation: 'Both variants are performing identically so far.',
    };
  }

  // Pooled proportion
  const pooledP = (conversionsA + conversionsB) / (sampleA + sampleB);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / sampleA + 1 / sampleB));

  let zScore = 0;
  if (se > 0) {
    zScore = Math.abs(pA - pB) / se;
  }

  // Approximate normal CDF to confidence percentage
  // For z = 1.96, confidence is 95%
  const confidenceScore = Math.min(99.9, Number((erf(zScore / Math.SQRT2) * 100).toFixed(1)));
  const isSignificant = confidenceScore >= 95;

  const winner: 'A' | 'B' = pB > pA ? 'B' : 'A';
  const baseline = winner === 'B' ? pA : pB;
  const winnerRate = winner === 'B' ? pB : pA;
  const diffPct = baseline > 0 ? Number((((winnerRate - baseline) / baseline) * 100).toFixed(1)) : 100;

  const metricLabel = metricName === 'open_rate' ? 'Open Rate' : 'Click Rate';
  let recommendation = '';
  if (isSignificant) {
    recommendation = `Variant ${winner} is outperforming with a +${diffPct}% higher ${metricLabel.toLowerCase()} (${confidenceScore}% statistical confidence).`;
  } else {
    recommendation = `Variant ${winner} is leading with +${diffPct}% higher ${metricLabel.toLowerCase()}, but more data is recommended for full statistical significance (${confidenceScore}% confidence).`;
  }

  return {
    winner,
    metricUsed: metricName,
    rateA: pA,
    rateB: pB,
    differencePercent: diffPct,
    isSignificant,
    confidenceScore,
    zScore: Number(zScore.toFixed(2)),
    sampleSizeA: sampleA,
    sampleSizeB: sampleB,
    recommendation,
  };
}

/**
 * Standard Gauss error function approximation for CDF calculation
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}
