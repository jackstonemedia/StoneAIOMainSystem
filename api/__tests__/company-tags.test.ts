/**
 * Company tags — Tier 1 Fix 12.
 * The company detail page already sent `tagsJson` on add/remove, but the
 * Company model had no such field, so Prisma rejected the update as an
 * unknown argument and tagging crashed. The field now exists (same shape
 * as Contact/Deal) and updateCompany passes it through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  updates: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    company: {
      update: vi.fn(async ({ where, data }: any) => {
        state.updates.push({ where, data });
        return { id: where.id, ...data };
      }),
    },
  },
}));

import { updateCompany } from '../services/crm.service.js';

describe('Company tags (Tier 1 Fix 12)', () => {
  beforeEach(() => {
    state.updates = [];
  });

  it('updateCompany accepts tagsJson and passes it to Prisma', async () => {
    const result = await updateCompany('co_1', 'ws_test', { tagsJson: JSON.stringify(['saas', 'priority']) });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({
      where: { id: 'co_1', workspaceId: 'ws_test' },
      data: { tagsJson: '["saas","priority"]' },
    });
    expect(result.tagsJson).toBe('["saas","priority"]');
  });

  it('updateCompany still strips relation fields from the payload', async () => {
    await updateCompany('co_1', 'ws_test', { name: 'Acme', contacts: [], deals: [], _count: {} });
    expect(state.updates[0].data).toEqual({ name: 'Acme' });
  });
});
