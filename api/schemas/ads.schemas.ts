import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const AdPlatformSchema = z.enum(['GOOGLE', 'FACEBOOK']);
export const AdTypeSchema = z.enum(['GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'FACEBOOK_FEED', 'FACEBOOK_LEAD']);
export const BudgetTypeSchema = z.enum(['DAILY', 'LIFETIME']);
export const AdCampaignStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'DRAFT', 'ENDED', 'REJECTED']);

// ─── Lead Form Field ──────────────────────────────────────────────────────────
export const LeadFormFieldSchema = z.object({
  id: z.string(),
  type: z.enum(['FULL_NAME', 'EMAIL', 'PHONE', 'COMPANY', 'ADDRESS', 'CUSTOM']),
  label: z.string().min(1),
  required: z.boolean(),
  order: z.number().int().min(0),
});

// ─── Keyword ──────────────────────────────────────────────────────────────────
export const KeywordSchema = z.object({
  text: z.string().min(1).max(80),
  matchType: z.enum(['BROAD', 'PHRASE', 'EXACT']),
});

// ─── Targeting ────────────────────────────────────────────────────────────────
export const AdTargetingSchema = z.object({
  locations: z.array(z.string()).min(1, 'At least one location required'),
  keywords: z.array(KeywordSchema).optional(),
  ageMin: z.number().int().min(13).max(65).optional(),
  ageMax: z.number().int().min(13).max(65).optional(),
  genders: z.array(z.enum(['MALE', 'FEMALE', 'ALL'])).optional(),
  interests: z.array(z.string()).optional(),
});

// ─── Creative ─────────────────────────────────────────────────────────────────
export const AdCreativeSchema = z.object({
  headlines: z.array(z.string().max(30)).min(1, 'At least one headline required'),
  descriptions: z.array(z.string().max(90)).min(1, 'At least one description required'),
  imageUrls: z.array(z.string().url()).optional(),
  videoUrl: z.string().url().optional(),
  callToAction: z.string().optional(),
  finalUrl: z.string().url().optional(),
  primaryText: z.string().max(125).optional(),
  leadFormFields: z.array(LeadFormFieldSchema).optional(),
  facebookPageId: z.string().optional(),
});

// ─── Create Campaign ──────────────────────────────────────────────────────────
export const CreateCampaignSchema = z.object({
  adType: AdTypeSchema,
  name: z.string().min(1).max(128),
  objective: z.string().min(1),
  budgetType: BudgetTypeSchema,
  budgetAmountCents: z.number().int().min(100),
  scheduleType: z.enum(['CONTINUOUS', 'SCHEDULED']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  bidStrategy: z.string().optional(),
  targetCpaCents: z.number().int().min(0).optional(),
  targeting: AdTargetingSchema,
  creative: AdCreativeSchema,
  isDraft: z.boolean().default(false),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

// ─── Update Campaign ──────────────────────────────────────────────────────────
export const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  status: AdCampaignStatusSchema.optional(),
});

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

// ─── Connect Account ──────────────────────────────────────────────────────────
export const ConnectAccountSchema = z.object({
  platform: AdPlatformSchema,
  code: z.string().min(1, 'OAuth code required'),
  accountId: z.string().min(1, 'Ad account ID required'),
  accountName: z.string().min(1, 'Account name required'),
});

export type ConnectAccountInput = z.infer<typeof ConnectAccountSchema>;

// ─── OAuth Account Pick ───────────────────────────────────────────────────────
export const PickAccountSchema = z.object({
  accountId: z.string().min(1),
  accountName: z.string().min(1),
});

// ─── Update Settings ──────────────────────────────────────────────────────────
export const UpdateSettingsSchema = z.object({
  defaultDailyBudgetCents: z.number().int().min(0).nullable().optional(),
  leadNotificationsEnabled: z.boolean().optional(),
  leadNotificationMode: z.enum(['IN_APP', 'IN_APP_AND_EMAIL']).optional(),
  aiAssistedCreativeDefault: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

// ─── AI Generate ─────────────────────────────────────────────────────────────
export const GenerateCopySchema = z.object({
  description: z.string().min(10, 'Provide at least 10 characters describing what you\'re advertising'),
  adType: AdTypeSchema,
  numVariants: z.number().int().min(1).max(5).default(3),
});

export type GenerateCopyInput = z.infer<typeof GenerateCopySchema>;

export const GenerateKeywordsSchema = z.object({
  description: z.string().min(10),
  seed: z.array(z.string()).optional(),
  numKeywords: z.number().int().min(5).max(30).default(15),
});

export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsSchema>;

// ─── Metrics Query ────────────────────────────────────────────────────────────
export const MetricsQuerySchema = z.object({
  preset: z.enum(['TODAY', 'LAST_7', 'LAST_30', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM']).default('LAST_30'),
  start: z.string().optional(),
  end: z.string().optional(),
  platform: z.enum(['ALL', 'GOOGLE', 'FACEBOOK']).default('ALL'),
  campaignId: z.string().optional(),
});

export type MetricsQueryInput = z.infer<typeof MetricsQuerySchema>;

// ─── Leads Query ─────────────────────────────────────────────────────────────
export const LeadsQuerySchema = z.object({
  campaignId: z.string().optional(),
  platform: z.enum(['ALL', 'GOOGLE', 'FACEBOOK']).default('ALL'),
  syncStatus: z.enum(['ALL', 'PENDING', 'SYNCED', 'FAILED']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
