/**
 * Ads API Routes — 28 endpoints covering accounts, campaigns, metrics, leads, settings, AI.
 * All routes require resolveWorkspace middleware (mounted in server.ts).
 */

import { Router, Request, Response } from 'express';
import {
  initGoogleOAuth, initFacebookOAuth,
  handleGoogleCallback, handleFacebookCallback,
  completeGoogleConnect, completeFacebookConnect,
  disconnectAdAccount, getAdAccounts,
} from '../services/ads/ads-account.service.js';
import {
  createCampaignDraft, updateCampaign, launchCampaign,
  pauseCampaign, resumeCampaign, deleteCampaign, duplicateCampaign,
  bulkPauseCampaigns, bulkResumeCampaigns, bulkDeleteCampaigns,
  listCampaigns, getCampaign,
} from '../services/ads/ads-campaign.service.js';
import {
  getDashboardMetrics, getDailyChartData, getCampaignMetrics,
} from '../services/ads/ads-metrics.service.js';
import {
  listLeads, retryLeadSync,
} from '../services/ads/ads-lead.service.js';
import {
  generateAdCopy, suggestKeywords, generateAdImage,
} from '../services/ads/ads-ai.service.js';
import {
  getOrCreateSettings, updateSettings, pauseAllCampaigns,
} from '../services/ads/ads-settings.service.js';
import {
  CreateCampaignSchema, UpdateCampaignSchema, ConnectAccountSchema,
  UpdateSettingsSchema, GenerateCopySchema, GenerateKeywordsSchema,
  MetricsQuerySchema, LeadsQuerySchema,
} from '../schemas/ads.schemas.js';

const router = Router();

// ─── Error Handler Helper ─────────────────────────────────────────────────────
function handleError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code;

  if (code === 'NOT_CONFIGURED') return res.status(503).json({ error: message, code });
  if (message.includes('not found') || message.includes('No campaign')) return res.status(404).json({ error: message });
  if (message.includes('Cannot launch') || message.includes('No connected')) return res.status(400).json({ error: message });
  if (code === 'OAUTH_ERROR') return res.status(502).json({ error: message, code });

  console.error('[AdsRouter]', err);
  return res.status(500).json({ error: message });
}

// ─── OAuth — Google ───────────────────────────────────────────────────────────

// GET /api/ads/oauth/google/init
router.get('/oauth/google/init', async (req: Request, res: Response) => {
  try {
    const url = await initGoogleOAuth(req.workspaceId!, req.userId!);
    res.json({ url });
  } catch (err) { handleError(res, err); }
});

// GET /api/ads/oauth/google/callback  (browser redirect from Google)
router.get('/oauth/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (error) {
      return res.redirect(`${frontendBase}/ads/settings?oauth_error=permission_denied&platform=google`);
    }
    const result = await handleGoogleCallback(code, state);

    if (result.type === 'already_connected') {
      return res.redirect(`${frontendBase}/ads/settings?oauth_info=already_connected&platform=google`);
    }

    // Encode accounts for picker
    const encoded = encodeURIComponent(JSON.stringify(result.accounts));
    const tokEncoded = encodeURIComponent(JSON.stringify(result.tokens));
    return res.redirect(
      `${frontendBase}/ads/settings?oauth_step=pick_account&platform=google&accounts=${encoded}&tokens=${tokEncoded}`
    );
  } catch (err) {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendBase}/ads/settings?oauth_error=server_error&platform=google`);
  }
});

// POST /api/ads/oauth/google/complete  (after account picker)
router.post('/oauth/google/complete', async (req: Request, res: Response) => {
  try {
    const { tokens, accountId, accountName } = req.body;
    await completeGoogleConnect(req.workspaceId!, req.userId!, tokens, accountId, accountName);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// ─── OAuth — Facebook ─────────────────────────────────────────────────────────

// GET /api/ads/oauth/facebook/init
router.get('/oauth/facebook/init', async (req: Request, res: Response) => {
  try {
    const url = await initFacebookOAuth(req.workspaceId!, req.userId!);
    res.json({ url });
  } catch (err) { handleError(res, err); }
});

// GET /api/ads/oauth/facebook/callback
router.get('/oauth/facebook/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (error) {
      return res.redirect(`${frontendBase}/ads/settings?oauth_error=permission_denied&platform=facebook`);
    }
    const result = await handleFacebookCallback(code, state);

    if (result.type === 'already_connected') {
      return res.redirect(`${frontendBase}/ads/settings?oauth_info=already_connected&platform=facebook`);
    }

    const encoded = encodeURIComponent(JSON.stringify(result.accounts));
    const tokEncoded = encodeURIComponent(JSON.stringify(result.tokens));
    const pagesEncoded = encodeURIComponent(JSON.stringify(result.pages));
    return res.redirect(
      `${frontendBase}/ads/settings?oauth_step=pick_account&platform=facebook&accounts=${encoded}&tokens=${tokEncoded}&pages=${pagesEncoded}`
    );
  } catch (err) {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendBase}/ads/settings?oauth_error=server_error&platform=facebook`);
  }
});

// POST /api/ads/oauth/facebook/complete
router.post('/oauth/facebook/complete', async (req: Request, res: Response) => {
  try {
    const { tokens, accountId, accountName, pages } = req.body;
    await completeFacebookConnect(req.workspaceId!, req.userId!, tokens, accountId, accountName, pages);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// ─── Ad Accounts ──────────────────────────────────────────────────────────────

// GET /api/ads/accounts
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await getAdAccounts(req.workspaceId!);
    res.json(accounts);
  } catch (err) { handleError(res, err); }
});

// DELETE /api/ads/accounts/:platform
router.delete('/accounts/:platform', async (req: Request, res: Response) => {
  try {
    const platform = req.params.platform.toUpperCase() as 'GOOGLE' | 'FACEBOOK';
    if (!['GOOGLE', 'FACEBOOK'].includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
    await disconnectAdAccount(req.workspaceId!, platform);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

// GET /api/ads/campaigns
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const { platform, status, search } = req.query as Record<string, string>;
    const campaigns = await listCampaigns(req.workspaceId!, { platform, status, search });
    // Attach parsed targeting/creative
    const mapped = campaigns.map(c => ({
      ...c,
      targeting: JSON.parse(c.targetingJson),
      creative: JSON.parse(c.creativeJson),
    }));
    res.json(mapped);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    const { platform, isDraft, ...rest } = parsed.data as any;
    // platform is derived from adType
    const plat = parsed.data.adType.startsWith('GOOGLE') ? 'GOOGLE' : 'FACEBOOK';
    const campaign = await createCampaignDraft(req.workspaceId!, req.userId!, plat, parsed.data);
    res.status(201).json(campaign);
  } catch (err) { handleError(res, err); }
});

// GET /api/ads/campaigns/:id
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await getCampaign(req.params.id, req.workspaceId!);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ...campaign, targeting: JSON.parse(campaign.targetingJson), creative: JSON.parse(campaign.creativeJson) });
  } catch (err) { handleError(res, err); }
});

// PATCH /api/ads/campaigns/:id
router.patch('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const parsed = UpdateCampaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    const campaign = await updateCampaign(req.params.id, req.workspaceId!, req.userId!, parsed.data);
    res.json(campaign);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/:id/launch
router.post('/campaigns/:id/launch', async (req: Request, res: Response) => {
  try {
    const result = await launchCampaign(req.params.id, req.workspaceId!, req.userId!);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(422).json({ success: false, reason: result.reason });
    }
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/:id/pause
router.post('/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const c = await pauseCampaign(req.params.id, req.workspaceId!, req.userId!);
    res.json(c);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/:id/resume
router.post('/campaigns/:id/resume', async (req: Request, res: Response) => {
  try {
    const c = await resumeCampaign(req.params.id, req.workspaceId!, req.userId!);
    res.json(c);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/:id/duplicate
router.post('/campaigns/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const c = await duplicateCampaign(req.params.id, req.workspaceId!, req.userId!);
    res.status(201).json(c);
  } catch (err) { handleError(res, err); }
});

// DELETE /api/ads/campaigns/:id
router.delete('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    await deleteCampaign(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/bulk/pause
router.post('/campaigns/bulk/pause', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await bulkPauseCampaigns(ids, req.workspaceId!, req.userId!);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/bulk/resume
router.post('/campaigns/bulk/resume', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await bulkResumeCampaigns(ids, req.workspaceId!, req.userId!);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/campaigns/bulk/delete
router.post('/campaigns/bulk/delete', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    await bulkDeleteCampaigns(ids, req.workspaceId!);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

// GET /api/ads/metrics/dashboard
router.get('/metrics/dashboard', async (req: Request, res: Response) => {
  try {
    const { preset, platform, start, end } = req.query as Record<string, string>;
    const metrics = await getDashboardMetrics(req.workspaceId!, preset, platform, start, end);
    res.json(metrics);
  } catch (err) { handleError(res, err); }
});

// GET /api/ads/metrics/chart
router.get('/metrics/chart', async (req: Request, res: Response) => {
  try {
    const { preset, platform, start, end } = req.query as Record<string, string>;
    const data = await getDailyChartData(req.workspaceId!, preset, platform, start, end);
    res.json(data);
  } catch (err) { handleError(res, err); }
});

// GET /api/ads/metrics/campaigns/:id
router.get('/metrics/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const { preset, start, end } = req.query as Record<string, string>;
    const metrics = await getCampaignMetrics(req.params.id, req.workspaceId!, preset, start, end);
    res.json(metrics);
  } catch (err) { handleError(res, err); }
});

// ─── Leads ────────────────────────────────────────────────────────────────────

// GET /api/ads/leads
router.get('/leads', async (req: Request, res: Response) => {
  try {
    const parsed = LeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
    const result = await listLeads(req.workspaceId!, parsed.data);
    res.json(result);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/leads/:id/retry-sync
router.post('/leads/:id/retry-sync', async (req: Request, res: Response) => {
  try {
    await retryLeadSync(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (err) { handleError(res, err); }
});

// ─── AI ───────────────────────────────────────────────────────────────────────

// POST /api/ads/ai/generate-copy
router.post('/ai/generate-copy', async (req: Request, res: Response) => {
  try {
    const parsed = GenerateCopySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    const variants = await generateAdCopy(parsed.data);
    res.json({ variants });
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/ai/suggest-keywords
router.post('/ai/suggest-keywords', async (req: Request, res: Response) => {
  try {
    const parsed = GenerateKeywordsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    const keywords = await suggestKeywords(parsed.data);
    res.json({ keywords });
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/ai/generate-image
router.post('/ai/generate-image', async (req: Request, res: Response) => {
  try {
    const { description } = req.body as { description: string };
    if (!description || description.length < 10) return res.status(400).json({ error: 'Description too short' });
    const image = await generateAdImage(description);
    res.json(image);
  } catch (err) { handleError(res, err); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

// GET /api/ads/settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSettings(req.workspaceId!);
    res.json(settings);
  } catch (err) { handleError(res, err); }
});

// PATCH /api/ads/settings
router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
    const settings = await updateSettings(req.workspaceId!, parsed.data);
    res.json(settings);
  } catch (err) { handleError(res, err); }
});

// POST /api/ads/settings/pause-all
router.post('/settings/pause-all', async (req: Request, res: Response) => {
  try {
    const count = await pauseAllCampaigns(req.workspaceId!, req.userId!);
    res.json({ success: true, pausedCount: count });
  } catch (err) { handleError(res, err); }
});

export default router;
