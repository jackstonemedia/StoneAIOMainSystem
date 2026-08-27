import { describe, it, expect } from 'vitest';
import {
  planRecipientSendSchedule,
  extractEmailDomain,
  getNextSendingWindowDate,
} from '../../../api/services/email-marketing/deliverability.service';

describe('Sequence & Deliverability Scheduler', () => {
  describe('extractEmailDomain', () => {
    it('extracts normalized domain from various email formats', () => {
      expect(extractEmailDomain('john.doe@gmail.com')).toBe('gmail.com');
      expect(extractEmailDomain('SUPPORT@AcmeCorp.io')).toBe('acmecorp.io');
      expect(extractEmailDomain('invalid-email')).toBe('unknown');
    });
  });

  describe('planRecipientSendSchedule', () => {
    it('schedules sends with human jitter and domain spacing', () => {
      const recipients = [
        { contactId: 'c1', email: 'alice@gmail.com' },
        { contactId: 'c2', email: 'bob@gmail.com' },
        { contactId: 'c3', email: 'carol@outlook.com' },
        { contactId: 'c4', email: 'dan@gmail.com' },
      ];

      const schedule = planRecipientSendSchedule(recipients, {
        enabled: true,
        humanJitterEnabled: true,
        minJitterSeconds: 10,
        maxJitterSeconds: 20,
        domainThrottleEnabled: true,
        maxPerDomainPerHour: 30, // spacing >= 120s between same domain
      });

      expect(schedule).toHaveLength(4);
      expect(schedule[0].domain).toBe('gmail.com');
      expect(schedule[1].domain).toBe('gmail.com');

      // bob's send must be spaced after alice's send because both are @gmail.com
      expect(schedule[1].scheduledDelayMs).toBeGreaterThan(schedule[0].scheduledDelayMs);
    });

    it('returns zero delay if deliverability throttling is disabled', () => {
      const recipients = [
        { contactId: 'c1', email: 'alice@gmail.com' },
        { contactId: 'c2', email: 'bob@gmail.com' },
      ];

      const schedule = planRecipientSendSchedule(recipients, { enabled: false });
      expect(schedule[0].scheduledDelayMs).toBe(0);
      expect(schedule[1].scheduledDelayMs).toBe(0);
    });
  });

  describe('getNextSendingWindowDate', () => {
    it('returns next valid business morning if called on a weekend', () => {
      const saturday = new Date('2026-08-22T14:00:00Z');
      const nextWindow = getNextSendingWindowDate(saturday, 8, 18, [1, 2, 3, 4, 5]);

      expect(nextWindow.getUTCDay()).toBeGreaterThanOrEqual(1);
      expect(nextWindow.getUTCDay()).toBeLessThanOrEqual(5);
      expect(nextWindow.getUTCHours()).toBeGreaterThanOrEqual(8);
    });
  });
});
