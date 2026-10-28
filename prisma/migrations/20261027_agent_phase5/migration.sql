-- Phase 5 (AI Agent): monthly token usage buckets.
-- Authored by hand from the Prisma schema (see Phase 2 migration note:
-- this repo has no migration history; the baseline lives in
-- prisma/migrations_baseline.sql).

CREATE TABLE "agent_token_usage" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_token_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_token_usage_workspace_id_month_key"
  ON "agent_token_usage"("workspace_id", "month");

ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
