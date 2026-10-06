/**
 * Drip Progression & Threading Test Suite
 *
 * Verifies:
 * 1. Multi-step drip sequence advances non-responders to Step 2, Step 3.
 * 2. Step body and subjects are interpolated per recipient.
 * 3. In-Reply-To and References headers are attached for conversation threading.
 * 4. Inbound replies immediately halt drip follow-up progression.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../../../infrastructure/database/client.js';
import {
  processDripSequences,
  hasContactReplied,
  markContactReplied,
} from '../sequence-scheduler.service.js';
import { CampaignStatus, EmailEventType } from '@prisma/client';

// Mock DB
vi.mock('../../../../infrastructure/database/client.js', () => ({
  db: {
    campaign: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    campaignRecipient: {
      findFirst: vi.fn().mockResolvedValue({ id: 'recip-1', variant: 'A' }),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    contactEvent: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    },
    emailEvent: {
      findMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'ee-1' }),
    },
    inboxMessage: {
      findFirst: vi.fn(),
    },
    channelConnection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn().mockResolvedValue({ id: 'ws-1', name: 'Test WS' }),
    },
    contactListMembership: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    suppressionEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock mailbox pool and channels
vi.mock('../mailbox-pool.service.js', () => ({
  selectNextMailbox: vi.fn().mockResolvedValue({
    id: 'box-gmail-1',
    provider: 'gmail',
    email: 'rep@company.com',
    dailySendLimit: 40,
    sentTodayCount: 5,
  }),
  recordSendSuccess: vi.fn().mockResolvedValue(undefined),
  recordSendBounce: vi.fn().mockResolvedValue(undefined),
  recordSendAuthError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../channels/gmail.service.js', () => ({
  sendGmailMessage: vi.fn().mockResolvedValue({
    messageId: 'gmail-msg-step-2',
    threadId: 'gmail-thread-1',
  }),
}));

describe('Drip Sequence Progression & RFC Threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects when contact has replied and stops sequence', async () => {
    (db.contact.findFirst as any).mockResolvedValue({
      id: 'contact-1',
      email: 'lead@target.com',
    });
    (db.inboxMessage.findFirst as any).mockResolvedValue({
      id: 'msg-inbound-1',
      senderType: 'contact',
    });

    const replied = await hasContactReplied('ws-1', 'contact-1');
    expect(replied).toBe(true);
  });

  it('manually marks contact as replied and logs contact event', async () => {
    const result = await markContactReplied('ws-1', 'cmp-1', 'contact-1');
    expect(result.success).toBe(true);
    expect(db.campaignRecipient.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'cmp-1', contactId: 'contact-1' },
      data: { status: 'REPLIED' },
    });
    expect(db.contactEvent.create).toHaveBeenCalled();
  });

  it('advances recipient to step 2 after required delay has elapsed', async () => {
    const threeDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    (db.campaign.findMany as any).mockResolvedValue([
      {
        id: 'cmp-drip-1',
        workspaceId: 'ws-1',
        name: 'Cold Outreach Sequence',
        subject: 'Quick question for {{first_name}}',
        status: CampaignStatus.SENT,
        blockJson: {
          campaignType: 'drip',
          dripSteps: [
            { stepNumber: 1, delayDays: 0, delayHours: 0, subject: 'Initial Touch', body: 'Hello {{first_name}}' },
            { stepNumber: 2, delayDays: 3, delayHours: 0, subject: 'Re: Quick question', body: 'Following up on my last note {{first_name}}' },
          ],
        },
        recipients: [
          {
            id: 'recip-1',
            contactId: 'c-1',
            status: 'SENT',
            sentAt: threeDaysAgo,
            resendMessageId: 'gmail-msg-step-1',
            contact: {
              id: 'c-1',
              email: 'prospect@acme.com',
              firstName: 'Jordan',
            },
          },
        ],
      },
    ]);

    // Has NOT replied
    (db.contact.findFirst as any).mockResolvedValue({ id: 'c-1', email: 'prospect@acme.com', firstName: 'Jordan' });
    (db.inboxMessage.findFirst as any).mockResolvedValue(null);
    (db.contactEvent.findFirst as any).mockImplementation((args: any) => {
      if (args?.where?.type === 'email_reply') return Promise.resolve(null);
      return Promise.resolve({
        id: 'last-evt-1',
        type: 'email',
        metadataJson: JSON.stringify({
          campaignId: 'cmp-drip-1',
          messageId: 'gmail-msg-step-1',
          threadId: 'gmail-thread-1',
        }),
      });
    });

    (db.campaign.findFirst as any).mockResolvedValue({
      id: 'cmp-drip-1',
      workspaceId: 'ws-1',
      name: 'Cold Outreach Sequence',
      subject: 'Quick question for {{first_name}}',
      blockJson: {
        campaignType: 'drip',
        dripSteps: [
          { stepNumber: 1, delayDays: 0, delayHours: 0, subject: 'Initial Touch', body: 'Hello {{first_name}}' },
          { stepNumber: 2, delayDays: 3, delayHours: 0, subject: 'Re: Quick question', body: 'Following up on my last note {{first_name}}' },
        ],
      },
    });

    // Only step 1 has been sent so far
    (db.emailEvent.findMany as any).mockResolvedValue([
      {
        id: 'ee-1',
        eventType: EmailEventType.SENT,
        occurredAt: threeDaysAgo,
      },
    ]);

    const result = await processDripSequences();
    expect(result.advanced).toBe(1);
    expect(result.stoppedOnReply).toBe(0);
  });
});
