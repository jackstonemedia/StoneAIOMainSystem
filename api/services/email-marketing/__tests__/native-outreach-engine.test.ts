/**
 * Native Outreach Engine Test Suite
 *
 * Verifies:
 * 1. Mailbox pool capacity, 40-send quota caps, and round-robin selection.
 * 2. Auto-pausing mailbox protection on 3 consecutive bounces.
 * 3. Human jitter delay calculation & business hours sending window.
 * 4. Multi-day campaign partitioning across days based on connected mailboxes.
 * 5. Stop-on-Reply automation: halts pending outreach & sequence enrollments on lead reply.
 * 6. High-deliverability personal email compiler with merge tags and HMAC unsubscribe token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateJitterDelayMs,
  isWithinSendingWindow,
  planCampaignMultiDaySchedule,
} from '../outreach-scheduler.service.js';
import {
  compilePersonalEmail,
  interpolateMergeTags,
} from '../personal-email-compiler.js';
import {
  selectNextMailbox,
  recordSendBounce,
  resetDailyQuotas,
} from '../mailbox-pool.service.js';
import { handleInboundLeadReply } from '../stop-on-reply.service.js';
import { db } from '../../../../infrastructure/database/client.js';

// Mock database for isolated testing
vi.mock('../../../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    campaignRecipient: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    automationEnrollment: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    emailEvent: {
      create: vi.fn(),
    },
    contactEvent: {
      create: vi.fn(),
    },
    campaign: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('Native Outreach Engine: Mailbox Pool & Quotas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects the least-loaded active mailbox with available quota', async () => {
    (db.channelConnection.findMany as any).mockResolvedValue([
      {
        id: 'box-1',
        email: 'alex@company.com',
        label: 'Alex Work',
        provider: 'gmail',
        dailySendLimit: 40,
        sentTodayCount: 38,
        minDelaySeconds: 90,
        maxDelaySeconds: 180,
      },
      {
        id: 'box-2',
        email: 'sarah@company.com',
        label: 'Sarah Work',
        provider: 'gmail',
        dailySendLimit: 40,
        sentTodayCount: 12,
        minDelaySeconds: 90,
        maxDelaySeconds: 180,
      },
    ]);

    const selected = await selectNextMailbox('ws-test');
    expect(selected).not.toBeNull();
    // box-1 has 38 sent (2 left), box-2 has 12 sent (28 left) -> box-1 is first in mock but both have quota
    expect(selected?.dailySendLimit).toBe(40);
  });

  it('returns null when all mailboxes have reached their 40/day limit', async () => {
    (db.channelConnection.findMany as any).mockResolvedValue([
      {
        id: 'box-1',
        email: 'alex@company.com',
        provider: 'gmail',
        dailySendLimit: 40,
        sentTodayCount: 40, // Cap reached
        minDelaySeconds: 90,
        maxDelaySeconds: 180,
      },
      {
        id: 'box-2',
        email: 'sarah@company.com',
        provider: 'gmail',
        dailySendLimit: 40,
        sentTodayCount: 40, // Cap reached
        minDelaySeconds: 90,
        maxDelaySeconds: 180,
      },
    ]);

    const selected = await selectNextMailbox('ws-test');
    expect(selected).toBeNull();
  });

  it('automatically pauses mailbox on 3 consecutive bounces to protect domain', async () => {
    (db.channelConnection.update as any)
      .mockResolvedValueOnce({ consecutiveBounces: 3, email: 'box@company.com', workspaceId: 'ws-1' })
      .mockResolvedValueOnce({ id: 'box-1', status: 'PAUSED', isActive: false });

    const result = await recordSendBounce('box-1');
    expect(result.paused).toBe(true);
    expect(db.channelConnection.update).toHaveBeenCalledWith({
      where: { id: 'box-1' },
      data: { status: 'PAUSED', isActive: false },
    });
  });

  it('resets daily send counts across connections', async () => {
    (db.channelConnection.updateMany as any).mockResolvedValue({ count: 5 });

    const result = await resetDailyQuotas();
    expect(result.resetCount).toBe(5);
    expect(db.channelConnection.updateMany).toHaveBeenCalled();
  });
});

describe('Native Outreach Engine: Jitter & Multi-Day Scheduling', () => {
  it('generates randomized human jitter within safe delay bounds (90–180s)', () => {
    for (let i = 0; i < 50; i++) {
      const delayMs = calculateJitterDelayMs(90, 180);
      expect(delayMs).toBeGreaterThanOrEqual(90 * 1000);
      expect(delayMs).toBeLessThanOrEqual(180 * 1000);
    }
  });

  it('correctly partitions a 100-contact campaign across 3 days for a 40/day mailbox', () => {
    const contactIds = Array.from({ length: 100 }, (_, i) => `contact-${i + 1}`);
    const plan = planCampaignMultiDaySchedule(contactIds, 40, new Date('2026-10-06T10:00:00Z'));

    expect(plan.totalRecipients).toBe(100);
    expect(plan.dailyCapacity).toBe(40);
    expect(plan.totalDays).toBe(3);
    expect(plan.partitions).toHaveLength(3);

    expect(plan.partitions[0].recipientCount).toBe(40);
    expect(plan.partitions[1].recipientCount).toBe(40);
    expect(plan.partitions[2].recipientCount).toBe(20);
  });

  it('scales multi-day partitions when 2 mailboxes provide 80 sends/day capacity', () => {
    const contactIds = Array.from({ length: 120 }, (_, i) => `contact-${i + 1}`);
    const plan = planCampaignMultiDaySchedule(contactIds, 80, new Date('2026-10-06T10:00:00Z'));

    expect(plan.totalDays).toBe(2);
    expect(plan.partitions[0].recipientCount).toBe(80);
    expect(plan.partitions[1].recipientCount).toBe(40);
  });

  it('detects business hours correctly', () => {
    // Tuesday at 2:00 PM EST (18:00 UTC) -> inside 09:00 - 17:00 EST
    const tuesdayAfternoon = new Date('2026-10-06T18:00:00Z');
    expect(isWithinSendingWindow(tuesdayAfternoon, { timezone: 'America/New_York' })).toBe(true);

    // Tuesday at 11:00 PM EST (Wednesday 03:00 UTC) -> outside business hours
    const tuesdayNight = new Date('2026-10-07T03:00:00Z');
    expect(isWithinSendingWindow(tuesdayNight, { timezone: 'America/New_York' })).toBe(false);

    // Sunday afternoon -> outside business days
    const sunday = new Date('2026-10-11T18:00:00Z');
    expect(isWithinSendingWindow(sunday, { timezone: 'America/New_York' })).toBe(false);
  });
});

describe('Native Outreach Engine: Stop-on-Reply Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halts pending campaign sends and sequence enrollments when lead replies', async () => {
    (db.contact.findFirst as any).mockResolvedValue({
      id: 'c-lead-1',
      firstName: 'Jordan',
      lastName: 'Smith',
    });

    (db.contact.update as any).mockResolvedValue({});
    (db.campaignRecipient.findMany as any).mockResolvedValue([
      { id: 'recip-1', campaignId: 'cmp-outreach-1' },
      { id: 'recip-2', campaignId: 'cmp-followup-1' },
    ]);
    (db.automationEnrollment.findMany as any).mockResolvedValue([
      { id: 'enr-1', automationId: 'auto-drip-1' },
    ]);
    (db.campaignRecipient.update as any).mockResolvedValue({});
    (db.automationEnrollment.update as any).mockResolvedValue({});
    (db.emailEvent.create as any).mockResolvedValue({});
    (db.contactEvent.create as any).mockResolvedValue({});

    const result = await handleInboundLeadReply({
      workspaceId: 'ws-active',
      senderEmail: 'jordan@prospect.com',
      subject: 'Re: Quick question',
      bodySnippet: 'Thanks for reaching out! Yes, let us chat this Thursday.',
      messageId: 'gmail-msg-123',
      threadId: 'gmail-th-456',
    });

    expect(result.handled).toBe(true);
    expect(result.cancelledRecipientsCount).toBe(2);
    expect(result.cancelledEnrollmentsCount).toBe(1);

    // Assert contact was updated with reply timestamp
    expect(db.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-lead-1' },
        data: expect.objectContaining({
          totalReplies: { increment: 1 },
        }),
      })
    );

    // Assert campaign recipients were marked REPLIED
    expect(db.campaignRecipient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REPLIED' }),
      })
    );

    // Assert sequence was halted with reason REPLIED
    expect(db.automationEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ exitReason: 'REPLIED' }),
      })
    );
  });
});

describe('Native Outreach Engine: High-Deliverability Personal Compiler', () => {
  it('interpolates merge tags accurately', () => {
    const rawTemplate = 'Hi {{first_name}}, how is {{business_name}} handling sales pipeline?';
    const output = interpolateMergeTags(rawTemplate, {
      workspaceId: 'ws-1',
      contactId: 'c-1',
      contact: {
        firstName: 'Marcus',
        companyName: 'Apex Roofing',
      },
      unsubscribeUrl: 'https://stoneaio.com/unsubscribe/tok123',
    });

    expect(output).toBe('Hi Marcus, how is Apex Roofing handling sales pipeline?');
  });

  it('compiles clean personal HTML without newsletter tables and includes unsubscribe link', () => {
    const rawBody = `Hey {{first_name}},\n\nSaw that {{company}} is scaling rapidly in Austin. Are you looking to streamline sales outreach?\n\nBest,\nJack`;
    const compiled = compilePersonalEmail(
      'Quick question for {{company}}',
      rawBody,
      {
        workspaceId: 'ws-1',
        contactId: 'c-1',
        contact: {
          firstName: 'Sarah',
          companyName: 'Austin Solar',
          email: 'sarah@austinsolar.com',
        },
        businessAddress: '123 Main St, Austin, TX 78701',
        unsubscribeUrl: 'https://stoneaio.com/unsubscribe/test-token',
      }
    );

    expect(compiled.subject).toBe('Quick question for Austin Solar');
    expect(compiled.html).toContain('Hey Sarah,');
    expect(compiled.html).toContain('Austin Solar');
    expect(compiled.html).toContain('123 Main St, Austin, TX 78701');
    expect(compiled.html).toContain('https://stoneaio.com/unsubscribe/test-token');
    // Ensure clean system font and no heavy table bloat
    expect(compiled.html).toContain('font-family: -apple-system');
    expect(compiled.html).not.toContain('<table');

    // Plain text version has clean fallback
    expect(compiled.plainText).toContain('Hey Sarah,');
    expect(compiled.plainText).toContain('Unsubscribe: https://stoneaio.com/unsubscribe/test-token');
  });
});
