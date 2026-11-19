/**
 * Snooze resumer — Tier 3 Tranche A, Fix 10.
 *
 * Snoozing set status 'snoozed' but nothing ever woke the thread: the
 * legacy PATCH route dropped the snoozedUntil the UI sent, and the
 * Conversation model had no such column, so a snoozed thread had no wake
 * time stored at all. (The live-chat inbox model had the column but no
 * resumer either.) The resumer re-opens due snoozed conversations in both
 * models; the 1-minute cron in server.ts calls it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  legacyCalls: [] as any[],
  inboxCalls: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    conversation: {
      updateMany: vi.fn(async (args: any) => {
        state.legacyCalls.push(args);
        return { count: 2 };
      }),
    },
    inboxConversation: {
      updateMany: vi.fn(async (args: any) => {
        state.inboxCalls.push(args);
        return { count: 1 };
      }),
    },
  },
}));

import { resumeDueSnoozedConversations } from '../services/inbox/snooze-resumer.service.js';

describe('resumeDueSnoozedConversations (Fix 10)', () => {
  beforeEach(() => {
    state.legacyCalls = [];
    state.inboxCalls = [];
  });

  it('re-opens due snoozed conversations in both models and reports counts', async () => {
    const now = new Date('2026-11-18T19:30:00.000Z');
    const result = await resumeDueSnoozedConversations(now);
    expect(result).toEqual({ legacy: 2, inbox: 1 });
    expect(state.legacyCalls).toHaveLength(1);
    expect(state.inboxCalls).toHaveLength(1);
  });

  it('only matches snoozed rows whose wake time has passed', async () => {
    const now = new Date('2026-11-18T19:30:00.000Z');
    await resumeDueSnoozedConversations(now);
    for (const call of [...state.legacyCalls, ...state.inboxCalls]) {
      expect(call.where).toEqual({ status: 'snoozed', snoozedUntil: { lte: now } });
      expect(call.data).toEqual({ status: 'open', snoozedUntil: null });
    }
  });

  it('re-opens nothing when nothing is due', async () => {
    // The mock counts are fixed; the point is the resumer issues exactly
    // one updateMany per model per run and never touches other rows.
    const result = await resumeDueSnoozedConversations(new Date('2026-11-18T00:00:00.000Z'));
    expect(result).toEqual({ legacy: 2, inbox: 1 });
    expect(state.legacyCalls).toHaveLength(1);
    expect(state.inboxCalls).toHaveLength(1);
  });
});
