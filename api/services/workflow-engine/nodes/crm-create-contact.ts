'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { createContact } from '../../crm.service.js';

/**
 * CRM Create Contact node.
 *
 * Creates a new contact record in the CRM system with the provided details.
 *
 * Configuration:
 *   - email (text, required) — Contact email address
 *   - firstName (text) — Contact first name
 *   - lastName (text) — Contact last name
 *   - phone (text) — Contact phone number
 *   - company (text) — Associated company / business name
 *   - status (select) — Contact status: lead, new, contact, opportunity, cold, warm
 *   - tags (text) — Comma-separated tags
 */
export const crmCreateContact: NodeImplementation = {
  type: 'crm.create_contact',
  category: 'crm',
  displayName: 'Create Contact',
  description: 'Create a new contact record in the CRM.',
  iconName: 'user-plus',
  color: '#10B981',
  outputHandles: [{ id: 'default', label: 'Created', color: '#10B981' }],
  configSchema: [
    {
      key: 'email',
      label: 'Email',
      type: 'text',
      required: true,
    },
    {
      key: 'firstName',
      label: 'First Name',
      type: 'text',
    },
    {
      key: 'lastName',
      label: 'Last Name',
      type: 'text',
    },
    {
      key: 'phone',
      label: 'Phone',
      type: 'text',
    },
    {
      key: 'company',
      label: 'Company',
      type: 'text',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Lead', value: 'lead' },
        { label: 'New', value: 'new' },
        { label: 'Contact', value: 'contact' },
        { label: 'Opportunity', value: 'opportunity' },
        { label: 'Cold', value: 'cold' },
        { label: 'Warm', value: 'warm' },
      ],
    },
    {
      key: 'tags',
      label: 'Tags',
      type: 'text',
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    if (!config.email) {
      throw new Error('Email is required to create a contact.');
    }

    try {
      const workspaceId = (config.workspaceId as string) ?? context.workspaceId;

      const contact = await createContact(workspaceId, {
        email: config.email,
        firstName: config.firstName,
        lastName: config.lastName,
        phone: config.phone,
        company: config.company,
        status: config.status,
      });

      const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email;

      return {
        output: [
          {
            json: {
              contactId: contact.id,
              email: contact.email,
              name,
              ...contact,
            },
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create contact: ${message}`);
    }
  },
};
