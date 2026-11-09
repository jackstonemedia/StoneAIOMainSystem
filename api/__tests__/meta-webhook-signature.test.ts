/**
 * Meta (Facebook/Instagram) inbound webhook — POST /api/hooks/meta.
 * Covers the 2026-11-07 fix: the mounts used to sit below the workflow
 * wildcard (which 404s unknown paths), so Meta inbound never reached the
 * handler — and nothing verified X-Hub-Signature-256. The handler now checks
 * the HMAC over the raw body against META_APP_SECRET before acking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const SECRET = 'test-meta-app-secret';
const PAGE_ID = 'page_123';
const SENDER_ID = 'user_456';

const mockIntegrations: any[] = [];
const mockConversations: any[] = [];
const mockMessages: any[] = [];

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    integration: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = mockIntegrations.find(
          (i) =>
            (!where.provider || i.provider === where.provider) &&
            (!where.accountId || i.accountId === where.accountId),
        );
        return Promise.resolve(found ?? null);
      }),
    },
    conversation: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = mockConversations.find(
          (c) =>
            (!where.workspaceId || c.workspaceId === where.workspaceId) &&
            (!where.externalId || c.externalId === where.externalId) &&
            (!where.channel || c.channel === where.channel),
        );
        return Promise.resolve(found ?? null);
      }),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const row = { id: `cv_${mockConversations.length + 1}`, ...data };
        mockConversations.push(row);
        return Promise.resolve(row);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const row = mockConversations.find((c) => c.id === where.id);
        if (row) {
          // Apply Prisma-style increments (the DB adds; Object.assign would overwrite).
          const { unreadCount, ...rest } = data;
          if (unreadCount?.increment) row.unreadCount = (row.unreadCount ?? 0) + unreadCount.increment;
          Object.assign(row, rest);
        }
        return Promise.resolve(row ?? null);
      }),
    },
    conversationMessage: {
      create: vi.fn().mockImplementation(({ data }: any) => {
        const row = { id: `cm_${mockMessages.length + 1}`, ...data };
        mockMessages.push(row);
        return Promise.resolve(row);
      }),
    },
  },
}));

import { verifyMetaSignature, metaWebhookPost } from '../webhooks/meta.handler.js';

function metaPayload() {
  return {
    object: 'page',
    entry: [
      {
        id: PAGE_ID,
        messaging: [
          { sender: { id: SENDER_ID }, message: { text: 'Hi there' } },
        ],
      },
    ],
  };
}

function sign(body: Buffer): string {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function mockRes() {
  const res: any = {
    statusCode: 0,
    body: '',
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: any) {
      res.body = body;
      return res;
    },
    sendStatus(code: number) {
      res.statusCode = code;
      return res;
    },
  };
  return res;
}

describe('verifyMetaSignature', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.META_APP_SECRET = SECRET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('accepts a correct HMAC over the raw body', () => {
    const raw = Buffer.from(JSON.stringify(metaPayload()));
    const req = {
      headers: { 'x-hub-signature-256': sign(raw) },
      rawBody: raw,
    } as any;
    expect(verifyMetaSignature(req)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const raw = Buffer.from(JSON.stringify(metaPayload()));
    const tampered = Buffer.from(JSON.stringify({ ...metaPayload(), object: 'instagram' }));
    const req = {
      headers: { 'x-hub-signature-256': sign(raw) },
      rawBody: tampered,
    } as any;
    expect(verifyMetaSignature(req)).toBe(false);
  });

  it('rejects a missing signature', () => {
    const req = { headers: {}, rawBody: Buffer.from('{}') } as any;
    expect(verifyMetaSignature(req)).toBe(false);
  });

  it('accepts everything when no secret is configured (dev parity)', () => {
    delete process.env.META_APP_SECRET;
    const req = { headers: {}, rawBody: Buffer.from('{}') } as any;
    expect(verifyMetaSignature(req)).toBe(true);
  });
});

describe('metaWebhookPost', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    mockIntegrations.length = 0;
    mockConversations.length = 0;
    mockMessages.length = 0;
    process.env.META_APP_SECRET = SECRET;
    mockIntegrations.push({ workspaceId: 'ws_meta', provider: 'facebook', accountId: PAGE_ID });
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('stores the message on a validly signed POST', async () => {
    const raw = Buffer.from(JSON.stringify(metaPayload()));
    const req = {
      headers: { 'x-hub-signature-256': sign(raw) },
      rawBody: raw,
      body: metaPayload(),
    } as any;
    const res = mockRes();
    await metaWebhookPost(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockConversations).toHaveLength(1);
    expect(mockConversations[0].channel).toBe('facebook');
    expect(mockConversations[0].externalId).toBe(SENDER_ID);
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0].body).toBe('Hi there');
    expect(mockMessages[0].direction).toBe('inbound');
    // Unread fix (agent/webhook-raw-body-fix): create with 0 + one increment = 1, not 2.
    expect(mockConversations[0].unreadCount).toBe(1);
  });

  it('rejects a bad signature with 403 and writes nothing', async () => {
    const raw = Buffer.from(JSON.stringify(metaPayload()));
    const req = {
      headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
      rawBody: raw,
      body: metaPayload(),
    } as any;
    const res = mockRes();
    await metaWebhookPost(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockConversations).toHaveLength(0);
    expect(mockMessages).toHaveLength(0);
  });
});
