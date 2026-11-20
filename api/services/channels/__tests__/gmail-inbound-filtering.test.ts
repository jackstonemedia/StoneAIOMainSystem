import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasSentEmailToRecipient, shouldFilterColdInbound, recordFilteredColdInbound } from '../gmail.service.js';
import { db } from '../../../../infrastructure/database/client.js';

vi.mock('../../../../infrastructure/database/client.js', () => ({
  db: {
    conversationMessage: {
      findFirst: vi.fn(),
    },
    contactEvent: {
      findFirst: vi.fn(),
    },
    campaignRecipient: {
      findFirst: vi.fn(),
    },
    channelConnection: {
      update: vi.fn(),
    },
  },
}));

describe('hasSentEmailToRecipient', () => {
  const workspaceId = 'ws-test-1';
  const recipient = 'alice@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no recipient email is provided', async () => {
    const result = await hasSentEmailToRecipient(workspaceId, '');
    expect(result).toBe(false);
    expect(db.conversationMessage.findFirst).not.toHaveBeenCalled();
  });

  it('returns true if the thread already has an outbound message', async () => {
    (db.conversationMessage.findFirst as any).mockResolvedValueOnce({ id: 'msg-out-1' });

    const result = await hasSentEmailToRecipient(workspaceId, recipient, 'thread-123');
    expect(result).toBe(true);
    expect(db.conversationMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          direction: 'outbound',
          conversation: expect.objectContaining({
            workspaceId,
            externalId: 'thread-123',
          }),
        }),
      })
    );
  });

  it('returns true if an outbound message was previously sent to this recipient in conversations', async () => {
    // 1st call for thread check returns null
    (db.conversationMessage.findFirst as any).mockResolvedValueOnce(null);
    // 2nd call for conversation outbound message returns match
    (db.conversationMessage.findFirst as any).mockResolvedValueOnce({ id: 'msg-out-2' });

    const result = await hasSentEmailToRecipient(workspaceId, recipient, 'thread-new');
    expect(result).toBe(true);
  });

  it('returns true if an email was sent via CRM actions / ContactEvent', async () => {
    (db.conversationMessage.findFirst as any).mockResolvedValue(null);
    (db.contactEvent.findFirst as any).mockResolvedValueOnce({ id: 'event-email-1' });

    const result = await hasSentEmailToRecipient(workspaceId, recipient);
    expect(result).toBe(true);
    expect(db.contactEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'email',
        }),
      })
    );
  });

  it('returns true if an email was sent via campaigns / CampaignRecipient', async () => {
    (db.conversationMessage.findFirst as any).mockResolvedValue(null);
    (db.contactEvent.findFirst as any).mockResolvedValue(null);
    (db.campaignRecipient.findFirst as any).mockResolvedValueOnce({ id: 'camp-recip-1' });

    const result = await hasSentEmailToRecipient(workspaceId, recipient);
    expect(result).toBe(true);
    expect(db.campaignRecipient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'SENT',
        }),
      })
    );
  });

  it('returns false for random inbound senders who were never emailed through the software', async () => {
    (db.conversationMessage.findFirst as any).mockResolvedValue(null);
    (db.contactEvent.findFirst as any).mockResolvedValue(null);
    (db.campaignRecipient.findFirst as any).mockResolvedValue(null);

    const result = await hasSentEmailToRecipient(workspaceId, 'stranger@random.com', 'thread-stranger');
    expect(result).toBe(false);
  });
});

describe('shouldFilterColdInbound (complete-platform item 3)', () => {
  it('never filters mail from a sender the workspace emailed first', () => {
    expect(shouldFilterColdInbound(true, false)).toBe(false);
    expect(shouldFilterColdInbound(true, true)).toBe(false);
  });

  it('never filters when the connection opts in to cold inbound', () => {
    expect(shouldFilterColdInbound(false, true)).toBe(false);
  });

  it('filters a cold sender when the opt-in is off', () => {
    expect(shouldFilterColdInbound(false, false)).toBe(true);
  });
});

describe('recordFilteredColdInbound (complete-platform item 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts the filtered message on the connection with a timestamp', async () => {
    await recordFilteredColdInbound('conn_gm');
    expect(db.channelConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn_gm' },
      data: {
        filteredColdCount: { increment: 1 },
        lastFilteredColdAt: expect.any(Date),
      },
    });
  });

  it('never throws — a failed count must not break inbound polling', async () => {
    (db.channelConnection.update as any).mockRejectedValueOnce(new Error('db down'));
    await expect(recordFilteredColdInbound('conn_gm')).resolves.toBeUndefined();
  });
});
