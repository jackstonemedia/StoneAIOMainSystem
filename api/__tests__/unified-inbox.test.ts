import { describe, it, expect, vi, beforeEach } from 'vitest';

// Item 2: one list + thread over both stores. The unified layer merges,
// sorts, and routes replies/mark-read to the owning store — it must
// never duplicate a message, never send through the wrong path, and
// never leak a thread across workspaces.

const state = vi.hoisted(() => ({
  legacy: [] as any[],
  legacyMessages: [] as any[],
  live: [] as any[],
  liveMessages: [] as any[],
  dispatchShouldFail: false,
}));

const legacyCtl = vi.hoisted(() => ({
  sent: [] as any[],
  // Light stand-in for biz.listConversations: honours the filter args
  // the unified service passes, over the fake legacy rows.
  list: vi.fn(async (_ws: string, filters: any = {}, callerUserId?: string) => {
    let rows = state.legacy.filter((r) => r.workspaceId === _ws);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.subject ?? '').toLowerCase().includes(q) ||
          `${r.contact?.firstName ?? ''} ${r.contact?.lastName ?? ''}`.toLowerCase().includes(q) ||
          (r.contact?.email ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
    if (filters.view === 'unread') rows = rows.filter((r) => r.unreadCount > 0);
    if (filters.assignedUserId === 'me') rows = rows.filter((r) => r.assignedUserId === callerUserId);
    if (filters.assignedUserId === 'unassigned') rows = rows.filter((r) => !r.assignedUserId);
    return rows;
  }),
  send: vi.fn(async (conversationId: string, body: string, sender: string, direction: string) => {
    const msg = { id: `lm-${legacyCtl.sent.length + 1}`, conversationId, sender, body, direction, status: 'sent', createdAt: new Date() };
    legacyCtl.sent.push(msg);
    state.legacyMessages.push(msg);
    return msg;
  }),
}));

const liveCtl = vi.hoisted(() => ({
  created: [] as any[],
  list: vi.fn(async (_ws: string, filters: any = {}) => {
    let rows = state.live.filter((r) => r.workspaceId === _ws);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.subject ?? '').toLowerCase().includes(q) ||
          (r.inboxContact?.name ?? '').toLowerCase().includes(q) ||
          (r.inboxContact?.email ?? '').toLowerCase().includes(q),
      );
    }
    if (filters.status && filters.status !== 'all') rows = rows.filter((r) => r.status === filters.status);
    if (filters.assignedUserId === 'me') rows = rows.filter((r) => r.assignedUserId === filters.callerUserId);
    if (filters.assignedUserId === 'unassigned') rows = rows.filter((r) => !r.assignedUserId);
    const pageSize = Number(filters.pageSize || 25);
    return { conversations: rows.slice(0, pageSize), total: rows.length, page: 1, pageSize, hasMore: rows.length > pageSize };
  }),
  createMessage: vi.fn(async (_ws: string, conversationId: string, data: any) => {
    const msg = { id: `im-${liveCtl.created.length + 1}`, conversationId, workspaceId: _ws, senderType: data.senderType, senderId: data.senderId, content: data.content, status: 'sent', private: false, createdAt: new Date() };
    liveCtl.created.push(msg);
    state.liveMessages.push(msg);
    return msg;
  }),
}));

const dispatchCtl = vi.hoisted(() => ({
  calls: [] as any[],
  dispatch: vi.fn(async (args: any) => {
    dispatchCtl.calls.push(args);
    if (state.dispatchShouldFail) throw new Error('No active Gmail or Outlook account connected.');
  }),
}));

const fakeDb = vi.hoisted(() => {
  const db = {
    conversation: {
      findUnique: async ({ where, include }: any) => {
        const row = state.legacy.find((r) => r.id === where.id) ?? null;
        if (!row) return null;
        return include ? { ...row } : row;
      },
      findMany: async () => state.legacy,
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const r of state.legacy) {
          if (r.id === where.id && r.workspaceId === where.workspaceId) {
            Object.assign(r, data);
            n++;
          }
        }
        return { count: n };
      },
      aggregate: async ({ where }: any) => ({
        _sum: { unreadCount: state.legacy.filter((r) => r.workspaceId === where.workspaceId).reduce((s, r) => s + r.unreadCount, 0) },
      }),
    },
    conversationMessage: {
      findMany: async ({ where }: any) =>
        state.legacyMessages.filter((m) => m.conversationId === where.conversationId),
    },
    inboxConversation: {
      findUnique: async ({ where }: any) => state.live.find((r) => r.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        let n = 0;
        for (const r of state.live) {
          if (r.id === where.id && r.workspaceId === where.workspaceId) {
            Object.assign(r, data);
            n++;
          }
        }
        return { count: n };
      },
      aggregate: async ({ where }: any) => ({
        _sum: { unreadCount: state.live.filter((r) => r.workspaceId === where.workspaceId).reduce((s, r) => s + r.unreadCount, 0) },
      }),
    },
    inboxMessage: {
      findMany: async ({ where, orderBy }: any) => {
        let rows = state.liveMessages;
        if (where.conversationId) {
          if (typeof where.conversationId === 'string') rows = rows.filter((m) => m.conversationId === where.conversationId);
          else if (where.conversationId.in) rows = rows.filter((m) => where.conversationId.in.includes(m.conversationId));
        }
        const dir = orderBy?.createdAt === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => dir * (+new Date(a.createdAt) - +new Date(b.createdAt)));
      },
    },
  };
  return db;
});

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));
vi.mock('../services/business.service.js', () => ({
  listConversations: legacyCtl.list,
  sendConversationMessage: legacyCtl.send,
}));
vi.mock('../services/inbox/inbox-conversation.service.js', () => ({
  listConversations: liveCtl.list,
}));
vi.mock('../services/inbox/inbox-message.service.js', () => ({
  createMessage: liveCtl.createMessage,
}));
vi.mock('../routes/business.routes.js', () => ({
  dispatchOutboundMessage: dispatchCtl.dispatch,
}));

import {
  listUnifiedThreads,
  getUnifiedThread,
  sendUnifiedReply,
  markUnifiedRead,
  getUnifiedUnread,
} from '../services/inbox/unified-inbox.service';

const T = (iso: string) => new Date(iso);

function seed() {
  // Same person (alice@) in BOTH stores — until cross-system identity
  // (1.23) lands these stay two threads; the list must show both,
  // each exactly once.
  state.legacy.push(
    {
      id: 'leg-1', workspaceId: 'ws1', contactId: 'ct_alice', channel: 'gmail', status: 'open',
      unreadCount: 2, subject: 'Pricing question', lastMessageAt: T('2026-11-19T10:00:00Z'),
      updatedAt: T('2026-11-19T10:00:00Z'), createdAt: T('2026-11-19T09:00:00Z'), assignedUserId: null,
      contact: { id: 'ct_alice', firstName: 'Alice', lastName: 'Freeman', email: 'alice@example.com', phone: null },
      messages: [{ body: 'What does the Plus plan cost?' }],
    },
    {
      id: 'leg-2', workspaceId: 'ws1', contactId: 'ct_bob', channel: 'sms', status: 'open',
      unreadCount: 0, subject: null, lastMessageAt: T('2026-11-19T08:00:00Z'),
      updatedAt: T('2026-11-19T08:00:00Z'), createdAt: T('2026-11-19T07:00:00Z'), assignedUserId: 'u1',
      contact: { id: 'ct_bob', firstName: 'Bob', lastName: '', email: null, phone: '+15551234567' },
      messages: [{ body: 'Thanks!' }],
    },
  );
  state.live.push(
    {
      id: 'live-1', workspaceId: 'ws1', inboxChannelId: 'ch1', inboxContactId: 'ic1', displayId: 7,
      status: 'open', unreadCount: 1, subject: null, assignedUserId: null,
      lastActivityAt: T('2026-11-19T11:00:00Z'), updatedAt: T('2026-11-19T11:00:00Z'), createdAt: T('2026-11-19T10:30:00Z'),
      inboxChannel: { id: 'ch1', name: 'Website', channelType: 'live_chat' },
      inboxContact: { id: 'ic1', name: 'Alice', email: 'alice@example.com' },
    },
  );
  state.legacyMessages.push(
    { id: 'lm-0a', conversationId: 'leg-1', sender: 'alice@example.com', body: 'What does the Plus plan cost?', direction: 'inbound', status: 'delivered', createdAt: T('2026-11-19T10:00:00Z') },
    { id: 'lm-0b', conversationId: 'leg-1', sender: 'agent', body: 'Plus is $49/mo.', direction: 'outbound', status: 'sent', createdAt: T('2026-11-19T10:01:00Z') },
  );
  state.liveMessages.push(
    { id: 'im-0a', conversationId: 'live-1', senderType: 'contact', content: 'Hi, is anyone there?', status: 'sent', private: false, createdAt: T('2026-11-19T11:00:00Z') },
    { id: 'im-0b', conversationId: 'live-1', senderType: 'agent', content: 'Hi Alice, yes!', status: 'sent', private: false, createdAt: T('2026-11-19T11:01:00Z') },
    { id: 'im-0c', conversationId: 'live-1', senderType: 'agent', content: 'Internal note', status: 'sent', private: true, createdAt: T('2026-11-19T11:02:00Z') },
  );
}

describe('unified inbox (complete-platform item 2)', () => {
  beforeEach(() => {
    state.legacy.splice(0);
    state.legacyMessages.splice(0);
    state.live.splice(0);
    state.liveMessages.splice(0);
    state.dispatchShouldFail = false;
    legacyCtl.sent.splice(0);
    liveCtl.created.splice(0);
    dispatchCtl.calls.splice(0);
    legacyCtl.list.mockClear();
    legacyCtl.send.mockClear();
    liveCtl.list.mockClear();
    liveCtl.createMessage.mockClear();
    dispatchCtl.dispatch.mockClear();
    seed();
  });

  it('lists both stores merged by recency, each thread once, unread summed', async () => {
    const { threads, total, unreadTotal } = await listUnifiedThreads('ws1');
    expect(total).toBe(3);
    expect(threads.map((t) => `${t.source}:${t.id}`)).toEqual(['live:live-1', 'legacy:leg-1', 'legacy:leg-2']);
    expect(unreadTotal).toBe(3); // 2 legacy + 1 live
    expect(threads[0].contactLabel).toBe('Alice');
    expect(threads[0].channelLabel).toBe('Live chat');
    expect(threads[0].preview).toBe('Internal note');
    expect(threads[1].contactLabel).toBe('Alice Freeman');
    expect(threads[1].channelLabel).toBe('Gmail');
    expect(threads[1].preview).toBe('What does the Plus plan cost?');
  });

  it('unread-only keeps only threads with unread', async () => {
    const { threads } = await listUnifiedThreads('ws1', { unreadOnly: true });
    expect(threads.map((t) => t.id).sort()).toEqual(['leg-1', 'live-1']);
  });

  it('search passes through to both stores', async () => {
    const { threads } = await listUnifiedThreads('ws1', { q: 'pricing' });
    expect(threads.map((t) => t.id)).toEqual(['leg-1']);
    expect(legacyCtl.list).toHaveBeenCalledWith('ws1', expect.objectContaining({ search: 'pricing' }), undefined);
    expect(liveCtl.list).toHaveBeenCalledWith('ws1', expect.objectContaining({ q: 'pricing' }));
  });

  it('legacy thread normalizes messages as-is', async () => {
    const res = await getUnifiedThread('ws1', 'legacy', 'leg-1');
    expect(res?.thread.contactLabel).toBe('Alice Freeman');
    expect(res?.messages.map((m) => [m.direction, m.body])).toEqual([
      ['inbound', 'What does the Plus plan cost?'],
      ['outbound', 'Plus is $49/mo.'],
    ]);
  });

  it('live thread maps senderType to direction and keeps private notes flagged', async () => {
    const res = await getUnifiedThread('ws1', 'live', 'live-1');
    expect(res?.thread.contactLabel).toBe('Alice');
    expect(res?.messages.map((m) => [m.direction, m.body, m.private ?? false])).toEqual([
      ['inbound', 'Hi, is anyone there?', false],
      ['outbound', 'Hi Alice, yes!', false],
      ['outbound', 'Internal note', true],
    ]);
  });

  it('a thread from another workspace is not visible', async () => {
    expect(await getUnifiedThread('ws2', 'legacy', 'leg-1')).toBeNull();
    expect(await getUnifiedThread('ws2', 'live', 'live-1')).toBeNull();
  });

  it('legacy reply records the message AND dispatches through the channel', async () => {
    const msg = await sendUnifiedReply('ws1', 'legacy', 'leg-1', 'Plus is $49/mo.', 'u1');
    expect(legacyCtl.send).toHaveBeenCalledWith('leg-1', 'Plus is $49/mo.', 'u1', 'outbound');
    expect(dispatchCtl.calls).toHaveLength(1);
    expect(dispatchCtl.calls[0]).toMatchObject({ workspaceId: 'ws1', conversationId: 'leg-1', messageId: msg.id });
    expect(liveCtl.createMessage).not.toHaveBeenCalled();
  });

  it('legacy reply throws when dispatch fails, like the legacy composer', async () => {
    state.dispatchShouldFail = true;
    await expect(sendUnifiedReply('ws1', 'legacy', 'leg-1', 'Hello', 'u1')).rejects.toThrow(/No active Gmail/);
    expect(legacyCtl.send).toHaveBeenCalledTimes(1); // row recorded, send failed
  });

  it('live reply goes through the inbox path, never the legacy dispatcher', async () => {
    const msg = await sendUnifiedReply('ws1', 'live', 'live-1', 'Hi Alice!', 'u1');
    expect(liveCtl.createMessage).toHaveBeenCalledWith('ws1', 'live-1', {
      senderType: 'agent', senderId: 'u1', content: 'Hi Alice!',
    });
    expect(dispatchCtl.calls).toHaveLength(0);
    expect(legacyCtl.send).not.toHaveBeenCalled();
    expect((msg as any).content).toBe('Hi Alice!');
  });

  it('mark-read clears only the owning store', async () => {
    await markUnifiedRead('ws1', 'legacy', 'leg-1');
    expect(state.legacy.find((r) => r.id === 'leg-1')!.unreadCount).toBe(0);
    expect(state.live.find((r) => r.id === 'live-1')!.unreadCount).toBe(1);
    await markUnifiedRead('ws1', 'live', 'live-1');
    expect(state.live.find((r) => r.id === 'live-1')!.unreadCount).toBe(0);
  });

  it('unread total sums both stores', async () => {
    expect(await getUnifiedUnread('ws1')).toBe(3);
    expect(await getUnifiedUnread('ws2')).toBe(0);
  });
});
