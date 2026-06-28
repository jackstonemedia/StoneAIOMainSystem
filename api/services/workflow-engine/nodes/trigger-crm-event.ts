/**
 * trigger.crm_event — CRM event trigger node.
 * Entry point for CRM events (contact created, deal stage changed, etc.).
 */
import { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import { WorkflowItem, ExecutionContext, NodeConfigField } from '../../../../src/types/automation.js';

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
    { key: 'pipelineId', label: 'Pipeline ID', type: 'text', advanced: true,
      placeholder: 'Leave empty to match all pipelines',
      description: 'Only trigger for events in this specific pipeline.' },
    { key: 'stageId', label: 'Stage ID', type: 'text', advanced: true,
      placeholder: 'Leave empty to match all stages',
      description: 'Only trigger for events involving this specific stage.' },
    { key: 'tagName', label: 'Tag Name', type: 'text', advanced: true,
      placeholder: 'Leave empty to match all tags',
      description: 'Only trigger when this specific tag is involved.' },
  ] as NodeConfigField[],
  async execute(_config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    // The trigger emitter sends triggerData structured as:
    //   { event: 'contact.created', entityType: 'contact', eventType: 'created', data: { ...payload } }
    // We preserve this structure so downstream expressions like $trigger.data.email resolve correctly.
    const triggerData = context.triggerData as Record<string, unknown> || {};

    const output: WorkflowItem[] = [{
      json: {
        event: triggerData.event ?? triggerData.eventType ?? 'unknown',
        entityType: triggerData.entityType ?? '',
        eventType: triggerData.eventType ?? '',
        data: triggerData.data ?? triggerData,
        occurredAt: new Date().toISOString(),
      },
    }];

    return { output };
  },
};
