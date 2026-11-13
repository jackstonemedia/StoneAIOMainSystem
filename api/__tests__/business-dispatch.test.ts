/**
 * Live UI dispatch — Tier 1 Fix 3.
 * The old SMS branch swallowed Twilio errors (`.catch(console.error)`) and
 * did nothing at all when there was no Twilio connection or no phone number,
 * while the message row defaulted to 'sent' — the UI showed a success for a
 * message that never left the server. Meta had no dispatch branch at all.
 * Every branch now follows the email branch's contract: mark the message
 * 'failed' with an errorMsg AND throw, or mark 'delivered' only on a real
 * provider success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  conversation: null as any,
  twilioConn: null as any,
  integration: null as any,
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
      findFirst: vi.fn(async ({ where }: any) =>
        where.provider === 'twilio' ? state.twilioConn : null,
      ),
    },
    conversationMessage: {
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ where, data }: any) => {
        state.messageUpdates.push({ where, data });
        return {};
      }),
    },
    integration: {
      findUnique: vi.fn(async () => state.integration),
    },
    contact: { findFirst: vi.fn(async () => null), create: vi.fn(async () => null) },
  },
}));

const twilioMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: twilioMock.create } })),
}));

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({ default: { post: axiosMock.post } }));

import { encryptJson } from '../services/channels/encryption.js';
import { dispatchOutboundMessage } from '../routes/business.routes.js';

const base = {
  workspaceId: 'ws_test',
  conversationId: 'conv_1',
  messageId: 'msg_1',
  body: 'Hello from the team',
};

describe('dispatchOutboundMessage (Tier 1 Fix 3)', () => {
  beforeEach(() => {
    state.messageUpdates = [];
    state.conversationUpdates = [];
    state.twilioConn = null;
    state.integration = null;
    twilioMock.create.mockReset();
    axiosMock.post.mockReset();
  });

  it('SMS with no Twilio connection fails honestly instead of silently succeeding', async () => {
    state.conversation = { id: 'conv_1', channel: 'sms', contact: { phone: '+15551234567' }, externalId: null };
    await expect(dispatchOutboundMessage({ ...base, channel: 'sms' })).rejects.toThrow(/No active Twilio/);
    expect(state.messageUpdates).toContainEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
    expect(state.messageUpdates[0].data.errorMsg).toMatch(/Twilio/);
  });

  it('SMS with no contact phone fails honestly', async () => {
    state.conversation = { id: 'conv_1', channel: 'sms', contact: { phone: null }, externalId: null };
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    await expect(dispatchOutboundMessage({ ...base, channel: 'sms' })).rejects.toThrow(/no phone number/);
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'failed' });
  });

  it('SMS Twilio failure is recorded and thrown (no more .catch(console.error))', async () => {
    state.conversation = { id: 'conv_1', channel: 'sms', contact: { phone: '+15551234567' }, externalId: null };
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    twilioMock.create.mockRejectedValue(new Error('Twilio 21211: invalid To number'));
    await expect(dispatchOutboundMessage({ ...base, channel: 'sms' })).rejects.toThrow(/SMS sending failed/);
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'failed', errorMsg: expect.stringContaining('21211') });
  });

  it('SMS success marks delivered with the Twilio SID', async () => {
    state.conversation = { id: 'conv_1', channel: 'sms', contact: { phone: '+15551234567' }, externalId: null };
    state.twilioConn = {
      id: 'cc_1', twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'ACx', authToken: 'tok' }),
    };
    twilioMock.create.mockResolvedValue({ sid: 'SM123' });
    await dispatchOutboundMessage({ ...base, channel: 'sms' });
    expect(twilioMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15551234567', from: '+15550001111', body: 'Hello from the team' }),
    );
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'delivered', externalId: 'SM123' });
  });

  it('Meta with no connected account fails honestly', async () => {
    state.conversation = { id: 'conv_1', channel: 'facebook', contact: { email: 'a@b.com' }, externalId: 'psid_123' };
    await expect(dispatchOutboundMessage({ ...base, channel: 'facebook' })).rejects.toThrow(/No facebook account connected/);
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'failed' });
  });

  it('Meta Graph error is recorded and thrown', async () => {
    state.conversation = { id: 'conv_1', channel: 'facebook', contact: { email: 'a@b.com' }, externalId: 'psid_123' };
    state.integration = { accessToken: 'tok_meta' };
    axiosMock.post.mockRejectedValue({ response: { data: { error: { message: 'Invalid PSID' } } } });
    await expect(dispatchOutboundMessage({ ...base, channel: 'facebook' })).rejects.toThrow(/facebook sending failed/);
    expect(state.messageUpdates[0].data.errorMsg).toMatch(/Invalid PSID/);
  });

  it('Meta success marks delivered with the Graph message id', async () => {
    state.conversation = { id: 'conv_1', channel: 'instagram', contact: { email: 'a@b.com' }, externalId: 'psid_456' };
    state.integration = { accessToken: 'tok_meta' };
    axiosMock.post.mockResolvedValue({ data: { message_id: 'mid.123' } });
    await dispatchOutboundMessage({ ...base, channel: 'instagram' });
    expect(axiosMock.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v18.0/me/messages',
      expect.objectContaining({ recipient: { id: 'psid_456' }, message: { text: 'Hello from the team' } }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok_meta' }) }),
    );
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'delivered', externalId: 'mid.123' });
  });

  it('an unknown channel fails honestly instead of looking sent', async () => {
    state.conversation = { id: 'conv_1', channel: 'pigeon', contact: {}, externalId: null };
    await expect(dispatchOutboundMessage({ ...base, channel: 'pigeon' })).rejects.toThrow(/not set up/);
    expect(state.messageUpdates[0].data).toMatchObject({ status: 'failed' });
  });
});
