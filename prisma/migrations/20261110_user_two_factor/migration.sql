-- Blueprint 3 / Tier 1 Fix 1: per-user TOTP 2FA storage.
-- Idempotent (CREATE TABLE / INDEX IF NOT EXISTS) following the
-- 20261110_assistant_tables philosophy. No FK to "users": the codebase keys
-- per-user rows by the raw Clerk user id string (see WorkspaceMember.userId).
-- The secret is stored ENCRYPTED by the application (AES-256-GCM); this
-- column must never hold a plaintext secret.
CREATE TABLE IF NOT EXISTS "user_two_factor" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_two_factor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_two_factor_user_id_key" ON "user_two_factor"("user_id");
