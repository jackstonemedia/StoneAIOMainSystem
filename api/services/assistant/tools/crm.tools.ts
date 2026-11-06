/**
 * CRM Tools for Stone AI Assistant — Stone AIO
 * Spec Section 2.8 & Stage S2
 */

import { db } from '../../../../infrastructure/database/client.js';
import * as crm from '../../crm.service.js';
import { assistantRepo } from '../assistant.repo.js';
import { hasMinimumRole } from '../modes.js';
import type { ToolDefinition } from './types.js';

export const crmTools: ToolDefinition[] = [
  // 1. search_contacts
  {
    name: 'search_contacts',
    description: 'Search CRM contacts by name, email, phone number, or tag in the current workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query matching contact names, emails, phones, or tags.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 20, max 100).',
        },
      },
      required: ['query'],
    },
    execute: async (args: { query: string; limit?: number }, ctx) => {
      const limit = Math.min(Math.max(args.limit || 20, 1), 100);
      const results = await crm.listContacts(ctx.workspaceId, {
        search: args.query,
        limit,
      });
      return {
        contacts: results.contacts.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          phone: c.phone,
          company: c.company?.name,
          tags: Array.isArray(c.tagsJson) ? c.tagsJson : [],
        })),
        total: results.total,
      };
    },
  },

  // 2. get_contact_details
  {
    name: 'get_contact_details',
    description: 'Retrieve full details for a specific contact including recent activities, notes, and deals.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        contactId: {
          type: 'string',
          description: 'The UUID of the contact.',
        },
      },
      required: ['contactId'],
    },
    execute: async (args: { contactId: string }, ctx) => {
      const contact = await crm.getContact(args.contactId, ctx.workspaceId);
      if (!contact) {
        throw new Error(`Contact with ID ${args.contactId} not found in this workspace.`);
      }

      // Fetch recent activities for this contact
      const activities = await db.activity.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          contactId: args.contactId,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        contact: {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          company: contact.company?.name,
          tags: contact.tagsJson,
          about: contact.about,
          deals: contact.deals || [],
          tasks: contact.tasks || [],
          recentActivities: activities,
        },
      };
    },
  },

  // 3. create_contact
  {
    name: 'create_contact',
    description: 'Create a new CRM contact in the workspace.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name of the contact.' },
        lastName: { type: 'string', description: 'Last name of the contact.' },
        email: { type: 'string', description: 'Primary email address.' },
        phone: { type: 'string', description: 'Phone number.' },
        companyId: { type: 'string', description: 'Optional ID of the company.' },
        tags: {
          type: 'array',
          description: 'Tags to associate with the contact.',
          items: { type: 'string' },
        },
      },
      required: ['firstName'],
    },
    execute: async (
      args: {
        firstName: string;
        lastName?: string;
        email?: string;
        phone?: string;
        companyId?: string;
        tags?: string[];
      },
      ctx
    ) => {
      const contact = await crm.createContact(ctx.workspaceId, {
        firstName: args.firstName,
        lastName: args.lastName || '',
        email: args.email || null,
        phone: args.phone || null,
        companyId: args.companyId || null,
        tagsJson: args.tags ? JSON.stringify(args.tags) : '[]',
        source: 'AI Assistant',
      });

      return {
        contact: {
          id: contact.id,
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email,
          phone: contact.phone,
        },
        message: `Contact "${contact.firstName} ${contact.lastName}".trim() created successfully.`,
      };
    },
  },

  // 4. update_contact
  {
    name: 'update_contact',
    description: 'Update fields of an existing contact.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The UUID of the contact to update.' },
        firstName: { type: 'string', description: 'New first name.' },
        lastName: { type: 'string', description: 'New last name.' },
        email: { type: 'string', description: 'New email address.' },
        phone: { type: 'string', description: 'New phone number.' },
        title: { type: 'string', description: 'New job title.' },
      },
      required: ['contactId'],
    },
    execute: async (
      args: {
        contactId: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        title?: string;
      },
      ctx
    ) => {
      const updateData: Record<string, unknown> = {};
      if (args.firstName !== undefined) updateData.firstName = args.firstName;
      if (args.lastName !== undefined) updateData.lastName = args.lastName;
      if (args.email !== undefined) updateData.email = args.email;
      if (args.phone !== undefined) updateData.phone = args.phone;
      if (args.title !== undefined) updateData.title = args.title;

      const updated = await crm.updateContact(args.contactId, ctx.workspaceId, updateData);
      return {
        contact: {
          id: updated.id,
          name: `${updated.firstName} ${updated.lastName}`.trim(),
          email: updated.email,
          phone: updated.phone,
        },
        message: 'Contact updated successfully.',
      };
    },
  },

  // 5. add_contact_note
  {
    name: 'add_contact_note',
    description: 'Add a note or activity log to a contact.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The UUID of the contact.' },
        note: { type: 'string', description: 'The note text.' },
      },
      required: ['contactId', 'note'],
    },
    execute: async (args: { contactId: string; note: string }, ctx) => {
      // Ensure contact belongs to workspace
      const contact = await crm.getContact(args.contactId, ctx.workspaceId);
      if (!contact) {
        throw new Error(`Contact ${args.contactId} not found in workspace.`);
      }

      const activity = await db.activity.create({
        data: {
          workspaceId: ctx.workspaceId,
          contactId: args.contactId,
          type: 'note',
          title: 'Note from AI Assistant',
          notes: args.note,
        },
      });

      if (db.contactEvent && typeof db.contactEvent.create === 'function') {
        await db.contactEvent
          .create({
            data: {
              contactId: args.contactId,
              type: 'note',
              title: 'Note from AI Assistant',
              content: args.note,
              metadataJson: JSON.stringify({
                createdByAssistant: true,
                createdForUserId: ctx.userId,
                createdForUserName: ctx.userName || 'User',
                source: 'assistant',
              }),
            },
          })
          .catch(() => {});
      }

      return {
        activityId: activity.id,
        contactId: args.contactId,
        message: 'Note added successfully.',
      };
    },
  },

  // 6. list_deals
  {
    name: 'list_deals',
    description: 'List deals with optional status or stage filters.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Deal status (e.g. open, won, lost).' },
        stageId: { type: 'string', description: 'Pipeline stage ID.' },
        contactId: { type: 'string', description: 'Contact ID.' },
      },
    },
    execute: async (args: { status?: string; stageId?: string; contactId?: string }, ctx) => {
      const deals = await crm.listDeals(ctx.workspaceId, {
        status: args.status,
        pipelineStageId: args.stageId,
        contactId: args.contactId,
      } as Record<string, string>);

      return {
        deals: deals.map((d: any) => ({
          id: d.id,
          title: d.title,
          amount: d.amount,
          status: d.status,
          stage: d.pipelineStage?.name,
          contact: d.contact ? `${d.contact.firstName} ${d.contact.lastName}`.trim() : null,
          company: d.company?.name,
        })),
        total: deals.length,
      };
    },
  },

  // 7. create_deal
  {
    name: 'create_deal',
    description: 'Create a new sales deal in the CRM.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deal title or name.' },
        amount: { type: 'number', description: 'Deal monetary value.' },
        pipelineStageId: { type: 'string', description: 'Pipeline stage ID (optional, defaults to first stage).' },
        contactId: { type: 'string', description: 'Associated contact ID.' },
        companyId: { type: 'string', description: 'Associated company ID.' },
      },
      required: ['title'],
    },
    execute: async (
      args: {
        title: string;
        amount?: number;
        pipelineStageId?: string;
        contactId?: string;
        companyId?: string;
      },
      ctx
    ) => {
      let stageId = args.pipelineStageId;
      if (!stageId) {
        const pipelines = await crm.listPipelines(ctx.workspaceId);
        if (pipelines.length > 0 && pipelines[0].stages?.length > 0) {
          stageId = pipelines[0].stages[0].id;
        } else {
          throw new Error('No pipeline stages found in this workspace. Please create a pipeline stage first.');
        }
      }

      const deal = await crm.createDeal(ctx.workspaceId, ctx.userId, {
        title: args.title,
        amount: args.amount || 0,
        pipelineStageId: stageId,
        contactId: args.contactId || null,
        companyId: args.companyId || null,
      });

      return {
        deal: {
          id: deal.id,
          title: deal.title,
          amount: deal.amount,
        },
        message: `Deal "${deal.title}" created successfully.`,
      };
    },
  },

  // 8. list_companies
  {
    name: 'list_companies',
    description: 'List or search companies in the workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Company name search query.' },
      },
    },
    execute: async (args: { query?: string }, ctx) => {
      const companies = await crm.listCompanies(ctx.workspaceId, args.query);
      return {
        companies: companies.map((c: any) => ({
          id: c.id,
          name: c.name,
          website: c.website,
          industry: c.industry,
          contactsCount: c._count?.contacts || c.contacts?.length || 0,
        })),
        total: companies.length,
      };
    },
  },

  // 9. list_tasks
  {
    name: 'list_tasks',
    description: 'List CRM tasks with optional status and priority filters.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Task status (e.g. pending, completed).' },
        priority: { type: 'string', description: 'Task priority (low, medium, high).' },
      },
    },
    execute: async (args: { status?: string; priority?: string }, ctx) => {
      const tasks = await crm.listTasks(ctx.workspaceId, {
        status: args.status,
        priority: args.priority,
      } as Record<string, string>);

      return {
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status,
          contact: t.contact ? `${t.contact.firstName} ${t.contact.lastName}`.trim() : null,
        })),
        total: tasks.length,
      };
    },
  },

  // 10. create_task
  {
    name: 'create_task',
    description: 'Create a new CRM task.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title.' },
        description: { type: 'string', description: 'Task description.' },
        dueDate: { type: 'string', description: 'ISO date string for when the task is due.' },
        priority: { type: 'string', description: 'Priority: low, medium, or high.' },
        contactId: { type: 'string', description: 'Contact ID associated with task.' },
        dealId: { type: 'string', description: 'Deal ID associated with task.' },
      },
      required: ['title'],
    },
    execute: async (
      args: {
        title: string;
        description?: string;
        dueDate?: string;
        priority?: 'low' | 'medium' | 'high';
        contactId?: string;
        dealId?: string;
      },
      ctx
    ) => {
      const task = await crm.createTask(ctx.workspaceId, {
        title: args.title,
        description: args.description || null,
        dueDate: args.dueDate || null,
        priority: args.priority || 'medium',
        contactId: args.contactId || null,
        dealId: args.dealId || null,
        assigneeId: ctx.userId,
      });

      if (args.contactId && db.contactEvent && typeof db.contactEvent.create === 'function') {
        await db.contactEvent
          .create({
            data: {
              contactId: args.contactId,
              type: 'task',
              title: `Task created: ${task.title}`,
              content: args.description || `Task due ${args.dueDate || 'no due date'}`,
              metadataJson: JSON.stringify({
                createdByAssistant: true,
                createdForUserId: ctx.userId,
                createdForUserName: ctx.userName || 'User',
                source: 'assistant',
                taskId: task.id,
              }),
            },
          })
          .catch(() => {});
      }

      return {
        task: {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          status: task.status,
        },
        message: `Task "${task.title}" created successfully.`,
      };
    },
  },

  // 11. update_task
  {
    name: 'update_task',
    description: 'Update an existing CRM task (e.g. mark completed, change priority).',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The UUID of the task.' },
        status: { type: 'string', description: 'Status: pending or completed.' },
        priority: { type: 'string', description: 'Priority: low, medium, or high.' },
        title: { type: 'string', description: 'New task title.' },
      },
      required: ['taskId'],
    },
    execute: async (
      args: {
        taskId: string;
        status?: 'pending' | 'completed';
        priority?: 'low' | 'medium' | 'high';
        title?: string;
      },
      ctx
    ) => {
      const updateData: Record<string, unknown> = {};
      if (args.status !== undefined) updateData.status = args.status;
      if (args.priority !== undefined) updateData.priority = args.priority;
      if (args.title !== undefined) updateData.title = args.title;

      const updated = await crm.updateTask(args.taskId, ctx.workspaceId, updateData);
      return {
        task: {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          priority: updated.priority,
        },
        message: 'Task updated successfully.',
      };
    },
  },

  // 12. complete_task
  {
    name: 'complete_task',
    description: 'Mark an existing CRM task as completed.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The UUID of the task to mark completed.',
        },
      },
      required: ['taskId'],
    },
    execute: async (args: { taskId: string }, ctx) => {
      const task = await crm.updateTask(args.taskId, ctx.workspaceId, { status: 'completed' });
      return {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
        },
        message: `Task "${task.title}" marked as completed.`,
      };
    },
  },

  // 13. create_company
  {
    name: 'create_company',
    description: 'Create a new company in the workspace CRM.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name.' },
        domain: { type: 'string', description: 'Website domain (e.g. acme.com).' },
        phone: { type: 'string', description: 'Company phone number.' },
        industry: { type: 'string', description: 'Industry or vertical.' },
      },
      required: ['name'],
    },
    execute: async (args: { name: string; domain?: string; phone?: string; industry?: string }, ctx) => {
      const company = await crm.createCompany(ctx.workspaceId, args);
      return {
        company: {
          id: company.id,
          name: company.name,
          website: company.website,
          industry: company.industry,
        },
        message: `Company "${company.name}" created successfully.`,
      };
    },
  },

  // 14. update_company
  {
    name: 'update_company',
    description: 'Update fields of an existing company in the workspace.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'The UUID of the company to update.' },
        name: { type: 'string', description: 'Updated company name.' },
        domain: { type: 'string', description: 'Updated website domain.' },
        phone: { type: 'string', description: 'Updated phone number.' },
        industry: { type: 'string', description: 'Updated industry.' },
      },
      required: ['companyId'],
    },
    execute: async (
      args: { companyId: string; name?: string; domain?: string; phone?: string; industry?: string },
      ctx
    ) => {
      const company = await crm.updateCompany(args.companyId, ctx.workspaceId, {
        name: args.name,
        website: args.domain,
        location: args.phone,
        industry: args.industry,
      });
      return {
        company: {
          id: company.id,
          name: company.name,
          website: company.website,
        },
        message: `Company "${company.name}" updated successfully.`,
      };
    },
  },

  // 15. add_contact_tag
  {
    name: 'add_contact_tag',
    description: 'Add a tag to a contact.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The UUID of the contact.' },
        tag: { type: 'string', description: 'The tag name to add.' },
      },
      required: ['contactId', 'tag'],
    },
    execute: async (args: { contactId: string; tag: string }, ctx) => {
      const contact = await db.contact.findFirst({
        where: { id: args.contactId, workspaceId: ctx.workspaceId },
      });
      if (!contact) throw new Error('Contact not found');

      let tags: string[] = [];
      try {
        tags = JSON.parse(contact.tagsJson || '[]');
      } catch {
        tags = [];
      }

      const cleanTag = args.tag.trim();
      if (!tags.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
        tags.push(cleanTag);
        await db.contact.update({
          where: { id: contact.id },
          data: { tagsJson: JSON.stringify(tags) },
        });
        await crm.syncContactTagsToWorkspace(ctx.workspaceId, [cleanTag]);
      }

      return {
        contactId: contact.id,
        tags,
        message: `Tag "${cleanTag}" added to contact.`,
      };
    },
  },

  // 16. remove_contact_tag
  {
    name: 'remove_contact_tag',
    description: 'Remove a tag from a contact.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The UUID of the contact.' },
        tag: { type: 'string', description: 'The tag name to remove.' },
      },
      required: ['contactId', 'tag'],
    },
    execute: async (args: { contactId: string; tag: string }, ctx) => {
      const contact = await db.contact.findFirst({
        where: { id: args.contactId, workspaceId: ctx.workspaceId },
      });
      if (!contact) throw new Error('Contact not found');

      let tags: string[] = [];
      try {
        tags = JSON.parse(contact.tagsJson || '[]');
      } catch {
        tags = [];
      }

      const cleanTag = args.tag.trim().toLowerCase();
      tags = tags.filter((t) => t.toLowerCase() !== cleanTag);

      await db.contact.update({
        where: { id: contact.id },
        data: { tagsJson: JSON.stringify(tags) },
      });

      return {
        contactId: contact.id,
        tags,
        message: `Tag "${args.tag}" removed from contact.`,
      };
    },
  },

  // 17. list_workspace_tags
  {
    name: 'list_workspace_tags',
    description: 'List all tags created in the current workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const tags = await crm.getWorkspaceTags(ctx.workspaceId);
      return {
        tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        total: tags.length,
      };
    },
  },

  // 18. list_smart_lists
  {
    name: 'list_smart_lists',
    description: 'List all saved smart lists / contact segments in the workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const lists = await crm.listSmartLists(ctx.workspaceId);
      return {
        smartLists: lists.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          count: (l as any)._count?.contacts || 0,
        })),
        total: lists.length,
      };
    },
  },

  // 19. delete_contact (Tier 3 Destructive)
  {
    name: 'delete_contact',
    description: 'Permanently delete a contact from the CRM.',
    risk: 'destructive',
    minimumRole: 'admin',
    requiresExplicitApproval: true,
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The UUID of the contact to delete.' },
      },
      required: ['contactId'],
    },
    execute: async (args: { contactId: string }, ctx) => {
      await crm.deleteContact(args.contactId, ctx.workspaceId);
      return {
        success: true,
        contactId: args.contactId,
        message: `Contact ${args.contactId} permanently deleted.`,
      };
    },
  },

  // 20. set_mode
  {
    name: 'set_mode',
    description: 'Switch the access mode of the current conversation (read_only, draft, full).',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          description: 'The target mode: read_only, draft, or full.',
          enum: ['read_only', 'draft', 'full'],
        },
      },
      required: ['mode'],
    },
    execute: async (args: { mode: 'read_only' | 'draft' | 'full' }, ctx) => {
      if (!ctx.conversationId) {
        throw new Error('Conversation context is missing for set_mode.');
      }

      if (args.mode === 'full') {
        const isAllowed = hasMinimumRole(ctx.userRole, 'admin');
        if (!isAllowed) {
          throw new Error('Only admins or owners may switch to Full autonomy mode.');
        }
      }

      await assistantRepo.updateConversation(ctx.workspaceId, ctx.userId, ctx.conversationId, {
        mode: args.mode,
      });

      return {
        mode: args.mode,
        message: `Access mode changed to ${args.mode}.`,
      };
    },
  },
];
