-- Landing Pages (Wave 1 item 1.1 / outline 02-17).
-- Idempotent: safe to apply on a DB that already has the tables.
CREATE TABLE IF NOT EXISTS "landing_pages" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "seo_title" TEXT,
  "seo_desc" TEXT,
  "sections_json" JSONB NOT NULL,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "landing_pages_slug_key" ON "landing_pages"("slug");
CREATE INDEX IF NOT EXISTS "landing_pages_workspace_id_idx" ON "landing_pages"("workspace_id");

CREATE TABLE IF NOT EXISTS "landing_page_views" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "referrer" TEXT,
  "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "landing_page_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "landing_page_views_workspace_id_idx" ON "landing_page_views"("workspace_id");
CREATE INDEX IF NOT EXISTS "landing_page_views_page_id_viewed_at_idx" ON "landing_page_views"("page_id", "viewed_at");

CREATE TABLE IF NOT EXISTS "form_responses" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "contact_id" TEXT,
  "answers_json" JSONB NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "form_responses_workspace_id_idx" ON "form_responses"("workspace_id");
CREATE INDEX IF NOT EXISTS "form_responses_page_id_submitted_at_idx" ON "form_responses"("page_id", "submitted_at");
