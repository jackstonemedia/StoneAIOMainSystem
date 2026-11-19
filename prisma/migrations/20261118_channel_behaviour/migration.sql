-- Channel behaviour columns (Tranche A fix 12). The Conversations channel
-- settings form sent these fields, but the PATCH route dropped them and
-- echoed them back as defaults, so they vanished on reload and never
-- affected a send. Now they persist and dispatch honours them:
-- signature (appended to email when the sender opts in), autoReply /
-- autoReplyText (first inbound email in a conversation gets the reply),
-- archiveOnReply (archive the thread after a successful reply),
-- quietHoursEnabled (block SMS sends 9pm–8am server-local time).
-- Idempotent: safe to apply on a DB that already has the columns.
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "signature" TEXT;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "auto_reply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "auto_reply_text" TEXT;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "archive_on_reply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false;
