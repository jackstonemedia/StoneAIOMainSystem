/**
 * Assistant Memory & Search Service — Stone AIO
 * Spec Section 2.6
 */

import { withTenant } from './rls.js';
import { assistantRepo } from './assistant.repo.js';
import { hasMinimumRole } from './modes.js';
import { tryGetAIClient, DEFAULT_MODEL } from '../../../packages/ai/client.js';
import { db } from '../../../infrastructure/database/client.js';
import { recordUsage, extractUsage } from '../agent/metering.js';
import type { AssistantMemory } from '@prisma/client';

/**
 * The trigger gate for memory extraction: does this message look like a
 * persistent preference, fact, or correction worth one small-model
 * extraction call? Pure, so it is unit-testable and checkable live
 * without a model. The gate decides whether to SPEND the call; the
 * model decides whether anything is actually saved (it returns {} when
 * nothing persistent is expressed).
 *
 * Item 9 correction (2026-11-19): the old gate never fired on
 * "avoid Mondays" — `avoid` was only matched when followed by a verb
 * from a fixed list. Any "avoid X" is a standing rule, and correction
 * language ("actually … instead", "not anymore", "no longer") is now a
 * trigger too, so a correction is extracted at all.
 */
export const MEMORY_TRIGGER_PATTERNS: RegExp[] = [
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
  // Item 9: "avoid X" is a standing rule whatever X is ("avoid Mondays"
  // previously never triggered extraction at all).
  /\bavoid\s+[a-z][a-z-]*\b/i,
  // Item 9: correction language — a statement that revises something
  // said before is exactly the case the stale-memory bug ate.
  /\b(?:actually|instead|change\s+(?:it|that|this)?\s*to|not\s+anymore|no\s+longer|correction|update\s+(?:it|that|this)|scratch\s+that|forget\s+(?:it|that|this))\b/i,
];

export function shouldExtractMemories(message: string): boolean {
  return MEMORY_TRIGGER_PATTERNS.some((pattern) => pattern.test(message));
}

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
   *
   * Item 9 — supersession: `opts.supersedes` lists the keys of existing
   * memories this new fact replaces. The new memory is saved FIRST and
   * the superseded rows are deleted AFTER (in their own tenant call,
   * each guarded), so a failure between the two leaves the old memory
   * in place, never a hole — and a delete failure cannot roll back the
   * save. A key equal to the new memory's own key is skipped (that is
   * the upsert path). Permissions mirror updateMemory: a personal row
   * is superseded only when it belongs to this user; a business row
   * only when userRole is admin — extraction must not bypass the
   * admin-only business-memory rule.
   */
  async saveMemory(
    workspaceId: string,
    userId: string,
    data: { key: string; value: string; category?: string },
    opts: { supersedes?: string[]; userRole?: string } = {},
  ): Promise<AssistantMemory> {
    const category = data.category || 'general';
    const userRole = opts.userRole || 'member';

    const saved = await withTenant(workspaceId, async (tx) => {
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

    const supersedes = [...new Set(opts.supersedes ?? [])].filter((k) => k && k !== data.key);
    for (const key of supersedes) {
      try {
        await withTenant(workspaceId, async (tx) => {
          // Same scope the prompt block feeds the model: this user's
          // personal rows plus business rows — never another user's
          // personal memory, even if it shares the key.
          const target = await tx.assistantMemory.findFirst({
            where: { workspaceId, key, OR: [{ userId }, { category: 'business' }] },
          });
          if (!target) return;
          if (target.category === 'business') {
            if (!hasMinimumRole(userRole, 'admin')) {
              console.log(
                `[AssistantMemory] Skipping supersede of business memory "${key}" — caller is not an admin.`,
              );
              return;
            }
          } else if (target.userId !== userId) {
            return;
          }
          await tx.assistantMemory.delete({ where: { id: target.id } });
          console.log(`[AssistantMemory] Superseded memory: [${key}] replaced by [${data.key}]`);
        });
      } catch (err) {
        console.error(`[AssistantMemory] Failed to supersede memory "${key}" (kept):`, (err as Error)?.message);
      }
    }

    return saved;
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
   *
   * Item 9 — the extractor is shown the user's current memories and
   * returns `supersedes`: the keys of existing memories this statement
   * replaces, contradicts, or restates. Without that, a correction
   * lands as a second row and the prompt block feeds the model both
   * the stale rule and its correction with nothing saying which wins.
   */
  async maybeExtractMemories(
    workspaceId: string,
    userId: string,
    userMessage: string,
    userRole: string = 'member',
  ): Promise<void> {
    const settings = await assistantRepo.getSettings(workspaceId, userId);
    if (!settings.memoryEnabled) return;

    if (!shouldExtractMemories(userMessage)) return;

    const ai = tryGetAIClient();
    if (!ai) return;

    // Item 9: the model can only name what it can see — give it the
    // current memories (same set the prompt block feeds it every turn).
    const existingMemories = await this.listMemories(workspaceId, userId, { scope: 'all' });
    const existingBlock =
      existingMemories.length > 0
        ? `\nExisting memories (do not repeat them; if the user's statement replaces, contradicts, or restates one of them under different wording, list its exact key in "supersedes" — an array of keys, possibly empty. Do not list a memory the new statement merely adds to):\n${existingMemories
            .slice(0, 20)
            .map((m) => `- ${m.key}: ${m.value}`)
            .join('\n')}\n`
        : '';

    const prompt = `You are an assistant memory extractor. Analyze the user statement below and determine if the user is expressing a writing style preference, detail/depth preference (e.g., "Make it more detailed", "keep it concise"), tone guideline (e.g., "Make it sound more human and personal", "don't sound corporate"), formatting rule (e.g., "use bullet points", "never use emojis"), or persistent user/workspace fact.

When a user gives feedback on how they want content drafted, revised, or formatted, extract it as an ongoing preference.
${existingBlock}
If YES, output a single JSON object with:
{
  "key": string (short descriptive title like "Detail Level", "Writing Tone", "Email Style", "Tone Preference", or "Company Name"),
  "value": string (clear, actionable rule or guideline to remember and follow, e.g. "Prefers detailed, comprehensive explanations with thorough depth." or "Prefers a human, personal, and conversational tone when drafting emails and messages."),
  "category": "preference" | "fact" | "instruction",
  "supersedes": string[] (keys of existing memories this statement replaces, contradicts, or restates — [] when it adds a new rule instead)
}

If NO persistent preference or fact is expressed, output {} only.
Return VALID JSON ONLY (no markdown code blocks, no other text):

"${userMessage.replace(/"/g, '\\"')}"`;

    try {
      const res = await ai.models.generateContent({
        model: process.env.ASSISTANT_SMALL_MODEL || DEFAULT_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      const rawText = res.text?.trim() || '';
      // D4: record the extraction call's tokens into the monthly bucket.
      // Never fatal: a recording failure must not change extraction.
      try {
        const usage = extractUsage(res, prompt, rawText);
        await recordUsage(db as any, workspaceId, usage);
        console.log(
          `[AssistantMemory] recorded ${usage.input + usage.output} extraction tokens for workspace ${workspaceId}`,
        );
      } catch (recErr) {
        console.error('[AssistantMemory] Failed to record extraction usage:', (recErr as Error)?.message);
      }
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.key && parsed.value) {
          const supersedes = Array.isArray(parsed.supersedes)
            ? parsed.supersedes.filter((k: unknown): k is string => typeof k === 'string')
            : [];
          await this.saveMemory(
            workspaceId,
            userId,
            {
              key: parsed.key,
              value: parsed.value,
              category: parsed.category || 'preference',
            },
            { supersedes, userRole },
          );
          console.log(`[AssistantMemory] Automatically extracted and saved preference: [${parsed.key}] ${parsed.value}`);
        }
      }
    } catch (err) {
      console.warn('[AssistantMemory] Memory extraction error (ignored):', err);
    }
  }
}

export const memoryService = new AssistantMemoryService();
