/**
 * Assistant Memory & Search Service — Stone AIO
 * Spec Section 2.6
 */

import { withTenant } from './rls.js';
import { assistantRepo } from './assistant.repo.js';
import { hasMinimumRole } from './modes.js';
import { tryGetAIClient, DEFAULT_MODEL } from '../../../packages/ai/client.js';
import type { AssistantMemory } from '@prisma/client';

export class AssistantMemoryService {
  /**
   * List stored memories for a user or workspace.
   */
  async listMemories(
    workspaceId: string,
    userId: string,
    options: { scope?: 'personal' | 'business' | 'all' } = {}
  ): Promise<AssistantMemory[]> {
    const scope = options.scope || 'all';

    return await withTenant(workspaceId, async (tx) => {
      let whereClause: any = { workspaceId };

      if (scope === 'business') {
        whereClause.category = 'business';
      } else if (scope === 'personal') {
        whereClause.userId = userId;
        whereClause.category = { not: 'business' };
      } else {
        whereClause = {
          workspaceId,
          OR: [{ userId }, { category: 'business' }],
        };
      }

      return await tx.assistantMemory.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
      });
    });
  }

  /**
   * Save or update a memory fact.
   */
  async saveMemory(
    workspaceId: string,
    userId: string,
    data: { key: string; value: string; category?: string }
  ): Promise<AssistantMemory> {
    const category = data.category || 'general';

    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantMemory.findFirst({
        where: {
          workspaceId,
          ...(category === 'business' ? { category: 'business' } : { userId }),
          key: data.key,
        },
      });

      if (existing) {
        return await tx.assistantMemory.update({
          where: { id: existing.id },
          data: {
            value: data.value,
            category,
          },
        });
      }

      return await tx.assistantMemory.create({
        data: {
          workspaceId,
          userId,
          key: data.key,
          value: data.value,
          category,
        },
      });
    });
  }

  /**
   * Update an existing memory item with permission checks.
   */
  async updateMemory(
    workspaceId: string,
    userId: string,
    userRole: string,
    id: string,
    data: { key?: string; value?: string; category?: string }
  ): Promise<AssistantMemory> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantMemory.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new Error('Memory note not found.');
      }

      if (existing.category === 'business') {
        if (!hasMinimumRole(userRole, 'admin')) {
          throw new Error('Insufficient permissions. Only workspace admins can modify Business memory notes.');
        }
      } else if (existing.userId !== userId) {
        throw new Error('Insufficient permissions. You can only modify your own personal memory notes.');
      }

      return await tx.assistantMemory.update({
        where: { id },
        data: {
          ...(data.key !== undefined ? { key: data.key } : {}),
          ...(data.value !== undefined ? { value: data.value } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
        },
      });
    });
  }

  /**
   * Delete a memory item with permission checks.
   */
  async deleteMemory(
    workspaceId: string,
    userId: string,
    id: string,
    userRole: string = 'member'
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantMemory.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) return false;

      if (existing.category === 'business') {
        if (!hasMinimumRole(userRole, 'admin')) {
          throw new Error('Insufficient permissions. Only workspace admins can delete Business memory notes.');
        }
      } else if (existing.userId !== userId) {
        throw new Error('Insufficient permissions. You can only delete your own personal memory notes.');
      }

      await tx.assistantMemory.delete({ where: { id } });
      return true;
    });
  }

  /**
   * Clear memories with permission checks.
   */
  async clearAllMemories(
    workspaceId: string,
    userId: string,
    scope: 'personal' | 'business' = 'personal',
    userRole: string = 'member'
  ): Promise<number> {
    if (scope === 'business' && !hasMinimumRole(userRole, 'admin')) {
      throw new Error('Insufficient permissions. Only workspace admins can reset Business memory.');
    }

    return await withTenant(workspaceId, async (tx) => {
      const whereClause =
        scope === 'business'
          ? { workspaceId, category: 'business' }
          : { workspaceId, userId, category: { not: 'business' } };

      const res = await tx.assistantMemory.deleteMany({
        where: whereClause,
      });
      return res.count;
    });
  }

  /**
   * Search past chats across all caller's conversations.
   */
  async searchPastChats(
    workspaceId: string,
    userId: string,
    query: string,
    limit = 10
  ): Promise<Array<{ conversationId: string; messageId: string; text: string; createdAt: Date }>> {
    if (!query.trim()) return [];

    return await withTenant(workspaceId, async (tx) => {
      const messages = await tx.assistantMessage.findMany({
        where: {
          workspaceId,
          userId,
          searchableText: {
            contains: query,
            mode: 'insensitive',
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          conversationId: true,
          searchableText: true,
          createdAt: true,
        },
      });

      return messages.map((m) => ({
        conversationId: m.conversationId,
        messageId: m.id,
        text: m.searchableText || '',
        createdAt: m.createdAt,
      }));
    });
  }

  /**
   * Formats stored memories into a prompt block for the AI model.
   */
  async getMemoriesPromptBlock(workspaceId: string, userId: string): Promise<string> {
    const settings = await assistantRepo.getSettings(workspaceId, userId);
    if (!settings.memoryEnabled) {
      return '';
    }

    const memories = await this.listMemories(workspaceId, userId, { scope: 'all' });
    if (memories.length === 0) {
      return '';
    }

    const lines = memories.map((m) =>
      m.category === 'business'
        ? `- [Business Fact] ${m.key}: ${m.value}`
        : `- [User Preference] ${m.key}: ${m.value}`
    );
    return `\nUser & Workspace Facts (Recall from memory):\n${lines.join('\n')}\n`;
  }

  /**
   * Extracts user preferences or facts from a conversation exchange using a small model.
   */
  async maybeExtractMemories(
    workspaceId: string,
    userId: string,
    userMessage: string
  ): Promise<void> {
    const settings = await assistantRepo.getSettings(workspaceId, userId);
    if (!settings.memoryEnabled) return;

    // Detect user preferences, style feedback, tone rules, or persistent facts
    const preferencePatterns = [
      /\b(?:remember|keep in mind|note that|learn that|from now on|in the future|save this)\b/i,
      /\b(?:i prefer|i like|i dislike|my preference|prefer to|i want you to|i'd prefer|i would prefer)\b/i,
      /\b(?:always|never|don't|do not|stop|avoid)\s+(?:use|write|say|sound|add|include|put|be|give|send)\b/i,
      /\b(?:make\s+(?:it|this|them|emails?|messages?|responses?)|sound|write|draft|keep\s+(?:it|this)|be)\s+(?:more|less)\s+[a-z-]+/i,
      /\b(?:make\s+(?:it|this|them|emails?|messages?|responses?)|keep\s+(?:it|this)|be)\s+(?:simpler|shorter|longer|clearer|warmer|cleaner|punchier|briefer|crisper|softer|bolder)\b/i,
      /\b(?:more|less)\s+(?:detailed|detail|depth|context|examples?|wordy|verbose|fluff|jargon|human|personal|conversational|casual|professional|concise|friendly|punchy|formal|direct|brief)\b/i,
      /\b(?:add|include|give)\s+(?:more|some)?\s*(?:details?|depth|context|examples?|bullet\s*points?|bullets?|steps?)\b/i,
      /\b(?:bullet\s*points?|numbered\s*lists?|headings?|formatting)\b/i,
      /\b(?:my name is|our company is|our product is|call me|i am the|my role is|we are a|i work at)\b/i,
      /\b(?:writing style|my tone|tone of voice|sound like me|my voice)\b/i,
      /\b(?:no emojis?|without emojis?|never use emojis?|stop using emojis?|don't use emojis?)\b/i,
    ];

    const hasTrigger = preferencePatterns.some((pattern) => pattern.test(userMessage));
    if (!hasTrigger) return;

    const ai = tryGetAIClient();
    if (!ai) return;

    try {
      const res = await ai.models.generateContent({
        model: process.env.ASSISTANT_SMALL_MODEL || DEFAULT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an assistant memory extractor. Analyze the user statement below and determine if the user is expressing a writing style preference, detail/depth preference (e.g., "Make it more detailed", "keep it concise"), tone guideline (e.g., "Make it sound more human and personal", "don't sound corporate"), formatting rule (e.g., "use bullet points", "never use emojis"), or persistent user/workspace fact.

When a user gives feedback on how they want content drafted, revised, or formatted, extract it as an ongoing preference.

If YES, output a single JSON object with:
{
  "key": string (short descriptive title like "Detail Level", "Writing Tone", "Email Style", "Tone Preference", or "Company Name"),
  "value": string (clear, actionable rule or guideline to remember and follow, e.g. "Prefers detailed, comprehensive explanations with thorough depth." or "Prefers a human, personal, and conversational tone when drafting emails and messages."),
  "category": "preference" | "fact" | "instruction"
}

If NO persistent preference or fact is expressed, output {} only.
Return VALID JSON ONLY (no markdown code blocks, no other text):

"${userMessage.replace(/"/g, '\\"')}"`,
              },
            ],
          },
        ],
      });

      const rawText = res.text?.trim() || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.key && parsed.value) {
          await this.saveMemory(workspaceId, userId, {
            key: parsed.key,
            value: parsed.value,
            category: parsed.category || 'preference',
          });
          console.log(`[AssistantMemory] Automatically extracted and saved preference: [${parsed.key}] ${parsed.value}`);
        }
      }
    } catch (err) {
      console.warn('[AssistantMemory] Memory extraction error (ignored):', err);
    }
  }
}

export const memoryService = new AssistantMemoryService();
