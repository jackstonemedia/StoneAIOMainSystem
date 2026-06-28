/**
 * Facebook Marketing API service wrapper.
 * Uses raw fetch against Graph API v19.0.
 * Separate from the existing Facebook messaging integration.
 */

import crypto from 'crypto';

const FB_API_VERSION = 'v22.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const FB_AUTH_URL = 'https://www.facebook.com/dialog/oauth';
const FB_TOKEN_URL = `${FB_BASE_URL}/oauth/access_token`;
const FB_SCOPES = ['ads_management', 'ads_read', 'leads_retrieval', 'pages_manage_ads'].join(',');

export class FacebookAdsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'FacebookAdsError';
  }
}

export interface FacebookOAuthTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookAdAccount {
  id: string;          // act_XXXXXXXXXX
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number; // 1=active, 2=disabled, etc.
}

export interface FacebookCampaignCreatePayload {
  name: string;
  objective: string;  // LEAD_GENERATION, LINK_CLICKS, REACH, ENGAGEMENT
  budgetType: 'DAILY' | 'LIFETIME';
  budgetAmountCents: number;
  startTime?: string;  // ISO string
  endTime?: string;
  adType: 'FACEBOOK_FEED' | 'FACEBOOK_LEAD';
  // Targeting
  locations: string[];
  ageMin?: number;
  ageMax?: number;
  genders?: number[];  // 1=male, 2=female
  interests?: Array<{ id: string; name: string }>;
  // Creative
  pageId: string;
  headlines: string[];
  descriptions: string[];
  imageUrls?: string[];
  primaryText?: string;
  callToAction?: string;
  finalUrl?: string;
  leadFormFields?: Array<{ type: string; label: string; required: boolean }>;
}

export interface FacebookCampaignResult {
  campaignId: string;
  adSetId: string;
  adId: string;
  leadFormId?: string;
}

export interface FacebookMetricDay {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
}

export interface FacebookLeadSubmission {
  leadId: string;
  adId: string;
  campaignId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  rawFields: Record<string, string>;
  createdAt: string;
}

function getFbConfig() {
  const appId = process.env.FACEBOOK_ADS_APP_ID;
  const appSecret = process.env.FACEBOOK_ADS_APP_SECRET;
  const webhookVerifyToken = process.env.FACEBOOK_ADS_WEBHOOK_VERIFY_TOKEN;
  const redirectUri = process.env.FACEBOOK_ADS_REDIRECT_URI || `${process.env.SERVER_URL || 'http://localhost:4000'}/api/ads/oauth/facebook/callback`;
  return { appId, appSecret, webhookVerifyToken, redirectUri };
}

function assertFbConfigured() {
  const { appId, appSecret } = getFbConfig();
  if (!appId || !appSecret) {
    throw new FacebookAdsError(
      'Facebook Ads is not configured. Set FACEBOOK_ADS_APP_ID and FACEBOOK_ADS_APP_SECRET.',
      'NOT_CONFIGURED',
    );
  }
}

async function fbFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${FB_BASE_URL}${path}`;
  const res = await fetch(url, init);
  const data = await res.json() as any;
  if (data.error) {
    throw new FacebookAdsError(
      data.error.message ?? 'Facebook API error',
      String(data.error.code ?? 'API_ERROR'),
      data.error,
    );
  }
  return data as T;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildFacebookAuthUrl(state: string): string {
  const { appId, redirectUri } = getFbConfig();
  if (!appId) throw new FacebookAdsError('FACEBOOK_ADS_APP_ID not set', 'NOT_CONFIGURED');
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: FB_SCOPES,
    state,
  });
  return `${FB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string): Promise<FacebookOAuthTokens> {
  const { appId, appSecret, redirectUri } = getFbConfig();
  assertFbConfigured();
  const params = new URLSearchParams({
    client_id: appId!,
    client_secret: appSecret!,
    redirect_uri: redirectUri,
    code,
  });
  return fbFetch<FacebookOAuthTokens>(`${FB_TOKEN_URL}?${params.toString()}`);
}

export async function getLongLivedFacebookToken(shortToken: string): Promise<FacebookOAuthTokens> {
  const { appId, appSecret } = getFbConfig();
  assertFbConfigured();
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId!,
    client_secret: appSecret!,
    fb_exchange_token: shortToken,
  });
  return fbFetch<FacebookOAuthTokens>(`${FB_TOKEN_URL}?${params.toString()}`);
}

// ─── Account Discovery ────────────────────────────────────────────────────────

export async function listFacebookAdAccounts(accessToken: string): Promise<FacebookAdAccount[]> {
  assertFbConfigured();
  const data = await fbFetch<{ data: FacebookAdAccount[] }>(
    `/me/adaccounts?fields=id,name,currency,timezone_name,account_status&access_token=${accessToken}`
  );
  return data.data ?? [];
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export async function listFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const data = await fbFetch<{ data: FacebookPage[] }>(
    `/me/accounts?fields=id,name,access_token,category&access_token=${userAccessToken}`
  );
  return data.data ?? [];
}

export async function subscribePageToLeadgenWebhook(
  pageId: string,
  pageAccessToken: string,
): Promise<void> {
  await fbFetch(`/${pageId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscribed_fields: ['leadgen'],
      access_token: pageAccessToken,
    }),
  });
  console.log(`[FacebookAds] Subscribed page ${pageId} to leadgen webhook`);
}

export async function subscribeAppToWebhook(): Promise<void> {
  const { appId, appSecret, webhookVerifyToken, redirectUri } = getFbConfig();
  assertFbConfigured();
  const appAccessToken = `${appId}|${appSecret}`;
  const callbackUrl = process.env.FACEBOOK_ADS_REDIRECT_URI?.replace(
    '/api/ads/oauth/facebook/callback',
    '/api/hooks/facebook-leads'
  );
  await fbFetch(`/${appId}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'page',
      callback_url: callbackUrl,
      fields: ['leadgen'],
      verify_token: webhookVerifyToken,
      access_token: appAccessToken,
    }),
  });
  console.log('[FacebookAds] App subscribed to leadgen webhook');
}

// ─── Location name → Meta geo targeting ─────────────────────────────────────

const COUNTRY_CODES: Record<string, string> = {
  'united states': 'US', 'usa': 'US', 'us': 'US', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
  'canada': 'CA', 'australia': 'AU', 'germany': 'DE', 'france': 'FR', 'spain': 'ES', 'italy': 'IT',
  'brazil': 'BR', 'mexico': 'MX', 'japan': 'JP', 'china': 'CN', 'india': 'IN', 'south korea': 'KR',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT', 'sweden': 'SE',
  'norway': 'NO', 'denmark': 'DK', 'finland': 'FI', 'portugal': 'PT', 'ireland': 'IE',
  'new zealand': 'NZ', 'singapore': 'SG', 'hong kong': 'HK', 'uae': 'AE', 'united arab emirates': 'AE',
  'saudi arabia': 'SA', 'south africa': 'ZA', 'argentina': 'AR', 'colombia': 'CO',
  'chile': 'CL', 'peru': 'PE', 'poland': 'PL', 'czech republic': 'CZ', 'hungary': 'HU',
  'romania': 'RO', 'greece': 'GR',
};

function buildFbGeoLocations(locations: string[]): Record<string, unknown> {
  const countries: string[] = [];
  const regions: Array<{ key: string }> = [];
  const cities: Array<{ key: string }> = [];

  for (const loc of locations) {
    const lower = loc.toLowerCase().trim();
    // Check country names
    const countryCode = COUNTRY_CODES[lower];
    if (countryCode) {
      if (!countries.includes(countryCode)) countries.push(countryCode);
      continue;
    }
    // US State abbreviations or state names — use country US as fallback
    // Cities with state (e.g. "New York, NY") — just add US
    if (lower.includes(',') || lower.length === 2) {
      if (!countries.includes('US')) countries.push('US');
      continue;
    }
    // US State names without comma
    const usStateNames = ['alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware',
      'florida','georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine',
      'maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska','nevada',
      'new hampshire','new jersey','new mexico','new york','north carolina','north dakota','ohio','oklahoma',
      'oregon','pennsylvania','rhode island','south carolina','south dakota','tennessee','texas','utah',
      'vermont','virginia','washington','west virginia','wisconsin','wyoming'];
    if (usStateNames.includes(lower)) {
      if (!countries.includes('US')) countries.push('US');
      continue;
    }
    // Fallback — treat as US
    if (!countries.includes('US')) countries.push('US');
  }

  // Default to US if nothing resolved
  if (countries.length === 0 && regions.length === 0 && cities.length === 0) {
    countries.push('US');
  }

  const geoLocations: Record<string, unknown> = { location_types: ['home', 'recent'] };
  if (countries.length) geoLocations.countries = countries;
  if (regions.length) geoLocations.regions = regions;
  if (cities.length) geoLocations.cities = cities;
  return geoLocations;
}

// ─── Interest name → Meta interest ID ───────────────────────────────────────

async function resolveFbInterests(accessToken: string, interests: Array<{id: string, name: string}>): Promise<Array<{id: string, name: string}>> {
  const resolved: Array<{id: string, name: string}> = [];
  for (const item of interests) {
    // If it's already a numeric ID, keep it
    if (/^\d+$/.test(item.id)) {
      resolved.push(item);
      continue;
    }
    try {
      const data = await fbFetch<{ data: Array<{ id: string; name: string }> }>(
        `/search?type=adinterest&q=${encodeURIComponent(item.name)}&access_token=${accessToken}`
      );
      if (data.data && data.data.length > 0) {
        resolved.push({ id: data.data[0].id, name: data.data[0].name });
      }
    } catch (e) {
      console.warn(`[FacebookAds] Could not resolve interest: ${item.name}`, e);
    }
  }
  return resolved;
}

// ─── Campaign Creation (3-step: Campaign → AdSet → Ad) ───────────────────────

export async function createFacebookCampaign(
  accessToken: string,
  adAccountId: string,
  payload: FacebookCampaignCreatePayload,
  pageAccessToken?: string,
): Promise<FacebookCampaignResult> {
  assertFbConfigured();

  // Ensure adAccountId always has act_ prefix (Meta requires it)
  const actAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  const OBJECTIVE_MAP: Record<string, string> = {
    // From campaign builder objective IDs
    'LEADS': 'OUTCOME_LEADS',
    'TRAFFIC': 'OUTCOME_TRAFFIC',
    'ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
    'AWARENESS': 'OUTCOME_AWARENESS',
    'SALES': 'OUTCOME_SALES',
    // From Meta ad format types (Step 1 in builder)
    'Single Image/Video': 'OUTCOME_TRAFFIC',
    'Carousel': 'OUTCOME_TRAFFIC',
    'Collection': 'OUTCOME_TRAFFIC',
    'Stories': 'OUTCOME_AWARENESS',
    'Reels': 'OUTCOME_AWARENESS',
    // Blank or unknown
    '': 'OUTCOME_TRAFFIC',
  };
  const fbObjective = OBJECTIVE_MAP[payload.objective] ?? 'OUTCOME_TRAFFIC';

  // Derive correct optimization_goal based on objective
  const OPT_GOAL_MAP: Record<string, string> = {
    'OUTCOME_LEADS': 'LEAD_GENERATION',
    'OUTCOME_TRAFFIC': 'LINK_CLICKS',
    'OUTCOME_ENGAGEMENT': 'POST_ENGAGEMENT',
    'OUTCOME_AWARENESS': 'REACH',
    'OUTCOME_SALES': 'LINK_CLICKS',
  };
  const optimizationGoal = payload.adType === 'FACEBOOK_LEAD'
    ? 'LEAD_GENERATION'
    : (OPT_GOAL_MAP[fbObjective] ?? 'LINK_CLICKS');

  // 1. Create Campaign
  const campaign = await fbFetch<{ id: string }>(`/${actAccountId}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      objective: fbObjective,
      status: 'PAUSED',  // Start paused — user can activate from Meta Ads Manager
      access_token: accessToken,
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false, // Required for OUTCOME_* objectives in v19+
    }),
  });

  // 2. Build targeting spec
  const targeting: Record<string, unknown> = {
    geo_locations: buildFbGeoLocations(payload.locations),
    age_min: payload.ageMin ?? 18,
    age_max: payload.ageMax ?? 65,
  };
  if (payload.genders?.length) targeting.genders = payload.genders;
  if (payload.interests?.length) {
    const resolvedInterests = await resolveFbInterests(accessToken, payload.interests);
    if (resolvedInterests.length > 0) targeting.interests = resolvedInterests;
  }

  // 3. Create AdSet
  // Meta budget: daily_budget in cents (USD), minimum 100 (= $1.00)
  const budgetCents = Math.max(100, payload.budgetAmountCents);
  const adSetBody: Record<string, unknown> = {
    name: payload.name,
    campaign_id: campaign.id,
    status: 'PAUSED',
    targeting,
    billing_event: 'IMPRESSIONS',
    optimization_goal: optimizationGoal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // Required: let Meta optimize bids automatically
    access_token: accessToken,
  };
  if (optimizationGoal === 'LEAD_GENERATION') {
    adSetBody.promoted_object = { page_id: payload.pageId };
  }
  if (payload.budgetType === 'DAILY') {
    adSetBody.daily_budget = budgetCents; // Meta expects cents (e.g. 500 = $5.00)
  } else {
    adSetBody.lifetime_budget = budgetCents;
    if (payload.startTime) adSetBody.start_time = payload.startTime;
    if (payload.endTime) adSetBody.end_time = payload.endTime;
  }

  const adSet = await fbFetch<{ id: string }>(`/${actAccountId}/adsets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(adSetBody),
  });

  // 4. Create Lead Form (for FACEBOOK_LEAD type)
  let leadFormId: string | undefined;
  if (payload.adType === 'FACEBOOK_LEAD' && payload.leadFormFields?.length) {
    const formFields = payload.leadFormFields.map(f => {
      const isCustom = !['full_name', 'email', 'phone', 'first_name', 'last_name', 'company_name'].includes(f.type.toLowerCase());
      return isCustom ? {
        type: 'CUSTOM',
        key: f.type.toLowerCase(),
        label: f.label || f.type
      } : {
        type: f.type.toLowerCase()
      };
    });
    const form = await fbFetch<{ id: string }>(`/${payload.pageId}/leadgen_forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${payload.name} Lead Form`,
        questions: formFields,
        privacy_policy: { url: payload.finalUrl || 'https://stoneaio.com/privacy' },
        follow_up_action_url: payload.finalUrl || 'https://stoneaio.com',
        access_token: pageAccessToken || accessToken,
      }),
    });
    leadFormId = form.id;
  }

  // 5. Create Ad Creative
  const creativeBody: Record<string, unknown> = {
    name: payload.name,
    access_token: accessToken,
  };
  if (payload.adType === 'FACEBOOK_LEAD' && leadFormId) {
    creativeBody.object_story_spec = {
      page_id: payload.pageId,
      link_data: {
        message: payload.primaryText ?? payload.descriptions[0] ?? '',
        name: payload.headlines[0] ?? payload.name,
        link: payload.finalUrl || 'https://stoneaio.com', // Required by Meta
        call_to_action: { type: payload.callToAction?.toUpperCase() ?? 'SIGN_UP', value: { lead_gen_form_id: leadFormId } },
        ...(payload.imageUrls?.[0] ? { picture: payload.imageUrls[0] } : {}),
      }
    };
  } else {
    creativeBody.object_story_spec = {
      page_id: payload.pageId,
      link_data: {
        link: payload.finalUrl || 'https://stoneaio.com',
        message: payload.primaryText ?? payload.descriptions[0] ?? '',
        name: payload.headlines[0] ?? payload.name,
        ...(payload.imageUrls?.[0] ? { picture: payload.imageUrls[0] } : {}),
        call_to_action: { type: payload.callToAction?.toUpperCase() ?? 'LEARN_MORE', value: { link: payload.finalUrl || 'https://stoneaio.com' } },
      }
    };
  }

  const creative = await fbFetch<{ id: string }>(`/${actAccountId}/adcreatives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creativeBody),
  });

  // 6. Create Ad
  const ad = await fbFetch<{ id: string }>(`/${actAccountId}/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'ACTIVE',
      access_token: accessToken,
    }),
  });

  return { campaignId: campaign.id, adSetId: adSet.id, adId: ad.id, leadFormId };
}

export async function pauseFacebookCampaign(accessToken: string, campaignId: string): Promise<void> {
  assertFbConfigured();
  await fbFetch(`/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PAUSED', access_token: accessToken }),
  });
}

export async function resumeFacebookCampaign(accessToken: string, campaignId: string): Promise<void> {
  assertFbConfigured();
  await fbFetch(`/${campaignId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ACTIVE', access_token: accessToken }),
  });
}

export async function deleteFacebookCampaign(accessToken: string, campaignId: string): Promise<void> {
  assertFbConfigured();
  await fbFetch(`/${campaignId}?access_token=${accessToken}`, { method: 'DELETE' });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function fetchFacebookMetrics(
  accessToken: string,
  platformCampaignId: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string,
): Promise<FacebookMetricDay[]> {
  assertFbConfigured();
  const params = new URLSearchParams({
    fields: 'date_start,spend,impressions,clicks,ctr,actions',
    time_range: JSON.stringify({ since: startDate, until: endDate }),
    time_increment: '1',
    access_token: accessToken,
  });
  const data = await fbFetch<{ data: any[] }>(`/${platformCampaignId}/insights?${params.toString()}`);
  return (data.data || []).map((d: any) => {
    const leadsAction = (d.actions || []).find((a: any) => a.action_type === 'lead') ?? {};
    return {
      date_start: d.date_start,
      spend: parseFloat(d.spend ?? '0'),
      impressions: parseInt(d.impressions ?? '0', 10),
      clicks: parseInt(d.clicks ?? '0', 10),
      leads: parseInt(leadsAction.value ?? '0', 10),
      ctr: parseFloat(d.ctr ?? '0'),
    };
  });
}

// ─── Lead Retrieval ───────────────────────────────────────────────────────────

export async function fetchFacebookLeads(
  accessToken: string,
  formId: string,
): Promise<FacebookLeadSubmission[]> {
  assertFbConfigured();
  const data = await fbFetch<{ data: any[] }>(
    `/${formId}/leads?fields=id,created_time,ad_id,campaign_id,field_data&access_token=${accessToken}`
  );
  return (data.data || []).map((l: any) => {
    const raw: Record<string, string> = {};
    let name: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    for (const f of (l.field_data || [])) {
      const key: string = f.name;
      const val: string = f.values?.[0] ?? '';
      raw[key] = val;
      if (key === 'full_name') name = val;
      if (key === 'email') email = val;
      if (key === 'phone_number') phone = val;
    }
    return {
      leadId: l.id,
      adId: l.ad_id,
      campaignId: l.campaign_id,
      name,
      email,
      phone,
      rawFields: raw,
      createdAt: l.created_time,
    };
  });
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

export function verifyFacebookWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const { appSecret } = getFbConfig();
  if (!appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
}
