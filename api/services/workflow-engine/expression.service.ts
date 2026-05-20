import { ExecutionContext, WorkflowItem } from '../../../src/types/automation.js';
import { randomUUID } from 'crypto';

export class ExpressionService {
  
  resolveConfig(
    config: Record<string, unknown>,
    context: ExecutionContext,
    currentItem?: WorkflowItem
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveExpression(value, context, currentItem);
      } else if (Array.isArray(value)) {
        resolved[key] = value.map(v => 
          typeof v === 'string' ? this.resolveExpression(v, context, currentItem) : 
          (typeof v === 'object' && v !== null ? this.resolveConfig(v as Record<string, unknown>, context, currentItem) : v)
        );
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveConfig(value as Record<string, unknown>, context, currentItem);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  resolveExpression(
    expression: string,
    context: ExecutionContext,
    currentItem?: WorkflowItem
  ): unknown {
    if (!expression || typeof expression !== 'string') return expression;

    // Check if the entire string is exactly one expression: "{{ ... }}"
    const exactMatch = expression.match(/^{{\s*(.*?)\s*}}$/);
    if (exactMatch) {
      return this.evaluateVariable(exactMatch[1], context, currentItem);
    }

    // Replace embedded expressions like "Hello {{ $item.name }}"
    return expression.replace(/{{\s*(.*?)\s*}}/g, (_match, variable) => {
      const val = this.evaluateVariable(variable, context, currentItem);
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  private evaluateVariable(variable: string, context: ExecutionContext, currentItem?: WorkflowItem): unknown {
    const v = variable.trim();
    
    // Built-in variables
    if (v === '$workflow.id') return context.workflowId;
    if (v === '$workspace.id') return context.workspaceId;
    if (v === '$now') return new Date().toISOString();
    if (v === '$today') return new Date().toISOString().split('T')[0];
    if (v === '$uuid') return randomUUID();
    
    // $trigger
    if (v === '$trigger' || v.startsWith('$trigger.')) {
      // We assume trigger node id is always mapped to 'trigger' in runData or we just use triggerData from context
      const tData = context.triggerData;
      if (v === '$trigger') return tData;
      const path = v.substring(9); // remove "$trigger."
      return this.resolvePath(tData, path);
    }

    // $node.NODEID...
    if (v.startsWith('$node.')) {
      const parts = v.split('.');
      const nodeId = parts[1];
      const items = context.runData[nodeId];
      if (!items || items.length === 0) return null;
      
      const firstItem = items[0].json;
      if (parts.length === 2) return firstItem;
      return this.resolvePath(firstItem, parts.slice(2).join('.'));
    }

    // $items.NODEID...
    if (v.startsWith('$items.')) {
      const parts = v.split('.');
      const nodeId = parts[1];
      const items = context.runData[nodeId];
      if (!items) return [];
      
      if (parts.length === 2) return items.map(i => i.json);
      const path = parts.slice(2).join('.');
      return items.map(i => this.resolvePath(i.json, path));
    }

    // $item... (current loop item)
    if (v.startsWith('$item')) {
      if (!currentItem) return null;
      if (v === '$item') return currentItem.json;
      if (v === '$item.index') return currentItem.pairedItem?.item ?? 0;
      return this.resolvePath(currentItem.json, v.substring(6)); // remove "$item."
    }

    // $json.field alias for $item.json.field or just $item.field
    if (v.startsWith('$json.')) {
      if (!currentItem) return null;
      return this.resolvePath(currentItem.json, v.substring(6)); // remove "$json."
    }

    return `[Unknown Variable: ${v}]`;
  }

  private resolvePath(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }
}

export const expressionService = new ExpressionService();
