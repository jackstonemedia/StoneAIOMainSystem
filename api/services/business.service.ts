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

  const [allDeals, totalContacts, wonDealsByMonth, agentRuns] = await Promise.all([
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

    agentPerformance,
  };
}

// ── Appointments ──────────────────────────────────────────────────────────────

export async function listAppointments(workspaceId: string) {
  return db.appointment.findMany({
    where: { workspaceId },
    include: { contact: true },
    orderBy: { startTime: 'asc' },
  });
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

// ── Conversations ─────────────────────────────────────────────────────────────

export async function listConversations(workspaceId: string) {
  const where = {
    workspaceId,
    // Only show conversations that are linked to a CRM contact OR that the
    // workspace user has replied to (at least one outbound message).
    // This prevents random inbound emails from strangers flooding the inbox.
    OR: [
      { contactId: { not: null } },
      { messages: { some: { direction: 'outbound' } } },
    ],
  };
  const include = {
    contact: {
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true },
    },
    messages: { take: 1, orderBy: { createdAt: 'desc' as const } },
  };
  try {
    // Preferred: sort by lastMessageAt (new field — requires regenerated Prisma client)
    return await db.conversation.findMany({
      where,
      include,
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });
  } catch {
    // Fallback: Prisma client not yet regenerated — lastMessageAt unknown to client.
    // Run `prisma generate` after stopping the dev server to restore full ordering.
    return await db.conversation.findMany({ where, include, orderBy: { updatedAt: 'desc' } });
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
