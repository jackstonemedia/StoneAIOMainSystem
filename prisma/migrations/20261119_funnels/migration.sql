-- Funnels (Wave 1 item 1.2 / outline 02-18).
-- Idempotent: safe to apply on a DB that already has the tables.
-- Also adds funnel-attribution columns to form_responses (nullable: a direct
-- page visit leaves them NULL; a funnel-step submission sets them).
CREATE TABLE IF NOT EXISTS "funnels" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "funnels_slug_key" ON "funnels"("slug");
CREATE INDEX IF NOT EXISTS "funnels_workspace_id_idx" ON "funnels"("workspace_id");

CREATE TABLE IF NOT EXISTS "funnel_steps" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "funnel_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "landing_page_id" TEXT NOT NULL,
  "offer_title" TEXT,
  "offer_body" TEXT,
  "tag_on_submit" TEXT,
  "campaign_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnel_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "funnel_steps_workspace_id_idx" ON "funnel_steps"("workspace_id");
CREATE INDEX IF NOT EXISTS "funnel_steps_funnel_id_position_idx" ON "funnel_steps"("funnel_id", "position");

CREATE TABLE IF NOT EXISTS "funnel_step_views" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "funnel_id" TEXT NOT NULL,
  "step_id" TEXT NOT NULL,
  "referrer" TEXT,
  "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnel_step_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "funnel_step_views_workspace_id_idx" ON "funnel_step_views"("workspace_id");
CREATE INDEX IF NOT EXISTS "funnel_step_views_funnel_id_step_id_idx" ON "funnel_step_views"("funnel_id", "step_id");

ALTER TABLE "form_responses" ADD COLUMN IF NOT EXISTS "funnel_id" TEXT;
ALTER TABLE "form_responses" ADD COLUMN IF NOT EXISTS "funnel_step_id" TEXT;
CREATE INDEX IF NOT EXISTS "form_responses_funnel_step_id_submitted_at_idx" ON "form_responses"("funnel_step_id", "submitted_at");
