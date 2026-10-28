-- Phase 2 (AI Agent): autonomy grants, chat conversations, audit log,
-- workspace agent mode + display name.
-- Authored by hand from the Prisma schema (this repo has no migration
-- history; the baseline lives in prisma/migrations_baseline.sql).

ALTER TABLE "workspaces" ADD COLUMN "agent_mode" TEXT NOT NULL DEFAULT 'approve';
ALTER TABLE "workspaces" ADD COLUMN "agent_name" TEXT NOT NULL DEFAULT 'AI Agent';

CREATE TABLE "agent_autonomy_grants" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "tool_name" TEXT NOT NULL,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "granted_by" TEXT NOT NULL,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "agent_autonomy_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_conversations" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_conversation_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_audit_logs" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tool_name" TEXT NOT NULL,
  "args" JSONB NOT NULL,
  "result" JSONB,
  "mode" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agent_autonomy_grants" ADD CONSTRAINT "agent_autonomy_grants_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_conversation_messages" ADD CONSTRAINT "agent_conversation_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
