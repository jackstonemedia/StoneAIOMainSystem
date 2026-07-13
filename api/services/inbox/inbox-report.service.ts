import { db } from '../../../infrastructure/database/client.js';

export async function getOverviewStats(workspaceId: string, startDate: Date, endDate: Date) {
  const [total, resolved, open, pending, resolutionStats, firstReplyStats] = await Promise.all([
    db.inboxConversation.count({ where: { workspaceId, createdAt: { gte: startDate, lte: endDate } } }),
    db.inboxConversation.count({ where: { workspaceId, status: 'resolved', resolvedAt: { gte: startDate, lte: endDate } } }),
    db.inboxConversation.count({ where: { workspaceId, status: 'open' } }),
    db.inboxConversation.count({ where: { workspaceId, status: 'pending' } }),
    
    // Average resolution time (requires raw query for time diff)
    db.$queryRaw<{avg_res: number}[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_res
      FROM inbox_conversations
      WHERE workspace_id = ${workspaceId} 
        AND status = 'resolved'
        AND resolved_at BETWEEN ${startDate} AND ${endDate}
    `,
    
    // Average first reply time
    db.$queryRaw<{avg_first: number}[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (first_reply_at - created_at))) as avg_first
      FROM inbox_conversations
      WHERE workspace_id = ${workspaceId} 
        AND first_reply_at IS NOT NULL
        AND created_at BETWEEN ${startDate} AND ${endDate}
    `
  ]);

  return {
    totalConversations: total,
    resolvedConversations: resolved,
    openConversations: open,
    pendingConversations: pending,
    avgResolutionMs: resolutionStats[0]?.avg_res ? Number(resolutionStats[0].avg_res) * 1000 : null,
    avgFirstResponseMs: firstReplyStats[0]?.avg_first ? Number(firstReplyStats[0].avg_first) * 1000 : null,
  };
}

export async function getAgentStats(workspaceId: string, startDate: Date, endDate: Date) {
  const stats = await db.$queryRaw<any[]>`
    SELECT 
      assigned_user_id as "userId",
      COUNT(id) as "assigned",
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as "resolved",
      AVG(EXTRACT(EPOCH FROM (first_reply_at - created_at))) as "avgFirstReply",
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as "avgResolution"
    FROM inbox_conversations
    WHERE workspace_id = ${workspaceId} 
      AND assigned_user_id IS NOT NULL
      AND created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY assigned_user_id
  `;
  
  return stats.map((s: any) => ({
    userId: s.userId,
    assigned: Number(s.assigned),
    resolved: Number(s.resolved),
    avgFirstReplyMs: s.avgFirstReply ? Number(s.avgFirstReply) * 1000 : null,
    avgResolutionMs: s.avgResolution ? Number(s.avgResolution) * 1000 : null,
  }));
}

export async function getLabelStats(workspaceId: string, startDate: Date, endDate: Date) {
  const stats = await db.$queryRaw<any[]>`
    SELECT 
      l.id as "labelId",
      l.title,
      l.color,
      COUNT(cl.conversation_id) as "count"
    FROM inbox_labels l
    LEFT JOIN inbox_conversation_labels cl ON l.id = cl.label_id
    LEFT JOIN inbox_conversations c ON cl.conversation_id = c.id
    WHERE l.workspace_id = ${workspaceId}
      AND (c.created_at BETWEEN ${startDate} AND ${endDate} OR c.created_at IS NULL)
    GROUP BY l.id, l.title, l.color
    ORDER BY "count" DESC
  `;
  
  return stats.map((s: any) => ({
    labelId: s.labelId,
    title: s.title,
    color: s.color,
    count: Number(s.count),
  }));
}

export async function getConversationTrend(workspaceId: string, startDate: Date, endDate: Date) {
  const trend = await db.$queryRaw<any[]>`
    SELECT 
      DATE(created_at) as "date",
      COUNT(id) as "new",
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as "resolved",
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as "pending"
    FROM inbox_conversations
    WHERE workspace_id = ${workspaceId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY "date" ASC
  `;

  return trend.map((t: any) => ({
    date: t.date,
    new: Number(t.new),
    resolved: Number(t.resolved),
    pending: Number(t.pending),
  }));
}
