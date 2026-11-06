/**
 * Finder Tools Tests — Stone AI Assistant
 * Spec Section 7.6 & Phase 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findersTools, getLastTouch } from '../services/assistant/tools/finders.tools.js';

const mockContacts: Record<string, any> = {};
const mockEvents: Record<string, any> = {};
const mockActivities: Record<string, any> = {};
const mockAppointments: Record<string, any> = {};
const mockCampaignRecipients: Record<string, any> = {};
const mockConversations: Record<string, any> = {};
const mockDeals: Record<string, any> = {};
const mockTasks: Record<string, any> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    contact: {
      findMany: vi.fn().mockImplementation(({ where, take }) => {
        let list = Object.values(mockContacts).filter((c) => {
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
          if (where.dndEnabled !== undefined && c.dndEnabled !== where.dndEnabled) return false;
          if (where.email?.not === null && !c.email) return false;
          if (where.createdAt?.gte && c.createdAt < where.createdAt.gte) return false;
          return true;
        });

        return Promise.resolve(
          list.slice(0, take || 50).map((c) => ({
            ...c,
            company: c.companyId ? { name: 'Acme Corp' } : null,
            tasks: (c.tasks || []).map((tid: string) => mockTasks[tid]).filter(Boolean),
            campaignRecipients: Object.values(mockCampaignRecipients).filter((r: any) => r.contactId === c.id),
            events: Object.values(mockEvents).filter((e: any) => e.contactId === c.id),
          }))
        );
      }),
    },
    contactEvent: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const matches = Object.values(mockEvents).filter((e) => e.contactId === where.contactId);
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return Promise.resolve(matches[0] || null);
      }),
    },
    activity: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const matches = Object.values(mockActivities).filter(
          (a) => a.workspaceId === where.workspaceId && a.contactId === where.contactId
        );
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return Promise.resolve(matches[0] || null);
      }),
    },
    appointment: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const matches = Object.values(mockAppointments).filter(
          (a) => a.workspaceId === where.workspaceId && a.contactId === where.contactId
        );
        matches.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        return Promise.resolve(matches[0] || null);
      }),
    },
    campaignRecipient: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const matches = Object.values(mockCampaignRecipients).filter(
          (r) => r.contactId === where.contactId && r.sentAt !== null
        );
        matches.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
        return Promise.resolve(matches[0] || null);
      }),
    },
    conversation: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const matches = Object.values(mockConversations).filter(
          (c) => c.workspaceId === where.workspaceId && c.contactId === where.contactId
        );
        return Promise.resolve(matches[0] || null);
      }),
      findMany: vi.fn().mockImplementation(({ where, take }) => {
        const matches = Object.values(mockConversations).filter((c) => {
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
          if (where.status && c.status !== where.status) return false;
          if (where.unreadCount?.gt !== undefined && c.unreadCount <= where.unreadCount.gt) return false;
          return true;
        });
        return Promise.resolve(
          matches.slice(0, take || 50).map((c) => ({
            ...c,
            contact: c.contactId ? mockContacts[c.contactId] : null,
          }))
        );
      }),
    },
    deal: {
      findMany: vi.fn().mockImplementation(({ where, take }) => {
        const matches = Object.values(mockDeals).filter((d) => {
          if (where.workspaceId && d.workspaceId !== where.workspaceId) return false;
          if (where.pipelineStage?.isWon !== undefined && d.pipelineStage?.isWon !== where.pipelineStage.isWon) return false;
          if (where.pipelineStage?.isLost !== undefined && d.pipelineStage?.isLost !== where.pipelineStage.isLost) return false;
          return true;
        });
        return Promise.resolve(matches.slice(0, take || 50));
      }),
    },
    task: {
      findMany: vi.fn().mockImplementation(({ where, take }) => {
        const matches = Object.values(mockTasks).filter((t) => {
          if (where.workspaceId && t.workspaceId !== where.workspaceId) return false;
          if (where.status?.not && t.status === where.status.not) return false;
          if (where.dueDate?.lt && t.dueDate >= where.dueDate.lt) return false;
          return true;
        });
        return Promise.resolve(
          matches.slice(0, take || 50).map((t) => ({
            ...t,
            contact: t.contactId ? mockContacts[t.contactId] : null,
            deal: t.dealId ? mockDeals[t.dealId] : null,
          }))
        );
      }),
    },
  },
}));

describe('Finder Tools (Phase 1)', () => {
  const ws1 = 'ws-finders-1';
  const ctx = {
    workspaceId: ws1,
    userId: 'u1',
    userRole: 'member',
  };

  beforeEach(() => {
    for (const key of Object.keys(mockContacts)) delete mockContacts[key];
    for (const key of Object.keys(mockEvents)) delete mockEvents[key];
    for (const key of Object.keys(mockActivities)) delete mockActivities[key];
    for (const key of Object.keys(mockAppointments)) delete mockAppointments[key];
    for (const key of Object.keys(mockCampaignRecipients)) delete mockCampaignRecipients[key];
    for (const key of Object.keys(mockConversations)) delete mockConversations[key];
    for (const key of Object.keys(mockDeals)) delete mockDeals[key];
    for (const key of Object.keys(mockTasks)) delete mockTasks[key];
  });

  it('getLastTouch accurately aggregates across events, activities, campaigns, and appointments', async () => {
    const contactId = 'ct-1';
    const t1 = new Date(Date.now() - 10 * 86400000);
    const t2 = new Date(Date.now() - 3 * 86400000);

    mockEvents['e1'] = { id: 'e1', contactId, type: 'email', title: 'Sent proposal', createdAt: t1 };
    mockActivities['a1'] = { id: 'a1', workspaceId: ws1, contactId, type: 'call', title: 'Follow-up call', createdAt: t2 };

    const lastTouch = await getLastTouch(ws1, contactId);
    expect(lastTouch).not.toBeNull();
    expect(lastTouch?.date).toEqual(t2);
    expect(lastTouch?.type).toBe('call');
  });

  it('find_stale_leads identifies contacts with no touchpoints older than N days', async () => {
    const staleDate = new Date(Date.now() - 25 * 86400000);
    mockContacts['c-stale'] = {
      id: 'c-stale',
      workspaceId: ws1,
      firstName: 'John',
      lastName: 'Stale',
      email: 'john@example.com',
      dndEnabled: false,
      leadScore: 80,
      createdAt: staleDate,
      lastContactedAt: staleDate,
      tasks: [],
    };

    const staleFinder = findersTools.find((t) => t.name === 'find_stale_leads')!;
    const res = (await staleFinder.execute({ olderThanDays: 14 }, ctx)) as any;

    expect(res.leads.length).toBe(1);
    expect(res.leads[0].id).toBe('c-stale');
    expect(res.leads[0].daysSinceLastTouch).toBeGreaterThanOrEqual(24);
    expect(res.leads[0].matchReason).toContain('no open tasks scheduled');
  });

  it('find_unwelcomed_leads finds new leads with email who never received outreach', async () => {
    const recentDate = new Date(Date.now() - 5 * 86400000);
    mockContacts['c-new'] = {
      id: 'c-new',
      workspaceId: ws1,
      firstName: 'Alice',
      lastName: 'Newbie',
      email: 'alice@example.com',
      dndEnabled: false,
      createdAt: recentDate,
      source: 'web_form',
    };

    const unwelcomedFinder = findersTools.find((t) => t.name === 'find_unwelcomed_leads')!;
    const res = (await unwelcomedFinder.execute({ createdWithinDays: 30 }, ctx)) as any;

    expect(res.leads.length).toBe(1);
    expect(res.leads[0].id).toBe('c-new');
    expect(res.leads[0].matchReason).toContain('zero outbound emails');
  });

  it('find_stalled_deals identifies open deals exceeding pipeline stale threshold', async () => {
    mockDeals['d-stalled'] = {
      id: 'd-stalled',
      workspaceId: ws1,
      title: 'Enterprise Plan',
      amount: 15000,
      currency: 'USD',
      daysInStage: 22,
      pipelineStage: {
        name: 'Negotiation',
        isWon: false,
        isLost: false,
        pipeline: { name: 'Sales Pipeline', staleThresholdDays: 14 },
      },
    };

    const stalledFinder = findersTools.find((t) => t.name === 'find_stalled_deals')!;
    const res = (await stalledFinder.execute({}, ctx)) as any;

    expect(res.deals.length).toBe(1);
    expect(res.deals[0].id).toBe('d-stalled');
    expect(res.deals[0].daysInStage).toBe(22);
    expect(res.deals[0].matchReason).toContain('threshold is 14 days');
  });

  it('find_overdue_tasks returns incomplete tasks with past due dates', async () => {
    const pastDue = new Date(Date.now() - 3 * 86400000);
    mockTasks['t-overdue'] = {
      id: 't-overdue',
      workspaceId: ws1,
      title: 'Send Revised Contract',
      type: 'contract',
      priority: 'high',
      status: 'pending',
      dueDate: pastDue,
    };

    const overdueFinder = findersTools.find((t) => t.name === 'find_overdue_tasks')!;
    const res = (await overdueFinder.execute({}, ctx)) as any;

    expect(res.tasks.length).toBe(1);
    expect(res.tasks[0].id).toBe('t-overdue');
    expect(res.tasks[0].daysOverdue).toBeGreaterThanOrEqual(2);
  });

  it('find_waiting_conversations returns open conversations with unread messages', async () => {
    mockConversations['conv-unread'] = {
      id: 'conv-unread',
      workspaceId: ws1,
      channel: 'email',
      subject: 'Urgent Pricing Question',
      status: 'open',
      unreadCount: 3,
      lastMessageAt: new Date(),
    };

    const waitingFinder = findersTools.find((t) => t.name === 'find_waiting_conversations')!;
    const res = (await waitingFinder.execute({}, ctx)) as any;

    expect(res.conversations.length).toBe(1);
    expect(res.conversations[0].id).toBe('conv-unread');
    expect(res.conversations[0].unreadCount).toBe(3);
  });
});
