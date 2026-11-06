/**
 * Deterministic Finder Tools for Stone AI Assistant — Stone AIO
 * Spec Section 7.6 & Phase 1
 */

import { db } from '../../../../infrastructure/database/client.js';
import type { ToolDefinition } from './types.js';

/**
 * Computes the most recent touchpoint for a contact across:
 * - ContactEvent (notes, calls, meetings)
 * - Activity
 * - Appointment
 * - CampaignRecipient (sent campaigns)
 * - Conversation (messaging, SMS, email)
 * - Contact.lastContactedAt
 */
export async function getLastTouch(
  workspaceId: string,
  contactId: string,
  contactLastContactedAt?: Date | null
): Promise<{ date: Date; type: string; details?: string } | null> {
  let latestDate: Date | null = contactLastContactedAt || null;
  let latestType = 'contacted';
  let latestDetails: string | undefined = undefined;

  // 1. Check ContactEvent
  const latestEvent = await db.contactEvent.findFirst({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
  });
  if (latestEvent && (!latestDate || latestEvent.createdAt > latestDate)) {
    latestDate = latestEvent.createdAt;
    latestType = latestEvent.type || 'event';
    latestDetails = latestEvent.title;
  }

  // 2. Check Activity
  const latestActivity = await db.activity.findFirst({
    where: { workspaceId, contactId },
    orderBy: { createdAt: 'desc' },
  });
  if (latestActivity && (!latestDate || latestActivity.createdAt > latestDate)) {
    latestDate = latestActivity.createdAt;
    latestType = latestActivity.type || 'activity';
    latestDetails = latestActivity.title;
  }

  // 3. Check Appointment
  const latestAppt = await db.appointment.findFirst({
    where: { workspaceId, contactId, startTime: { lte: new Date() } },
    orderBy: { startTime: 'desc' },
  });
  if (latestAppt && (!latestDate || latestAppt.startTime > latestDate)) {
    latestDate = latestAppt.startTime;
    latestType = 'appointment';
    latestDetails = latestAppt.title;
  }

  // 4. Check CampaignRecipient sent
  const latestCampaign = await db.campaignRecipient.findFirst({
    where: { contactId, sentAt: { not: null } },
    orderBy: { sentAt: 'desc' },
  });
  if (latestCampaign?.sentAt && (!latestDate || latestCampaign.sentAt > latestDate)) {
    latestDate = latestCampaign.sentAt;
    latestType = 'campaign_email';
  }

  // 5. Check Conversation
  const latestConvo = await db.conversation.findFirst({
    where: { workspaceId, contactId, lastMessageAt: { not: null } },
    orderBy: { lastMessageAt: 'desc' },
  });
  if (latestConvo?.lastMessageAt && (!latestDate || latestConvo.lastMessageAt > latestDate)) {
    latestDate = latestConvo.lastMessageAt;
    latestType = latestConvo.channel || 'message';
  }

  if (!latestDate) return null;
  return { date: latestDate, type: latestType, details: latestDetails };
}

export const findersTools: ToolDefinition[] = [
  // 1. find_stale_leads
  {
    name: 'find_stale_leads',
    description:
      'Find leads in the workspace whose last touch (or creation date if untouched) is older than N days, with no future due tasks.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        olderThanDays: {
          type: 'number',
          description: 'Number of days without contact to consider stale (default 14).',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100).',
        },
      },
    },
    execute: async (args: { olderThanDays?: number; limit?: number }, ctx) => {
      const days = args.olderThanDays ?? 14;
      const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Query contacts that are not DND, ordered by lead score then creation
      const contacts = await db.contact.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          dndEnabled: false,
          OR: [
            { lastContactedAt: { lte: cutoff } },
            { lastContactedAt: null, createdAt: { lte: cutoff } },
          ],
        },
        include: {
          company: { select: { name: true } },
          tasks: {
            where: {
              status: { not: 'completed' },
              dueDate: { gte: new Date() },
            },
          },
        },
        orderBy: [{ leadScore: 'desc' }, { createdAt: 'desc' }],
        take: limit * 2,
      });

      const staleLeads = [];
      for (const contact of contacts) {
        // Exclude contacts with upcoming open tasks
        if (contact.tasks && contact.tasks.length > 0) continue;

        // Verify accurate last touchpoint
        const lastTouch = await getLastTouch(ctx.workspaceId, contact.id, contact.lastContactedAt);
        const lastDate = lastTouch?.date || contact.createdAt;

        if (lastDate <= cutoff) {
          const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          staleLeads.push({
            id: contact.id,
            name: `${contact.firstName} ${contact.lastName}`.trim(),
            email: contact.email,
            phone: contact.phone,
            company: contact.company?.name,
            leadScore: contact.leadScore,
            status: contact.status || 'open',
            daysSinceLastTouch: daysSince,
            lastTouchType: lastTouch?.type || 'created',
            matchReason: `${daysSince} days since last ${lastTouch?.type || 'touchpoint'}, no open tasks scheduled`,
          });
        }

        if (staleLeads.length >= limit) break;
      }

      return {
        leads: staleLeads,
        total: staleLeads.length,
        filterApplied: { olderThanDays: days },
      };
    },
  },

  // 2. find_unwelcomed_leads
  {
    name: 'find_unwelcomed_leads',
    description:
      'Find newly created contacts who have an email address but have never received any outbound email or welcome outreach.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        createdWithinDays: {
          type: 'number',
          description: 'Maximum age of lead in days (default 30).',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100).',
        },
      },
    },
    execute: async (args: { createdWithinDays?: number; limit?: number }, ctx) => {
      const days = args.createdWithinDays ?? 30;
      const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const candidates = await db.contact.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          email: { not: null },
          dndEnabled: false,
          createdAt: { gte: sinceDate },
        },
        include: {
          company: { select: { name: true } },
          campaignRecipients: {
            where: { sentAt: { not: null } },
            select: { id: true },
          },
          events: {
            where: { type: { in: ['email', 'welcome', 'outbound_email'] } },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
      });

      const unwelcomedLeads = [];
      for (const contact of candidates) {
        if (contact.campaignRecipients.length > 0) continue;
        if (contact.events.length > 0) continue;

        // Check if there is any conversation with messages
        const hasConvo = await db.conversation.findFirst({
          where: { workspaceId: ctx.workspaceId, contactId: contact.id, lastMessageAt: { not: null } },
          select: { id: true },
        });
        if (hasConvo) continue;

        const daysSinceCreated = Math.floor((Date.now() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        unwelcomedLeads.push({
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email,
          phone: contact.phone,
          company: contact.company?.name,
          source: contact.source || 'direct',
          createdAt: contact.createdAt.toISOString(),
          daysSinceCreated,
          matchReason: `Created ${daysSinceCreated} day(s) ago, zero outbound emails or welcome messages sent`,
        });

        if (unwelcomedLeads.length >= limit) break;
      }

      return {
        leads: unwelcomedLeads,
        total: unwelcomedLeads.length,
        filterApplied: { createdWithinDays: days },
      };
    },
  },

  // 3. find_stalled_deals
  {
    name: 'find_stalled_deals',
    description:
      'Find open deals that have remained in their current pipeline stage longer than the pipeline stale threshold.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100).',
        },
      },
    },
    execute: async (args: { limit?: number }, ctx) => {
      const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);

      // Query deals in stages that are neither won nor lost
      const deals = await db.deal.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          pipelineStage: {
            isWon: false,
            isLost: false,
          },
        },
        include: {
          pipelineStage: {
            include: {
              pipeline: { select: { name: true, staleThresholdDays: true } },
            },
          },
          company: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { amount: 'desc' },
        take: limit * 2,
      });

      const stalledDeals = [];
      for (const deal of deals) {
        const threshold = deal.pipelineStage?.pipeline?.staleThresholdDays ?? 14;
        if (deal.daysInStage >= threshold) {
          stalledDeals.push({
            id: deal.id,
            title: deal.title,
            amount: deal.amount,
            currency: deal.currency,
            pipeline: deal.pipelineStage?.pipeline?.name,
            stageName: deal.pipelineStage?.name,
            daysInStage: deal.daysInStage,
            staleThresholdDays: threshold,
            company: deal.company?.name,
            contactName: deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}`.trim() : undefined,
            matchReason: `In "${deal.pipelineStage?.name}" for ${deal.daysInStage} days (threshold is ${threshold} days)`,
          });
        }

        if (stalledDeals.length >= limit) break;
      }

      return {
        deals: stalledDeals,
        total: stalledDeals.length,
      };
    },
  },

  // 4. find_overdue_tasks
  {
    name: 'find_overdue_tasks',
    description: 'Find incomplete tasks whose due date has passed.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100).',
        },
      },
    },
    execute: async (args: { limit?: number }, ctx) => {
      const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
      const now = new Date();

      const tasks = await db.task.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { not: 'completed' },
          dueDate: { lt: now },
        },
        include: {
          contact: { select: { firstName: true, lastName: true } },
          deal: { select: { title: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: limit,
      });

      return {
        tasks: tasks.map((t) => {
          const daysOverdue = Math.floor((now.getTime() - (t.dueDate?.getTime() || 0)) / (1000 * 60 * 60 * 24));
          return {
            id: t.id,
            title: t.title,
            type: t.type,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString(),
            daysOverdue: Math.max(daysOverdue, 0),
            contactName: t.contact ? `${t.contact.firstName} ${t.contact.lastName}`.trim() : undefined,
            dealTitle: t.deal?.title,
          };
        }),
        total: tasks.length,
      };
    },
  },

  // 5. find_waiting_conversations
  {
    name: 'find_waiting_conversations',
    description: 'Find open conversations that have unread messages or are waiting for an agent reply.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 25, max 100).',
        },
      },
    },
    execute: async (args: { limit?: number }, ctx) => {
      const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);

      const convos = await db.conversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: 'open',
          unreadCount: { gt: 0 },
        },
        include: {
          contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
      });

      return {
        conversations: convos.map((c) => ({
          id: c.id,
          channel: c.channel,
          subject: c.subject,
          unreadCount: c.unreadCount,
          lastMessageAt: c.lastMessageAt?.toISOString(),
          contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName}`.trim() : undefined,
          contactEmail: c.contact?.email,
        })),
        total: convos.length,
      };
    },
  },
];
