/**
 * Twilio inbound SMS webhook — POST /api/hooks/twilio-sms.
 * Covers the 2026-11-07 fix: the production signature check used to build its
 * URL from VITE_APP_URL alone (undefined in a Render deploy → every inbound
 * SMS failed validation with a 403). The URL now reconstructs from
 * PUBLIC_APP_URL first. Also covers media storage and the empty-body guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { encryptJson } from '../services/channels/encryption.js';

const TEST_KEY = 'a'.repeat(64);
const AUTH_TOKEN = 'test-twilio-auth-token';
const WS_ID = 'ws_test_twilio';
const TO_NUMBER = '+15550001111';
const FROM_NUMBER = '+15550002222';
const HOOK_URL = 'http://localhost:4000/api/hooks/twilio-sms';

const mockConnections: any[] = [];
const mockContacts: any[] = [];
const mockConversations: any[] = [];
const mockMessages: any[] = [];
const claimedSids = new Set<string>();

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = mockConnections.find(
          (c) =>
            (!where.provider || c.provider === where.provider) &&
            (!where.twilioPhoneNumber || c.twilioPhoneNumber === where.twilioPhoneNumber) &&
            (where.isActive === undefined || c.isActive === where.isActive),
        );
        return Promise.resolve(found ?? null);
      }),
    },
    contact: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = mockContacts.find(
          (c) =>
            (!where.workspaceId || c.workspaceId === where.workspaceId) &&
            (!where.phone || c.phone === where.phone),
        );
        return Promise.resolve(found ?? null);
      }),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const row = { id: `ct_${mockContacts.length + 1}`, ...data };
        mockContacts.push(row);
        return Promise.resolve(row);
      }),
    },
    conversation: {
      findFirst: vi.fn().mockImplementation(({ where }: any) => {
        const found = mockConversations.find(
          (c) =>
            (!where.workspaceId || c.workspaceId === where.workspaceId) &&
            (!where.channel || c.channel === where.channel) &&
            (!where.externalId || c.externalId === where.externalId) &&
            (!where.contactId || c.contactId === where.contactId) &&
            (!where.status || c.status === where.status),
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
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => {
        const row = { id: `cm_${mockMessages.length + 1}`, ...data };
        mockMessages.push(row);
        return Promise.resolve(row);
      }),
    },
  },
}));

vi.mock('../../infrastructure/database/idempotency.js', () => ({
  claimWebhookEvent: vi.fn().mockImplementation(async (_provider: string, eventId: string) => {
    if (!eventId) return true;
    if (claimedSids.has(eventId)) return false;
    claimedSids.add(eventId);
    return true;
  }),
}));

vi.mock('../services/channels/realtime.service.js', () => ({
  publishConversationEvent: vi.fn().mockResolvedValue(undefined),
  publishInboxEvent: vi.fn().mockResolvedValue(undefined),
}));

import { twilioSmsHandler, buildTwilioRequestUrl } from '../webhooks/twilio-sms.handler.js';

/** Mirrors Twilio's signing algorithm: HMAC-SHA1 over URL + sorted key+value pairs. */
function twilioSignature(url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', AUTH_TOKEN).update(data).digest('base64');
}

function buildApp() {
  const app = express();
  app.post('/api/hooks/twilio-sms', express.urlencoded({ extended: false }), twilioSmsHandler);
  return app;
}

const baseParams = (overrides: Record<string, string> = {}) => ({
  To: TO_NUMBER,
  From: FROM_NUMBER,
  Body: 'Hello from the test phone',
  MessageSid: 'SM_test_message_sid_1',
  NumMedia: '0',
  ...overrides,
});

describe('twilioSmsHandler', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    mockConnections.length = 0;
    mockContacts.length = 0;
    mockConversations.length = 0;
    mockMessages.length = 0;
    claimedSids.clear();
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_URL = 'http://localhost:4000';
    process.env.CHANNEL_ENCRYPTION_KEY = TEST_KEY;
    delete process.env.VITE_APP_URL;
    mockConnections.push({
      id: 'conn_1',
      workspaceId: WS_ID,
      provider: 'twilio',
      twilioPhoneNumber: TO_NUMBER,
      isActive: true,
      credentialsJson: encryptJson({ authToken: AUTH_TOKEN }),
    });
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.clearAllMocks();
  });

  it('accepts a validly signed SMS and stores conversation + message + contact', async () => {
    const params = baseParams();
    const sig = twilioSignature(HOOK_URL, params);
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', sig)
      .type('form')
      .send(params);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<Response>');
    expect(mockConversations).toHaveLength(1);
    expect(mockConversations[0].channel).toBe('sms');
    expect(mockConversations[0].externalId).toBe(FROM_NUMBER);
    expect(mockConversations[0].workspaceId).toBe(WS_ID);
    expect(mockMessages).toHaveLength(1);
    expect(mockMessages[0].body).toBe('Hello from the test phone');
    expect(mockMessages[0].direction).toBe('inbound');
    // Unread fix (agent/webhook-raw-body-fix): create with 0 + one increment = 1, not 2.
    expect(mockConversations[0].unreadCount).toBe(1);
    expect(mockContacts).toHaveLength(1);
    expect(mockContacts[0].phone).toBe(FROM_NUMBER);
  });

  it('rejects a bad signature with 403 and writes nothing', async () => {
    const params = baseParams();
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', 'bad-signature')
      .type('form')
      .send(params);
    expect(res.status).toBe(403);
    expect(mockConversations).toHaveLength(0);
    expect(mockMessages).toHaveLength(0);
  });

  it('rejects a missing signature with 403', async () => {
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .type('form')
      .send(baseParams());
    expect(res.status).toBe(403);
    expect(mockMessages).toHaveLength(0);
  });

  it('acks an unknown To number with 200 and writes nothing', async () => {
    const params = baseParams({ To: '+15559998888' });
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .type('form')
      .send(params);
    expect(res.status).toBe(200);
    expect(mockConversations).toHaveLength(0);
    expect(mockMessages).toHaveLength(0);
  });

  it('ignores a duplicate MessageSid (Twilio retry)', async () => {
    const params = baseParams();
    const sig = twilioSignature(HOOK_URL, params);
    const app = buildApp();
    const first = await request(app)
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', sig)
      .type('form')
      .send(params);
    expect(first.status).toBe(200);
    expect(mockMessages).toHaveLength(1);
    const second = await request(app)
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', sig)
      .type('form')
      .send(params);
    expect(second.status).toBe(200);
    expect(mockMessages).toHaveLength(1);
    expect(mockConversations).toHaveLength(1);
  });

  it('acks an empty body with no media and stores nothing', async () => {
    const params = baseParams({ Body: '' });
    const sig = twilioSignature(HOOK_URL, params);
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', sig)
      .type('form')
      .send(params);
    expect(res.status).toBe(200);
    expect(mockMessages).toHaveLength(0);
    expect(mockConversations).toHaveLength(0);
  });

  it('stores media URLs in the message attachments JSON', async () => {
    const params = baseParams({
      Body: '',
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/abc',
    });
    const sig = twilioSignature(HOOK_URL, params);
    const res = await request(buildApp())
      .post('/api/hooks/twilio-sms')
      .set('X-Twilio-Signature', sig)
      .type('form')
      .send(params);
    expect(res.status).toBe(200);
    expect(mockMessages).toHaveLength(1);
    expect(JSON.parse(mockMessages[0].attachments).mediaUrls).toEqual([
      'https://api.twilio.com/media/abc',
    ]);
  });

  it('buildTwilioRequestUrl prefers PUBLIC_APP_URL over VITE_APP_URL', () => {
    process.env.PUBLIC_APP_URL = 'https://app.example.com';
    process.env.VITE_APP_URL = 'https://vite.example.com';
    const req = {
      originalUrl: '/api/hooks/twilio-sms',
      protocol: 'http',
      get: () => 'internal:4000',
    } as any;
    expect(buildTwilioRequestUrl(req)).toBe('https://app.example.com/api/hooks/twilio-sms');
    delete process.env.PUBLIC_APP_URL;
    expect(buildTwilioRequestUrl(req)).toBe('https://vite.example.com/api/hooks/twilio-sms');
  });
});
