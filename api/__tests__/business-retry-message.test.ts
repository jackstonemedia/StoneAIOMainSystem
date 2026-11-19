/**
 * Inbox retry — Tier 3 Tranche A, Fix 8.
 *
 * POST /business/conversations/:id/messages/:msgId/retry used to just set
 * the row to 'delivered' and clear the error — the message never left the
 * server, and the thread showed a success for a send that never happened.
 * Retry now re-runs the real dispatch (dispatchOutboundMessage) with the
 * original body and the stored email envelope, and the row reflects the
 * real outcome: delivered with the provider id on success, failed again
 * with the error on failure. Only failed outbound messages can be retried.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  conversation: null as any,
  message: null as any,
  twilioConn: null as any,
  gmailConn: null as any,
  messageUpdates: [] as any[],
  conversationUpdates: [] as any[],
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
        if (where.provider === 'twilio') return state.twilioConn;
        if (where.provider?.in?.includes('gmail')) return state.gmailConn;
        if (where.id) return state.gmailConn?.id === where.id ? state.gmailConn : state.twilioConn?.id === where.id ? state.twilioConn : null;
        return null;
      }),
      // Tranche A fix 12: dispatch now re-reads the connection for the daily
      // send-limit check (assertDailySendAvailable) and records each success.
      findUnique: vi.fn(async ({ where }: any) =>
        state.gmailConn?.id === where.id ? state.gmailConn : state.twilioConn?.id === where.id ? state.twilioConn : null,
      ),
      update: vi.fn(async () => ({})),
    },
    conversationMessage: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where?.id && state.message && where.id === state.message.id) {
          if (where.conversationId && where.conversationId !== state.message.conversationId) return null;
          return state.message;
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        state.message && where.id === state.message.id ? state.message : null,
      ),
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

const twilioMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: twilioMock.create } })),
}));

const gmailMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: gmailMock.send,
}));

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post: axiosMock.post } }));

import { encryptJson } from '../services/channels/encryption.js';
import businessRouter from '../routes/business.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    req.userId = 'user_test';
    next();
  });
  app.use('/business', businessRouter);
  return app;
}

function seedSmsFailed() {
  state.conversation = {
    id: 'conv_1', workspaceId: 'ws_test', channel: 'sms',
    contact: { phone: '+15551234567', email: 'a@b.com' },
    channelConnectionId: null, subject: null, externalId: null,
  };
  state.message = {
    id: 'msg_1', conversationId: 'conv_1', body: 'Hello from the team',
    direction: 'outbound', status: 'failed', errorMsg: 'Twilio 21211: invalid To number',
    channel: 'sms', attachments: null, externalId: null,
    conversation: state.conversation,
  };
}

function seedEmailFailed() {
  state.conversation = {
    id: 'conv_1', workspaceId: 'ws_test', channel: 'email',
    contact: { phone: null, email: 'a@b.com' },
    channelConnectionId: 'cc_gmail', subject: 'Hi there', externalId: null,
  };
  state.message = {
    id: 'msg_1', conversationId: 'conv_1', body: 'Hi there body',
    direction: 'outbound', status: 'failed', errorMsg: 'Gmail: connection expired',
    channel: 'email',
    attachments: JSON.stringify({ toEmail: 'a@b.com', subject: 'Hi there', htmlBody: '<p>Hi</p>' }),
    externalId: null,
    conversation: state.conversation,
  };
}

describe('POST /business/conversations/:id/messages/:msgId/retry (Fix 8)', () => {
  beforeEach(() => {
    state.messageUpdates = [];
    state.conversationUpdates = [];
    state.twilioConn = null;
    state.gmailConn = null;
    twilioMock.create.mockReset();
    gmailMock.send.mockReset();
    axiosMock.post.mockReset();
    state.conversation = null;
    state.message = null;
  });

  it('retries a failed SMS through Twilio and marks it delivered with the SID', async () => {
    seedSmsFailed();
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    twilioMock.create.mockResolvedValue({ sid: 'SM999' });

    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(200);
    expect(twilioMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15551234567', from: '+15550001111', body: 'Hello from the team' }),
    );
    expect(res.body.status).toBe('delivered');
    expect(res.body.externalId).toBe('SM999');
    expect(res.body.errorMsg).toBeNull();
  });

  it('a failed retry leaves the message failed with the new error — never delivered', async () => {
    seedSmsFailed();
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    twilioMock.create.mockRejectedValue(new Error('Twilio 21211: invalid To number'));

    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/21211/);
    expect(state.message.status).toBe('failed');
    expect(state.message.errorMsg).toMatch(/21211/);
  });

  it('retry with no Twilio connection fails honestly and never claims delivery', async () => {
    seedSmsFailed();
    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No active Twilio/);
    expect(twilioMock.create).not.toHaveBeenCalled();
    expect(state.message.status).toBe('failed');
  });

  it('retries a failed email through Gmail with the stored envelope', async () => {
    seedEmailFailed();
    state.gmailConn = { id: 'cc_gmail', provider: 'gmail', isActive: true };
    gmailMock.send.mockResolvedValue({ messageId: 'gm_123', threadId: 'th_1' });

    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(200);
    expect(gmailMock.send).toHaveBeenCalledWith(
      'cc_gmail', 'a@b.com', 'Hi there', 'Hi there body', undefined, '<p>Hi</p>',
    );
    expect(res.body.status).toBe('delivered');
    expect(res.body.externalId).toBe('gm_123');
    expect(res.body.errorMsg).toBeNull();
  });

  it('a delivered message cannot be retried (no double-send)', async () => {
    seedSmsFailed();
    state.message.status = 'delivered';
    state.message.errorMsg = null;
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only failed messages/);
    expect(twilioMock.create).not.toHaveBeenCalled();
  });

  it('an inbound message cannot be retried', async () => {
    seedSmsFailed();
    state.message.direction = 'inbound';
    const res = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_1/retry');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only outbound messages/);
    expect(twilioMock.create).not.toHaveBeenCalled();
  });

  it('a missing message is a 404 and a message from another conversation is not retried', async () => {
    seedSmsFailed();
    const missing = await request(makeApp()).post('/business/conversations/conv_1/messages/msg_nope/retry');
    expect(missing.status).toBe(404);
    const wrongConvo = await request(makeApp()).post('/business/conversations/conv_other/messages/msg_1/retry');
    expect(wrongConvo.status).toBe(404);
    expect(twilioMock.create).not.toHaveBeenCalled();
  });
});
