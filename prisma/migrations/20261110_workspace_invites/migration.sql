-- Tier 1 Fix 9: real team invites (token + expiry + accept).
-- Idempotent (CREATE TABLE / INDEX IF NOT EXISTS) following the
-- 20261110_assistant_tables philosophy.
CREATE TABLE IF NOT EXISTS "workspace_invites" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "token" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "invited_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_token_key" ON "workspace_invites"("token");
CREATE INDEX IF NOT EXISTS "workspace_invites_workspace_id_idx" ON "workspace_invites"("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_invites_token_idx" ON "workspace_invites"("token");

-- FK to workspaces (idempotent: only add if missing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_invites_workspace_id_fkey'
  ) THEN
    ALTER TABLE "workspace_invites"
      ADD CONSTRAINT "workspace_invites_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
