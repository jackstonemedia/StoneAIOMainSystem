/**
 * Channel auto-reply — Tier 3 Tranche A, Fix 12.
 *
 * The auto-reply toggle and message were form fields the PATCH route
 * dropped; nothing ever sent a reply. maybeSendAutoReply fires exactly
 * once per conversation: when an inbound message arrives and no outbound
 * message exists in that conversation yet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  conn: null as any,
  outboundExists: false,
  created: [] as any[],
  recordSuccessCalls: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.conn?.id === where.id ? state.conn : null,
      ),
    },
    conversationMessage: {
      findFirst: vi.fn(async () => (state.outboundExists ? { id: 'cm_out' } : null)),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `cm_${state.created.length + 1}`, ...data };
        state.created.push(row);
        return row;
      }),
    },
  },
}));

const gmailMock = vi.hoisted(() => ({ send: vi.fn(async () => ({ messageId: 'gm_1', threadId: 'th_1' })) }));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: gmailMock.send,
}));
const outlookMock = vi.hoisted(() => ({ send: vi.fn(async () => ({ conversationId: 'oc_1' })) }));
vi.mock('../services/channels/outlook.service.js', () => ({
  sendOutlookMessage: outlookMock.send,
}));
vi.mock('../services/email-marketing/mailbox-pool.service.js', () => ({
  recordSendSuccess: vi.fn(async (id: string) => { state.recordSuccessCalls.push(id); }),
}));

import { maybeSendAutoReply } from '../services/channels/auto-reply.service.js';

describe('maybeSendAutoReply (Fix 12)', () => {
  beforeEach(() => {
    state.conn = {
      id: 'conn_gm', provider: 'gmail', email: 'me@work.com',
      autoReply: true, autoReplyText: 'Thanks for writing — we will get back to you soon.',
    };
    state.outboundExists = false;
    state.created = [];
    state.recordSuccessCalls = [];
    gmailMock.send.mockClear();
    outlookMock.send.mockClear();
  });

  it('sends once when auto-reply is on and nobody has answered yet', async () => {
    const sent = await maybeSendAutoReply({
      connectionId: 'conn_gm', conversationId: 'cv_1',
      senderEmail: 'a@b.com', subject: 'Pricing question', threadId: 'th_9',
    });
    expect(sent).toBe(true);
    expect(gmailMock.send).toHaveBeenCalledTimes(1);
    expect(gmailMock.send.mock.calls[0].slice(1, 4)).toEqual([
      'a@b.com', 'Re: Pricing question', 'Thanks for writing — we will get back to you soon.',
    ]);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ direction: 'outbound', status: 'delivered' });
    expect(state.recordSuccessCalls).toEqual(['conn_gm']);
  });

  it('does nothing when auto-reply is off', async () => {
    state.conn.autoReply = false;
    expect(await maybeSendAutoReply({
      connectionId: 'conn_gm', conversationId: 'cv_1', senderEmail: 'a@b.com', subject: 'Hi',
    })).toBe(false);
    expect(gmailMock.send).not.toHaveBeenCalled();
  });

  it('does nothing when an outbound message already exists in the conversation', async () => {
    state.outboundExists = true;
    expect(await maybeSendAutoReply({
      connectionId: 'conn_gm', conversationId: 'cv_1', senderEmail: 'a@b.com', subject: 'Hi',
    })).toBe(false);
    expect(gmailMock.send).not.toHaveBeenCalled();
  });

  it('does nothing when the reply text is blank', async () => {
    state.conn.autoReplyText = '   ';
    expect(await maybeSendAutoReply({
      connectionId: 'conn_gm', conversationId: 'cv_1', senderEmail: 'a@b.com', subject: 'Hi',
    })).toBe(false);
    expect(gmailMock.send).not.toHaveBeenCalled();
  });

  it('uses the Outlook sender for Outlook connections', async () => {
    state.conn.provider = 'outlook';
    expect(await maybeSendAutoReply({
      connectionId: 'conn_gm', conversationId: 'cv_1', senderEmail: 'a@b.com', subject: 'Hi', threadId: 'th_9',
    })).toBe(true);
    expect(outlookMock.send).toHaveBeenCalledTimes(1);
    expect(gmailMock.send).not.toHaveBeenCalled();
  });
});
