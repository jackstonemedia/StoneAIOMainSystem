import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEmailSendJobDirectly, type EmailSendJobData } from '../email-send-worker.service.js';
import { db } from '../../../../infrastructure/database/client.js';

vi.mock('../../../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findFirst: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
    },
    campaign: {
      findFirst: vi.fn(),
    },
    campaignRecipient: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    contactListMembership: {
      findFirst: vi.fn(),
    },
    suppressionEntry: {
      findFirst: vi.fn(),
    },
    channelConnection: {
      findFirst: vi.fn(),
    },
    emailEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../channels/gmail.service.js', () => ({
  sendGmailMessage: vi.fn().mockResolvedValue({ messageId: 'gmail_msg_123', threadId: 'thread_123' }),
}));

describe('Email Send Worker Multi-Tenant Isolation (C1 Security Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strictly rejects sending when workspace has no active Gmail connection and never borrows another workspace connection', async () => {
    const jobData: EmailSendJobData = {
      workspaceId: 'workspace_victim',
      campaignRecipientId: 'recip_123',
      contactId: 'contact_123',
      type: 'CAMPAIGN',
      campaignId: 'camp_123',
    };

    // Workspace exists
    (db.workspace.findFirst as any).mockResolvedValue({
      id: 'workspace_victim',
      name: 'Victim Corp',
    });

    // Contact exists
    (db.contact.findFirst as any).mockResolvedValue({
      id: 'contact_123',
      workspaceId: 'workspace_victim',
      email: 'lead@example.com',
      firstName: 'Jane',
    });

    // Not suppressed
    (db.suppressionEntry.findFirst as any).mockResolvedValue(null);
    (db.contactListMembership.findFirst as any).mockResolvedValue(null);

    // Campaign exists
    (db.campaign.findFirst as any).mockResolvedValue({
      id: 'camp_123',
      workspaceId: 'workspace_victim',
      subject: 'Hello',
      blockJson: { html: 'Hello Jane' },
    });

    (db.campaignRecipient.findFirst as any).mockResolvedValue({
      id: 'recip_123',
      variant: 'A',
    });

    // Channel connection: workspace_victim has NO connection
    (db.channelConnection.findFirst as any).mockImplementation((args: any) => {
      // If query does not include workspaceId, this is a multi-tenant leak!
      if (!args.where || !args.where.workspaceId) {
        throw new Error('CRITICAL SECURITY VIOLATION: channelConnection queried without workspaceId!');
      }
      if (args.where.workspaceId === 'workspace_victim') {
        return Promise.resolve(null);
      }
      // Another workspace has an active connection
      return Promise.resolve({ id: 'conn_other_tenant', workspaceId: 'other_workspace', provider: 'gmail' });
    });

    const result = await processEmailSendJobDirectly(jobData);

    // Verification:
    // 1. db.channelConnection.findFirst was ONLY called with workspaceId: 'workspace_victim'
    expect(db.channelConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace_victim',
          provider: 'gmail',
          isActive: true,
        }),
      })
    );

    // 2. It must NEVER have called findFirst without workspaceId
    const allCalls = (db.channelConnection.findFirst as any).mock.calls;
    for (const call of allCalls) {
      expect(call[0]?.where?.workspaceId).toBe('workspace_victim');
    }

    // 3. The recipient must be marked as failed because no connection exists
    expect(db.campaignRecipient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'recip_123' },
        data: expect.objectContaining({
          status: expect.stringContaining('FAILED'),
        }),
      })
    );
  });
});
