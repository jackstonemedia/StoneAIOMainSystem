import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSendingDomain,
  getSendingDomains,
  verifySendingDomain,
  deleteSendingDomain,
} from '../sending-domain.service.js';
import { db } from '../../../../infrastructure/database/client.js';

vi.mock('../../../../infrastructure/database/client.js', () => ({
  db: {
    sendingDomain: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      domains: {
        create: vi.fn().mockResolvedValue({
          data: {
            id: 'resend_dom_123',
            name: 'company.com',
            status: 'not_started',
            records: [{ record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'not_started' }],
          },
          error: null,
        }),
        get: vi.fn().mockResolvedValue({
          data: {
            id: 'resend_dom_123',
            name: 'company.com',
            status: 'verified',
            records: [{ record: 'SPF', name: 'send', type: 'TXT', ttl: 'Auto', status: 'verified' }],
          },
          error: null,
        }),
        verify: vi.fn().mockResolvedValue({
          data: { id: 'resend_dom_123' },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({
          data: { id: 'resend_dom_123', deleted: true },
          error: null,
        }),
      },
    })),
  };
});

describe('SendingDomain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates sending domain with workspace isolation', async () => {
    (db.sendingDomain.create as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      resendDomainId: 'resend_dom_123',
      status: 'PENDING',
      dnsRecords: [],
    });

    const result = await createSendingDomain('ws-test', 'company.com');
    expect(result.domain).toBe('company.com');
    expect(db.sendingDomain.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ workspaceId: 'ws-test', domain: 'company.com' }),
    });
  });

  it('lists sending domains strictly scoped by workspaceId', async () => {
    (db.sendingDomain.findMany as any).mockResolvedValue([
      { id: 'dom-1', workspaceId: 'ws-test', domain: 'company.com' },
    ]);

    const list = await getSendingDomains('ws-test');
    expect(list.length).toBe(1);
    expect(db.sendingDomain.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-test' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('verifies sending domain and updates status in database', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      resendDomainId: 'resend_dom_123',
      status: 'PENDING',
      dnsRecords: [],
    });
    (db.sendingDomain.update as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      status: 'VERIFIED',
    });

    const result = await verifySendingDomain('ws-test', 'dom-1');
    expect(result.status).toBe('VERIFIED');
    expect(db.sendingDomain.update).toHaveBeenCalledWith({
      where: { id: 'dom-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
  });

  it('deletes sending domain scoped to workspace', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      resendDomainId: 'resend_dom_123',
    });
    (db.sendingDomain.deleteMany as any).mockResolvedValue({ count: 1 });

    const result = await deleteSendingDomain('ws-test', 'dom-1');
    expect(result).toBeDefined();
    expect(db.sendingDomain.deleteMany).toHaveBeenCalledWith({
      where: { id: 'dom-1', workspaceId: 'ws-test' },
    });
  });
});
