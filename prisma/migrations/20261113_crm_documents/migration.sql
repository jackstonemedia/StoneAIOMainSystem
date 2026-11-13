-- CrmDocument: backing store for the CRM Documents page (Tier 2 fix 5).
-- Idempotent: safe to apply on a DB that already has the table.
CREATE TABLE IF NOT EXISTS "crm_documents" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'Untitled Document',
  "content" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_documents_workspace_id_idx" ON "crm_documents"("workspace_id");
