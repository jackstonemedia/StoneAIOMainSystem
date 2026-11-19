/**
 * Channel settings — Tier 3 Tranche A, Fix 12.
 *
 * The Conversations channel settings form sent behaviour fields the PATCH
 * route silently dropped and echoed back as defaults: signature, auto-reply,
 * quiet hours and friends vanished on reload and never affected a send.
 * The five fields with a real hook now persist and dispatch honours them
 * (signature on email when the sender opts in, daily send limit on the
 * Conversations send path, quiet hours on SMS, archive-after-reply), and
 * the fields with no hook are gone from the form and the response.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  conn: null as any,
  conversation: null as any,
  message: null as any,
  messageUpdates: [] as any[],
  conversationUpdates: [] as any[],
  connectionUpdates: [] as any[],
  connectionsList: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    conversation: {
      findUnique: vi.fn(async () => state.conversation),
      update: vi.fn(async ({ where, data }: any) => {
        state.conversationUpdates.push({ where, data });
        return {};
      }),
    },
    channelConnection: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.provider === 'twilio') return state.conn?.provider === 'twilio' ? state.conn : null;
        if (where.provider?.in?.includes('gmail')) return state.conn?.provider === 'gmail' ? state.conn : null;
        if (where.id) return state.conn?.id === where.id ? state.conn : null;
        return null;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        state.conn?.id === where.id ? state.conn : null,
      ),
      update: vi.fn(async ({ where, data }: any) => {
        state.connectionUpdates.push({ where, data });
        if (state.conn && where.id === state.conn.id) Object.assign(state.conn, data);
        return state.conn;
      }),
      findMany: vi.fn(async () => state.connectionsList),
    },
    conversationMessage: {
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ where, data }: any) => {
        state.messageUpdates.push({ where, data });
        if (state.message && where.id === state.message.id) Object.assign(state.message, data);
        return state.message;
      }),
    },
    contact: { findFirst: vi.fn(async () => null), create: vi.fn(async () => null) },
    integration: { findUnique: vi.fn(async () => null) },
  },
}));

const twilioMock = vi.hoisted(() => ({ create: vi.fn(async () => ({ sid: 'SM_1' })) }));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: twilioMock.create } })),
}));

const gmailMock = vi.hoisted(() => ({ send: vi.fn(async (..._args: any[]) => ({ messageId: 'gm_1', threadId: 'th_1' })) }));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: gmailMock.send,
  getGmailAuthUrl: vi.fn(),
  exchangeGmailCode: vi.fn(),
}));

const axiosMock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('axios', () => ({ default: { post: axiosMock.post, get: axiosMock.get } }));

import channelsRouter from '../routes/channels.routes.js';
import businessRouter, { dispatchOutboundMessage, isWithinQuietHours } from '../routes/business.routes.js';
import { encryptJson } from '../services/channels/encryption.js';

function makeApp(router: any, mount: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    req.userId = 'user_1';
    next();
  });
  app.use(mount, router);
  return app;
}

function emailConvo() {
  state.conversation = {
    id: 'cv_1', channel: 'email', contactId: 'ct_1',
    contact: { id: 'ct_1', email: 'a@b.com', phone: '+15551234567' },
    subject: 'Hello', externalId: null, channelConnectionId: 'conn_gm',
  };
  state.conn = {
    id: 'conn_gm', provider: 'gmail', isActive: true, email: 'me@work.com',
    dailySendLimit: 40, sentTodayCount: 0, lastResetAt: new Date(),
    signature: '— Jack\nStone AIO', autoReply: false, archiveOnReply: false, quietHoursEnabled: false,
  };
  state.message = { id: 'cm_1', conversationId: 'cv_1', direction: 'outbound', status: 'sending', body: 'Hi there' };
}

function smsConvo() {
  state.conversation = {
    id: 'cv_2', channel: 'sms', contactId: 'ct_1',
    contact: { id: 'ct_1', email: 'a@b.com', phone: '+15551234567' },
    subject: null, externalId: null, channelConnectionId: 'conn_tw',
  };
  state.conn = {
    id: 'conn_tw', provider: 'twilio', isActive: true, twilioPhoneNumber: '+15550000000',
    credentialsJson: encryptJson({ accountSid: 'AC_test', authToken: 'tok_test' }),
    dailySendLimit: 40, sentTodayCount: 0, lastResetAt: new Date(),
    archiveOnReply: false, quietHoursEnabled: false,
  };
  state.message = { id: 'cm_2', conversationId: 'cv_2', direction: 'outbound', status: 'sending', body: 'Hi there' };
}

describe('channel settings (Fix 12)', () => {
  beforeEach(() => {
    state.conn = null;
    state.conversation = null;
    state.message = null;
    state.messageUpdates = [];
    state.conversationUpdates = [];
    state.connectionUpdates = [];
    state.connectionsList = [];
    twilioMock.create.mockClear();
    gmailMock.send.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('PATCH persists the behaviour fields and echoes nothing phantom', async () => {
    state.conn = { id: 'conn_1', workspaceId: 'ws_test', provider: 'gmail', isActive: true };
    const app = makeApp(channelsRouter, '/channels');
    const res = await request(app)
      .patch('/channels/connections/conn_1')
      .send({
        signature: '— Jack', autoReply: true, autoReplyText: 'We are away.',
        archiveOnReply: true, quietHoursEnabled: true,
        twoWaySync: true, forwardingNumber: '+15550000000', stopStartHandling: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.signature).toBe('— Jack');
    expect(res.body.autoReply).toBe(true);
    expect(res.body.autoReplyText).toBe('We are away.');
    expect(res.body.archiveOnReply).toBe(true);
    expect(res.body.quietHoursEnabled).toBe(true);
    expect(res.body).not.toHaveProperty('twoWaySync');
    expect(res.body).not.toHaveProperty('forwardingNumber');
    expect(res.body).not.toHaveProperty('stopStartHandling');
    expect(res.body).not.toHaveProperty('businessHoursAutoReply');
    expect(res.body).not.toHaveProperty('sharedWithUserIds');
    expect(res.body).not.toHaveProperty('teamRoutingId');
  });

  it('GET /connections returns the behaviour fields', async () => {
    state.connectionsList = [{
      id: 'conn_1', provider: 'gmail', signature: '— Jack', autoReply: true,
      autoReplyText: 'Away.', archiveOnReply: false, quietHoursEnabled: true,
      dailySendLimit: 40, sentTodayCount: 0, status: 'ACTIVE', isActive: true,
    }];
    const app = makeApp(channelsRouter, '/channels');
    const res = await request(app).get('/channels/connections');
    expect(res.status).toBe(200);
    expect(res.body[0].signature).toBe('— Jack');
    expect(res.body[0].quietHoursEnabled).toBe(true);
  });

  it('email dispatch appends the saved signature only when the sender opts in', async () => {
    emailConvo();
    await dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_1', messageId: 'cm_1',
      body: 'Hi there', includeSignature: true,
    });
    expect(gmailMock.send).toHaveBeenCalledTimes(1);
    const sentBody = gmailMock.send.mock.calls[0][3];
    expect(sentBody).toContain('Hi there');
    expect(sentBody).toContain('— Jack\nStone AIO');
    expect(state.messageUpdates.some((u) => u.data.status === 'delivered')).toBe(true);
    // The send counts toward the daily total.
    expect(state.connectionUpdates.some((u) => u.data.sentTodayCount?.increment === 1)).toBe(true);
  });

  it('email dispatch without the Sig opt-in sends the body as-is', async () => {
    emailConvo();
    await dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_1', messageId: 'cm_1', body: 'Hi there',
    });
    expect(gmailMock.send).toHaveBeenCalledTimes(1);
    expect(gmailMock.send.mock.calls[0][3]).toBe('Hi there');
  });

  it('SMS dispatch at the daily cap fails honestly and never calls Twilio', async () => {
    smsConvo();
    state.conn.sentTodayCount = 1;
    state.conn.dailySendLimit = 1;
    await expect(dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_2', messageId: 'cm_2', body: 'Hi there',
    })).rejects.toThrow('Daily send limit');
    expect(twilioMock.create).not.toHaveBeenCalled();
    expect(state.messageUpdates.some((u) => u.data.status === 'failed' && /Daily send limit/.test(u.data.errorMsg))).toBe(true);
  });

  it('SMS dispatch during quiet hours fails honestly and never calls Twilio', async () => {
    smsConvo();
    state.conn.quietHoursEnabled = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 18, 22, 0, 0)); // 22:00 local
    await expect(dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_2', messageId: 'cm_2', body: 'Hi there',
    })).rejects.toThrow('Quiet hours');
    expect(twilioMock.create).not.toHaveBeenCalled();
    expect(state.messageUpdates.some((u) => u.data.status === 'failed' && /Quiet hours/.test(u.data.errorMsg))).toBe(true);
  });

  it('SMS dispatch outside quiet hours sends', async () => {
    smsConvo();
    state.conn.quietHoursEnabled = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 18, 10, 0, 0)); // 10:00 local
    await dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_2', messageId: 'cm_2', body: 'Hi there',
    });
    expect(twilioMock.create).toHaveBeenCalledTimes(1);
  });

  it('a successful reply archives the thread when archiveOnReply is on', async () => {
    smsConvo();
    state.conn.archiveOnReply = true;
    await dispatchOutboundMessage({
      workspaceId: 'ws_test', conversationId: 'cv_2', messageId: 'cm_2', body: 'Hi there',
    });
    expect(twilioMock.create).toHaveBeenCalledTimes(1);
    expect(state.conversationUpdates.some((u) => u.data.status === 'archived')).toBe(true);
  });

  it('isWithinQuietHours: 22:00 yes, 10:00 no, boundaries 21:00 yes / 08:00 no', () => {
    expect(isWithinQuietHours(new Date(2026, 10, 18, 22, 0))).toBe(true);
    expect(isWithinQuietHours(new Date(2026, 10, 18, 10, 0))).toBe(false);
    expect(isWithinQuietHours(new Date(2026, 10, 18, 21, 0))).toBe(true);
    expect(isWithinQuietHours(new Date(2026, 10, 18, 8, 0))).toBe(false);
  });
});
