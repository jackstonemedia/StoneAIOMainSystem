-- Phase 3 (AI Agent): curated memories.
-- Authored by hand from the Prisma schema (see Phase 2 migration note:
-- this repo has no migration history; the baseline lives in
-- prisma/migrations_baseline.sql).

CREATE TABLE "agent_memories" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
