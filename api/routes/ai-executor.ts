/**
 * ai-executor.ts — Stone AIO
 *
 * Shared CRM tool execution logic for the AI system.
 * Called by both the AI chat route (live execution) and the AI actions
 * approval route (deferred execution after human review).
 */

import { db } from '../../infrastructure/database/client.js';
import * as crm from '../services/crm.service.js';
import { createCampaign as createEmailMarketingCampaign, getCampaigns } from '../services/email-marketing/campaigns.service.js';

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
      const event = await db.contactEvent.create({
        data: {
          contactId: args.contactId,
          type: 'email',
          title: `Email: ${args.subject}`,
          content: args.body,
        },
      });
      await db.contact.update({ where: { id: args.contactId }, data: { lastContactedAt: new Date() } });
      return { success: true, message: `Email to ${contact.email} queued/sent`, event };
    }
    case 'send_sms': {
      const contact = await db.contact.findFirst({ where: { id: args.contactId, workspaceId } });
      if (!contact || !contact.phone) return { error: 'Contact phone not found' };
      const event = await db.contactEvent.create({
        data: {
          contactId: args.contactId,
          type: 'sms',
          title: 'Outbound SMS',
          content: args.message,
        },
      });
      await db.contact.update({ where: { id: args.contactId }, data: { lastContactedAt: new Date() } });
      return { success: true, message: `SMS to ${contact.phone} queued/sent`, event };
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
    default: return toolName;
  }
}
