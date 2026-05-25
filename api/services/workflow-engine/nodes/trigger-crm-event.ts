/**
 * trigger.crm_event — CRM event trigger node.
 * Entry point for CRM events (contact created, deal stage changed, etc.).
 */
import { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import { WorkflowItem, ExecutionContext, NodeConfigField } from '../../../src/types/automation.js';

export const triggerCrmEvent: NodeImplementation = {
  type: 'trigger.crm_event',
  category: 'trigger',
  displayName: 'CRM Event',
  description: 'Run workflow when a CRM event occurs (contact created, deal updated, etc.)',
  iconName: 'zap',
  color: '#8B5CF6',
  outputHandles: [{ id: 'default', label: 'Event', color: '#8B5CF6' }],
  configSchema: [
    { key: 'eventType', label: 'Event Type', type: 'select', required: true, options: [
      { label: 'Contact Created', value: 'contact.created' },
      { label: 'Contact Updated', value: 'contact.updated' },
      { label: 'Contact Deleted', value: 'contact.deleted' },
      { label: 'Deal Created', value: 'deal.created' },
      { label: 'Deal Stage Changed', value: 'deal.stage_changed' },
      { label: 'Deal Won', value: 'deal.won' },
      { label: 'Deal Lost', value: 'deal.lost' },
      { label: 'Form Submitted', value: 'form.submitted' },
      { label: 'Appointment Booked', value: 'appointment.booked' },
      { label: 'Review Received', value: 'review.received' },
    ]},
  ] as NodeConfigField[],
  async execute(_config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const triggerData = context.triggerData as Record<string, unknown> || {};
    const output = [{ json: { ...triggerData, eventType: triggerData.eventType || 'unknown', occurredAt: new Date().toISOString() } }];
    return { output };
  },
};
