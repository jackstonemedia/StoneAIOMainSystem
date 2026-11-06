/**
 * Tool Registry Types — Stone AIO Assistant
 * Spec Section 2.8 & 2.9
 */

import type { ToolRisk } from '../modes.js';

export interface ToolContext {
  workspaceId: string;
  userId: string;
  userRole: string;
  userName?: string;
  conversationId?: string;
}

export interface ToolParameterSchema {
  type: string;
  description?: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: Record<string, unknown>;
  }>;
  required?: string[];
}

export interface ToolDefinition<TArgs = any, TResult = any> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  risk: ToolRisk;
  minimumRole: 'owner' | 'admin' | 'member';
  capability?: string;
  isUntrustedContentSource?: boolean;
  requiresExplicitApproval?: boolean;
  affectedRecordsCount?: (args: TArgs) => number;
  execute: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}

export interface ToolExecutionResult {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}
