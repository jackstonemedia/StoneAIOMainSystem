'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { db } from '../../../infrastructure/database/client.js';

/**
 * Logic Wait / Delay node.
 *
 * Pauses workflow execution for a specified duration.
 * The engine's built-in pause/resume system handles the actual delay:
 * - Sets workflowRun status = 'PAUSED'
 * - Sets resumeAt = now + durationMs
 * - Sets waitingNodeId = this node's id
 * - The server's 60-second interval checks for paused runs and resumes them
 *
 * Configuration:
 *   - waitUnit: 'seconds' | 'minutes' | 'hours' | 'days'
 *   - waitAmount: positive number
 */
export const logicWait: NodeImplementation = {
  type: 'logic.wait',
  category: 'logic',
  displayName: 'Wait / Delay',
  description: 'Pause workflow execution for a specified duration.',
  iconName: 'pause-circle',
  color: '#F97316',
  outputHandles: [{ id: 'default', label: 'Resumed', color: '#F97316' }],
  configSchema: [
    {
      key: 'waitUnit',
      label: 'Wait Unit',
      type: 'select',
      default: 'minutes',
      options: [
        { label: 'Seconds', value: 'seconds' },
        { label: 'Minutes', value: 'minutes' },
        { label: 'Hours', value: 'hours' },
        { label: 'Days', value: 'days' },
      ],
    },
    {
      key: 'waitAmount',
      label: 'Wait Amount',
      type: 'number',
      required: true,
      default: 5,
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const waitUnit = (config.waitUnit as string) ?? 'minutes';
    const waitAmount = Number(config.waitAmount) || 5;

    // Convert to milliseconds
    const multipliers: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
    const durationMs = waitAmount * (multipliers[waitUnit] ?? 60000);

    // Cap at 30 days max (safety)
    const maxMs = 30 * 86400000;
    if (durationMs > maxMs) {
      throw new Error(`Wait duration of ${waitAmount} ${waitUnit} exceeds maximum of 30 days`);
    }

    // Set the run to PAUSED with resumeAt.
    // The engine detects PAUSED status after this node completes and sets
    // waitingNodeId to the current node's id (in executeNodeRecursive).
    await db.workflowRun.update({
      where: { id: context.runId },
      data: {
        status: 'PAUSED',
        resumeAt: new Date(Date.now() + durationMs),
      },
    });

    return { output: items };
  },
};
