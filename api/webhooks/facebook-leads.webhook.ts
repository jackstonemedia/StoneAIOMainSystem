/**
 * Facebook Lead Ads Webhook Handler.
 * Mounted BEFORE resolveWorkspace in server.ts (no JWT required).
 * Responds immediately (200) then processes async — per Facebook's retry policy.
 */

import { Request, Response } from 'express';
import { verifyFacebookWebhookSignature } from '../services/ads/facebook-ads.service.js';
import { ingestFacebookLead } from '../services/ads/ads-lead.service.js';
import { db } from '../../infrastructure/database/client.js';
import { claimWebhookEvent } from '../../infrastructure/database/idempotency.js';

// GET — Facebook verification challenge
export function facebookLeadsWebhookVerify(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.FACEBOOK_ADS_WEBHOOK_VERIFY_TOKEN) {
    console.log('[FacebookLeadsWebhook] Verification successful');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

// POST — Lead notification from Facebook
export function facebookLeadsWebhookPost(req: Request, res: Response) {
  // Respond immediately to prevent Facebook retry
  res.status(200).send('EVENT_RECEIVED');

  // Async processing
  processLeadEvent(req).catch(err => {
    console.error('[FacebookLeadsWebhook] Processing error:', err);
  });
}

async function processLeadEvent(req: Request) {
  const rawBody: Buffer = (req as any).rawBody;
  const signature = req.headers['x-hub-signature-256'] as string;

  if (rawBody && signature) {
    if (!verifyFacebookWebhookSignature(rawBody, signature)) {
      console.warn('[FacebookLeadsWebhook] Invalid signature — ignoring event');
      return;
    }
  }

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of (body.entry ?? [])) {
    for (const change of (entry.changes ?? [])) {
      if (change.field !== 'leadgen') continue;

      const value = change.value;
      if (!value?.leadgen_id || !value?.ad_id || !value?.campaign_id) continue;

      // P1.2: Check idempotency to prevent duplicate lead ingestion
      const isNew = await claimWebhookEvent('meta', value.leadgen_id, { campaign_id: value.campaign_id, ad_id: value.ad_id });
      if (!isNew) {
        console.log(`[FacebookLeadsWebhook] Duplicate leadgen_id ${value.leadgen_id} ignored.`);
        continue;
      }

      // Resolve workspace from the ad account that owns this campaign
      const campaign = await db.adCampaign.findFirst({
        where: { platformCampaignId: value.campaign_id, platform: 'FACEBOOK' },
        select: { workspaceId: true, id: true, name: true },
      });

      if (!campaign) {
        console.warn(`[FacebookLeadsWebhook] No campaign found for id=${value.campaign_id}`);
        continue;
      }

      // Fetch full lead data from Facebook
      try {
        const adAccount = await db.adAccount.findFirst({
          where: { workspaceId: campaign.workspaceId, platform: 'FACEBOOK' },
        });
        if (!adAccount) continue;

        // Fetch lead details from Facebook Graph API
        const { decryptString } = await import('../services/channels/encryption.js');
        const accessToken = decryptString(adAccount.accessToken);

        const leadRes = await fetch(
          `https://graph.facebook.com/v19.0/${value.leadgen_id}?fields=id,created_time,ad_id,campaign_id,field_data&access_token=${accessToken}`
        );

        if (!leadRes.ok) {
          console.warn('[FacebookLeadsWebhook] Failed to fetch lead details');
          continue;
        }

        const leadData = await leadRes.json() as any;
        const rawFields: Record<string, string> = {};
        let name: string | null = null;
        let email: string | null = null;
        let phone: string | null = null;

        for (const f of (leadData.field_data ?? [])) {
          rawFields[f.name] = f.values?.[0] ?? '';
          if (f.name === 'full_name') name = f.values?.[0] ?? null;
          if (f.name === 'email') email = f.values?.[0] ?? null;
          if (f.name === 'phone_number') phone = f.values?.[0] ?? null;
        }

        await ingestFacebookLead({
          leadId: leadData.id,
          adId: leadData.ad_id ?? value.ad_id,
          campaignId: value.campaign_id,
          name,
          email,
          phone,
          rawFields,
          createdAt: leadData.created_time ?? new Date().toISOString(),
        }, campaign.workspaceId);

        console.log(`[FacebookLeadsWebhook] Ingested lead ${leadData.id} for workspace ${campaign.workspaceId}`);
      } catch (err) {
        console.error('[FacebookLeadsWebhook] Error ingesting lead:', err);
      }
    }
  }
}
