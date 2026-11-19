-- Conversation.snoozedUntil: backing store for the Conversations snooze
-- control (Tranche A fix 10). The UI already sent snoozedUntil in the
-- PATCH body, but the route dropped it and the column never existed, so
-- a snoozed thread had no wake time stored and could never re-open.
-- Idempotent: safe to apply on a DB that already has the column.
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3);
