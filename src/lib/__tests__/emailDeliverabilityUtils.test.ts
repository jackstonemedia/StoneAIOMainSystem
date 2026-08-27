import { describe, it, expect } from 'vitest';
import {
  analyzeEmailDeliverability,
  stripHtml,
  calculateRandomJitterMs,
  isWithinSendingWindow,
} from '../emailDeliverabilityUtils';

describe('emailDeliverabilityUtils', () => {
  describe('stripHtml', () => {
    it('strips tags and formats plain text correctly', () => {
      const html = '<p>Hello <strong>World</strong>! <a href="https://example.com">Click Here</a></p>';
      expect(stripHtml(html)).toBe('Hello World! Click Here');
    });

    it('handles scripts and styles safely', () => {
      const html = '<style>body { color: red; }</style><p>Content</p><script>alert(1);</script>';
      expect(stripHtml(html)).toBe('Content');
    });
  });

  describe('analyzeEmailDeliverability', () => {
    it('gives clean score to well-formatted email with unsubscribe link', () => {
      const subject = 'Quarterly Project Update & Roadmap Overview';
      const body = `
        <p>Hi {{first_name}},</p>
        <p>Here is a quick summary of what we built this quarter and what is coming next.</p>
        <p>Feel free to reply with any thoughts or questions.</p>
        <br/>
        <p><small><a href="{{unsubscribe_url}}">Unsubscribe</a> | 123 Main St, Suite 400</small></p>
      `;

      const result = analyzeEmailDeliverability(subject, body);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.grade).toBe('Excellent');
      expect(result.metrics.hasUnsubscribe).toBe(true);
      expect(result.issues.filter(i => i.type === 'critical')).toHaveLength(0);
    });

    it('detects high-risk spam keywords and flags them', () => {
      const subject = 'ACT NOW! Make money fast and claim your prize guaranteed income';
      const body = `
        <p>100% free offer! You have won a million dollars with zero risk-free guarantee.</p>
        <p>Apply now for crypto profit!</p>
      `;

      const result = analyzeEmailDeliverability(subject, body);
      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('High Risk');
      expect(result.metrics.spamKeywordCount).toBeGreaterThanOrEqual(4);
      expect(result.issues.some(i => i.id === 'spam-keywords')).toBe(true);
    });

    it('penalizes missing subject lines and missing unsubscribe links', () => {
      const subject = '';
      const body = '<p>Check out our brand new offering with lots of exciting features for your team.</p>';

      const result = analyzeEmailDeliverability(subject, body);
      expect(result.issues.some(i => i.id === 'empty-subject')).toBe(true);
      expect(result.issues.some(i => i.id === 'missing-unsubscribe')).toBe(true);
      expect(result.score).toBeLessThan(50);
    });

    it('catches ALL-CAPS subject lines', () => {
      const subject = 'URGENT BUSINESS NOTIFICATION READ THIS';
      const body = '<p>Standard body text with unsubscribe link: <a href="{{unsubscribe_url}}">Opt out</a></p>';

      const result = analyzeEmailDeliverability(subject, body);
      expect(result.issues.some(i => i.id === 'subject-caps')).toBe(true);
    });
  });

  describe('calculateRandomJitterMs', () => {
    it('returns values within specified bounds', () => {
      for (let i = 0; i < 20; i++) {
        const jitter = calculateRandomJitterMs(10, 30);
        expect(jitter).toBeGreaterThanOrEqual(10000);
        expect(jitter).toBeLessThanOrEqual(30000);
      }
    });
  });

  describe('isWithinSendingWindow', () => {
    it('returns true during permitted business hours on weekdays', () => {
      const wednesday10am = new Date('2026-08-19T10:00:00Z'); // Wednesday 10 AM UTC
      expect(isWithinSendingWindow(wednesday10am, 8, 18, [1, 2, 3, 4, 5])).toBe(true);
    });

    it('returns false on weekends when weekends are excluded', () => {
      const saturday = new Date('2026-08-22T14:00:00Z'); // Saturday
      expect(isWithinSendingWindow(saturday, 8, 18, [1, 2, 3, 4, 5])).toBe(false);
    });

    it('returns false outside configured hour windows', () => {
      const wednesdayNight = new Date('2026-08-19T23:00:00Z'); // 11 PM UTC
      expect(isWithinSendingWindow(wednesdayNight, 8, 18, [1, 2, 3, 4, 5])).toBe(false);
    });
  });
});
