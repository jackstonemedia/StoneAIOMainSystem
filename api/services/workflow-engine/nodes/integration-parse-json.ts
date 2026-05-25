'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';

/**
 * Parse JSON node.
 *
 * Parses a JSON string and optionally extracts a nested value using a dot-path.
 *
 * Configuration:
 *   - inputField (text, required) — The JSON string to parse
 *   - path       (text, optional)  — Dot-path like 'data.items[0].email' to extract a nested value
 */
export const integrationParseJson: NodeImplementation = {
  type: 'integration.parse_json',
  category: 'data',
  displayName: 'Parse JSON',
  description: 'Parse a JSON string and optionally extract a nested value using a dot-path.',
  iconName: 'code',
  color: '#A855F7',
  outputHandles: [
    { id: 'default', label: 'Parsed', color: '#A855F7' },
    { id: 'error', label: 'Error', color: '#EF4444' },
  ],
  configSchema: [
    {
      key: 'inputField',
      label: 'JSON Input',
      type: 'text',
      required: true,
    },
    {
      key: 'path',
      label: 'Path (optional)',
      type: 'text',
      description: "Dot-path like 'data.items[0].email' to extract a specific value.",
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], _context: ExecutionContext): Promise<NodeExecuteResult> {
    const inputField = config.inputField as string | undefined;
    const path = config.path as string | undefined;

    if (!inputField) {
      throw new Error('inputField is required — provide the JSON string to parse.');
    }

    // Parse the JSON string
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputField);
    } catch (parseErr) {
      const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
      throw new Error(`Invalid JSON: ${message}`);
    }

    // If a path is provided, extract the nested value
    if (path) {
      parsed = extractByPath(parsed, path);
    }

    return {
      output: [
        {
          json: {
            parsed,
            ...(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : {}),
          },
        },
      ],
    };
  },
};

/**
 * Extract a value from an object using a dot-bracket path.
 * e.g. 'data.items[0].email' → obj.data.items[0].email
 */
function extractByPath(obj: unknown, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Split segment to handle array access like 'items[0]' or 'items[0]'
    const parts = segment.split('[');
    const key = parts[0];

    // Access the property
    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];

    // Handle additional bracket segments for nested arrays like 'key[0][1]'
    for (let i = 1; i < parts.length; i++) {
      const bracket = parts[i];
      const indexStr = bracket.replace(/\].*$/, '');
      const index = parseInt(indexStr, 10);
      if (!isNaN(index) && Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    }
  }

  return current;
}
