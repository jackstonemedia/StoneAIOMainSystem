-- Complete-platform item 6: onboarding completion flag on Workspace.
-- Idempotent: the dev DB has no _prisma_migrations table (rebuild builds
-- schema directly), so the column is applied via psql from this file.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP NULL;
