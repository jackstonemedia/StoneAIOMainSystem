/**
 * Google Ads API service wrapper.
 * Uses the google-ads-api npm package for OAuth + campaign management.
 * Falls back gracefully when credentials are not configured.
 */

const GOOGLE_ADS_SCOPES = [
  'https://www.googleapis.com/auth/adwords',
].join(' ');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export class GoogleAdsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'GoogleAdsError';
  }
}

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleAdAccount {
  id: string;          // e.g. "123-456-7890"
  name: string;
  currencyCode: string;
  timeZone: string;
}

export interface GoogleCampaignCreatePayload {
  name: string;
  objective: string;
  budgetType: 'DAILY' | 'LIFETIME';
  budgetAmountMicros: number; // budget in micros (cents * 10000)
  bidStrategy: string;
  targetCpaMicros?: number;
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;
  keywords: Array<{ text: string; matchType: 'BROAD' | 'PHRASE' | 'EXACT' }>;
  headlines: string[];
  descriptions: string[];
  finalUrl?: string;
  locations: string[];  // location criteria IDs or names
}

export interface GoogleCampaignResult {
  campaignId: string;
  adGroupId: string;
  adId: string;
  resourceName: string;
}

export interface GoogleMetricDay {
  date: string;  // YYYY-MM-DD
  spendMicros: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
}

export interface GoogleLeadFormSubmission {
  leadId: string;
  campaignId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  rawFields: Record<string, string>;
  submittedAt: string;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || `${process.env.SERVER_URL || 'http://localhost:4000'}/api/ads/oauth/google/callback`;
  return { clientId, clientSecret, developerToken, redirectUri };
}

function assertGoogleConfigured() {
  const { clientId, clientSecret, developerToken } = getGoogleConfig();
  if (!clientId || !clientSecret || !developerToken) {
    throw new GoogleAdsError(
      'Google Ads is not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN.',
      'NOT_CONFIGURED',
    );
  }
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleConfig();
  if (!clientId) throw new GoogleAdsError('GOOGLE_ADS_CLIENT_ID not set', 'NOT_CONFIGURED');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_ADS_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  assertGoogleConfigured();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GoogleAdsError(`Token exchange failed: ${body}`, 'OAUTH_ERROR');
  }
  return res.json() as Promise<GoogleOAuthTokens>;
}

export async function refreshGoogleToken(refreshToken: string): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret } = getGoogleConfig();
  assertGoogleConfigured();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GoogleAdsError(`Token refresh failed: ${body}`, 'OAUTH_ERROR');
  }
  return res.json() as Promise<GoogleOAuthTokens>;
}

// ─── Account discovery ────────────────────────────────────────────────────────

export async function listGoogleAdAccounts(accessToken: string): Promise<GoogleAdAccount[]> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  // Google Ads API v17 — list accessible customers
  const res = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken!,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GoogleAdsError(`Failed to list ad accounts: ${body}`, 'API_ERROR');
  }
  const data = await res.json() as { resourceNames: string[] };
  const resourceNames = data.resourceNames ?? [];
  if (resourceNames.length === 0) return [];

  // Fetch account names in parallel
  const accounts = await Promise.all(
    resourceNames.map(async (rn) => {
      const customerId = rn.split('/')[1];
      try {
        const infoRes = await fetch(
          `https://googleads.googleapis.com/v17/customers/${customerId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'developer-token': developerToken!,
              'login-customer-id': customerId,
            },
          }
        );
        if (!infoRes.ok) return null;
        const info = await infoRes.json() as any;
        return {
          id: customerId,
          name: info.descriptiveName || `Account ${customerId}`,
          currencyCode: info.currencyCode || 'USD',
          timeZone: info.timeZone || 'UTC',
        } as GoogleAdAccount;
      } catch { return null; }
    })
  );
  return accounts.filter(Boolean) as GoogleAdAccount[];
}

// ─── Campaign Management ──────────────────────────────────────────────────────

export async function createGoogleCampaign(
  accessToken: string,
  customerId: string,
  payload: GoogleCampaignCreatePayload,
): Promise<GoogleCampaignResult> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken!,
    'login-customer-id': customerId,
    'Content-Type': 'application/json',
  };

  // 1. Create campaign budget
  const budgetRes = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/campaignBudgets:mutate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            amountMicros: payload.budgetAmountMicros,
            deliveryMethod: 'STANDARD',
            explicitlyShared: false,
          }
        }]
      })
    }
  );
  if (!budgetRes.ok) throw new GoogleAdsError(await budgetRes.text(), 'CAMPAIGN_CREATE_FAILED');
  const budgetData = await budgetRes.json() as any;
  const budgetResourceName: string = budgetData.results?.[0]?.resourceName;

  // 2. Create campaign
  const campaignRes = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: payload.name,
            status: 'ENABLED',
            advertisingChannelType: 'SEARCH',
            campaignBudget: budgetResourceName,
            networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false },
            startDate: payload.startDate || undefined,
            endDate: payload.endDate || undefined,
            biddingStrategy: payload.bidStrategy === 'TARGET_CPA'
              ? { targetCpa: { targetCpaMicros: payload.targetCpaMicros } }
              : { maximizeConversions: {} },
          }
        }]
      })
    }
  );
  if (!campaignRes.ok) throw new GoogleAdsError(await campaignRes.text(), 'CAMPAIGN_CREATE_FAILED');
  const campaignData = await campaignRes.json() as any;
  const campaignResourceName: string = campaignData.results?.[0]?.resourceName;
  const campaignId = campaignResourceName.split('/')[3];

  // 3. Create ad group
  const adGroupRes = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/adGroups:mutate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [{ create: { name: payload.name, campaign: campaignResourceName, status: 'ENABLED' } }]
      })
    }
  );
  if (!adGroupRes.ok) throw new GoogleAdsError(await adGroupRes.text(), 'CAMPAIGN_CREATE_FAILED');
  const adGroupData = await adGroupRes.json() as any;
  const adGroupResourceName: string = adGroupData.results?.[0]?.resourceName;
  const adGroupId = adGroupResourceName.split('/')[3];

  // 4. Create ad
  const adRes = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/adGroupAds:mutate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            adGroup: adGroupResourceName,
            status: 'ENABLED',
            ad: {
              responsiveSearchAd: {
                headlines: payload.headlines.map(h => ({ text: h })),
                descriptions: payload.descriptions.map(d => ({ text: d })),
              },
              finalUrls: payload.finalUrl ? [payload.finalUrl] : [],
            }
          }
        }]
      })
    }
  );
  if (!adRes.ok) throw new GoogleAdsError(await adRes.text(), 'CAMPAIGN_CREATE_FAILED');
  const adData = await adRes.json() as any;
  const adResourceName: string = adData.results?.[0]?.resourceName;
  const adId = adResourceName.split('/')[3];

  return { campaignId, adGroupId, adId, resourceName: campaignResourceName };
}

export async function pauseGoogleCampaign(
  accessToken: string, customerId: string, campaignId: string
): Promise<void> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status: 'PAUSED' }, updateMask: 'status' }]
      })
    }
  );
  if (!res.ok) throw new GoogleAdsError(await res.text(), 'CAMPAIGN_UPDATE_FAILED');
}

export async function resumeGoogleCampaign(
  accessToken: string, customerId: string, campaignId: string
): Promise<void> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status: 'ENABLED' }, updateMask: 'status' }]
      })
    }
  );
  if (!res.ok) throw new GoogleAdsError(await res.text(), 'CAMPAIGN_UPDATE_FAILED');
}

export async function deleteGoogleCampaign(
  accessToken: string, customerId: string, campaignId: string
): Promise<void> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operations: [{ remove: `customers/${customerId}/campaigns/${campaignId}` }]
      })
    }
  );
  if (!res.ok) throw new GoogleAdsError(await res.text(), 'CAMPAIGN_DELETE_FAILED');
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function fetchGoogleMetrics(
  accessToken: string,
  customerId: string,
  platformCampaignId: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string,
): Promise<GoogleMetricDay[]> {
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const query = `
    SELECT
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.ctr
    FROM campaign
    WHERE campaign.id = ${platformCampaignId}
      AND segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date ASC
  `.trim();

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    }
  );
  if (!res.ok) throw new GoogleAdsError(await res.text(), 'METRICS_FETCH_FAILED');
  const lines = await res.json() as any[];
  return (lines || []).flatMap((batch: any) =>
    (batch.results || []).map((r: any) => ({
      date: r.segments?.date ?? '',
      spendMicros: parseInt(r.metrics?.costMicros ?? '0', 10),
      impressions: parseInt(r.metrics?.impressions ?? '0', 10),
      clicks: parseInt(r.metrics?.clicks ?? '0', 10),
      leads: Math.round(parseFloat(r.metrics?.conversions ?? '0')),
      ctr: parseFloat(r.metrics?.ctr ?? '0'),
    }))
  );
}

// ─── Lead Form Submissions ────────────────────────────────────────────────────

export async function fetchGoogleLeadFormSubmissions(
  accessToken: string,
  customerId: string,
  platformCampaignId: string,
  since?: string,
): Promise<GoogleLeadFormSubmission[]> {
  // Google Lead Form submissions via GAQL
  assertGoogleConfigured();
  const { developerToken } = getGoogleConfig();
  const dateFilter = since ? `AND lead_form_submission_data.create_date_time >= '${since}'` : '';
  const query = `
    SELECT
      lead_form_submission_data.lead_form_submission_data_id,
      lead_form_submission_data.campaign,
      lead_form_submission_data.create_date_time,
      lead_form_submission_data.submission_date_time,
      lead_form_submission_data.column_data
    FROM lead_form_submission_data
    WHERE lead_form_submission_data.campaign = 'customers/${customerId}/campaigns/${platformCampaignId}'
    ${dateFilter}
  `.trim();

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': developerToken!,
        'login-customer-id': customerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    }
  );
  if (!res.ok) {
    console.warn('[GoogleAds] Lead form submissions query failed:', await res.text());
    return [];
  }
  const data = await res.json() as any;
  return (data.results || []).map((r: any) => {
    const raw: Record<string, string> = {};
    let name: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    for (const col of (r.leadFormSubmissionData?.columnData || [])) {
      const colType: string = col.columnId ?? '';
      const val: string = col.stringValue ?? '';
      raw[colType] = val;
      if (colType.toLowerCase().includes('full_name')) name = val;
      if (colType.toLowerCase().includes('email')) email = val;
      if (colType.toLowerCase().includes('phone_number')) phone = val;
    }
    return {
      leadId: r.leadFormSubmissionData?.leadFormSubmissionDataId ?? '',
      campaignId: platformCampaignId,
      name,
      email,
      phone,
      rawFields: raw,
      submittedAt: r.leadFormSubmissionData?.submissionDateTime ?? new Date().toISOString(),
    };
  });
}
