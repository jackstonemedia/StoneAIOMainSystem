-- Tier 1 Fix 6: company activity log (mirror of contact_events).
-- Idempotent (CREATE TABLE / INDEX IF NOT EXISTS) following the
-- 20261110_assistant_tables philosophy.
CREATE TABLE IF NOT EXISTS "company_events" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "metadata_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "company_events_company_id_idx" ON "company_events"("company_id");

-- FK to companies (idempotent: only add if missing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_events_company_id_fkey'
  ) THEN
    ALTER TABLE "company_events"
      ADD CONSTRAINT "company_events_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
