'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { expressionService } from '../expression.service.js';

/**
 * Logic If/Else node.
 *
 * Evaluates conditions and routes workflow execution to one of two paths.
 * Supports AND/OR grouping on an array of individual conditions.
 *
 * Configuration:
 *   - conditionGroup: 'and' | 'or' — how to combine individual conditions
 *   - conditions: Array of { operator, firstValue, secondValue }
 *
 * Conditions:
 *   - TEXT_CONTAINS, TEXT_DOES_NOT_CONTAIN
 *   - TEXT_EXACTLY_MATCHES, TEXT_DOES_NOT_EXACTLY_MATCH
 *   - NUMBER_IS_GREATER_THAN, NUMBER_IS_LESS_THAN, NUMBER_IS_EQUAL_TO
 *   - BOOLEAN_IS_TRUE, BOOLEAN_IS_FALSE
 *   - EXISTS, DOES_NOT_EXIST
 */
export const logicIfElse: NodeImplementation = {
  type: 'logic.if_else',
  category: 'logic',
  displayName: 'If / Else',
  description: 'Evaluate conditions and branch workflow execution.',
  iconName: 'git-branch',
  color: '#F59E0B',
  outputHandles: [
    { id: 'true', label: 'True', color: '#10B981' },
    { id: 'false', label: 'False', color: '#EF4444' },
  ],
  configSchema: [
    {
      key: 'conditionGroup',
      label: 'Condition Group',
      type: 'select',
      default: 'and',
      options: [
        { label: 'AND — all must be true', value: 'and' },
        { label: 'OR — any must be true', value: 'or' },
      ],
    },
    {
      key: 'conditions',
      label: 'Conditions',
      type: 'collection',
      collection: [
        { key: 'operator', label: 'Operator', type: 'select', options: [
          { label: 'Text contains', value: 'TEXT_CONTAINS' },
          { label: 'Text does not contain', value: 'TEXT_DOES_NOT_CONTAIN' },
          { label: 'Text exactly matches', value: 'TEXT_EXACTLY_MATCHES' },
          { label: 'Text does not exactly match', value: 'TEXT_DOES_NOT_EXACTLY_MATCH' },
          { label: 'Number is greater than', value: 'NUMBER_IS_GREATER_THAN' },
          { label: 'Number is less than', value: 'NUMBER_IS_LESS_THAN' },
          { label: 'Number is equal to', value: 'NUMBER_IS_EQUAL_TO' },
          { label: 'Boolean is true', value: 'BOOLEAN_IS_TRUE' },
          { label: 'Boolean is false', value: 'BOOLEAN_IS_FALSE' },
          { label: 'Exists', value: 'EXISTS' },
          { label: 'Does not exist', value: 'DOES_NOT_EXIST' },
        ]},
        { key: 'firstValue', label: 'First Value', type: 'expression' },
        { key: 'secondValue', label: 'Second Value', type: 'expression' },
      ],
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const conditions = (config.conditions as Array<Record<string, unknown>>) ?? [];
    const conditionGroup = (config.conditionGroup as string) ?? 'and';

    // If there are no conditions, default to true (pass-through)
    if (conditions.length === 0) {
      return { output: items, branches: { true: items } };
    }

    let result: boolean;
    if (conditionGroup === 'and') {
      result = conditions.every(cond => evaluateCondition(cond));
    } else {
      result = conditions.some(cond => evaluateCondition(cond));
    }

    const branch = result ? 'true' : 'false';

    return {
      output: items,
      branches: { [branch]: items },
    };

    function evaluateCondition(cond: Record<string, unknown>): boolean {
      const operator = (cond.operator as string) ?? 'TEXT_EXACTLY_MATCHES';
      const firstVal = cond.firstValue as string | undefined;
      const secondVal = cond.secondValue as string | undefined;

      // For EXISTS / DOES_NOT_EXIST, just check if firstVal is defined/non-empty
      if (operator === 'EXISTS') return firstVal !== undefined && firstVal !== null && firstVal !== '';
      if (operator === 'DOES_NOT_EXIST') return firstVal === undefined || firstVal === null || firstVal === '';

      // For BOOLEAN operators, coerce to boolean
      if (operator === 'BOOLEAN_IS_TRUE') return firstVal === true || firstVal === 'true';
      if (operator === 'BOOLEAN_IS_FALSE') return firstVal === false || firstVal === 'false';

      // For NUMBER operators, coerce to numbers
      if (operator.startsWith('NUMBER_')) {
        const a = typeof firstVal === 'number' ? firstVal : Number(firstVal);
        const b = typeof secondVal === 'number' ? secondVal : Number(secondVal);
        if (operator === 'NUMBER_IS_GREATER_THAN') return a > b;
        if (operator === 'NUMBER_IS_LESS_THAN') return a < b;
        if (operator === 'NUMBER_IS_EQUAL_TO') return a === b;
      }

      // TEXT operators (default)
      const strA = String(firstVal ?? '').toLowerCase();
      const strB = String(secondVal ?? '').toLowerCase();
      if (operator === 'TEXT_CONTAINS') return strA.includes(strB);
      if (operator === 'TEXT_DOES_NOT_CONTAIN') return !strA.includes(strB);
      if (operator === 'TEXT_EXACTLY_MATCHES') return strA === strB;
      if (operator === 'TEXT_DOES_NOT_EXACTLY_MATCH') return strA !== strB;

      return false;
    }
  },
};
