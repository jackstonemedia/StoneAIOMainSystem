-- Billing Core: record when a workspace's 1-week free trial ends
-- (null = never trialed). Applied to workspaces only; no backfill
-- (existing subscribers keep stripeSubscriptionId, which already
-- disqualifies them from a new trial).
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
