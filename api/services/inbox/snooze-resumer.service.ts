/**
 * Snooze resumer — Tier 3 Tranche A, Fix 10.
 *
 * Snoozing a conversation set status 'snoozed' but nothing ever woke it:
 * the legacy PATCH route dropped the snoozedUntil the UI sent, and the
 * Conversation model had no such column at all, so a snoozed thread had
 * no wake time stored and could never re-open. (The live-chat inbox model
 * already had the column but no resumer either.)
 *
 * This runs every minute from the server's cron jobs: any conversation in
 * either model whose wake time has passed goes back to 'open' with its
 * snoozedUntil cleared, so it returns to the open list.
 */
import { db } from '../../../infrastructure/database/client.js';

export async function resumeDueSnoozedConversations(now: Date = new Date()) {
  // Legacy Conversations model — the live Conversations page snoozes here.
  const legacy = await db.conversation.updateMany({
    where: { status: 'snoozed', snoozedUntil: { lte: now } },
    data: { status: 'open', snoozedUntil: null },
  });
  // Live-chat inbox model — snoozable via PATCH /inbox/conversations/:id.
  const inbox = await db.inboxConversation.updateMany({
    where: { status: 'snoozed', snoozedUntil: { lte: now } },
    data: { status: 'open', snoozedUntil: null },
  });
  return { legacy: legacy.count, inbox: inbox.count };
}
