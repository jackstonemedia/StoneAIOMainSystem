import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDomainDns,
  createSendingDomain,
  deleteSendingDomain,
  getSendingDomains,
  guidanceRecords,
  isReservedDomain,
  joinTxtRecords,
  verifySendingDomain,
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

// No 'resend' mock: the service must not import Resend at all (Gmail-only).
// If it did, this file would fail to load without the mock.

function txtRecord(value: string): string[][] {
  return [[value]];
}

function fakeResolver(mapping: Record<string, string | Error>): { resolveTxt: (host: string) => Promise<string[][]> } {
  return {
    resolveTxt: async (host: string) => {
      const v = mapping[host];
      if (v instanceof Error) throw v;
      if (typeof v === 'string') return txtRecord(v);
      throw Object.assign(new Error('no data'), { code: 'ENODATA' });
    },
  };
}

const timeout = () => Object.assign(new Error('timed out'), { code: 'ETIMEOUT' });

describe('SendingDomain Service (Gmail-only, direct DNS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins chunked TXT records', () => {
    expect(joinTxtRecords([['v=spf1 ', 'include:_spf.google.com'], ['~all']])).toEqual([
      'v=spf1 include:_spf.google.com',
      '~all',
    ]);
  });

  it('detects RFC 2606 reserved domains', () => {
    expect(isReservedDomain('sparkling.example')).toBe(true);
    expect(isReservedDomain('foo.test')).toBe(true);
    expect(isReservedDomain('bar.localhost')).toBe(true);
    expect(isReservedDomain('baz.invalid')).toBe(true);
    expect(isReservedDomain('company.com')).toBe(false);
    expect(isReservedDomain('example.com')).toBe(false);
  });

  it('checkDomainDns finds SPF, DKIM (google selector), and DMARC', async () => {
    const resolver = {
      resolveTxt: vi.fn(async (host: string) => {
        if (host === 'company.com') return txtRecord('v=spf1 include:_spf.google.com ~all');
        if (host === 'google._domainkey.company.com') return txtRecord('v=DKIM1; k=rsa; p=abc');
        if (host === '_dmarc.company.com') return txtRecord('v=DMARC1; p=none; rua=mailto:dmarc@company.com');
        throw Object.assign(new Error('no data'), { code: 'ENODATA' });
      }),
    };
    const r = await checkDomainDns('company.com', resolver);
    expect(r.spf).toBe(true);
    expect(r.dkim).toBe(true);
    expect(r.dkimSelector).toBe('google');
    expect(r.dmarc).toBe(true);
    expect(r.inconclusive).toBe(false);
  });

  it('checkDomainDns reports missing records as conclusive absence', async () => {
    const resolver = {
      resolveTxt: vi.fn(async () => {
        throw Object.assign(new Error('no data'), { code: 'ENODATA' });
      }),
    };
    const r = await checkDomainDns('company.com', resolver);
    expect(r.spf).toBe(false);
    expect(r.dkim).toBe(false);
    expect(r.dmarc).toBe(false);
    expect(r.inconclusive).toBe(false);
  });

  it('checkDomainDns marks timeouts inconclusive (never "missing")', async () => {
    const resolver = {
      resolveTxt: vi.fn(async () => {
        throw Object.assign(new Error('timed out'), { code: 'ETIMEOUT' });
      }),
    };
    const r = await checkDomainDns('company.com', resolver);
    expect(r.inconclusive).toBe(true);
  });

  it('creates sending domain as PENDING with DNS guidance (no provider id)', async () => {
    (db.sendingDomain.create as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      status: 'PENDING',
    });
    const result = await createSendingDomain('ws-test', 'company.com');
    expect(result.domain).toBe('company.com');
    const call = (db.sendingDomain.create as any).mock.calls[0][0];
    expect(call.data.workspaceId).toBe('ws-test');
    expect(call.data.domain).toBe('company.com');
    expect(call.data.status).toBe('PENDING');
    expect(String(call.data.resendDomainId)).toMatch(/^local_/);
    const recs = call.data.dnsRecords as Array<{ record: string }>;
    expect(recs.map((r) => r.record)).toEqual(['SPF', 'DKIM', 'DMARC']);
    expect(guidanceRecords('company.com').map((r) => r.record)).toEqual(['SPF', 'DKIM', 'DMARC']);
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

  it('verifies via live DNS: SPF + DKIM present → VERIFIED', async () => {
    const resolver = fakeResolver({
      'company.com': 'v=spf1 include:_spf.google.com ~all',
      'google._domainkey.company.com': 'v=DKIM1; k=rsa; p=abc',
      '_dmarc.company.com': 'v=DMARC1; p=none',
    });
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      status: 'PENDING',
      dnsRecords: [],
      verifiedAt: null,
    });
    (db.sendingDomain.update as any).mockResolvedValue({ id: 'dom-1', status: 'VERIFIED' });
    const result = await verifySendingDomain('ws-test', 'dom-1', resolver);
    expect(result.status).toBe('VERIFIED');
    expect(db.sendingDomain.update).toHaveBeenCalledWith({
      where: { id: 'dom-1' },
      data: expect.objectContaining({ status: 'VERIFIED' }),
    });
  });

  it('verifies via live DNS: records missing → FAILED', async () => {
    const resolver = fakeResolver({});
    (db.sendingDomain.findFirst as any).mockResolvedValue({
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      status: 'PENDING',
      dnsRecords: [],
      verifiedAt: null,
    });
    (db.sendingDomain.update as any).mockResolvedValue({ id: 'dom-1', status: 'FAILED' });
    const result = await verifySendingDomain('ws-test', 'dom-1', resolver);
    expect(result.status).toBe('FAILED');
  });

  it('inconclusive DNS never downgrades: row returned untouched, no update', async () => {
    const resolver = {
      resolveTxt: async () => {
        throw timeout();
      },
    };
    const record = {
      id: 'dom-1',
      workspaceId: 'ws-test',
      domain: 'company.com',
      status: 'VERIFIED',
      dnsRecords: [],
      verifiedAt: new Date(),
    };
    (db.sendingDomain.findFirst as any).mockResolvedValue(record);
    const result = await verifySendingDomain('ws-test', 'dom-1', resolver);
    expect(result).toBe(record);
    expect(db.sendingDomain.update).not.toHaveBeenCalled();
  });

  it('deletes sending domain scoped to workspace (no provider removal)', async () => {
    (db.sendingDomain.findFirst as any).mockResolvedValue({ id: 'dom-1', workspaceId: 'ws-test' });
    (db.sendingDomain.deleteMany as any).mockResolvedValue({ count: 1 });
    const result = await deleteSendingDomain('ws-test', 'dom-1');
    expect(result).toBeDefined();
    expect(db.sendingDomain.deleteMany).toHaveBeenCalledWith({
      where: { id: 'dom-1', workspaceId: 'ws-test' },
    });
  });
});
