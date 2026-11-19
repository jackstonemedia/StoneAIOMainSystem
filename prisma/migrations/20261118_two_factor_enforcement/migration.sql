-- Tranche A fix 17: 2FA enforcement at sign-in. The TOTP machinery existed
-- (UserTwoFactor + setup/verify endpoints) but nothing ever consulted it at
-- sign-in, so enabling 2FA changed nothing.
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "require_two_factor" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "two_factor_sessions" (
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "two_factor_sessions_pkey" PRIMARY KEY ("session_id")
);
