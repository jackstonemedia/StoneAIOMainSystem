/**
 * Tool Registry — Stone AIO Assistant
 * Spec Section 2.8 & 2.10
 */

import { crmTools } from './crm.tools.js';
import { communicationTools } from './communication.tools.js';
import { calendarTools } from './calendar.tools.js';
import { workflowTools } from './workflow.tools.js';
import { campaignTools } from './campaign.tools.js';
import { webSearchTools } from './web-search.tools.js';
import { findersTools } from './finders.tools.js';
import { platformTools } from './platform.tools.js';
import { sanitizeSecrets } from './sanitizer.js';
import type { ToolContext, ToolDefinition, ToolExecutionResult } from './types.js';

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerAll(crmTools);
    this.registerAll(communicationTools);
    this.registerAll(calendarTools);
    this.registerAll(workflowTools);
    this.registerAll(campaignTools);
    this.registerAll(webSearchTools);
    this.registerAll(findersTools);
    this.registerAll(platformTools);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Transforms tools into Google GenAI FunctionDeclarations format.
   */
  getGeminiFunctionDeclarations(): Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }> {
    return this.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: this.formatParameters(t.parameters),
    }));
  }

  private formatParameters(schema: Record<string, any>): Record<string, unknown> {
    if (!schema) return { type: 'OBJECT', properties: {} };

    const type = (schema.type || 'object').toUpperCase();
    const formatted: Record<string, unknown> = {
      type: type === 'OBJECT' ? 'OBJECT' : type,
      properties: {},
    };

    if (schema.description) {
      formatted.description = schema.description;
    }

    if (schema.required && Array.isArray(schema.required)) {
      formatted.required = schema.required;
    }

    if (schema.properties) {
      const properties: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(schema.properties as Record<string, any>)) {
        properties[key] = {
          type: (val.type || 'string').toUpperCase(),
          description: val.description,
          ...(val.enum ? { enum: val.enum } : {}),
          ...(val.items ? { items: { type: (val.items.type || 'string').toUpperCase() } } : {}),
        };
      }
      formatted.properties = properties;
    }

    return formatted;
  }

  /**
   * Executes a tool with context, applying secret stripping on input and output.
   */
  async execute(name: string, rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolName: name,
        args: rawArgs,
        error: `Tool "${name}" is not registered.`,
      };
    }

    // 1. Sanitize incoming arguments
    const sanitizedArgs = sanitizeSecrets(rawArgs);

    try {
      // 2. Execute handler
      const rawResult = await tool.execute(sanitizedArgs, ctx);

      // 3. Sanitize output data
      const sanitizedResult = sanitizeSecrets(rawResult);

      return {
        toolName: name,
        args: sanitizedArgs,
        result: sanitizedResult,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        toolName: name,
        args: sanitizedArgs,
        error: message,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
