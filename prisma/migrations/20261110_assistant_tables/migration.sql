-- Assistant tables (Stone AI Assistant, Jack's Phases 0-10, merged 2026-11-07).
-- Authored by hand from the Prisma schema (prisma/schema.prisma, models
-- AssistantConversation..AssistantProjectLink). The commit that added these
-- 12 models to the schema shipped NO migration, so production `prisma
-- migrate deploy` never creates them and the assistant crashes on first use.
--
-- Idempotent by design (same philosophy as 20261028_prod_catchup): every
-- statement tolerates objects that already exist, because production's exact
-- history is unknown (it may have been built by `prisma db push`, which
-- would already have these tables, or by `migrate deploy`). Safe to apply on
-- an already-complete database (no-op there).
--
-- Deviation from the repo's earlier hand-authored migrations (phase2/3/5,
-- billing_core, prod_catchup): those omitted the plain @@index indexes and
-- only created unique indexes. This migration DOES create the @@index
-- indexes (Prisma naming `<table>_<cols>_idx`), so the database matches the
-- schema — the assistant queries filter by workspace_id/user_id/status, and
-- those indexes matter. The dev DB (scaffold-built) also lacks them; that is
-- a dev gap, not a reason to omit them from production.
--
-- Conventions follow the existing migrations: TEXT ids with no DB default
-- (Prisma generates uuids client-side), TIMESTAMP(3), JSONB, created_at
-- DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL with no
-- default (Prisma manages it), FKs ON DELETE CASCADE ON UPDATE CASCADE.
--
-- Verified 2026-11-10 (dev-DB rebuild #17 + scratch DBs, then dropped):
-- baseline (57 tables) -> `migrate resolve --applied` for the 5 older
-- migrations -> `migrate deploy` applies ONLY this migration; 12 tables,
-- 6 _prisma_migrations rows, 30 indexes (12 pkeys + 15 @@index + 3 unique),
-- 14 FKs, and a 136-column information_schema comparison against the schema
-- with 0 mismatches. Re-applying the file to a DB that already has the
-- tables is a no-op (rc 0, "already exists, skipping" notices). Caveat:
-- `prisma migrate diff --from-migrations` cannot run for this repo — the
-- shadow database is wiped, so phase2's ALTER TABLE workspaces fails; the
-- column comparison above is the schema-match check instead. The repo
-- previously had no migration_lock.toml; one was added (provider =
-- "postgresql") so `migrate deploy`/`status` treat the directory as valid.

-- ── 1. assistant_conversations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_conversations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New Conversation',
  "project_id" TEXT,
  "pinned_at" TIMESTAMP(3),
  "mode" TEXT NOT NULL DEFAULT 'unset',
  "thinking" TEXT NOT NULL DEFAULT 'auto',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_conversations_workspace_id_user_id_idx"
  ON "assistant_conversations"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "assistant_conversations_workspace_id_updated_at_idx"
  ON "assistant_conversations"("workspace_id", "updated_at");

DO $$ BEGIN
  ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 2. assistant_messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_messages" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "parts" JSONB NOT NULL,
  "thought_signatures" JSONB,
  "status" TEXT NOT NULL DEFAULT 'complete',
  "model" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "feedback" JSONB,
  "searchable_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_messages_conversation_id_created_at_idx"
  ON "assistant_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "assistant_messages_workspace_id_user_id_idx"
  ON "assistant_messages"("workspace_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 3. assistant_tool_calls ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_tool_calls" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "conversation_id" TEXT,
  "message_id" TEXT,
  "task_run_id" TEXT,
  "source" TEXT NOT NULL DEFAULT 'chat',
  "tool_name" TEXT NOT NULL,
  "risk" TEXT NOT NULL,
  "args" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "error" TEXT,
  "approved_by_user_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_tool_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_tool_calls_workspace_id_user_id_status_idx"
  ON "assistant_tool_calls"("workspace_id", "user_id", "status");
CREATE INDEX IF NOT EXISTS "assistant_tool_calls_conversation_id_idx"
  ON "assistant_tool_calls"("conversation_id");

DO $$ BEGIN
  ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 4. assistant_settings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_settings" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "default_mode" TEXT NOT NULL DEFAULT 'ask',
  "thinking" TEXT NOT NULL DEFAULT 'auto',
  "voice" TEXT NOT NULL DEFAULT 'default',
  "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
  "past_chat_search" BOOLEAN NOT NULL DEFAULT true,
  "notify" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assistant_settings_workspace_id_user_id_key"
  ON "assistant_settings"("workspace_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 5. assistant_workspace_settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_workspace_settings" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "max_mode" TEXT NOT NULL DEFAULT 'full',
  "full_autonomy_roles" JSONB NOT NULL DEFAULT '["owner", "admin"]',
  "require_approval_for" JSONB NOT NULL DEFAULT '{}',
  "bulk_threshold" INTEGER NOT NULL DEFAULT 25,
  "daily_limits" JSONB NOT NULL DEFAULT '{}',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_workspace_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assistant_workspace_settings_workspace_id_key"
  ON "assistant_workspace_settings"("workspace_id");

DO $$ BEGIN
  ALTER TABLE "assistant_workspace_settings" ADD CONSTRAINT "assistant_workspace_settings_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 6. assistant_usage ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_usage" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "messages" INTEGER NOT NULL DEFAULT 0,
  "searches" INTEGER NOT NULL DEFAULT 0,
  "research_runs" INTEGER NOT NULL DEFAULT 0,
  "images" INTEGER NOT NULL DEFAULT 0,
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "assistant_usage_workspace_id_user_id_day_key"
  ON "assistant_usage"("workspace_id", "user_id", "day");
CREATE INDEX IF NOT EXISTS "assistant_usage_workspace_id_day_idx"
  ON "assistant_usage"("workspace_id", "day");

DO $$ BEGIN
  ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 7. assistant_memories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_memories" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_memories_workspace_id_user_id_idx"
  ON "assistant_memories"("workspace_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "assistant_memories" ADD CONSTRAINT "assistant_memories_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 8. assistant_scheduled_tasks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_scheduled_tasks" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "cron" TEXT NOT NULL DEFAULT '0 9 * * *',
  "mode" TEXT NOT NULL DEFAULT 'read_only',
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_scheduled_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_scheduled_tasks_workspace_id_user_id_idx"
  ON "assistant_scheduled_tasks"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "assistant_scheduled_tasks_status_next_run_at_idx"
  ON "assistant_scheduled_tasks"("status", "next_run_at");

DO $$ BEGIN
  ALTER TABLE "assistant_scheduled_tasks" ADD CONSTRAINT "assistant_scheduled_tasks_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 9. assistant_task_runs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_task_runs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "result_text" TEXT,
  "error" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "assistant_task_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_task_runs_workspace_id_task_id_idx"
  ON "assistant_task_runs"("workspace_id", "task_id");

DO $$ BEGIN
  ALTER TABLE "assistant_task_runs" ADD CONSTRAINT "assistant_task_runs_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "assistant_task_runs" ADD CONSTRAINT "assistant_task_runs_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "assistant_scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 10. assistant_projects ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_projects" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#3b82f6',
  "icon" TEXT NOT NULL DEFAULT 'folder',
  "instructions" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_projects_workspace_id_user_id_idx"
  ON "assistant_projects"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "assistant_projects_workspace_id_visibility_idx"
  ON "assistant_projects"("workspace_id", "visibility");

DO $$ BEGIN
  ALTER TABLE "assistant_projects" ADD CONSTRAINT "assistant_projects_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 11. assistant_project_files ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assistant_project_files" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "storage_url" TEXT,
  "extracted_text" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assistant_project_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_project_files_workspace_id_project_id_idx"
  ON "assistant_project_files"("workspace_id", "project_id");

DO $$ BEGIN
  ALTER TABLE "assistant_project_files" ADD CONSTRAINT "assistant_project_files_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "assistant_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── 12. assistant_project_links ─────────────────────────────────────────────
-- Note: this model has created_at but NO updated_at and NO user_id in the schema.
CREATE TABLE IF NOT EXISTS "assistant_project_links" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistant_project_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assistant_project_links_workspace_id_project_id_idx"
  ON "assistant_project_links"("workspace_id", "project_id");

DO $$ BEGIN
  ALTER TABLE "assistant_project_links" ADD CONSTRAINT "assistant_project_links_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "assistant_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
