-- Complete-platform item 7: delete the two dead score columns on Contact.
-- leadScore stays — it is now written by the computed scorer. healthScore
-- was never written and had no UI slot; engagementScore was never written
-- and had no readers at all. Idempotent: the dev DB has no
-- _prisma_migrations table, so the columns are dropped via psql from this file.
ALTER TABLE contacts DROP COLUMN IF EXISTS health_score;
ALTER TABLE contacts DROP COLUMN IF EXISTS engagement_score;
