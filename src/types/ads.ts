/** TypeScript types for the Ad Manager module. */

export type AdPlatform = 'GOOGLE' | 'FACEBOOK';
export type AdAccountStatus = 'ACTIVE' | 'NEEDS_ATTENTION' | 'DISCONNECTED';
export type AdCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ENDED' | 'REJECTED';
export type AdType = 'GOOGLE_SEARCH' | 'GOOGLE_DISPLAY' | 'FACEBOOK_FEED' | 'FACEBOOK_LEAD';
export type BudgetType = 'DAILY' | 'LIFETIME';
export type LeadSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

// ─── Date Range ───────────────────────────────────────────────────────────────
export type DateRangePreset = 'TODAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export interface DateRange {
  preset: DateRangePreset;
  start?: string; // ISO date string for CUSTOM
  end?: string;
}

// ─── Ad Account ───────────────────────────────────────────────────────────────
export interface AdAccount {
  id: string;
  workspaceId: string;
  platform: AdPlatform;
  externalAccountId: string;
  accountName: string;
  status: AdAccountStatus;
  connectedAt: string;
  connectedByUserId: string;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Ad Campaign ──────────────────────────────────────────────────────────────
export interface AdTargeting {
  locations: string[];
  // Google Search only
  keywords?: Array<{ text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }>;
  // Facebook only
  ageMin?: number;
  ageMax?: number;
  genders?: ('MALE' | 'FEMALE' | 'ALL')[];
  interests?: string[];
}

export interface AdCreative {
  headlines: string[];        // Google: up to 3, 30 chars; Facebook: 1
  descriptions: string[];     // Google: up to 2, 90 chars; Facebook: 1
  imageUrls?: string[];
  videoUrl?: string;
  callToAction?: string;
  finalUrl?: string;          // Google + Facebook (non-Lead)
  primaryText?: string;       // Facebook only
  leadFormFields?: LeadFormField[]; // Facebook Lead + Google Lead Form
  facebookPageId?: string;    // Facebook only
}

export interface LeadFormField {
  id: string;
  type: 'FULL_NAME' | 'EMAIL' | 'PHONE' | 'COMPANY' | 'ADDRESS' | 'CUSTOM';
  label: string;
  required: boolean;
  order: number;
}

export interface AdCampaign {
  id: string;
  workspaceId: string;
  adAccountId: string;
  platform: AdPlatform;
  adType: AdType;
  name: string;
  objective: string;
  status: AdCampaignStatus;
  rejectionReason?: string | null;
  budgetType: BudgetType;
  budgetAmountCents: number;
  scheduleType: 'CONTINUOUS' | 'SCHEDULED';
  startDate?: string | null;
  endDate?: string | null;
  bidStrategy?: string | null;
  targetCpaCents?: number | null;
  targeting: AdTargeting;
  creative: AdCreative;
  platformCampaignId?: string | null;
  cachedSpend30dCents: number;
  cachedLeads30d: number;
  cachedCtr30d: number;
  metricsCachedAt?: string | null;
  createdByUserId: string;
  lastEditedByUserId: string;
  launchedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
export interface AdMetricSnapshot {
  id: string;
  campaignId: string;
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  costPerLeadCents?: number | null;
}

export interface DashboardMetrics {
  totalSpendCents: number;
  totalLeads: number;
  costPerLeadCents: number | null;
  activeCampaigns: number;
  spendDeltaPct: number | null;
  leadsDeltaPct: number | null;
}

export interface DailyMetricPoint {
  date: string;
  googleSpendCents: number;
  facebookSpendCents: number;
  googleLeads: number;
  facebookLeads: number;
}

// ─── Ad Lead ──────────────────────────────────────────────────────────────────
export interface AdLead {
  id: string;
  workspaceId: string;
  campaignId: string;
  platform: AdPlatform;
  platformLeadId: string;
  facebookFormId?: string | null;
  leadName?: string | null;
  leadEmail?: string | null;
  leadPhone?: string | null;
  syncStatus: LeadSyncStatus;
  syncError?: string | null;
  syncAttempts: number;
  syncedAt?: string | null;
  capturedAt: string;
  createdAt: string;
  // Joined
  contactId?: string | null;
}

// ─── Workspace Settings ───────────────────────────────────────────────────────
export interface AdWorkspaceSettings {
  id: string;
  workspaceId: string;
  defaultDailyBudgetCents?: number | null;
  leadNotificationsEnabled: boolean;
  leadNotificationMode: 'IN_APP' | 'IN_APP_AND_EMAIL';
  aiAssistedCreativeDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response shapes ──────────────────────────────────────────────────────
export interface AdsApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CampaignWithMetrics extends AdCampaign {
  spendCents: number;
  leads: number;
  ctr: number;
  costPerLeadCents: number | null;
}

// ─── Builder form state ───────────────────────────────────────────────────────
export interface CampaignDraft {
  adType: AdType | null;
  platform: AdPlatform | null;
  // Step 1
  name: string;
  objective: string;
  targeting: Partial<AdTargeting>;
  // Step 2
  budgetType: BudgetType;
  budgetAmountCents: number;
  scheduleType: 'CONTINUOUS' | 'SCHEDULED';
  startDate?: string;
  endDate?: string;
  bidStrategy?: string;
  targetCpaCents?: number;
  // Step 3
  creative: Partial<AdCreative>;
  aiAssistedEnabled: boolean;
  aiDescription?: string;
}
