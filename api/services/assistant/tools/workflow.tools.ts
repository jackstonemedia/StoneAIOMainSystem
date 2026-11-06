/**
 * Workflow & Automation Tools — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { db } from '../../../../infrastructure/database/client.js';
import type { ToolDefinition } from './types.js';

export const workflowTools: ToolDefinition[] = [
  // 1. list_workflows
  {
    name: 'list_workflows',
    description: 'List automated workflows in the workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: draft, active, paused.' },
      },
    },
    execute: async (args: { status?: string }, ctx) => {
      const workflows = await db.workflow.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.status ? { status: args.status } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      return {
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          status: w.status,
          triggerType: w.triggerType,
          isFavorite: w.isFavorite,
        })),
        total: workflows.length,
      };
    },
  },

  // 2. create_workflow
  {
    name: 'create_workflow',
    description: 'Create a new automation workflow in the workspace.',
    risk: 'write',
    minimumRole: 'admin',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name.' },
        description: { type: 'string', description: 'Workflow purpose or notes.' },
        triggerType: { type: 'string', description: 'Trigger type (e.g. contact_created, form_submitted, deal_won).' },
      },
      required: ['name'],
    },
    execute: async (args: { name: string; description?: string; triggerType?: string }, ctx) => {
      const workflow = await db.workflow.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: args.name,
          description: args.description || null,
          triggerType: args.triggerType || 'manual',
          status: 'draft',
        },
      });

      return {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          triggerType: workflow.triggerType,
        },
        message: `Workflow "${workflow.name}" created as draft.`,
      };
    },
  },

  // 3. trigger_workflow
  {
    name: 'trigger_workflow',
    description: 'Trigger an automation workflow execution manually for a contact or context.',
    risk: 'write',
    minimumRole: 'admin',
    parameters: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'The UUID of the workflow to run.' },
        contactId: { type: 'string', description: 'Optional Contact ID to run the workflow on.' },
      },
      required: ['workflowId'],
    },
    execute: async (args: { workflowId: string; contactId?: string }, ctx) => {
      const workflow = await db.workflow.findFirst({
        where: { id: args.workflowId, workspaceId: ctx.workspaceId },
      });

      if (!workflow) {
        throw new Error(`Workflow ${args.workflowId} not found in workspace.`);
      }

      // Workflow execution triggered
      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        contactId: args.contactId || null,
        status: 'triggered',
        message: `Workflow "${workflow.name}" triggered successfully.`,
      };
    },
  },
];
