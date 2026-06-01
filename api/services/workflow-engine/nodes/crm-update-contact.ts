'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { updateContact } from '../../crm.service.js';

/**
 * CRM Update Contact node.
 *
 * Updates an existing contact record in the CRM system with the provided fields.
 * Only specified fields are updated — omitted fields remain unchanged.
 *
 * Configuration:
 *   - contactId (expression/text, required) — ID of the contact to update
 *   - firstName (text) — Contact first name
 *   - lastName (text) — Contact last name
 *   - phone (text) — Contact phone number
 *   - company (text) — Associated company / business name
 *   - status (select) — Contact status (lead/new/contact/opportunity/cold/warm)
 *   - tags (text) — Comma-separated tags
 */
export const crmUpdateContact: NodeImplementation = {
  type: 'crm.update_contact',
  category: 'crm',
  displayName: 'Update Contact',
  description: 'Update an existing contact record in the CRM.',
  iconName: 'user-edit',
  color: '#3B82F6',
  outputHandles: [{ id: 'default', label: 'Updated', color: '#3B82F6' }],
  configSchema: [
    {
      key: 'contactId',
      label: 'Contact ID',
      type: 'expression',
      required: true,
      placeholder: '{{ $json.contactId }}',
      description: 'The ID of the contact to update. Supports expressions.',
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
    const contactId = config.contactId as string | undefined;

    if (!contactId) {
      throw new Error('Contact ID is required to update a contact.');
    }

    try {
      const contact = await updateContact(contactId, context.workspaceId, {
        firstName: config.firstName,
        lastName: config.lastName,
        phone: config.phone,
        company: config.company,
        status: config.status,
        tags: config.tags,
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
      throw new Error(`Failed to update contact: ${message}`);
    }
  },
};
