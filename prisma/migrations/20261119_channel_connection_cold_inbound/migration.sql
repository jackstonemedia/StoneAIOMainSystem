-- Complete-platform item 3: Gmail cold inbound opt-in + visible filter count.
-- Idempotent: safe to re-apply (dev rebuilds re-run migrations).
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "allow_cold_inbound" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "filtered_cold_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "channel_connections" ADD COLUMN IF NOT EXISTS "last_filtered_cold_at" TIMESTAMP(3);
