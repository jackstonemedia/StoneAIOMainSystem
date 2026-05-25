'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { createDeal } from '../../crm.service.js';

/**
 * CRM Create Deal node.
 *
 * Creates a new deal record in the CRM system with the provided details.
 *
 * Configuration:
 *   - contactId    (text, required) — Associated contact ID
 *   - title        (text, required) — Deal title
 *   - amount       (number)         — Deal amount / value
 *   - stageId      (text)           — Pipeline stage ID
 *   - probability  (number)         — Win probability percentage
 *   - closeDate    (datetime)       — Expected close date
 *   - description  (textarea)       — Deal description / notes
 */
export const crmCreateDeal: NodeImplementation = {
  type: 'crm.create_deal',
  category: 'crm',
  displayName: 'Create Deal',
  description: 'Create a new deal record in the CRM.',
  iconName: 'briefcase',
  color: '#F59E0B',
  outputHandles: [{ id: 'default', label: 'Created', color: '#F59E0B' }],
  configSchema: [
    {
      key: 'contactId',
      label: 'Contact ID',
      type: 'text',
      required: true,
    },
    {
      key: 'title',
      label: 'Deal Title',
      type: 'text',
      required: true,
    },
    {
      key: 'amount',
      label: 'Amount',
      type: 'number',
    },
    {
      key: 'stageId',
      label: 'Stage ID',
      type: 'text',
    },
    {
      key: 'probability',
      label: 'Probability (%)',
      type: 'number',
    },
    {
      key: 'closeDate',
      label: 'Close Date',
      type: 'datetime',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    if (!config.contactId) {
      throw new Error('Contact ID is required to create a deal.');
    }
    if (!config.title) {
      throw new Error('Deal title is required to create a deal.');
    }

    try {
      const workspaceId = (config.workspaceId as string) ?? context.workspaceId;
      const userId = (context.userId as string) ?? 'system';

      const dealData = {
        contactId: config.contactId,
        title: config.title,
        amount: config.amount,
        stageId: config.stageId,
        probability: config.probability,
        closeDate: config.closeDate,
        description: config.description,
      };

      const deal = await createDeal(workspaceId, userId, dealData);

      return {
        output: [
          {
            json: {
              dealId: deal.id,
              title: deal.title,
              contactId: deal.contactId,
              amount: deal.amount,
              stageId: deal.stageId,
              probability: deal.probability,
              closeDate: deal.closeDate,
              description: deal.description,
              ...deal,
            },
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create deal: ${message}`);
    }
  },
};
