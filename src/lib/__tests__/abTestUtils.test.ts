import { describe, it, expect } from 'vitest';
import {
  partitionRecipients,
  calculateStatisticalSignificance,
} from '../abTestUtils';
import { ABTestConfig } from '../../types/emailCampaign';

describe('A/B Split Testing Utilities', () => {
  describe('partitionRecipients', () => {
    it('partitions 50/50 across all contacts when split percentage is 100 or 50', () => {
      const contacts = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
      const config: ABTestConfig = {
        enabled: true,
        subjectA: 'Subject A',
        subjectB: 'Subject B',
        testPercentage: 100,
        splitPercentage: 100,
        winnerMetric: 'open_rate',
        autoSelectAfterHours: 24,
      };

      const result = partitionRecipients(contacts, config);
      expect(result.variantAContactIds.length).toBe(3);
      expect(result.variantBContactIds.length).toBe(3);
      expect(result.heldContactIds.length).toBe(0);
      expect(result.samplePercentage).toBe(100);

      // Verify no overlap
      const setA = new Set(result.variantAContactIds);
      const setB = new Set(result.variantBContactIds);
      for (const id of setA) {
        expect(setB.has(id)).toBe(false);
      }
    });

    it('partitions sample test group and holds remaining recipients for rollout', () => {
      // 10 contacts with 20% test group -> 2 sample contacts (1 for A, 1 for B), 8 held
      const contacts = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
      const config: ABTestConfig = {
        enabled: true,
        subjectA: 'Subject A',
        subjectB: 'Subject B',
        testPercentage: 20,
        splitPercentage: 20,
        winnerMetric: 'open_rate',
        autoSelectAfterHours: 24,
      };

      const result = partitionRecipients(contacts, config);
      expect(result.variantAContactIds.length).toBe(1);
      expect(result.variantBContactIds.length).toBe(1);
      expect(result.heldContactIds.length).toBe(8);
      expect(result.samplePercentage).toBe(20);
    });

    it('handles empty contact list gracefully', () => {
      const config: ABTestConfig = {
        enabled: true,
        subjectA: 'A',
        subjectB: 'B',
        testPercentage: 50,
        winnerMetric: 'open_rate',
        autoSelectAfterHours: 24,
      };
      const result = partitionRecipients([], config);
      expect(result.variantAContactIds).toEqual([]);
      expect(result.variantBContactIds).toEqual([]);
      expect(result.heldContactIds).toEqual([]);
    });
  });

  describe('calculateStatisticalSignificance', () => {
    it('identifies Variant B as winner when Variant B has higher open rate', () => {
      // Variant A: 10 opens / 100 delivered (10%)
      // Variant B: 35 opens / 100 delivered (35%)
      const result = calculateStatisticalSignificance(10, 100, 35, 100, 'open_rate');
      expect(result.winner).toBe('B');
      expect(result.rateA).toBeCloseTo(0.10);
      expect(result.rateB).toBeCloseTo(0.35);
      expect(result.differencePercent).toBeGreaterThan(100);
      expect(result.isSignificant).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(95);
    });

    it('identifies tied performance when rates are equal', () => {
      const result = calculateStatisticalSignificance(20, 100, 20, 100, 'open_rate');
      expect(result.winner).toBe('TIED');
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificant).toBe(false);
    });

    it('reports insufficient data when sample size is 0', () => {
      const result = calculateStatisticalSignificance(0, 0, 0, 0, 'click_rate');
      expect(result.winner).toBe('INSUFFICIENT_DATA');
      expect(result.isSignificant).toBe(false);
    });
  });
});
