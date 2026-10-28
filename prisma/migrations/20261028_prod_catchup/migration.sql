-- Production catch-up migration (2026-10-28).
-- Idempotent by design: every statement tolerates objects that already
-- exist, because production's exact history is unknown (it may have been
-- built by `prisma db push`, by `migrate deploy` from the baseline, or
-- from an older main). This file brings ANY such database up to the
-- merged schema: all tables/columns/enums the app code references that
-- no earlier migration creates (notably the outreach/SDR/email/inbox
-- tables added on main after 683aac6, which never got migration files).
-- Safe to apply on an already-complete database (no-op there).
-- It must run AFTER the 20261027_* and 20261028_billing_core migrations
-- in `prisma migrate deploy` order (folder name sorts last).
-- If production was push-built (no _prisma_migrations rows), mark the
-- earlier migrations applied first with `prisma migrate resolve
-- --applied <name>` for each, or deploy will stop on their plain
-- CREATE statements for tables that already exist.

DO $$ BEGIN CREATE TYPE public."AdPlatform" AS ENUM ('GOOGLE', 'FACEBOOK'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AdAccountStatus" AS ENUM ('ACTIVE', 'NEEDS_ATTENTION', 'DISCONNECTED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AdCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT', 'ENDED', 'REJECTED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AdType" AS ENUM ('GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'FACEBOOK_FEED', 'FACEBOOK_LEAD'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."BudgetType" AS ENUM ('DAILY', 'LIFETIME'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."LeadSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."SubscriptionStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED', 'PENDING_CONFIRMATION'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AutomationTriggerType" AS ENUM ('CONTACT_CREATED', 'TAG_ADDED', 'TAG_REMOVED', 'FORM_SUBMITTED', 'LIST_JOINED', 'DEAL_STAGE_CHANGED', 'CUSTOM_FIELD_CHANGED', 'DATE_BASED', 'EMAIL_OPENED', 'EMAIL_LINK_CLICKED', 'MANUAL_ENROLLMENT', 'API_EVENT'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."AutomationStepType" AS ENUM ('SEND_EMAIL', 'WAIT', 'CONDITION_BRANCH', 'ADD_TAG', 'REMOVE_TAG', 'UPDATE_FIELD', 'ADD_TO_LIST', 'REMOVE_FROM_LIST', 'WEBHOOK_CALL', 'GOAL_CHECK', 'EXIT_AUTOMATION'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."EnrollmentExitReason" AS ENUM ('COMPLETED_ALL_STEPS', 'GOAL_MET', 'MANUALLY_REMOVED', 'UNSUBSCRIBED', 'SUPPRESSED', 'CONTACT_DELETED', 'REPLIED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED', 'REPLIED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."ConsentSource" AS ENUM ('MANUAL_ADD', 'CSV_IMPORT', 'FORM_SUBMISSION', 'API', 'AUTOMATION'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."SdrMode" AS ENUM ('COPILOT', 'AUTOPILOT'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."SdrStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."DossierStatus" AS ENUM ('DRAFTED', 'APPROVED', 'SENDING', 'ENGAGED', 'MEETING_BOOKED', 'BOUNCED', 'DECLINED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE TYPE public."SendingDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED'); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "subscription_status" TEXT DEFAULT 'inactive';
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "credits_used" INTEGER DEFAULT 0;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "credits_limit" INTEGER DEFAULT 500;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "inbox_token" TEXT UNIQUE;
ALTER TABLE public."workspaces" ADD COLUMN IF NOT EXISTS "inbox_enabled" BOOLEAN DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS public."ai_actions" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "tool_name" TEXT,
  "args" JSONB,
  "label" TEXT,
  "status" TEXT DEFAULT 'pending',
  "result" JSONB,
  "chat_context" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE public."agent_token_usage" ADD CONSTRAINT "agent_token_usage_workspace_id_month_key" UNIQUE ("workspace_id", "month"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."inbox_channels" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "channel_type" TEXT,
  "avatar_url" TEXT,
  "welcome_message" TEXT,
  "away_message" TEXT,
  "widget_color" TEXT DEFAULT '#7dd3fc',
  "is_enabled" BOOLEAN DEFAULT TRUE,
  "channel_connection_id" TEXT,
  "embed_token" TEXT UNIQUE,
  "settings_json" TEXT DEFAULT '{}',
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_channel_agents" (
  "inbox_channel_id" TEXT,
  "user_id" TEXT,
  "availability_status" TEXT DEFAULT 'online'
);
CREATE TABLE IF NOT EXISTS public."inbox_labels" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "title" TEXT,
  "description" TEXT,
  "color" TEXT DEFAULT '#7dd3fc',
  "show_on_sidebar" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP(3),
  UNIQUE ("workspace_id", "title")
);
DO $$ BEGIN ALTER TABLE public."inbox_labels" ADD CONSTRAINT "inbox_labels_workspace_id_title_key" UNIQUE ("workspace_id", "title"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."inbox_teams" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspace_id", "name")
);
DO $$ BEGIN ALTER TABLE public."inbox_teams" ADD CONSTRAINT "inbox_teams_workspace_id_name_key" UNIQUE ("workspace_id", "name"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."inbox_team_members" (
  "team_id" TEXT,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."canned_responses" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "content" TEXT,
  "type" TEXT DEFAULT 'text',
  "folder" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_contacts" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "crm_contact_id" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "avatar_url" TEXT,
  "external_id" TEXT,
  "additional_attributes" TEXT,
  "last_activity_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_conversations" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "inbox_channel_id" TEXT,
  "inbox_contact_id" TEXT,
  "crm_contact_id" TEXT,
  "display_id" INTEGER,
  "status" TEXT DEFAULT 'open',
  "priority" TEXT,
  "subject" TEXT,
  "assigned_user_id" TEXT,
  "team_id" TEXT,
  "snoozed_until" TIMESTAMP(3),
  "first_reply_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "waiting_since" TIMESTAMP(3),
  "unread_count" INTEGER DEFAULT 0,
  "last_activity_at" TIMESTAMP(3),
  "additional_attributes" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_messages" (
  "id" TEXT PRIMARY KEY,
  "conversation_id" TEXT,
  "workspace_id" TEXT,
  "sender_type" TEXT,
  "sender_id" TEXT,
  "content_type" TEXT DEFAULT 'text',
  "content" TEXT,
  "content_attributes" TEXT,
  "private" BOOLEAN DEFAULT FALSE,
  "status" TEXT DEFAULT 'sent',
  "external_id" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_conversation_labels" (
  "conversation_id" TEXT,
  "label_id" TEXT,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."inbox_conversation_participants" (
  "conversation_id" TEXT,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."inbox_mentions" (
  "id" TEXT PRIMARY KEY,
  "message_id" TEXT,
  "mentioned_id" TEXT,
  "read" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."inbox_agent_signatures" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "body" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspace_id", "user_id")
);
DO $$ BEGIN ALTER TABLE public."inbox_agent_signatures" ADD CONSTRAINT "inbox_agent_signatures_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."inbox_display_id_sequences" (
  "workspace_id" TEXT PRIMARY KEY,
  "last_id" INTEGER DEFAULT 0
);
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "ad_lead_id" TEXT UNIQUE;
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "last_email_opened_at" TIMESTAMP(3);
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "last_email_clicked_at" TIMESTAMP(3);
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "last_email_replied_at" TIMESTAMP(3);
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "total_emails_received" INTEGER DEFAULT 0;
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "total_opens" INTEGER DEFAULT 0;
ALTER TABLE public."contacts" ADD COLUMN IF NOT EXISTS "total_replies" INTEGER DEFAULT 0;
ALTER TABLE public."deals" ADD COLUMN IF NOT EXISTS "tags_json" TEXT DEFAULT '[]';
ALTER TABLE public."deals" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE public."deals" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'open';
ALTER TABLE public."deals" ADD COLUMN IF NOT EXISTS "won_lost_notes" TEXT;
DO $$ BEGIN ALTER TABLE public."api_keys" ADD CONSTRAINT "api_keys_workspace_id_provider_key" UNIQUE ("workspace_id", "provider"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE public."integrations" ADD CONSTRAINT "integrations_workspace_id_provider_key" UNIQUE ("workspace_id", "provider"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."channel_connections" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "provider" TEXT,
  "label" TEXT,
  "email" TEXT,
  "credentials_json" TEXT,
  "is_active" BOOLEAN DEFAULT TRUE,
  "twilio_phone_number" TEXT,
  "outlook_subscription_id" TEXT,
  "outlook_subscription_expiry" TIMESTAMP(3),
  "gmail_history_id" TEXT,
  "last_polled_at" TIMESTAMP(3),
  "daily_send_limit" INTEGER DEFAULT 40,
  "sent_today_count" INTEGER DEFAULT 0,
  "last_sent_at" TIMESTAMP(3),
  "last_reset_at" TIMESTAMP(3),
  "status" TEXT DEFAULT 'ACTIVE',
  "consecutive_bounces" INTEGER DEFAULT 0,
  "min_delay_seconds" INTEGER DEFAULT 90,
  "max_delay_seconds" INTEGER DEFAULT 180,
  "warmup_day" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspace_id", "provider", "email")
);
DO $$ BEGIN ALTER TABLE public."channel_connections" ADD CONSTRAINT "channel_connections_workspace_id_provider_email_key" UNIQUE ("workspace_id", "provider", "email"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "external_id" TEXT;
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "channel_connection_id" TEXT;
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMP(3);
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "assigned_user_id" TEXT;
ALTER TABLE public."conversations" ADD COLUMN IF NOT EXISTS "starred" BOOLEAN DEFAULT FALSE;
ALTER TABLE public."conversation_messages" ADD COLUMN IF NOT EXISTS "external_id" TEXT;
ALTER TABLE public."conversation_messages" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'sent';
ALTER TABLE public."conversation_messages" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE public."conversation_messages" ADD COLUMN IF NOT EXISTS "error_msg" TEXT;
ALTER TABLE public."pipelines" ADD COLUMN IF NOT EXISTS "stale_threshold_days" INTEGER DEFAULT 14;
ALTER TABLE public."pipelines" ADD COLUMN IF NOT EXISTS "allow_stage_skip" BOOLEAN DEFAULT TRUE;
ALTER TABLE public."pipelines" ADD COLUMN IF NOT EXISTS "enable_line_items" BOOLEAN DEFAULT FALSE;
ALTER TABLE public."pipelines" ADD COLUMN IF NOT EXISTS "visible_tabs_json" TEXT DEFAULT '[\"overview\",\"activity\",\"line_items\",\"files\",\"automations\"]';
ALTER TABLE public."pipeline_stages" ADD COLUMN IF NOT EXISTS "is_won" BOOLEAN DEFAULT FALSE;
ALTER TABLE public."pipeline_stages" ADD COLUMN IF NOT EXISTS "is_lost" BOOLEAN DEFAULT FALSE;
ALTER TABLE public."pipeline_stages" ADD COLUMN IF NOT EXISTS "required_fields_json" TEXT DEFAULT '[]';
DO $$ BEGIN ALTER TABLE public."smart_list_items" ADD CONSTRAINT "smart_list_items_smart_list_id_contact_id_key" UNIQUE ("smart_list_id", "contact_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
ALTER TABLE public."custom_fields" ADD COLUMN IF NOT EXISTS "pipeline_id" TEXT;
ALTER TABLE public."custom_fields" ADD COLUMN IF NOT EXISTS "scope" TEXT DEFAULT 'all';
ALTER TABLE public."tags" ADD COLUMN IF NOT EXISTS "is_shared" BOOLEAN DEFAULT TRUE;
ALTER TABLE public."tags" ADD COLUMN IF NOT EXISTS "entity_type" TEXT DEFAULT 'all';
DO $$ BEGIN ALTER TABLE public."tags" ADD CONSTRAINT "tags_workspace_id_name_key" UNIQUE ("workspace_id", "name"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."won_lost_reasons" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "pipeline_id" TEXT,
  "reason" TEXT,
  "type" TEXT DEFAULT 'both',
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."opportunity_line_items" (
  "id" TEXT PRIMARY KEY,
  "deal_id" TEXT,
  "name" TEXT,
  "description" TEXT,
  "quantity" DOUBLE PRECISION DEFAULT 1,
  "unit_price" DOUBLE PRECISION DEFAULT 0,
  "subtotal" DOUBLE PRECISION DEFAULT 0,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."opportunity_activity_logs" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "deal_id" TEXT,
  "type" TEXT,
  "title" TEXT,
  "description" TEXT,
  "user_id" TEXT,
  "user_name" TEXT,
  "metadata_json" TEXT,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."opportunity_saved_views" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "pipeline_id" TEXT,
  "name" TEXT,
  "is_default" BOOLEAN DEFAULT FALSE,
  "view_type" TEXT DEFAULT 'board',
  "filters_json" TEXT DEFAULT '[]',
  "sort_json" TEXT,
  "columns_json" TEXT,
  "card_config_json" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE public."contact_relations" ADD CONSTRAINT "contact_relations_source_contact_id_target_contact_id_relationship_type_key" UNIQUE ("source_contact_id", "target_contact_id", "relationship_type"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE public."workflow_credentials" ADD CONSTRAINT "workflow_credentials_workspace_id_name_type_key" UNIQUE ("workspace_id", "name", "type"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."ad_accounts" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "platform" "AdPlatform",
  "external_account_id" TEXT,
  "account_name" TEXT,
  "access_token" TEXT,
  "refresh_token" TEXT DEFAULT '',
  "token_expires_at" TIMESTAMP(3),
  "token_last_refreshed_at" TIMESTAMP(3),
  "facebook_pages" TEXT DEFAULT '[]',
  "status" "AdAccountStatus" DEFAULT 'ACTIVE'::"AdAccountStatus",
  "connected_at" TIMESTAMP(3),
  "connected_by_user_id" TEXT,
  "last_sync_at" TIMESTAMP(3),
  "last_poll_at" TIMESTAMP(3),
  "disconnected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspace_id", "platform")
);
DO $$ BEGIN ALTER TABLE public."ad_accounts" ADD CONSTRAINT "ad_accounts_workspace_id_platform_key" UNIQUE ("workspace_id", "platform"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."ad_campaigns" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "ad_account_id" TEXT,
  "platform" "AdPlatform",
  "ad_type" "AdType",
  "platform_campaign_id" TEXT,
  "platform_ad_set_id" TEXT,
  "platform_ad_group_id" TEXT,
  "platform_ad_id" TEXT,
  "name" TEXT,
  "objective" TEXT,
  "status" "AdCampaignStatus" DEFAULT 'DRAFT'::"AdCampaignStatus",
  "rejection_reason" TEXT,
  "budget_type" "BudgetType",
  "budget_amount_cents" INTEGER,
  "schedule_type" TEXT,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "bid_strategy" TEXT,
  "target_cpa_cents" INTEGER,
  "targeting_json" TEXT DEFAULT '{}',
  "creative_json" TEXT DEFAULT '{}',
  "cached_spend_30d_cents" INTEGER DEFAULT 0,
  "cached_leads_30d" INTEGER DEFAULT 0,
  "cached_ctr_30d" DOUBLE PRECISION DEFAULT 0,
  "metrics_cached_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "last_edited_by_user_id" TEXT,
  "launched_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."ad_metric_snapshots" (
  "id" TEXT PRIMARY KEY,
  "campaign_id" TEXT,
  "date" TIMESTAMP(3),
  "spend_cents" INTEGER DEFAULT 0,
  "impressions" INTEGER DEFAULT 0,
  "clicks" INTEGER DEFAULT 0,
  "leads" INTEGER DEFAULT 0,
  "ctr" DOUBLE PRECISION DEFAULT 0,
  "cost_per_lead_cents" INTEGER,
  "synced_at" TIMESTAMP(3),
  UNIQUE ("campaign_id", "date")
);
DO $$ BEGIN ALTER TABLE public."ad_metric_snapshots" ADD CONSTRAINT "ad_metric_snapshots_campaign_id_date_key" UNIQUE ("campaign_id", "date"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."ad_leads" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "campaign_id" TEXT,
  "platform" "AdPlatform",
  "platform_lead_id" TEXT,
  "facebook_form_id" TEXT,
  "lead_name" TEXT,
  "lead_email" TEXT,
  "lead_phone" TEXT,
  "raw_data_json" TEXT DEFAULT '{}',
  "sync_status" "LeadSyncStatus" DEFAULT 'PENDING'::"LeadSyncStatus",
  "sync_error" TEXT,
  "sync_attempts" INTEGER DEFAULT 0,
  "synced_at" TIMESTAMP(3),
  "captured_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  UNIQUE ("platform", "platform_lead_id")
);
DO $$ BEGIN ALTER TABLE public."ad_leads" ADD CONSTRAINT "ad_leads_platform_platform_lead_id_key" UNIQUE ("platform", "platform_lead_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."ad_workspace_settings" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT UNIQUE,
  "default_daily_budget_cents" INTEGER,
  "lead_notifications_enabled" BOOLEAN DEFAULT TRUE,
  "lead_notification_mode" TEXT DEFAULT 'IN_APP',
  "ai_assisted_creative_default" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."ads_oauth_states" (
  "id" TEXT PRIMARY KEY,
  "state" TEXT UNIQUE,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."lead_generation_jobs" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "status" TEXT DEFAULT 'queued',
  "niche" TEXT,
  "area" TEXT,
  "max_leads" INTEGER DEFAULT 100,
  "leads_found" INTEGER DEFAULT 0,
  "leads_returned" INTEGER DEFAULT 0,
  "search_query" TEXT,
  "expanded_query" TEXT,
  "progress_pct" INTEGER DEFAULT 0,
  "message" TEXT,
  "error_message" TEXT,
  "queued_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."leads" (
  "id" TEXT PRIMARY KEY,
  "job_id" TEXT,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "source_url" TEXT,
  "discovery_engine" TEXT,
  "business_name" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT DEFAULT 'US',
  "postal_code" TEXT,
  "category" TEXT,
  "confidence_score" INTEGER,
  "phone_source" TEXT,
  "phone_validated" BOOLEAN DEFAULT FALSE,
  "is_duplicate" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."user_lead_history" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "user_id" TEXT,
  "normalized_name" TEXT,
  "city" TEXT,
  "state" TEXT,
  "phone" TEXT,
  "first_seen_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "times_returned" INTEGER DEFAULT 1,
  UNIQUE ("workspace_id", "user_id", "normalized_name", "city", "state")
);
DO $$ BEGIN ALTER TABLE public."user_lead_history" ADD CONSTRAINT "user_lead_history_workspace_id_user_id_normalized_name_city_state_key" UNIQUE ("workspace_id", "user_id", "normalized_name", "city", "state"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."daily_lead_quotas" (
  "workspace_id" TEXT,
  "user_id" TEXT,
  "date" TIMESTAMP(3),
  "leads_used" INTEGER DEFAULT 0,
  "leads_requested" INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public."help_center_portals" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT UNIQUE,
  "name" TEXT,
  "domain" TEXT,
  "color" TEXT DEFAULT '#4f46e5',
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."help_center_categories" (
  "id" TEXT PRIMARY KEY,
  "portal_id" TEXT,
  "name" TEXT,
  "description" TEXT,
  "position" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."help_center_articles" (
  "id" TEXT PRIMARY KEY,
  "portal_id" TEXT,
  "category_id" TEXT,
  "title" TEXT,
  "content" TEXT,
  "status" TEXT DEFAULT 'draft',
  "author_id" TEXT,
  "views" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."contact_segments" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "description" TEXT,
  "query_filter" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."inbox_campaigns" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "inbox_channel_id" TEXT,
  "title" TEXT,
  "message" TEXT,
  "segment_id" TEXT,
  "status" TEXT DEFAULT 'draft',
  "scheduled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."email_lists" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "double_opt_in" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."contact_list_memberships" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "contact_id" TEXT,
  "list_id" TEXT,
  "status" "SubscriptionStatus" DEFAULT 'SUBSCRIBED'::"SubscriptionStatus",
  "consent_source" "ConsentSource",
  "consent_timestamp" TIMESTAMP(3),
  UNIQUE ("contact_id", "list_id")
);
DO $$ BEGIN ALTER TABLE public."contact_list_memberships" ADD CONSTRAINT "contact_list_memberships_contact_id_list_id_key" UNIQUE ("contact_id", "list_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."email_segments" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "filter_definition" JSONB,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."email_templates" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "block_json" JSONB,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."email_campaigns" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "subject" TEXT,
  "status" "CampaignStatus" DEFAULT 'DRAFT'::"CampaignStatus",
  "draft_id" TEXT,
  "cold_contacts" BOOLEAN DEFAULT FALSE,
  "audience_summary" TEXT,
  "recipient_count" INTEGER,
  "send_window" JSONB,
  "idempotency_key" TEXT UNIQUE,
  "block_json" JSONB,
  "list_id" TEXT,
  "segment_id" TEXT,
  "smart_list_id" TEXT,
  "scheduled_at_utc" TIMESTAMP(3),
  "sent_at_utc" TIMESTAMP(3),
  "ab_test_config" JSONB,
  "multi_day_progress" JSONB,
  "daily_batch_limit" INTEGER,
  "sending_window_start" TEXT DEFAULT '09:00',
  "sending_window_end" TEXT DEFAULT '17:00',
  "sending_timezone" TEXT DEFAULT 'America/New_York',
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."campaign_recipients" (
  "id" TEXT PRIMARY KEY,
  "campaign_id" TEXT,
  "contact_id" TEXT,
  "channel_connection_id" TEXT,
  "variant" TEXT,
  "scheduled_for_date" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "opened_at" TIMESTAMP(3),
  "clicked_at" TIMESTAMP(3),
  "replied_at" TIMESTAMP(3),
  "unsubscribed_at" TIMESTAMP(3),
  "status" TEXT,
  "resend_message_id" TEXT
);
CREATE TABLE IF NOT EXISTS public."email_automations" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "status" "AutomationStatus" DEFAULT 'DRAFT'::"AutomationStatus",
  "trigger_type" "AutomationTriggerType",
  "trigger_config" JSONB,
  "canvas_json" JSONB,
  "reentry_allowed" BOOLEAN DEFAULT FALSE,
  "reentry_cooldown_days" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."automation_enrollments" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "automation_id" TEXT,
  "contact_id" TEXT,
  "current_step_id" TEXT,
  "enrolled_at" TIMESTAMP(3),
  "exited_at" TIMESTAMP(3),
  "exit_reason" "EnrollmentExitReason"
);
CREATE TABLE IF NOT EXISTS public."email_events" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "contact_id" TEXT,
  "campaign_id" TEXT,
  "automation_enrollment_id" TEXT,
  "event_type" "EmailEventType",
  "link_url" TEXT,
  "occurred_at" TIMESTAMP(3),
  "is_bot_suspected" BOOLEAN DEFAULT FALSE,
  "metadata" JSONB
);
CREATE TABLE IF NOT EXISTS public."email_suppression_entries" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "email" TEXT,
  "reason" TEXT,
  "created_at" TIMESTAMP(3),
  UNIQUE ("workspace_id", "email")
);
DO $$ BEGIN ALTER TABLE public."email_suppression_entries" ADD CONSTRAINT "email_suppression_entries_workspace_id_email_key" UNIQUE ("workspace_id", "email"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."autonomous_sdr_agents" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "name" TEXT,
  "target_icp" JSONB,
  "value_proposition" TEXT,
  "primary_offer" TEXT,
  "calendar_url" TEXT,
  "mode" "SdrMode" DEFAULT 'COPILOT'::"SdrMode",
  "status" "SdrStatus" DEFAULT 'ACTIVE'::"SdrStatus",
  "daily_limit" INTEGER DEFAULT 35,
  "sequence_config" JSONB,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."sdr_lead_dossiers" (
  "id" TEXT PRIMARY KEY,
  "agent_id" TEXT,
  "contact_id" TEXT,
  "business_name" TEXT,
  "website_url" TEXT,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "contact_name" TEXT,
  "website_summary" TEXT,
  "hook_angle" TEXT,
  "drafted_subject" TEXT,
  "drafted_body" TEXT,
  "sequence_steps" JSONB,
  "status" "DossierStatus" DEFAULT 'DRAFTED'::"DossierStatus",
  "metrics" JSONB,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."processed_webhook_events" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT,
  "event_id" TEXT,
  "status" TEXT DEFAULT 'processed',
  "meta_json" TEXT,
  "created_at" TIMESTAMP(3),
  UNIQUE ("provider", "event_id")
);
DO $$ BEGIN ALTER TABLE public."processed_webhook_events" ADD CONSTRAINT "processed_webhook_events_provider_event_id_key" UNIQUE ("provider", "event_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
CREATE TABLE IF NOT EXISTS public."sending_domains" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "domain" TEXT,
  "resend_domain_id" TEXT,
  "status" "SendingDomainStatus" DEFAULT 'PENDING'::"SendingDomainStatus",
  "region" TEXT,
  "dns_records" JSONB,
  "created_at" TIMESTAMP(3),
  "verified_at" TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS public."business_profiles" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT UNIQUE,
  "business_name" TEXT,
  "business_type" TEXT,
  "services" TEXT,
  "service_area" TEXT,
  "sender_name" TEXT,
  "reply_to_email" TEXT,
  "physical_address" TEXT,
  "booking_link" TEXT,
  "phone" TEXT,
  "customer_type" TEXT,
  "voice_description" TEXT,
  "words_to_avoid" TEXT,
  "website_url" TEXT,
  "differentiators" TEXT,
  "guarantees_proof" TEXT,
  "timezone" TEXT,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."writing_samples" (
  "id" TEXT PRIMARY KEY,
  "profile_id" TEXT,
  "title" TEXT,
  "content" TEXT,
  "source" TEXT,
  "style_summary" JSONB,
  "approved" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."campaign_drafts" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "current_phase" TEXT DEFAULT 'goal',
  "status" TEXT DEFAULT 'interviewing',
  "profile_snapshot" JSONB,
  "conversation" JSONB DEFAULT '[]',
  "checklists" JSONB DEFAULT '{}',
  "brief" JSONB,
  "brief_version" INTEGER DEFAULT 0,
  "plan" JSONB,
  "plan_version" INTEGER DEFAULT 0,
  "sequence" JSONB,
  "profile_noted_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."reaction_rules" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "draft_id" TEXT,
  "priority" INTEGER,
  "source_order" INTEGER,
  "condition" TEXT,
  "condition_params" JSONB DEFAULT '{}',
  "action" TEXT,
  "action_params" JSONB DEFAULT '{}',
  "decision_window_hours" INTEGER DEFAULT 72,
  "delay_minutes" INTEGER DEFAULT 60,
  "readback" TEXT DEFAULT '',
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."campaign_emails" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "draft_id" TEXT,
  "campaign_id" TEXT,
  "kind" TEXT DEFAULT 'scheduled',
  "order" INTEGER DEFAULT 1,
  "name" TEXT DEFAULT 'Email 1',
  "purpose" TEXT,
  "timing_rule" JSONB,
  "receives_rule" JSONB,
  "subject_variants" JSONB,
  "subject_selected" INTEGER DEFAULT 0,
  "preview_text" TEXT,
  "body_html" TEXT,
  "body_text" TEXT,
  "cta" JSONB,
  "fact_map" JSONB DEFAULT '[]',
  "versions" JSONB DEFAULT '[]',
  "status" TEXT DEFAULT 'draft',
  "scheduled_at_utc" TIMESTAMP(3),
  "cold_ack" BOOLEAN DEFAULT FALSE,
  "recipient_count" INTEGER,
  "created_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public."recipient_states" (
  "id" TEXT PRIMARY KEY,
  "workspace_id" TEXT,
  "draft_id" TEXT,
  "contact_id" TEXT,
  "current_email_id" TEXT,
  "next_email_order" INTEGER DEFAULT 1,
  "status" TEXT DEFAULT 'active',
  "first_sent_at" TIMESTAMP(3),
  "last_sent_at" TIMESTAMP(3),
  "next_send_at" TIMESTAMP(3),
  "signals" JSONB DEFAULT '{}',
  "history" JSONB DEFAULT '[]',
  UNIQUE ("workspace_id", "draft_id", "contact_id")
);
DO $$ BEGIN ALTER TABLE public."recipient_states" ADD CONSTRAINT "recipient_states_workspace_id_draft_id_contact_id_key" UNIQUE ("workspace_id", "draft_id", "contact_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
