/**
 * Stage S4: Memory, Search & Thinking Toggle Tests
 * Spec Section 2.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FixtureMemory {
  id: string;
  workspaceId: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FixtureMessage {
  id: string;
  workspaceId: string;
  conversationId: string;
  userId: string;
  searchableText: string;
  createdAt: Date;
}

const mockMemories: Record<string, FixtureMemory> = {};
const mockMessages: Record<string, FixtureMessage> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantMemory: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockMemories).filter((m) => {
                if (where.workspaceId && m.workspaceId !== where.workspaceId) return false;
                if (where.OR) {
                  return where.OR.some((cond: any) => {
                    if (cond.userId && m.userId === cond.userId) return true;
                    if (cond.category && m.category === cond.category) return true;
                    return false;
                  });
                }
                if (where.userId && m.userId !== where.userId) return false;
                if (where.category && typeof where.category === 'string' && m.category !== where.category) return false;
                return true;
              })
            );
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockMemories).find((m) => {
                if (where.id && m.id !== where.id) return false;
                if (where.workspaceId && m.workspaceId !== where.workspaceId) return false;
                if (where.userId && m.userId !== where.userId) return false;
                if (where.key && m.key !== where.key) return false;
                return true;
              }) || null
            );
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item: FixtureMemory = {
              id,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockMemories[id] = item;
            return Promise.resolve(item);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockMemories[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Memory not found'));
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockMemories[where.id];
            return Promise.resolve({ id: where.id });
          }),
          deleteMany: vi.fn().mockImplementation(({ where }) => {
            let count = 0;
            for (const [id, m] of Object.entries(mockMemories)) {
              if (where.workspaceId && m.workspaceId !== where.workspaceId) continue;
              if (where.userId && m.userId !== where.userId) continue;
              if (where.category === 'business' && m.category !== 'business') continue;
              delete mockMemories[id];
              count++;
            }
            return Promise.resolve({ count });
          }),
        },
        assistantSettings: {
          findFirst: vi.fn().mockResolvedValue({
            workspaceId: 'ws1',
            userId: 'user1',
            memoryEnabled: true,
            pastChatSearch: true,
          }),
          findUnique: vi.fn().mockResolvedValue({
            workspaceId: 'ws1',
            userId: 'user1',
            memoryEnabled: true,
            pastChatSearch: true,
          }),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, memoryEnabled: true })),
        },
        assistantMessage: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            const query = where.searchableText?.contains?.toLowerCase() || '';
            return Promise.resolve(
              Object.values(mockMessages).filter((m) => {
                if (m.workspaceId !== where.workspaceId) return false;
                if (m.userId !== where.userId) return false;
                if (query && !m.searchableText.toLowerCase().includes(query)) return false;
                return true;
              })
            );
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item = { id, ...data, createdAt: new Date() };
            mockMessages[id] = item;
            return Promise.resolve(item);
          }),
        },
      };

      return callback(txMock);
    }),
  },
}));

vi.mock('../../packages/ai/client.js', () => ({
  DEFAULT_MODEL: 'gemini-3.8-flash',
  tryGetAIClient: vi.fn().mockReturnValue({
    models: {
      generateContent: vi.fn().mockImplementation(async ({ contents }) => {
        const promptText = contents?.[0]?.parts?.[0]?.text || '';
        const lastLine = promptText.trim().split('\n').pop() || '';
        if (lastLine.includes('Make it more detailed')) {
          return {
            text: JSON.stringify({
              key: 'Detail Level',
              value: 'Prefers detailed, comprehensive explanations with thorough depth.',
              category: 'preference',
            }),
          };
        }
        if (lastLine.includes('Make it sound more human and personal')) {
          return {
            text: JSON.stringify({
              key: 'Writing Tone',
              value: 'Prefers a human, personal, and conversational tone when drafting emails.',
              category: 'preference',
            }),
          };
        }
        return { text: '{}' };
      }),
    },
  }),
}));

import { memoryService } from '../services/assistant/memory.service.js';

describe('Assistant Memory Service', () => {
  const ws1 = 'ws-mem-1';
  const ws2 = 'ws-mem-2';
  const user1 = 'u-mem-1';
  const user2 = 'u-mem-2';

  beforeEach(() => {
    for (const key of Object.keys(mockMemories)) delete mockMemories[key];
    for (const key of Object.keys(mockMessages)) delete mockMessages[key];
  });

  it('saves and lists user memories scoped to workspace and user', async () => {
    const mem1 = await memoryService.saveMemory(ws1, user1, {
      key: 'product_name',
      value: 'Antigravity Enterprise CRM',
      category: 'fact',
    });

    expect(mem1.id).toBeDefined();
    expect(mem1.key).toBe('product_name');
    expect(mem1.value).toBe('Antigravity Enterprise CRM');

    const memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(1);
    expect(memories[0].key).toBe('product_name');

    // Tenant isolation: ws2 or user2 cannot see ws1/user1 memories
    const otherMemories = await memoryService.listMemories(ws2, user1);
    expect(otherMemories.length).toBe(0);

    const otherUserMemories = await memoryService.listMemories(ws1, user2);
    expect(otherUserMemories.length).toBe(0);
  });

  it('updates memory when saving existing key', async () => {
    await memoryService.saveMemory(ws1, user1, {
      key: 'product_name',
      value: 'Antigravity Enterprise CRM',
    });

    const updated = await memoryService.saveMemory(ws1, user1, {
      key: 'product_name',
      value: 'Stone AIO Suite',
    });

    expect(updated.value).toBe('Stone AIO Suite');

    const memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(1);
    expect(memories[0].value).toBe('Stone AIO Suite');
  });

  it('generates memories prompt block for system prompt injection', async () => {
    await memoryService.saveMemory(ws1, user1, {
      key: 'product_name',
      value: 'Stone AIO Suite',
    });

    const block = await memoryService.getMemoriesPromptBlock(ws1, user1);
    expect(block).toContain('Stone AIO Suite');
    expect(block).toContain('product_name');
  });

  it('deletes individual memory items and clears all', async () => {
    const mem1 = await memoryService.saveMemory(ws1, user1, {
      key: 'k1',
      value: 'v1',
    });

    const mem2 = await memoryService.saveMemory(ws1, user1, {
      key: 'k2',
      value: 'v2',
      category: 'preference',
    });

    let memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(2);

    const deleted = await memoryService.deleteMemory(ws1, user1, mem2.id);
    expect(deleted).toBe(true);

    memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(1);
    expect(memories[0].id).toBe(mem1.id);

    const clearedCount = await memoryService.clearAllMemories(ws1, user1);
    expect(clearedCount).toBe(1);

    memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(0);
  });

  it('automatically extracts user writing preferences like "Make it sound more human and personal"', async () => {
    await memoryService.maybeExtractMemories(
      ws1,
      user1,
      'Make it sound more human and personal.'
    );

    const memories = await memoryService.listMemories(ws1, user1);
    expect(memories.length).toBe(1);
    expect(memories[0].key).toBe('Writing Tone');
    expect(memories[0].value).toContain('human, personal, and conversational');

    const promptBlock = await memoryService.getMemoriesPromptBlock(ws1, user1);
    expect(promptBlock).toContain('Writing Tone');
    expect(promptBlock).toContain('human, personal, and conversational');
  });

  it('automatically extracts user writing preferences like "Make it more detailed"', async () => {
    await memoryService.maybeExtractMemories(
      ws1,
      user1,
      'Make it more detailed'
    );

    const memories = await memoryService.listMemories(ws1, user1);
    const detailMem = memories.find((m) => m.key === 'Detail Level');
    expect(detailMem).toBeDefined();
    expect(detailMem?.value).toContain('detailed, comprehensive explanations');

    const promptBlock = await memoryService.getMemoriesPromptBlock(ws1, user1);
    expect(promptBlock).toContain('Detail Level');
    expect(promptBlock).toContain('detailed, comprehensive explanations');
  });

  it('searches past chats using keyword match with strict workspace scoping', async () => {
    mockMessages['m1'] = {
      id: 'm1',
      workspaceId: ws1,
      userId: user1,
      conversationId: 'c1',
      searchableText: 'What is the pricing for Q4 enterprise plans?',
      createdAt: new Date(),
    };

    mockMessages['m2'] = {
      id: 'm2',
      workspaceId: ws2,
      userId: user1,
      conversationId: 'c2',
      searchableText: 'Other workspace enterprise discussion',
      createdAt: new Date(),
    };

    const results = await memoryService.searchPastChats(ws1, user1, 'enterprise');
    expect(results.length).toBe(1);
    expect(results[0].text).toContain('pricing for Q4 enterprise');

    // Cross-tenant search returns empty
    const crossResults = await memoryService.searchPastChats('ws-non-existent', user1, 'enterprise');
    expect(crossResults.length).toBe(0);
  });
});
