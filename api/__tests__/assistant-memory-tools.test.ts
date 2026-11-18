/**
 * Tier 2 fix 17 — memory tools are wired into the registry (43 -> 45).
 *
 * `save_memory_preference` / `list_user_memories` were exported but never
 * imported by registry.ts, so the assistant could not call them at all.
 * Wiring them surfaced a real gate conflict: `save_memory_preference`
 * was labeled risk 'read' while it WRITES (upserts AssistantMemory),
 * and the mode gate executes 'read' tools in every mode — including
 * read-only and paused. It is now risk 'write': blocked in read-only,
 * a proposal in draft mode, executed in full mode. `list_user_memories`
 * is a genuine read and stays 'read'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolRegistry } from '../services/assistant/tools/registry.js';
import { evaluateModeGate } from '../services/assistant/modes.js';

const mockMemories: Record<string, any> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation((cb: any) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantMemory: {
          findFirst: vi.fn().mockImplementation(({ where }: any) => {
            const m = Object.values(mockMemories).find((item: any) => {
              if (where.workspaceId && item.workspaceId !== where.workspaceId) return false;
              if (where.userId && item.userId !== where.userId) return false;
              if (where.key && item.key !== where.key) return false;
              if (where.category === 'business' && item.category !== 'business') return false;
              return true;
            });
            return Promise.resolve(m || null);
          }),
          findMany: vi.fn().mockImplementation(({ where }: any) => {
            const list = Object.values(mockMemories).filter((item: any) => {
              if (where.workspaceId && item.workspaceId !== where.workspaceId) return false;
              if (where.OR) {
                const ok = where.OR.some((clause: any) => {
                  if (clause.userId && item.userId === clause.userId) return true;
                  if (clause.category === 'business' && item.category === 'business') return true;
                  return false;
                });
                if (!ok) return false;
              }
              return true;
            });
            return Promise.resolve(list);
          }),
          create: vi.fn().mockImplementation(({ data }: any) => {
            const id = `mem_${Date.now()}_${Math.random()}`;
            const m = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
            mockMemories[id] = m;
            return Promise.resolve(m);
          }),
          update: vi.fn().mockImplementation(({ where, data }: any) => {
            const m = mockMemories[where.id];
            Object.assign(m, data, { updatedAt: new Date() });
            return Promise.resolve(m);
          }),
        },
      };
      return cb(tx);
    }),
  },
}));

const ctx: any = { workspaceId: 'ws-test', userId: 'user-test' };

describe('Tier 2 fix 17 — memory tools in the registry', () => {
  beforeEach(() => {
    Object.keys(mockMemories).forEach((k) => delete mockMemories[k]);
  });

  it('registry holds 45 tools including both memory tools', () => {
    const all = toolRegistry.getAllTools();
    const names = all.map((t) => t.name);
    expect(names).toContain('save_memory_preference');
    expect(names).toContain('list_user_memories');
    expect(all.length).toBe(45);
  });

  it('both memory tools appear in the Gemini function declarations', () => {
    const decls = toolRegistry.getGeminiFunctionDeclarations();
    const names = decls.map((d) => d.name);
    expect(names).toContain('save_memory_preference');
    expect(names).toContain('list_user_memories');
    expect(decls.length).toBe(45);
  });

  it('save_memory_preference persists a preference a later turn can list', async () => {
    const save = toolRegistry.getTool('save_memory_preference')!;
    const res: any = await save.execute(
      { key: 'Writing Tone', value: 'Prefers short, direct sentences.', category: 'preference' },
      ctx,
    );
    expect(res.success).toBe(true);
    expect(res.savedKey).toBe('Writing Tone');

    const list = toolRegistry.getTool('list_user_memories')!;
    const listed: any = await list.execute({}, ctx);
    expect(listed.memories).toHaveLength(1);
    expect(listed.memories[0]).toMatchObject({
      key: 'Writing Tone',
      value: 'Prefers short, direct sentences.',
      category: 'preference',
    });
  });

  it('save_memory_preference is risk write, list_user_memories is risk read', () => {
    expect(toolRegistry.getTool('save_memory_preference')!.risk).toBe('write');
    expect(toolRegistry.getTool('list_user_memories')!.risk).toBe('read');
  });

  it('the mode gate blocks a memory write in read-only, proposes in draft, executes in full', () => {
    const base = { userRole: 'member', toolRisk: 'write' as const, minimumRole: 'member' };
    expect(evaluateModeGate({ ...base, chatMode: 'read_only' }).action).toBe('blocked');
    expect(evaluateModeGate({ ...base, chatMode: 'draft' }).action).toBe('proposal');
    // Full autonomy is admins/owners only (D6): a member in 'full' chat mode
    // is capped at draft and gets a proposal, not an execution.
    expect(evaluateModeGate({ ...base, chatMode: 'full' }).action).toBe('proposal');
    // An admin in full mode executes the write.
    expect(
      evaluateModeGate({ ...base, userRole: 'admin', chatMode: 'full' }).action,
    ).toBe('execute');
    // A paused workspace blocks the write too (read tools still execute).
    expect(
      evaluateModeGate({ ...base, userRole: 'admin', chatMode: 'full', isPaused: true }).action,
    ).toBe('blocked');
  });

  it('the mode gate still executes a memory read in read-only mode', () => {
    expect(
      evaluateModeGate({
        chatMode: 'read_only',
        userRole: 'member',
        toolRisk: 'read',
        minimumRole: 'member',
      }).action,
    ).toBe('execute');
  });
});
