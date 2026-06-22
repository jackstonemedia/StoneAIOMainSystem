'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';
import { emitTrigger } from '../../trigger-emitter.service.js';

export const crmUpdateDeal: NodeImplementation = {
  type: 'crm.update_deal',
  category: 'crm',
  displayName: 'Update Deal',
  description: 'Update an existing deal in the CRM.',
  iconName: 'briefcase',
  color: '#8B5CF6',
  outputHandles: [{ id: 'default', label: 'Updated', color: '#8B5CF6' }],
  configSchema: [
    { key: 'dealId', label: 'Deal ID', type: 'text', required: true },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'status', label: 'Status', type: 'select', options: [
      { label: 'Open', value: 'open' },
      { label: 'Won', value: 'won' },
      { label: 'Lost', value: 'lost' },
    ]},
    { key: 'stageId', label: 'Stage ID', type: 'text' },
    { key: 'description', label: 'Description', type: 'textarea' },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const dealId = config.dealId as string;
    if (!dealId) throw new Error('Deal ID is required.');

    // Verify deal belongs to this workspace
    const existing = await db.deal.findFirst({ where: { id: dealId, workspaceId: context.workspaceId } });
    if (!existing) throw new Error(`Deal ${dealId} not found.`);

    const updateData: Record<string, unknown> = {};
    if (config.title) updateData.title = config.title;
    if (config.amount !== undefined && config.amount !== '') updateData.amount = Number(config.amount);
    if (config.status) updateData.status = config.status;
    if (config.stageId) updateData.stageId = config.stageId;
    if (config.description) updateData.description = config.description;

    const deal = await db.deal.update({ where: { id: dealId }, data: updateData as any });

    emitTrigger(context.workspaceId, 'deal.updated', deal as Record<string, unknown>).catch(() => {});
    if (config.status === 'won') emitTrigger(context.workspaceId, 'deal.won', deal as Record<string, unknown>).catch(() => {});
    if (config.status === 'lost') emitTrigger(context.workspaceId, 'deal.lost', deal as Record<string, unknown>).catch(() => {});

    return { output: [{ json: { ...deal, id: deal.id } }] };
  },
};
