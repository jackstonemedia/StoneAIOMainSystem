/**
 * Blueprint 3, Phase 2 — Truthfulness audit.
 *
 * Pins the fix for the fake sends in the shipping assistant: a send tool must
 * never report success without the effect happening. Every send either
 * delivers (verified by the mocked Gmail call) or throws honestly — and a
 * blocked/failed send leaves no 'sent' row behind.
 *
 * Key-independent: the Gmail call and the database are both mocked, so these
 * tests prove the tool layer's honesty without a live key or connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  channelConnection: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  conversationMessage: { create: vi.fn() },
  contact: { findFirst: vi.fn() },
  contactEvent: { create: vi.fn() },
  inboxConversation: { findUnique: vi.fn(), update: vi.fn() },
  inboxMessage: { create: vi.fn() },
  inboxMention: { create: vi.fn() },
}));

const mockSendGmailMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ messageId: 'gmail-msg-1', threadId: 'gmail-thread-1' })
);

vi.mock('../../infrastructure/database/client.js', () => ({ db: mockDb }));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: mockSendGmailMessage,
}));
vi.mock('../services/channels/realtime.service.js', () => ({
  publishInboxEvent: vi.fn().mockResolvedValue(undefined),
  publishWidgetEvent: vi.fn().mockResolvedValue(undefined),
}));

import { communicationTools } from '../services/assistant/tools/communication.tools.js';
import { createMessage } from '../services/inbox/inbox-message.service.js';

const ctx = { workspaceId: 'ws_1', userId: 'user_1', userRole: 'member', userName: 'Tester' };
const gmailConn = { id: 'conn_gmail', provider: 'gmail', isActive: true };

function tool(name: string) {
  const t = communicationTools.find((t) => t.name === name);
  if (!t) throw new Error(`tool ${name} not registered`);
  return t;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSendGmailMessage.mockResolvedValue({ messageId: 'gmail-msg-1', threadId: 'gmail-thread-1' });
  mockDb.channelConnection.findFirst.mockResolvedValue(gmailConn);
  mockDb.conversation.create.mockImplementation(async ({ data }: any) => ({ id: 'convo_new', ...data }));
  mockDb.conversationMessage.create.mockImplementation(async ({ data }: any) => ({ id: 'msg_new', ...data }));
  mockDb.contact.findFirst.mockResolvedValue({ email: 'alice@acmecorp.com' });
  mockDb.contactEvent.create.mockResolvedValue({});
  mockDb.inboxMessage.create.mockImplementation(async ({ data }: any) => ({ id: 'imsg_new', ...data }));
  mockDb.inboxConversation.update.mockImplementation(async ({ data }: any) => ({ id: 'iconvo_1', ...data }));
});

describe('Phase 2 — send_email delivers through Gmail or fails honestly', () => {
  it('throws an honest error with no Gmail connection and records nothing', async () => {
    mockDb.channelConnection.findFirst.mockResolvedValue(null);
    await expect(
      tool('send_email').execute(
        { recipientEmail: 'bob@example.com', subject: 'Hi', body: 'Hello' },
        ctx
      )
    ).rejects.toThrow('No active Gmail connection found');
    expect(mockSendGmailMessage).not.toHaveBeenCalled();
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
    expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
  });

  it('sends via Gmail first, then records the row as sent with the Gmail ids', async () => {
    const res = await tool('send_email').execute(
      { recipientEmail: 'bob@example.com', subject: 'Hi', body: 'Hello', contactId: 'ct_1' },
      ctx
    );
    expect(mockSendGmailMessage).toHaveBeenCalledWith('conn_gmail', 'bob@example.com', 'Hi', 'Hello');
    expect(mockDb.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'email',
          subject: 'Hi',
          externalId: 'gmail-thread-1',
          channelConnectionId: 'conn_gmail',
        }),
      })
    );
    expect(mockDb.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'sent', externalId: 'gmail-msg-1' }),
      })
    );
    expect(res.status).toBe('sent');
    expect(res.gmailMessageId).toBe('gmail-msg-1');
  });

  it('a failed Gmail send throws and leaves no sent row behind', async () => {
    mockSendGmailMessage.mockRejectedValue(new Error('Gmail API unavailable'));
    await expect(
      tool('send_email').execute(
        { recipientEmail: 'bob@example.com', subject: 'Hi', body: 'Hello' },
        ctx
      )
    ).rejects.toThrow('Gmail API unavailable');
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
    expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
  });
});

describe('Phase 2 — reply_to_conversation threads honestly', () => {
  const emailConvo = {
    id: 'convo_1',
    workspaceId: 'ws_1',
    channel: 'email',
    contactId: 'ct_1',
    subject: 'Re: Pricing',
    externalId: 'gmail-thread-9',
    channelConnectionId: 'conn_gmail',
  };

  it('throws when the conversation does not exist', async () => {
    mockDb.conversation.findFirst.mockResolvedValue(null);
    await expect(
      tool('reply_to_conversation').execute({ conversationId: 'nope', body: 'Hi' }, ctx)
    ).rejects.toThrow('not found in workspace');
    expect(mockSendGmailMessage).not.toHaveBeenCalled();
  });

  it('refuses a non-email conversation instead of faking a reply', async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ ...emailConvo, channel: 'sms' });
    await expect(
      tool('reply_to_conversation').execute({ conversationId: 'convo_1', body: 'Hi' }, ctx)
    ).rejects.toThrow('Cannot reply to a sms conversation');
    expect(mockSendGmailMessage).not.toHaveBeenCalled();
    expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
  });

  it('refuses when the conversation has no contact email to reply to', async () => {
    mockDb.conversation.findFirst.mockResolvedValue({ ...emailConvo, contactId: null });
    await expect(
      tool('reply_to_conversation').execute({ conversationId: 'convo_1', body: 'Hi' }, ctx)
    ).rejects.toThrow('no contact email address');
  });

  it('threads the reply through the stored Gmail thread id', async () => {
    mockDb.conversation.findFirst.mockResolvedValue(emailConvo);
    const res = await tool('reply_to_conversation').execute(
      { conversationId: 'convo_1', body: 'Thanks — sending it over.' },
      ctx
    );
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      'conn_gmail',
      'alice@acmecorp.com',
      'Re: Pricing',
      'Thanks — sending it over.',
      'gmail-thread-9'
    );
    expect(mockDb.conversationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'sent', externalId: 'gmail-msg-1' }),
      })
    );
    expect(res.message).toContain('in conversation thread');
  });

  it('sends as a new email — and says so — when no Gmail thread is linked', async () => {
    mockDb.conversation.findFirst.mockResolvedValue({
      ...emailConvo,
      externalId: null,
      channelConnectionId: null,
    });
    const res = await tool('reply_to_conversation').execute(
      { conversationId: 'convo_1', body: 'Hi again.' },
      ctx
    );
    expect(mockSendGmailMessage).toHaveBeenCalledWith(
      'conn_gmail',
      'alice@acmecorp.com',
      'Re: Pricing',
      'Hi again.',
      undefined
    );
    expect(res.message).toContain('new email');
    expect(mockDb.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalId: 'gmail-thread-1' }),
      })
    );
  });
});

describe('Phase 2 — send_sms fails honestly (no Twilio dispatch)', () => {
  it('still refuses a DND contact first', async () => {
    mockDb.contact.findFirst.mockResolvedValue({ firstName: 'Bob', lastName: 'Smith', dndEnabled: true });
    await expect(
      tool('send_sms').execute(
        { phoneNumber: '+15551234567', message: 'Hi', contactId: 'ct_1' },
        ctx
      )
    ).rejects.toThrow('DND enabled');
  });

  it('throws an honest not-set-up error and records nothing', async () => {
    mockDb.contact.findFirst.mockResolvedValue({ firstName: 'Bob', lastName: 'Smith', dndEnabled: false });
    await expect(
      tool('send_sms').execute({ phoneNumber: '+15551234567', message: 'Hi', contactId: 'ct_1' }, ctx)
    ).rejects.toThrow('SMS sending is not set up');
    expect(mockDb.conversation.create).not.toHaveBeenCalled();
    expect(mockDb.conversationMessage.create).not.toHaveBeenCalled();
    expect(mockDb.contactEvent.create).not.toHaveBeenCalled();
  });
});

describe('Phase 2 — manual Conversations-UI sends fail honestly too', () => {
  const agentSend = { senderType: 'agent' as const, content: 'Hello from support' };

  it('an SMS-channel agent send throws before recording anything', async () => {
    mockDb.inboxConversation.findUnique.mockResolvedValue({
      id: 'iconvo_1',
      inboxChannel: { channelType: 'sms' },
    });
    await expect(createMessage('ws_1', 'iconvo_1', agentSend)).rejects.toThrow(
      'SMS sending is not set up'
    );
    expect(mockDb.inboxMessage.create).not.toHaveBeenCalled();
  });

  it('an email-channel agent send still dispatches through Gmail', async () => {
    mockDb.inboxConversation.findUnique.mockResolvedValue({
      id: 'iconvo_1',
      status: 'open',
      subject: 'Pricing question',
      inboxChannel: { channelType: 'email' },
      inboxContact: { email: 'alice@acmecorp.com' },
      additionalAttributes: '{}',
    });
    const msg = await createMessage('ws_1', 'iconvo_1', agentSend);
    expect(mockSendGmailMessage).toHaveBeenCalled();
    expect(mockDb.inboxMessage.create).toHaveBeenCalled();
    expect(msg.id).toBe('imsg_new');
  });

  it('a live_chat agent reply is untouched — the widget event is its delivery', async () => {
    mockDb.inboxConversation.findUnique.mockResolvedValue({
      id: 'iconvo_1',
      status: 'open',
      inboxChannel: { channelType: 'live_chat' },
      inboxContact: {},
      additionalAttributes: '{}',
    });
    const msg = await createMessage('ws_1', 'iconvo_1', agentSend);
    expect(mockSendGmailMessage).not.toHaveBeenCalled();
    expect(mockDb.inboxMessage.create).toHaveBeenCalled();
    expect(msg.id).toBe('imsg_new');
  });
});
