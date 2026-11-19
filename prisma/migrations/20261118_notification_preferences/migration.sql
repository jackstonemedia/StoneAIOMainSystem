-- NotificationPreference: backing store for the Settings notification
-- toggles (Tranche A fix 11). The toggles used to be local useState that
-- only ever showed a toast — nothing was persisted and nothing read them.
-- Idempotent: safe to apply on a DB that already has the table.
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_workspace_id_key_key" ON "notification_preferences"("workspace_id", "key");
