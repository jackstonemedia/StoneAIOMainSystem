/**
 * ai-executor.ts — Stone AIO
 *
 * Shared CRM tool execution logic for the AI system.
 * Called by both the AI chat route (live execution) and the AI actions
 * approval route (deferred execution after human review).
 */

import { db } from '../../infrastructure/database/client.js';
import * as crm from '../services/crm.service.js';
import { createCampaign as createEmailMarketingCampaign, getCampaigns, sendCampaign } from '../services/email-marketing/campaigns.service.js';
import { listAppointments, createAppointment } from '../services/business.service.js';
import { copilotService } from '../services/inbox/copilot.service.js';
import { whitelistDealUpdate, validateAppointmentTimes } from '../services/agent/tools.js';

export async function executeTool(workspaceId: string, name: string, args: any, userId?: string): Promise<any> {
  switch (name) {
    case 'get_crm_dashboard': {
      return await crm.getDashboard(workspaceId);
    }
    case 'search_contacts': {
      return await crm.listContacts(workspaceId, { search: args.search, status: args.status, limit: 15 });
    }
    case 'get_contact_details': {
      const contact = await db.contact.findFirst({
        where: { id: args.contactId, workspaceId },
        include: { events: { take: 10, orderBy: { createdAt: 'desc' } }, company: true },
      });
      return contact || { error: 'Contact not found' };
    }
    case 'create_contact': {
      const created = await crm.createContact(workspaceId, {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        phone: args.phone,
        status: args.status || 'Lead',
        about: args.about,
      });
      return { success: true, contact: created };
    }
    case 'update_contact': {
      const updated = await crm.updateContact(args.contactId, workspaceId, {
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        phone: args.phone,
        status: args.status,
        about: args.about,
      });
      return { success: true, contact: updated };
    }
    case 'add_contact_note': {
      // Phase 2 scoping fix: a note must never land on another
      // workspace's contact. (The framework checks this too for the new
      // route; this protects the old route and the approval path.)
      const contact = await db.contact.findFirst({
        where: { id: args.contactId, workspaceId },
      });
      if (!contact) return { error: 'Contact not found in this workspace' };
      const event = await db.contactEvent.create({
        data: { contactId: args.contactId, type: 'note', title: 'Internal Note', content: args.note },
      });
      return { success: true, note: event };
    }
    case 'list_deals': {
      const deals = await db.deal.findMany({
        where: { workspaceId },
        include: { contact: true, pipelineStage: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return deals;
    }
    case 'create_deal': {
      let stageId = args.stageId;
      if (!stageId) {
        const stage = await db.pipelineStage.findFirst({ where: { pipeline: { workspaceId } } });
        stageId = stage?.id;
      }
      if (!stageId) return { error: 'No pipeline stage found in workspace' };
      const deal = await crm.createDeal(workspaceId, userId || 'system', {
        title: args.title,
        amount: args.amount ? Number(args.amount) : 0,
        contactId: args.contactId || null,
        priority: args.priority || 'medium',
        pipelineStageId: stageId,
      });
      return { success: true, deal };
    }
    case 'list_tasks': {
      return await crm.listTasks(workspaceId, {});
    }
    case 'create_task': {
      const task = await crm.createTask(workspaceId, {
        title: args.title,
        contactId: args.contactId || null,
        priority: args.priority || 'medium',
        dueDate: args.dueDate || new Date().toISOString(),
      });
      return { success: true, task };
    }
    case 'send_email': {
      const contact = await db.contact.findFirst({ where: { id: args.contactId, workspaceId } });
      if (!contact || !contact.email) return { error: 'Contact email not found' };
      // Truthfulness (Phase 0): only report a send when Gmail actually accepts it.
      // Resolve the workspace's active Gmail connection (same pattern as crm-actions).
      let gmailConn = await db.channelConnection.findFirst({
        where: { workspaceId, provider: 'gmail', isActive: true },
      });
      if (!gmailConn) {
        gmailConn = await db.channelConnection.findFirst({
          where: { provider: 'gmail', isActive: true },
        });
      }
      if (!gmailConn) {
        return { error: 'No active Gmail connection — email not sent. Connect Gmail in Settings.' };
      }
      const { sendGmailMessage } = await import('../services/channels/gmail.service.js');
      const sent = await sendGmailMessage(gmailConn.id, contact.email, args.subject, args.body);
      const event = await db.contactEvent.create({
        data: {
          contactId: args.contactId,
          type: 'email',
          title: `Email: ${args.subject}`,
          content: args.body,
        },
      });
      await db.contact.update({ where: { id: args.contactId }, data: { lastContactedAt: new Date() } });
      return { success: true, message: `Email sent via Gmail to ${contact.email}`, messageId: sent.messageId, event };
    }
    case 'send_sms': {
      const contact = await db.contact.findFirst({ where: { id: args.contactId, workspaceId } });
      if (!contact || !contact.phone) return { error: 'Contact phone not found' };
      // Truthfulness (Phase 0): no SMS provider exists in this codebase, so a send
      // must never be claimed. Record nothing and report the miss honestly.
      return { error: 'SMS not sent — no SMS provider is configured for this workspace.' };
    }
    case 'list_campaigns': {
      return await getCampaigns(workspaceId);
    }
    case 'create_campaign': {
      const campaign = await createEmailMarketingCampaign(workspaceId, {
        name: args.name,
        subject: args.subject,
        blockJson: { html: args.bodyHtml || '<p>Draft email content</p>' },
      });
      return { success: true, campaign };
    }
    // ── Phase 4: Conversations / Inbox ──────────────────────────────
    case 'list_inbox_conversations': {
      return await db.inboxConversation.findMany({
        where: { workspaceId, ...(args.status ? { status: args.status } : {}) },
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { lastActivityAt: 'desc' },
        take: 20,
      });
    }
    case 'get_inbox_messages': {
      const conv = await db.inboxConversation.findFirst({ where: { id: args.conversationId, workspaceId } });
      if (!conv) return { error: 'Inbox conversation not found in this workspace' };
      return await db.inboxMessage.findMany({
        where: { conversationId: args.conversationId, workspaceId },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    }
    case 'list_conversations': {
      return await db.conversation.findMany({
        where: { workspaceId, ...(args.channel ? { channel: args.channel } : {}), ...(args.status ? { status: args.status } : {}) },
        include: { contact: true },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
      });
    }
    case 'get_conversation_messages': {
      const conv = await db.conversation.findFirst({ where: { id: args.conversationId, workspaceId } });
      if (!conv) return { error: 'Conversation not found in this workspace' };
      return await db.conversationMessage.findMany({
        where: { conversationId: args.conversationId },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    }
    case 'draft_inbox_reply': {
      const conv = await db.inboxConversation.findFirst({ where: { id: args.conversationId, workspaceId } });
      if (!conv) return { error: 'Inbox conversation not found in this workspace' };
      const draft = await copilotService.generateDraftReply(args.conversationId, workspaceId);
      return { draft };
    }
    // ── Phase 4: Email marketing detail + send ───────────────────────
    case 'get_campaign_details': {
      const campaign = await db.campaign.findFirst({ where: { id: args.campaignId, workspaceId } });
      if (!campaign) return { error: 'Campaign not found in this workspace' };
      const counts = await db.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId: args.campaignId },
        _count: { status: true },
      });
      return {
        campaign,
        recipientCounts: counts.map((c) => ({ status: c.status, count: c._count.status })),
      };
    }
    case 'send_campaign': {
      const sent = await sendCampaign(workspaceId, args.campaignId);
      return { success: true, ...sent };
    }
    // ── Phase 4: Calendar / Appointments ─────────────────────────────
    case 'list_appointments': {
      return await listAppointments(workspaceId, {
        contactId: args.contactId,
        startDate: args.startDate,
        endDate: args.endDate,
        search: args.search,
      });
    }
    case 'create_appointment': {
      const validated = validateAppointmentTimes(args.startTime, args.endTime);
      if ('error' in validated) return validated;
      const appt = await createAppointment(workspaceId, {
        title: args.title,
        description: args.description,
        type: args.type,
        location: args.location,
        contactId: args.contactId ?? null,
        startTime: validated.start.toISOString(),
        endTime: validated.end.toISOString(),
      });
      return { success: true, appointment: appt };
    }
    // ── Phase 4: Deals / Pipelines full + Settings read + Reporting ──
    case 'update_deal': {
      // Whitelist only: anything else is dropped, never passed through.
      const data = whitelistDealUpdate(args);
      if (Object.keys(data).length === 0) {
        return { error: 'update_deal needs at least one field to update' };
      }
      if (data.pipelineStageId) {
        const stage = await db.pipelineStage.findFirst({
          where: { id: data.pipelineStageId as string, pipeline: { workspaceId } },
        });
        if (!stage) return { error: 'Pipeline stage not found in this workspace' };
      }
      const updated = await crm.updateDeal(args.dealId, workspaceId, data);
      return { success: true, deal: updated };
    }
    case 'list_pipelines': {
      // Direct query, NOT crm.listPipelines: that service auto-creates a
      // default pipeline when none exists, and a read tool must not
      // have a write side effect.
      return await db.pipeline.findMany({
        where: { workspaceId },
        include: { stages: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
    }
    case 'get_workspace_info': {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, plan: true, agentMode: true, agentName: true, creditsUsed: true, creditsLimit: true },
      });
      if (!ws) return { error: 'Workspace not found' };
      return { ...ws, creditsNote: 'Credits are displayed only and are not enforced (metering lands in Phase 5).' };
    }
    case 'get_pipeline_summary': {
      const pipelines = await db.pipeline.findMany({
        where: { workspaceId },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      const deals = await db.deal.findMany({
        where: { workspaceId },
        select: { pipelineStageId: true, amount: true },
      });
      return pipelines.map((p) => ({
        pipeline: p.name,
        stages: p.stages.map((s) => {
          const inStage = deals.filter((d) => d.pipelineStageId === s.id);
          return {
            stage: s.name,
            deals: inStage.length,
            value: inStage.reduce((sum, d) => sum + (d.amount ?? 0), 0),
          };
        }),
      }));
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** Tools that require human approval before execution */
export const APPROVAL_REQUIRED_TOOLS = new Set([
  'create_contact',
  'update_contact',
  'create_deal',
  'create_task',
  'send_email',
  'send_sms',
  'create_campaign',
  // Phase 4: every NEW write/send tool queues in the old route too, so
  // the old route never executes a new tool without approval.
  'update_deal',
  'create_appointment',
  'send_campaign',
]);

/** Human-readable labels for tool calls */
export function getActionLabel(toolName: string, args: any): string {
  switch (toolName) {
    case 'create_contact': return `Create contact: ${args.firstName || ''} ${args.lastName || ''}`.trim();
    case 'update_contact': return `Update contact ID: ${args.contactId}`;
    case 'create_deal': return `Create deal: "${args.title}" ($${args.amount ?? 0})`;
    case 'create_task': return `Create task: "${args.title}"`;
    case 'send_email': return `Send email to contact ${args.contactId}: "${args.subject}"`;
    case 'send_sms': return `Send SMS to contact ${args.contactId}: "${args.message?.slice(0, 40)}..."`;
    case 'create_campaign': return `Create email campaign: "${args.name}"`;
    case 'update_deal': return `Update deal ID: ${args.dealId}`;
    case 'create_appointment': return `Create appointment: "${args.title ?? 'Meeting'}"`;
    case 'send_campaign': return `Send campaign ID: ${args.campaignId}`;
    default: return toolName;
  }
}
