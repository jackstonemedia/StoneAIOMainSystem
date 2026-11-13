-- CrmSettings: backing store for the CRM Settings page (Tier 2 fix 8).
-- Idempotent: safe to apply on a DB that already has the table.
CREATE TABLE IF NOT EXISTS "crm_settings" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "crm_name" TEXT,
  "default_currency" TEXT,
  "fiscal_year_start" TEXT,
  "deal_stage_labels" TEXT,
  "admin_email" TEXT,
  "default_role" TEXT,
  "notify_new_lead" BOOLEAN NOT NULL DEFAULT false,
  "notify_deal_won" BOOLEAN NOT NULL DEFAULT false,
  "notify_deal_lost" BOOLEAN NOT NULL DEFAULT false,
  "weekly_digest" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_settings_workspace_id_key" ON "crm_settings"("workspace_id");
