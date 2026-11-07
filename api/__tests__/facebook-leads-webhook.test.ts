/**
 * Facebook Lead Ads webhook — POST /api/hooks/facebook-leads.
 * Covers the 2026-11-07 fix (agent/webhook-raw-body-fix): verification was
 * inverted — the guard `if (rawBody && signature)` skipped verification
 * when the signature was missing (unsigned requests ingested), while a
 * properly signed delivery threw inside Hmac.update because rawBody was
 * the parsed object, not a Buffer (route-level raw() after the global
 * json() is a no-op), and was dropped. The raw bytes are now captured
 * before json() and verification is mandatory whenever
 * FACEBOOK_ADS_APP_SECRET is configured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { facebookLeadsWebhookPost } from '../webhooks/facebook-leads.webhook.js';
import { ingestFacebookLead } from '../services/ads/ads-lead.service.js';

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    adCampaign: {
      findFirst: vi.fn().mockResolvedValue({ workspaceId: 'ws_test', id: 'cmp_1', name: 'Test' }),
    },
    adAccount: {
      findFirst: vi.fn().mockResolvedValue({ accessToken: 'enc_dummy' }),
    },
  },
}));

vi.mock('../../infrastructure/database/idempotency.js', () => ({
  claimWebhookEvent: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/ads/ads-lead.service.js', () => ({
  ingestFacebookLead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/channels/encryption.js', () => ({
  decryptString: vi.fn((s: string) => s),
  encryptString: vi.fn((s: string) => s),
}));

const APP_SECRET = 'test_app_secret_1234';
const OLD_ENV = { ...process.env };

const LEAD_BODY = {
  object: 'page',
  entry: [
    {
      changes: [
        {
          field: 'leadgen',
          value: { leadgen_id: 'lg_test_1', ad_id: 'ad_1', campaign_id: 'camp_1' },
        },
      ],
    },
  ],
};

function signPayload(payload: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.send = vi.fn((body?: any) => {
    res.body = body;
    return res;
  });
  return res;
}

async function postLead(opts: { signature?: string; secret?: string; rawBody?: Buffer }) {
  const payload = JSON.stringify(LEAD_BODY);
  const req: any = {
    headers: opts.signature ? { 'x-hub-signature-256': opts.signature } : {},
    body: LEAD_BODY,
    rawBody: opts.rawBody ?? Buffer.from(payload, 'utf8'),
  };
  const res = mockRes();
  facebookLeadsWebhookPost(req, res);
  expect(res.statusCode).toBe(200); // ack is immediate, processing is async
  await new Promise((r) => setTimeout(r, 100)); // let the async ingest chain settle
  return res;
}

describe('facebookLeadsWebhookPost signature verification', () => {
  beforeEach(() => {
    process.env.FACEBOOK_ADS_APP_SECRET = APP_SECRET;
    vi.mocked(global.fetch as any)?.mockReset?.();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        field_data: [
          { name: 'full_name', values: ['Test Lead'] },
          { name: 'email', values: ['lead@example.com'] },
        ],
      }),
    }) as any;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.clearAllMocks();
  });

  it('valid signature -> lead ingested once', async () => {
    const payload = JSON.stringify(LEAD_BODY);
    await postLead({ signature: signPayload(payload, APP_SECRET) });
    expect(ingestFacebookLead).toHaveBeenCalledTimes(1);
  });

  it('bad signature -> ignored, zero rows', async () => {
    const payload = JSON.stringify(LEAD_BODY);
    await postLead({ signature: signPayload(payload, 'wrong_secret_0000') });
    expect(ingestFacebookLead).not.toHaveBeenCalled();
  });

  it('missing signature with secret configured -> ignored', async () => {
    await postLead({});
    expect(ingestFacebookLead).not.toHaveBeenCalled();
  });

  it('missing signature with NO secret configured -> accepted (dev parity)', async () => {
    delete process.env.FACEBOOK_ADS_APP_SECRET;
    await postLead({});
    expect(ingestFacebookLead).toHaveBeenCalledTimes(1);
  });

  it('signed delivery with a parsed-object rawBody -> dropped, not ingested', async () => {
    // Regression: before the fix, rawBody was the parsed object and
    // Hmac.update(object) threw, so a properly signed delivery was lost.
    const payload = JSON.stringify(LEAD_BODY);
    await postLead({
      signature: signPayload(payload, APP_SECRET),
      rawBody: LEAD_BODY as any,
    });
    expect(ingestFacebookLead).not.toHaveBeenCalled();
  });
});
