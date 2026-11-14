/**
 * Memory Tools — Stone AIO Assistant
 * Spec Section 2.6 & 2.8
 */

import { memoryService } from '../memory.service.js';
import type { ToolDefinition } from './types.js';

export const memoryTools: ToolDefinition[] = [
  {
    name: 'save_memory_preference',
    description:
      'Save a persistent user preference, writing style guideline, tone rule, or fact to the assistant memory so it is remembered and applied across all future chats.',
    // risk 'write', NOT 'read': this tool upserts a row in AssistantMemory.
    // The mode gate executes 'read' tools in ALL modes (even read-only and
    // paused), so labeling this 'read' would let the assistant write
    // memories in Read-only mode. 'write' blocks it in read-only, queues
    // it as a proposal in draft mode, and executes it in full mode.
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Short title for the preference or rule (e.g., "Writing Tone", "Email Format", "Company Info").',
        },
        value: {
          type: 'string',
          description:
            'The clear guideline or preference to remember (e.g., "Prefers a human, personal, and conversational tone rather than corporate jargon").',
        },
        category: {
          type: 'string',
          description: 'Category for the memory note: "preference", "fact", or "instruction". Defaults to "preference".',
          enum: ['preference', 'fact', 'instruction'],
        },
      },
      required: ['key', 'value'],
    },
    execute: async (args: { key: string; value: string; category?: string }, ctx) => {
      const saved = await memoryService.saveMemory(ctx.workspaceId, ctx.userId, {
        key: args.key,
        value: args.value,
        category: args.category || 'preference',
      });
      return {
        success: true,
        savedKey: saved.key,
        savedValue: saved.value,
        message: `Saved "${saved.key}" to assistant memory. This will be automatically applied to future responses.`,
      };
    },
  },
  {
    name: 'list_user_memories',
    description: 'Retrieve the saved memories, preferences, and style guidelines currently stored for this user and workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args: Record<string, never>, ctx) => {
      const memories = await memoryService.listMemories(ctx.workspaceId, ctx.userId, { scope: 'all' });
      return {
        memories: memories.map((m) => ({
          key: m.key,
          value: m.value,
          category: m.category,
          updatedAt: m.updatedAt,
        })),
      };
    },
  },
];
