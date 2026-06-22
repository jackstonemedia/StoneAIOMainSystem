'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';

export const crmRemoveTag: NodeImplementation = {
  type: 'crm.remove_tag',
  category: 'crm',
  displayName: 'Remove Tag',
  description: 'Remove a tag from a contact.',
  iconName: 'tag',
  color: '#EF4444',
  outputHandles: [{ id: 'default', label: 'Done', color: '#EF4444' }],
  configSchema: [
    { key: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [
      { label: 'Contact', value: 'contact' },
    ]},
    { key: 'entityId', label: 'Entity ID', type: 'text', required: true },
    { key: 'tag', label: 'Tag to Remove', type: 'text', required: true },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const entityId = config.entityId as string;
    const tag = (config.tag as string)?.trim();
    if (!entityId || !tag) throw new Error('Entity ID and tag are required.');

    const contact = await db.contact.findFirst({ where: { id: entityId, workspaceId: context.workspaceId } });
    if (!contact) throw new Error(`Contact ${entityId} not found.`);

    let tags: string[] = [];
    try { tags = JSON.parse((contact as any).tagsJson || '[]'); } catch { tags = []; }
    const filtered = tags.filter((t: string) => t !== tag);
    await db.contact.update({ where: { id: entityId }, data: { tagsJson: JSON.stringify(filtered) } as any });

    return { output: [{ json: { entityId, tag, tags: filtered } }] };
  },
};
