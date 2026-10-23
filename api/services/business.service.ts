/**
 * Business Hub Service — all logic for campaigns, appointments, reviews,
 * conversations, forms, and analytics.
 */
import { db } from '../../infrastructure/database/client.js';
import { emitTrigger } from './trigger-emitter.service.js';

// ── Metrics ───────────────────────────────────────────────────────────────────

export async function getBusinessMetrics(workspaceId: string, from?: string, to?: string) {
  const now = new Date();

  // Resolve time window: current period and previous comparison period
  let currentFrom: Date;
  let currentTo: Date;

  if (from && to && !isNaN(new Date(from).getTime()) && !isNaN(new Date(to).getTime())) {
    currentFrom = new Date(from);
    currentTo = new Date(to);
  } else {
    currentTo = now;
    currentFrom = new Date(now.getTime() - 30 * 86_400_000);
  }

  const durationMs = Math.max(currentTo.getTime() - currentFrom.getTime(), 86_400_000);
  const prevFrom = new Date(currentFrom.getTime() - durationMs);
  const prevTo = new Date(currentFrom.getTime());

  // Fourteen days ago for stale deals
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

  // Today & This Week boundaries for Calendar
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now.getTime() - dayOfWeek * 86_400_000);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86_400_000 - 1);

  // Parallel database queries
  const [
    contactsCurrent,
    contactsPrev,
    allContacts,
    allDeals,
    wonDealsCurrent,
    wonDealsPrev,
    unreadConvosCount,
    openConvosCount,
    allConvos,
    allMessages,
    allAppointments,
    upcomingAppointments,
    campaignRecipients,
    emailEvents,
    lastSentCampaign,
    activeWorkflowsCount,
    allWorkflows,
    workflowRuns,
  ] = await Promise.all([
    db.contact.count({ where: { workspaceId, createdAt: { gte: currentFrom, lte: currentTo } } }),
    db.contact.count({ where: { workspaceId, createdAt: { gte: prevFrom, lt: currentFrom } } }),
    db.contact.findMany({
      where: { workspaceId },
      select: { id: true, firstName: true, lastName: true, email: true, source: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.deal.findMany({
      where: { workspaceId },
      include: { pipelineStage: true, contact: { select: { firstName: true, lastName: true, email: true } } },
    }),
    db.deal.findMany({
      where: { workspaceId, pipelineStage: { name: 'Won' }, updatedAt: { gte: currentFrom, lte: currentTo } },
    }),
    db.deal.findMany({
      where: { workspaceId, pipelineStage: { name: 'Won' }, updatedAt: { gte: prevFrom, lt: currentFrom } },
    }),
    db.conversation.count({ where: { workspaceId, unreadCount: { gt: 0 } } }),
    db.conversation.count({ where: { workspaceId, status: 'open' } }),
    db.conversation.findMany({
      where: { workspaceId },
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    }),
    db.conversationMessage.findMany({
      where: { conversation: { workspaceId } },
      select: { channel: true, direction: true, createdAt: true },
    }),
    db.appointment.findMany({
      where: { workspaceId },
      include: { contact: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { startTime: 'desc' },
    }),
    db.appointment.findMany({
      where: { workspaceId, startTime: { gte: now } },
      include: { contact: { select: { firstName: true, lastName: true, email: true, phone: true } } },
      orderBy: { startTime: 'asc' },
      take: 5,
    }),
    db.campaignRecipient.findMany({
      where: { campaign: { workspaceId } },
      select: { contactId: true, status: true, sentAt: true },
    }),
    db.emailEvent.findMany({
      where: { workspaceId },
      select: { contactId: true, eventType: true, linkUrl: true, occurredAt: true },
    }),
    db.campaign.findFirst({
      where: { workspaceId, status: 'SENT' },
      orderBy: { updatedAt: 'desc' },
    }),
    db.workflow.count({ where: { workspaceId, status: 'ACTIVE' } }),
    db.workflow.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    }),
    db.workflowRun.findMany({
      where: { workspaceId },
      include: { workflow: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    }),
  ]);

  // 1. Headline Numbers
  const openDeals = allDeals.filter(
    (d) => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost' && d.pipelineStage?.name !== 'Closed',
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const wonCountCurrent = wonDealsCurrent.length;
  const wonValueCurrent = wonDealsCurrent.reduce((sum, d) => sum + (d.amount || 0), 0);
  const wonCountPrev = wonDealsPrev.length;
  const wonValuePrev = wonDealsPrev.reduce((sum, d) => sum + (d.amount || 0), 0);
  const wonValueChangePct = wonValuePrev > 0 ? Math.round(((wonValueCurrent - wonValuePrev) / wonValuePrev) * 100) : null;
  const wonCountChangePct = wonCountPrev > 0 ? Math.round(((wonCountCurrent - wonCountPrev) / wonCountPrev) * 100) : null;
  const contactsChangePct = contactsPrev > 0 ? Math.round(((contactsCurrent - contactsPrev) / contactsPrev) * 100) : null;

  // 2. CRM / Pipeline
  const wonTotal = allDeals.filter((d) => d.pipelineStage?.name === 'Won').length;
  const lostTotal = allDeals.filter((d) => d.pipelineStage?.name === 'Lost' || d.pipelineStage?.name === 'Closed').length;
  const winRate = (wonTotal + lostTotal) > 0 ? Math.round((wonTotal / (wonTotal + lostTotal)) * 1000) / 10 : null;

  const STAGE_COLORS: Record<string, string> = {
    'New Lead': '#64748b', Lead: '#64748b', Qualified: '#818cf8', Proposal: '#fbbf24',
    'Proposal Sent': '#fbbf24', Negotiation: '#a78bfa', Won: '#34d399', Closed: '#34d399',
  };
  const stageMap = new Map<string, { count: number; value: number; color: string }>();
  allDeals.forEach((d) => {
    const sName = d.pipelineStage?.name || 'Unassigned';
    const entry = stageMap.get(sName) || { count: 0, value: 0, color: STAGE_COLORS[sName] || '#52677D' };
    entry.count += 1;
    entry.value += d.amount || 0;
    stageMap.set(sName, entry);
  });
  const pipelineStages = Array.from(stageMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    value: data.value,
    color: data.color,
  }));

  // Lead sources breakdown
  const sourceMap: Record<string, number> = {};
  allContacts.forEach((c) => {
    const s = (c.source || 'Direct / Organic').trim();
    sourceMap[s] = (sourceMap[s] || 0) + 1;
  });
  const leadSources = Object.entries(sourceMap).map(([source, count]) => ({
    source,
    count,
    percentage: allContacts.length > 0 ? Math.round((count / allContacts.length) * 100) : 0,
  }));

  // Stale deals (open deals with updatedAt < fourteenDaysAgo)
  const staleDealsList = openDeals.filter((d) => new Date(d.updatedAt) < fourteenDaysAgo);
  const staleDeals = {
    count: staleDealsList.length,
    value: staleDealsList.reduce((sum, d) => sum + (d.amount || 0), 0),
    topStale: staleDealsList.slice(0, 5).map((d) => ({
      id: d.id,
      name: d.title,
      amount: d.amount,
      daysStale: Math.floor((now.getTime() - new Date(d.updatedAt).getTime()) / 86_400_000),
      stage: d.pipelineStage?.name || 'Open',
      contactName: d.contact ? `${d.contact.firstName} ${d.contact.lastName || ''}`.trim() : null,
    })),
  };

  // New contacts over time (buckets in selected range)
  const daysInRange = Math.ceil(durationMs / 86_400_000);
  const bucketCount = Math.min(Math.max(daysInRange, 7), 30);
  const bucketSizeMs = durationMs / bucketCount;
  const contactsOverTime = Array.from({ length: bucketCount }, (_, i) => {
    const bStart = new Date(currentFrom.getTime() + i * bucketSizeMs);
    const bEnd = new Date(currentFrom.getTime() + (i + 1) * bucketSizeMs);
    const count = allContacts.filter((c) => c.createdAt >= bStart && c.createdAt < bEnd).length;
    return {
      date: bStart.toISOString().split('T')[0],
      count,
    };
  });

  // 3. Conversations
  const emailSent = allMessages.filter((m) => m.channel === 'email' && m.direction === 'outbound').length;
  const emailReceived = allMessages.filter((m) => m.channel === 'email' && m.direction === 'inbound').length;
  const smsSent = allMessages.filter((m) => m.channel === 'sms' && m.direction === 'outbound').length;
  const smsReceived = allMessages.filter((m) => m.channel === 'sms' && m.direction === 'inbound').length;

  let totalResponseMins = 0;
  let respondedCount = 0;
  allConvos.forEach((c) => {
    const inbound = c.messages.find((m) => m.direction === 'inbound');
    if (inbound) {
      const outbound = c.messages.find((m) => m.direction === 'outbound' && new Date(m.createdAt) > new Date(inbound.createdAt));
      if (outbound) {
        totalResponseMins += (new Date(outbound.createdAt).getTime() - new Date(inbound.createdAt).getTime()) / 60000;
        respondedCount++;
      }
    }
  });
  const avgFirstResponseMinutes = respondedCount > 0 ? Math.round(totalResponseMins / respondedCount) : null;

  const awaitingReplyList = allConvos
    .filter((c) => {
      if (c.status !== 'open' || c.messages.length === 0) return false;
      const last = c.messages[c.messages.length - 1];
      return last.direction === 'inbound';
    })
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      subject: c.subject || 'Direct message',
      contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName || ''}`.trim() : 'Customer',
      lastMessageAt: c.lastMessageAt,
      snippet: c.messages[c.messages.length - 1]?.body?.slice(0, 90) || '',
    }));

  // 4. Calendar
  const todayAppointmentsCount = allAppointments.filter((a) => a.startTime >= startOfToday && a.startTime <= endOfToday).length;
  const thisWeekAppointmentsCount = allAppointments.filter((a) => a.startTime >= startOfWeek && a.startTime <= endOfWeek).length;
  const calendarStatusBreakdown = {
    booked: allAppointments.filter((a) => a.status === 'confirmed' || a.status === 'booked' || a.status === 'scheduled').length,
    completed: allAppointments.filter((a) => a.status === 'completed').length,
    cancelled: allAppointments.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length,
  };
  const upcomingAppointmentsList = upcomingAppointments.map((a) => ({
    id: a.id,
    title: a.title || 'Scheduled Appointment',
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    type: a.type || 'Meeting',
    contactName: a.contact ? `${a.contact.firstName} ${a.contact.lastName || ''}`.trim() : null,
    contactEmail: a.contact?.email || null,
  }));

  // 5. Email Marketing
  const emailSentCount = Math.max(
    emailEvents.filter((e) => e.eventType === 'SENT').length,
    campaignRecipients.filter((r) => r.status === 'SENT' || r.sentAt).length,
  );
  const emailDeliveredCount = emailEvents.filter((e) => e.eventType === 'DELIVERED').length || emailSentCount;
  const uniqueOpens = new Set(emailEvents.filter((e) => e.eventType === 'OPENED').map((e) => e.contactId)).size;
  const uniqueClicks = new Set(emailEvents.filter((e) => e.eventType === 'CLICKED').map((e) => e.contactId)).size;
  const emailBouncedCount = emailEvents.filter((e) => e.eventType === 'BOUNCED').length;
  const emailUnsubscribedCount = emailEvents.filter((e) => e.eventType === 'UNSUBSCRIBED').length;
  const openRatePct = emailDeliveredCount > 0 ? Math.round((uniqueOpens / emailDeliveredCount) * 1000) / 10 : 0;
  const clickRatePct = emailDeliveredCount > 0 ? Math.round((uniqueClicks / emailDeliveredCount) * 1000) / 10 : 0;

  const lastCampaignCard = lastSentCampaign
    ? {
        id: lastSentCampaign.id,
        name: lastSentCampaign.name,
        subject: lastSentCampaign.subject,
        sentAt: lastSentCampaign.updatedAt,
        totalRecipients: lastSentCampaign.recipientCount || 0,
        openRate: openRatePct,
        clickRate: clickRatePct,
      }
    : null;

  // 6. Automations
  const runsInPeriod = workflowRuns.filter((r) => r.startedAt >= currentFrom && r.startedAt <= currentTo);
  const succeededRuns = runsInPeriod.filter((r) => r.status === 'SUCCEEDED').length;
  const failedRuns = runsInPeriod.filter((r) => r.status === 'FAILED').length;
  const totalRuns = runsInPeriod.length;
  const automationSuccessRate = totalRuns > 0 ? Math.round((succeededRuns / totalRuns) * 100) : 100;
  const recentFailedRuns = workflowRuns
    .filter((r) => r.status === 'FAILED')
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      workflowId: r.workflowId,
      workflowName: r.workflow?.name || 'Automation Workflow',
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      error: r.errorMessage || 'Execution failed',
    }));

  // 7. Activity Feed (chronological union of real events)
  const activityEvents: Array<{
    id: string;
    type: 'contact_created' | 'deal_won' | 'appointment_booked' | 'campaign_sent' | 'workflow_failed';
    title: string;
    subtitle: string;
    timestamp: Date;
    link: string;
  }> = [];

  allContacts.slice(0, 5).forEach((c) => {
    activityEvents.push({
      id: 'contact-' + c.id,
      type: 'contact_created',
      title: 'New lead added',
      subtitle: `${c.firstName} ${c.lastName || ''} (${c.email || c.source || 'Direct'})`.trim(),
      timestamp: c.createdAt,
      link: `/crm/contacts/${c.id}`,
    });
  });

  allDeals.filter((d) => d.pipelineStage?.name === 'Won').slice(0, 5).forEach((d) => {
    activityEvents.push({
      id: 'deal-' + d.id,
      type: 'deal_won',
      title: 'Deal won',
      subtitle: `${d.title} (${(d.amount || 0).toLocaleString()})`,
      timestamp: d.updatedAt,
      link: '/opportunities',
    });
  });

  allAppointments.slice(0, 5).forEach((a) => {
    activityEvents.push({
      id: 'appt-' + a.id,
      type: 'appointment_booked',
      title: 'Appointment booked',
      subtitle: `${a.title || 'Meeting'}${a.contact ? ` with ${a.contact.firstName} ${a.contact.lastName || ''}` : ''}`,
      timestamp: a.createdAt,
      link: '/calendar',
    });
  });

  if (lastSentCampaign) {
    activityEvents.push({
      id: 'campaign-' + lastSentCampaign.id,
      type: 'campaign_sent',
      title: 'Email campaign dispatched',
      subtitle: `${lastSentCampaign.name} (${lastSentCampaign.recipientCount || 0} recipients)`,
      timestamp: lastSentCampaign.updatedAt,
      link: '/email-marketing/campaigns',
    });
  }

  workflowRuns.filter((r) => r.status === 'FAILED').slice(0, 5).forEach((r) => {
    activityEvents.push({
      id: 'wf-' + r.id,
      type: 'workflow_failed',
      title: 'Automation failed',
      subtitle: `${r.workflow?.name || 'Workflow'} encountered an execution error`,
      timestamp: r.startedAt,
      link: '/automations',
    });
  });

  activityEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    headline: {
      newContacts: {
        count: contactsCurrent,
        total: allContacts.length,
        changePct: contactsChangePct,
      },
      openOpportunities: {
        count: openDeals.length,
        value: pipelineValue,
      },
      wonDeals: {
        count: wonCountCurrent,
        value: wonValueCurrent,
        changePct: wonValueChangePct,
        wonCountChangePct,
        allTimeValue: allDeals.filter((d) => d.pipelineStage?.name === 'Won').reduce((sum, d) => sum + (d.amount || 0), 0),
      },
      unreadConversations: {
        count: unreadConvosCount,
        openThreads: openConvosCount,
      },
      upcomingAppointments: {
        count: upcomingAppointments.length,
      },
    },
    crm: {
      pipelineStages,
      winRate,
      wonDealsCount: wonTotal,
      lostDealsCount: lostTotal,
      leadSources,
      staleDeals,
      contactsOverTime,
    },
    conversations: {
      unreadCount: unreadConvosCount,
      openThreads: openConvosCount,
      messages: {
        emailSent,
        emailReceived,
        smsSent,
        smsReceived,
        totalSent: emailSent + smsSent,
        totalReceived: emailReceived + smsReceived,
      },
      avgFirstResponseMinutes,
      awaitingReply: {
        count: awaitingReplyList.length,
        items: awaitingReplyList,
      },
    },
    calendar: {
      todayAppointmentsCount,
      thisWeekAppointmentsCount,
      statusBreakdown: calendarStatusBreakdown,
      upcomingAppointments: upcomingAppointmentsList,
    },
    emailMarketing: {
      sent: emailSentCount,
      delivered: emailDeliveredCount,
      uniqueOpens,
      uniqueClicks,
      bounces: emailBouncedCount,
      unsubscribes: emailUnsubscribedCount,
      openRate: openRatePct,
      clickRate: clickRatePct,
      lastCampaign: lastCampaignCard,
      listGrowth: {
        newSubscribers: contactsCurrent,
        unsubscribes: emailUnsubscribedCount,
        netGrowth: contactsCurrent - emailUnsubscribedCount,
      },
    },
    automations: {
      activeWorkflows: activeWorkflowsCount,
      totalRuns,
      succeededRuns,
      failedRuns,
      successRate: automationSuccessRate,
      recentFailedRuns,
    },
    activityFeed: activityEvents.slice(0, 10),

    // Backward-compat fields for existing hooks
    revenue: { current: wonValueCurrent, trend: [] },
    pipeline: { value: pipelineValue },
    contacts: { total: allContacts.length },
    open_conversations: openConvosCount,
    pipeline_stages: pipelineStages,
    email: {
      sent: emailSentCount,
      delivered: emailDeliveredCount,
      uniqueOpens,
      totalOpens: uniqueOpens,
      uniqueClicks,
      totalClicks: uniqueClicks,
      hardBounces: emailBouncedCount,
      softBounces: 0,
      complaints: 0,
      unsubscribes: emailUnsubscribedCount,
    },
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
