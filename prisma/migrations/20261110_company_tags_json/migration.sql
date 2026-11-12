-- Tier 1 Fix 12: Company.tagsJson (Contact/Deal already have it; the
-- company detail page was already sending tagsJson and Prisma rejected it
-- as an unknown argument, so tag add/remove crashed).
-- Idempotent (ADD COLUMN IF NOT EXISTS).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tags_json" TEXT DEFAULT '[]';
