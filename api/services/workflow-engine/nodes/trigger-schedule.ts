/**
 * trigger.schedule — Cron schedule trigger node.
 * Entry point for time-based workflow execution.
 */
import { NodeImplementation, NodeExecuteResult } from './node-runner.js';
import { WorkflowItem, ExecutionContext, NodeConfigField } from '../../../src/types/automation.js';

export const triggerSchedule: NodeImplementation = {
  type: 'trigger.schedule',
  category: 'trigger',
  displayName: 'Schedule',
  description: 'Run workflow on a recurring schedule (cron expression)',
  iconName: 'clock',
  color: '#10B981',
  outputHandles: [{ id: 'default', label: 'Triggered', color: '#10B981' }],
  configSchema: [
    { key: 'cronExpression', label: 'Cron Expression', type: 'text', required: true, placeholder: '0 9 * * *' },
    { key: 'timezone', label: 'Timezone', type: 'select', default: 'UTC', options: [
      { label: 'UTC', value: 'UTC' },
      { label: 'US Eastern', value: 'America/New_York' },
      { label: 'US Pacific', value: 'America/Los_Angeles' },
      { label: 'US Central', value: 'America/Chicago' },
      { label: 'Europe/London', value: 'Europe/London' },
    ]},
  ] as NodeConfigField[],
  async execute(_config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const output = [{ json: { triggeredAt: new Date().toISOString(), workflowId: context.workflowId, runId: context.runId } }];
    return { output };
  },
};
