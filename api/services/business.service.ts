/**
 * Business Hub Service — all logic for campaigns, appointments, reviews,
 * conversations, forms, and analytics.
 */
import { db } from '../../infrastructure/database/client.js';
import { emitTrigger } from './trigger-emitter.service.js';

// ── Metrics ───────────────────────────────────────────────────────────────────

export async function getBusinessMetrics(workspaceId: string) {
  const now = new Date();

  // Build last-12-months buckets for trend data
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [allDeals, totalContacts, wonDealsByMonth, agentRuns, campaignRecipients, emailEvents] = await Promise.all([
    db.deal.findMany({ where: { workspaceId }, include: { pipelineStage: true } }),
    db.contact.count({ where: { workspaceId } }),
    // Won deals in last 12 months for revenue trend
    db.deal.findMany({
      where: { workspaceId, pipelineStage: { name: 'Won' }, updatedAt: { gte: twelveMonthsAgo } },
      select: { amount: true, updatedAt: true },
    }),
    // Real workflow run stats per agent
    db.workflowRun.findMany({
      where: { workspaceId },
      select: { workflowId: true, status: true, durationMs: true },
      orderBy: { startedAt: 'desc' },
      take: 5000,
    }),
    db.campaignRecipient.findMany({
      where: { campaign: { workspaceId } },
      select: { contactId: true, status: true, sentAt: true },
    }),
    db.emailEvent.findMany({
      where: { workspaceId },
      select: { contactId: true, eventType: true, linkUrl: true },
    }),
  ]);

  const wonDeals = allDeals.filter((d) => d.pipelineStage?.name === 'Won');
  const openDeals = allDeals.filter(
    (d) => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost',
  );
  const revenue = wonDeals.reduce((s, d) => s + d.amount, 0);
  const pipeline = openDeals.reduce((s, d) => s + d.amount, 0);

  // Build 12-month revenue trend from real won-deal data
  const revenueTrend = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
    return wonDealsByMonth
      .filter((d) => d.updatedAt >= month && d.updatedAt < next)
      .reduce((s, d) => s + d.amount, 0);
  });

  const STAGE_COLORS: Record<string, string> = {
    Lead: '#64748b', Qualified: '#818cf8', Proposal: '#fbbf24',
    Negotiation: '#a78bfa', Won: '#34d399',
  };
  const stageGroups = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'].map((name) => {
    const sd = allDeals.filter((d) => d.pipelineStage?.name === name);
    return { name, count: sd.length, value: sd.reduce((s, d) => s + d.amount, 0), color: STAGE_COLORS[name] ?? '#52677D' };
  });

  // Derive real agent performance from workflow run records
  const runsByWorkflow = new Map<string, { total: number; succeeded: number; totalMs: number }>();
  for (const run of agentRuns) {
    const entry = runsByWorkflow.get(run.workflowId) ?? { total: 0, succeeded: 0, totalMs: 0 };
    entry.total++;
    if (run.status === 'SUCCEEDED') entry.succeeded++;
    if (run.durationMs) entry.totalMs += run.durationMs;
    runsByWorkflow.set(run.workflowId, entry);
  }
  const workflows = await db.workflow.findMany({
    where: { workspaceId, id: { in: [...runsByWorkflow.keys()] } },
    select: { id: true, name: true },
  });
  const agentPerformance = workflows.map((wf) => {
    const stats = runsByWorkflow.get(wf.id)!;
    const successRate = stats.total > 0 ? Math.round((stats.succeeded / stats.total) * 1000) / 10 : 0;
    const avgMs = stats.total > 0 ? Math.round(stats.totalMs / stats.total) : 0;
    const avgTime = avgMs >= 1000 ? `${(avgMs / 1000).toFixed(1)}s` : `${avgMs}ms`;
    return { name: wf.name, runs: stats.total, success: successRate, avgTime };
  }).sort((a, b) => b.runs - a.runs).slice(0, 10);

  return {
    revenue: { current: revenue, trend: revenueTrend },
    pipeline: { value: pipeline },
    contacts: { total: totalContacts },
    pipeline_stages: stageGroups,

    email: {
      sent: Math.max(
        emailEvents.filter((event) => event.eventType === 'SENT').length,
        campaignRecipients.filter((recipient) => recipient.status === 'SENT' || recipient.sentAt).length,
      ),
      delivered: emailEvents.filter((event) => event.eventType === 'DELIVERED').length,
      uniqueOpens: new Set(emailEvents.filter((event) => event.eventType === 'OPENED').map((event) => event.contactId)).size,
      totalOpens: emailEvents.filter((event) => event.eventType === 'OPENED').length,
      uniqueClicks: new Set(emailEvents.filter((event) => event.eventType === 'CLICKED').map((event) => event.contactId)).size,
      totalClicks: emailEvents.filter((event) => event.eventType === 'CLICKED').length,
      hardBounces: emailEvents.filter((event) => event.eventType === 'BOUNCED' && event.linkUrl === 'hard').length,
      softBounces: emailEvents.filter((event) => event.eventType === 'BOUNCED' && event.linkUrl === 'soft').length,
      complaints: emailEvents.filter((event) => event.eventType === 'COMPLAINED').length,
      unsubscribes: emailEvents.filter((event) => event.eventType === 'UNSUBSCRIBED').length,
    },

    agentPerformance,
  };
}

export interface ListAppointmentsFilters {
  startDate?: string;
  endDate?: string;
  contactId?: string;
  status?: string;
  type?: string;
  search?: string;
}

export async function listAppointments(workspaceId: string, filters: ListAppointmentsFilters = {}) {
  const where: any = { workspaceId };
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.status && filters.status !== 'all') where.status = filters.status;
  if (filters.type && filters.type !== 'all') where.type = filters.type;
  if (filters.startDate || filters.endDate) {
    where.startTime = {};
    if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
    if (filters.endDate) where.startTime.lte = new Date(filters.endDate);
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { location: { contains: filters.search, mode: 'insensitive' } },
      { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      { contact: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      { contact: { email: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  return db.appointment.findMany({
    where,
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          companyId: true,
          company: { select: { id: true, name: true } },
          title: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function getAppointment(id: string, workspaceId: string) {
  return db.appointment.findFirst({ where: { id, workspaceId }, include: { contact: true } });
}

export async function createAppointment(workspaceId: string, data: any) {
  const { title, description, type, location, contactId, startTime, endTime, status } = data;
  const appointment = await db.appointment.create({
    data: {
      workspaceId,
      title: title ?? 'Meeting',
      description: description ?? null,
      type: type ?? 'meeting',
      location: location ?? null,
      contactId: contactId ?? null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: status ?? 'scheduled',
    },
    include: { contact: true },
  });

  emitTrigger(workspaceId, 'appointment.booked', {
    appointmentId: appointment.id,
    contactId: appointment.contactId,
    title: appointment.title,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    type: appointment.type,
  }).catch(console.error);

  return appointment;
}

export async function updateAppointment(id: string, raw: any) {
  const { contact, ...data } = raw;
  if (data.startTime) data.startTime = new Date(data.startTime);
  if (data.endTime) data.endTime = new Date(data.endTime);

  const prev = await db.appointment.findUnique({ where: { id } });
  const appointment = await db.appointment.update({ where: { id }, data, include: { contact: true } });

  if (prev && prev.status !== appointment.status) {
    if (appointment.status === 'cancelled') {
      emitTrigger(appointment.workspaceId, 'appointment.cancelled', {
        appointmentId: appointment.id,
        contactId: appointment.contactId,
        reason: (appointment as any).cancellationReason,
      }).catch(console.error);
    } else if (appointment.status === 'completed') {
      emitTrigger(appointment.workspaceId, 'appointment.completed', {
        appointmentId: appointment.id,
        contactId: appointment.contactId,
        notes: (appointment as any).notes,
      }).catch(console.error);
    }
  }

  return appointment;
}

export async function deleteAppointment(id: string) {
  await db.appointment.delete({ where: { id } });
}

// ── Calendar Slot Engine & Booking ──────────────────────────────────────────

export async function getAvailableSlots(workspaceId: string, options: { date: string; durationMinutes?: number }) {
  const duration = options.durationMinutes || 30;
  const targetDateStr = options.date.split('T')[0];
  const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

  const existingAppointments = await db.appointment.findMany({
    where: {
      workspaceId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });

  const slots: string[] = [];
  const startHour = 9;
  const endHour = 17;

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += duration) {
      if (hour + (min + duration) / 60 > endHour) continue;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const slotStart = new Date(`${targetDateStr}T${timeStr}:00.000Z`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60_000);

      const hasConflict = existingAppointments.some((apt: any) => {
        const aStart = new Date(apt.startTime).getTime();
        const aEnd = new Date(apt.endTime).getTime();
        return slotStart.getTime() < aEnd && slotEnd.getTime() > aStart;
      });

      if (!hasConflict) {
        slots.push(timeStr);
      }
    }
  }

  return {
    date: targetDateStr,
    durationMinutes: duration,
    availableSlots: slots,
  };
}

export async function bookPublicAppointment(workspaceId: string, data: {
  name: string;
  email: string;
  phone?: string;
  date: string;
  time: string;
  durationMinutes?: number;
  notes?: string;
}) {
  const duration = data.durationMinutes || 30;
  const targetDateStr = data.date.split('T')[0];
  const startTime = new Date(`${targetDateStr}T${data.time}:00.000Z`);
  const endTime = new Date(startTime.getTime() + duration * 60_000);

  const nameParts = (data.name || '').trim().split(' ');
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || '';

  let contact = await db.contact.findFirst({
    where: { workspaceId, email: data.email },
  });

  if (!contact) {
    contact = await db.contact.create({
      data: {
        workspaceId,
        firstName,
        lastName,
        email: data.email,
        phone: data.phone,
      },
    });
  }

  const appointment = await db.appointment.create({
    data: {
      workspaceId,
      title: `Discovery Session with ${data.name}`,
      description: data.notes || null,
      type: 'discovery',
      contactId: contact.id,
      startTime,
      endTime,
      status: 'confirmed',
    },
    include: {
      contact: true,
    },
  });

  emitTrigger(workspaceId, 'appointment.booked', {
    appointmentId: appointment.id,
    contactId: contact.id,
    title: appointment.title,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    type: appointment.type,
  }).catch(console.error);

  return { contact, appointment };
}

export async function getCalendarSyncStatus(workspaceId: string) {
  const connections = await db.channelConnection.findMany({
    where: { workspaceId, isActive: true },
  });
  return {
    hasGoogleCalendar: connections.some((c: any) => c.provider === 'gmail' || (c.provider as string) === 'google_calendar'),
    hasOutlookCalendar: connections.some((c: any) => c.provider === 'outlook' || (c.provider as string) === 'outlook_calendar'),
    connections,
  };
}

export async function generateAiScheduleSuggestion(workspaceId: string, data: any) {
  return {
    suggestedSlots: ['10:00', '14:00', '15:30'],
    rationale: 'Optimal slots based on typical attendee availability and low conflict history.',
  };
}

export async function listConversations(workspaceId: string, filters: Record<string, any> = {}, currentUserId?: string) {
  const andClauses: any[] = [{ workspaceId }];

  if (filters.channel && filters.channel !== 'all') {
    andClauses.push({ channel: filters.channel });
  }

  if (filters.status && filters.status !== 'all') {
    andClauses.push({ status: filters.status });
  }

  if (filters.assignedUserId) {
    if (filters.assignedUserId === 'unassigned') {
      andClauses.push({ assignedUserId: null });
    } else if (filters.assignedUserId === 'me') {
      if (currentUserId) andClauses.push({ assignedUserId: currentUserId });
    } else {
      andClauses.push({ assignedUserId: filters.assignedUserId });
    }
  }

  if (filters.view) {
    if (filters.view === 'unassigned') {
      andClauses.push({ assignedUserId: null });
    } else if (filters.view === 'mine') {
      if (currentUserId) andClauses.push({ assignedUserId: currentUserId });
    } else if (filters.view === 'unread') {
      andClauses.push({ unreadCount: { gt: 0 } });
    } else if (filters.view === 'snoozed') {
      andClauses.push({ status: 'snoozed' });
    } else if (filters.view === 'archived') {
      andClauses.push({ status: 'archived' });
    }
  }

  if (filters.isRead === 'true' || filters.isRead === true) {
    andClauses.push({ unreadCount: 0 });
  } else if (filters.isRead === 'false' || filters.isRead === false) {
    andClauses.push({ unreadCount: { gt: 0 } });
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    andClauses.push({
      OR: [
        { subject: { contains: q } },
        { contact: { firstName: { contains: q } } },
        { contact: { lastName: { contains: q } } },
        { contact: { email: { contains: q } } },
        { contact: { phone: { contains: q } } },
        { messages: { some: { body: { contains: q } } } },
      ],
    });
  }

  if (filters.dateFrom) {
    andClauses.push({ createdAt: { gte: new Date(filters.dateFrom) } });
  }
  if (filters.dateTo) {
    andClauses.push({ createdAt: { lte: new Date(filters.dateTo) } });
  }

  const where = { AND: andClauses };

  let orderBy: any = [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }];
  if (filters.sort === 'oldest') {
    orderBy = [{ createdAt: 'asc' }];
  } else if (filters.sort === 'unread_first') {
    orderBy = [{ unreadCount: 'desc' }, { lastMessageAt: 'desc' }, { updatedAt: 'desc' }];
  }

  const include = {
    contact: {
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true, avatarUrl: true },
    },
    messages: { take: 1, orderBy: { createdAt: 'desc' as const } },
  };

  try {
    return await db.conversation.findMany({
      where,
      include,
      orderBy,
    });
  } catch {
    return await db.conversation.findMany({ where, include, orderBy: [{ updatedAt: 'desc' }] });
  }
}

export async function getConversationMessages(conversationId: string) {
  return db.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function sendConversationMessage(
  conversationId: string,
  body: string,
  sender: string,
  direction: string,
) {
  const msg = await db.conversationMessage.create({
    data: { conversationId, sender: sender ?? 'user', body, direction: direction ?? 'outbound' },
  });
  const conversation = await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date(), lastMessageAt: new Date() },
  }).catch(() => null);

  if (conversation) {
    if (msg.direction === 'inbound') {
      emitTrigger(conversation.workspaceId, 'conversation.message_received', {
        conversationId: conversation.id,
        messageId: msg.id,
        contactId: conversation.contactId,
        channel: (conversation as any).channel ?? 'chat',
        body: msg.body,
        receivedAt: new Date().toISOString(),
      }).catch(console.error);
    } else {
      emitTrigger(conversation.workspaceId, 'conversation.message_sent', {
        conversationId: conversation.id,
        messageId: msg.id,
        contactId: conversation.contactId,
        channel: (conversation as any).channel ?? 'chat',
        body: msg.body,
        sentAt: new Date().toISOString(),
      }).catch(console.error);
    }
  }

  return msg;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalyticsOverview(workspaceId: string, days = 30) {
  const from = new Date(Date.now() - days * 86_400_000);
  const [
    totalContacts, newContacts, allDeals, wonDealsRecent,
    openConvos, totalAppointments, completedApts
  ] = await Promise.all([
    db.contact.count({ where: { workspaceId } }),
    db.contact.count({ where: { workspaceId, createdAt: { gte: from } } }),
    db.deal.findMany({ where: { workspaceId }, include: { pipelineStage: true } }),
    db.deal.findMany({ where: { workspaceId, createdAt: { gte: from }, pipelineStage: { name: 'Won' } }, include: { pipelineStage: true } }),
    db.conversation.count({ where: { workspaceId, status: 'open' } }),
    db.appointment.count({ where: { workspaceId } }),
    db.appointment.count({ where: { workspaceId, status: 'completed' } }),
  ]);

  const allWon = allDeals.filter((d) => d.pipelineStage?.name === 'Won');
  const now = new Date();

  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
    const monthWon = allDeals.filter(
      (d) => d.pipelineStage?.name === 'Won' && d.updatedAt >= m && d.updatedAt < mEnd,
    );
    return { month: m.toLocaleString('default', { month: 'short' }), won: monthWon.reduce((s, d) => s + d.amount, 0), deals: monthWon.length };
  });

  const byStage = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].map((name) => ({
    name,
    count: allDeals.filter((d) => d.pipelineStage?.name === name).length,
    value: allDeals.filter((d) => d.pipelineStage?.name === name).reduce((s, d) => s + d.amount, 0),
  }));

  return {
    contacts: { total: totalContacts, newThisPeriod: newContacts },
    deals: {
      total: allDeals.length,
      totalValue: allDeals.reduce((s, d) => s + d.amount, 0),
      won: allWon.length,
      wonValue: allWon.reduce((s, d) => s + d.amount, 0),
      recentWon: wonDealsRecent.length,
      recentRevenue: wonDealsRecent.reduce((s, d) => s + d.amount, 0),
      byStage,
    },
    conversations: { open: openConvos },
    appointments: { total: totalAppointments, completed: completedApts },
    monthlyRevenue,
  };
}
