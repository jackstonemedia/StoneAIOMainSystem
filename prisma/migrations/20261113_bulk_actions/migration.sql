-- BulkAction: recorded history for every bulk run (Tier 2 fix 9).
-- Idempotent: safe to apply on a DB that already has the table.
CREATE TABLE IF NOT EXISTS "bulk_actions" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "target_count" INTEGER NOT NULL,
  "success_count" INTEGER NOT NULL,
  "failed_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "bulk_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bulk_actions_workspace_id_idx" ON "bulk_actions"("workspace_id");
