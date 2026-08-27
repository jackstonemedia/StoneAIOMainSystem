import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as biz from '../business.service.js';
import { db } from '../../../infrastructure/database/client.js';

// Mock dependencies
vi.mock('../../../infrastructure/database/client.js', () => {
  const mockDb = {
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    channelConnection: {
      findMany: vi.fn(),
    },
  };
  return { db: mockDb };
});

vi.mock('../triggers.service.js', () => ({
  emitTrigger: vi.fn().mockResolvedValue(true),
}));

describe('Calendar & Scheduling Hub Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('returns standard business hour slots when no appointments exist', async () => {
      (db.appointment.findMany as any).mockResolvedValue([]);

      const result = await biz.getAvailableSlots('ws-123', {
        date: '2026-08-26',
        durationMinutes: 30,
      });

      expect(result.availableSlots).toBeDefined();
      expect(result.availableSlots).toContain('09:00');
      expect(result.availableSlots).toContain('09:30');
      expect(result.availableSlots).toContain('16:30');
      expect(result.availableSlots).not.toContain('17:00'); // 17:00 + 30m is past 17:00
      expect(result.availableSlots.length).toBe(16); // 9am to 5pm in 30-min chunks = 16 slots
    });

    it('filters out slots that overlap with existing appointments', async () => {
      (db.appointment.findMany as any).mockResolvedValue([
        {
          id: 'apt-1',
          startTime: new Date('2026-08-26T10:00:00.000Z'),
          endTime: new Date('2026-08-26T11:00:00.000Z'),
          status: 'confirmed',
        },
      ]);

      const result = await biz.getAvailableSlots('ws-123', {
        date: '2026-08-26',
        durationMinutes: 30,
      });

      expect(result.availableSlots).toBeDefined();
      expect(result.availableSlots).toContain('09:00');
      expect(result.availableSlots).toContain('09:30');
      expect(result.availableSlots).not.toContain('10:00');
      expect(result.availableSlots).not.toContain('10:30');
      expect(result.availableSlots).toContain('11:00');
    });
  });

  describe('bookPublicAppointment', () => {
    it('finds or creates CRM contact and confirms appointment', async () => {
      (db.contact.findFirst as any).mockResolvedValue(null);
      (db.contact.create as any).mockResolvedValue({
        id: 'contact-new-1',
        firstName: 'Alex',
        lastName: 'Johnson',
        email: 'alex@austinplumbing.com',
      });
      (db.appointment.create as any).mockResolvedValue({
        id: 'apt-new-1',
        title: 'Discovery Session with Alex Johnson',
        contactId: 'contact-new-1',
        startTime: new Date('2026-08-26T14:00:00.000Z'),
        endTime: new Date('2026-08-26T14:30:00.000Z'),
        status: 'confirmed',
        contact: {
          id: 'contact-new-1',
          firstName: 'Alex',
          lastName: 'Johnson',
        },
      });

      const res = await biz.bookPublicAppointment('ws-123', {
        name: 'Alex Johnson',
        email: 'alex@austinplumbing.com',
        phone: '+15125550199',
        date: '2026-08-26',
        time: '14:00',
        durationMinutes: 30,
        notes: 'Interested in SDR module',
      });

      expect(res.contact.id).toBe('contact-new-1');
      expect(res.appointment.id).toBe('apt-new-1');
      expect(db.contact.create).toHaveBeenCalled();
      expect(db.appointment.create).toHaveBeenCalled();
    });
  });

  describe('getCalendarSyncStatus', () => {
    it('detects connected Gmail or Outlook channels', async () => {
      (db.channelConnection.findMany as any).mockResolvedValue([
        { id: 'conn-1', provider: 'gmail', email: 'jack@stoneaio.com', isActive: true },
      ]);

      const status = await biz.getCalendarSyncStatus('ws-123');
      expect(status.hasGoogleCalendar).toBe(true);
      expect(status.hasOutlookCalendar).toBe(false);
    });
  });
});
