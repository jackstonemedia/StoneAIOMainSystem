import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDomainUpdatedWebhook } from '../resend-webhook.handler.js';
import { db } from '../../../infrastructure/database/client.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    sendingDomain: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    campaignRecipient: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Resend domain.updated Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates sending domain status to VERIFIED when Resend domain is verified', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      resendDomainId: 'resend_123',
      status: 'PENDING',
    });
    (db.sendingDomain.update as any).mockResolvedValue({
      id: 'dom-1',
      status: 'VERIFIED',
    });

    const handled = await handleDomainUpdatedWebhook({
      type: 'domain.updated',
      data: {
        id: 'resend_123',
        status: 'verified',
        records: [],
      },
    });

    expect(handled).toBe(true);
    expect(db.sendingDomain.update).toHaveBeenCalledWith({
      where: { id: 'dom-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
  });

  it('updates sending domain status to FAILED when Resend domain fails verification', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      resendDomainId: 'resend_123',
      status: 'PENDING',
    });
    (db.sendingDomain.update as any).mockResolvedValue({
      id: 'dom-1',
      status: 'FAILED',
    });

    const handled = await handleDomainUpdatedWebhook({
      type: 'domain.updated',
      data: {
        id: 'resend_123',
        status: 'failed',
        records: [],
      },
    });

    expect(handled).toBe(true);
    expect(db.sendingDomain.update).toHaveBeenCalledWith({
      where: { id: 'dom-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });
});
