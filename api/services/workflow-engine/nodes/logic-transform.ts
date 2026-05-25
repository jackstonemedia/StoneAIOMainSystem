'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { expressionService } from '../expression.service.js';

/**
 * Logic Transform node.
 *
 * Maps each input item to a new set of fields by evaluating expression templates.
 * Uses the engine's expressionService to resolve {{ $json.field }}, {{ $node.ID.output }}, etc.
 *
 * Configuration:
 *   - outputFields: Array of { key: field name, value: expression template }
 *
 * Example:
 *   outputFields: [
 *     { key: 'fullName', value: '{{ $json.firstName }} {{ $json.lastName }}' },
 *     { key: 'email', value: '{{ $json.email }}' },
 *   ]
 */
export const logicTransform: NodeImplementation = {
  type: 'logic.transform',
  category: 'logic',
  displayName: 'Transform Data',
  description: 'Map and transform input items into a new data structure.',
  iconName: 'shuffle',
  color: '#A855F7',
  outputHandles: [{ id: 'default', label: 'Transformed', color: '#A855F7' }],
  configSchema: [
    {
      key: 'outputFields',
      label: 'Output Fields',
      type: 'collection',
      collection: [
        { key: 'field', label: 'Field Name', type: 'text', required: true, placeholder: 'fullName' },
        { key: 'value', label: 'Value Expression', type: 'text', required: true, placeholder: '{{ $json.firstName }} {{ $json.lastName }}' },
      ],
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const outputFields = (config.outputFields as Array<{ field: string; value: string }>) ?? [];

    // If there are no output fields defined, just pass input through
    if (outputFields.length === 0 || items.length === 0) {
      return { output: items };
    }

    const output: WorkflowItem[] = items.map((item) => {
      const transformed: Record<string, unknown> = {};
      for (const { field, value } of outputFields) {
        // Resolve the expression template for each item individually
        const resolved = expressionService.resolveExpression(value, context, item);
        transformed[field] = resolved;
      }
      return { json: transformed };
    });

    return { output };
  },
};
