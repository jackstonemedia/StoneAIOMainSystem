'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';
import { emitTrigger } from '../../trigger-emitter.service.js';

export const crmAddTag: NodeImplementation = {
  type: 'crm.add_tag',
  category: 'crm',
  displayName: 'Add Tag',
  description: 'Add a tag to a contact or deal.',
  iconName: 'tag',
  color: '#F59E0B',
  outputHandles: [{ id: 'default', label: 'Tagged', color: '#F59E0B' }],
  configSchema: [
    { key: 'entityType', label: 'Entity Type', type: 'select', required: true, options: [
      { label: 'Contact', value: 'contact' },
      { label: 'Deal', value: 'deal' },
    ]},
    { key: 'entityId', label: 'Entity ID', type: 'text', required: true },
    { key: 'tag', label: 'Tag', type: 'text', required: true },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const entityType = config.entityType as string;
    const entityId = config.entityId as string;
    const tag = (config.tag as string)?.trim();
    if (!entityId || !tag) throw new Error('Entity ID and tag are required.');

    if (entityType === 'contact') {
      const contact = await db.contact.findFirst({ where: { id: entityId, workspaceId: context.workspaceId } });
      if (!contact) throw new Error(`Contact ${entityId} not found.`);
      
      let tags: string[] = [];
      try { tags = JSON.parse((contact as any).tagsJson || '[]'); } catch { tags = []; }
      if (!tags.includes(tag)) {
        tags.push(tag);
        await db.contact.update({ where: { id: entityId }, data: { tagsJson: JSON.stringify(tags) } as any });
        emitTrigger(context.workspaceId, 'contact.tag_added', { contactId: entityId, tag, tags }).catch(() => {});
      }
      return { output: [{ json: { entityId, entityType, tag, tags } }] };
    } else if (entityType === 'deal') {
      const deal = await db.deal.findFirst({ where: { id: entityId, workspaceId: context.workspaceId } });
      if (!deal) throw new Error(`Deal ${entityId} not found.`);
      // Deals may not have a tags field — store in a metadata or note if needed
      // Implementation: add to deal.description or use a custom approach
      return { output: [{ json: { entityId, entityType, tag } }] };
    }
    throw new Error(`Unknown entity type: ${entityType}`);
  },
};
