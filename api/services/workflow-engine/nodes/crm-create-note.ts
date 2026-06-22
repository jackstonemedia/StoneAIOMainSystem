'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';

export const crmCreateNote: NodeImplementation = {
  type: 'crm.create_note',
  category: 'crm',
  displayName: 'Create Note',
  description: 'Create a note or activity log on a contact.',
  iconName: 'file-text',
  color: '#64748B',
  outputHandles: [{ id: 'default', label: 'Created', color: '#64748B' }],
  configSchema: [
    { key: 'contactId', label: 'Contact ID', type: 'text' },
    { key: 'content', label: 'Note Content', type: 'textarea', required: true },
    { key: 'type', label: 'Type', type: 'select', options: [
      { label: 'Note', value: 'note' },
      { label: 'Call', value: 'call' },
      { label: 'Email', value: 'email' },
      { label: 'Meeting', value: 'meeting' },
    ]},
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const content = config.content as string;
    if (!content) throw new Error('Note content is required.');
    const contactId = config.contactId as string | undefined;
    const type = (config.type as string) || 'note';

    const event = await db.contactEvent.create({
      data: {
        contactId: contactId || undefined,
        type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        content,
        metadataJson: JSON.stringify({ createdByWorkflow: context.workflowId }),
      } as any,
    });

    return { output: [{ json: { eventId: event.id, contactId, type, content } }] };
  },
};
