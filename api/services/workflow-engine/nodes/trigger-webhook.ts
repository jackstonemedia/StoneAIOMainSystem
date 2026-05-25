'use strict';

import type { NodeImplementation, NodeExecuteResult } from './node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';

/**
 * Webhook trigger node.
 *
 * Entry point for webhook-triggered workflows. Passes the incoming
 * trigger data through as its output.
 *
 * Configuration:
 *   - secretPath: Unique path string identifying the webhook endpoint.
 */
export const triggerWebhook: NodeImplementation = {
  type: 'trigger.webhook',
  category: 'trigger',
  displayName: 'Webhook',
  description: 'Trigger workflow execution via an incoming webhook request.',
  iconName: 'globe',
  color: '#3B82F6',
  outputHandles: [{ id: 'default', label: 'Triggered', color: '#3B82F6' }],
  configSchema: [
    {
      key: 'secretPath',
      label: 'Secret Path',
      type: 'text',
      placeholder: 'my-unique-secret-path',
    },
  ] as NodeConfigField[],

  async execute(_config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    return {
      output: [{ json: context.triggerData as Record<string, unknown> }],
    };
  },
};
