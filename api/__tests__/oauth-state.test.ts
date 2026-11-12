/**
 * Tier 2 Fix 1 — OAuth trust.
 * Gmail/Outlook/Meta OAuth `state` is HMAC-SHA256 signed + expiring.
 * Tampered/expired/mismatched state → 400, no binding, no token exchange.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHmac } from 'crypto';
import { signOAuthState, verifyOAuthState } from '../services/channels/oauth-state.js';

process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret-0123456789abcdef';
process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.GMAIL_CLIENT_ID = 'gmail-client-id';
process.env.META_CLIENT_ID = 'meta-client-id';
process.env.VITE_APP_URL = 'http://localhost:3000';

const { upsertMock } = vi.hoisted(() => ({
  upsertMock: vi.fn().mockResolvedValue({ id: 'conn_1' }),
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: upsertMock,
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    integration: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: upsertMock,
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../services/channels/gmail.service.js', () => ({
  getGmailAuthUrl: vi.fn((state: string) => `https://accounts.google.com/o/oauth2/auth?state=${state}`),
  exchangeGmailCode: vi.fn().mockResolvedValue({
    credentials: { access_token: 'gmail_token', refresh_token: 'gmail_refresh' },
    email: 'owner@example.com',
  }),
}));

vi.mock('../services/channels/outlook.service.js', () => ({
  getOutlookAuthUrl: vi.fn((state: string) => `https://login.microsoftonline.com/auth?state=${state}`),
  exchangeOutlookCode: vi.fn().mockResolvedValue({
    credentials: { access_token: 'outlook_token' },
    email: 'owner@example.com',
  }),
  createOutlookSubscription: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/channels/realtime.service.js', () => ({
  subscribeToWorkspace: vi.fn(() => () => {}),
}));

import axios from 'axios';
vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import channelsRouter from '../routes/channels.routes.js';
import integrationsRouter from '../routes/integrations.routes.js';

function stubAuth(app: express.Express) {
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_session';
    req.userId = 'user_session';
    next();
  });
}

function mountChannels() {
  const app = express();
  app.use(express.json());
  stubAuth(app);
  app.use('/api/channels', channelsRouter);
  return app;
}

function mountIntegrations() {
  const app = express();
  app.use(express.json());
  stubAuth(app);
  app.use('/api/integrations', integrationsRouter);
  return app;
}

describe('signOAuthState / verifyOAuthState', () => {
  it('round-trips a payload', () => {
    const raw = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
    expect(verifyOAuthState(raw)).toEqual({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
  });

  it('rejects a tampered payload', () => {
    const raw = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
    const [encoded, sig] = raw.split('.');
    const body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    body.workspaceId = 'ws_victim';
    const tampered = `${Buffer.from(JSON.stringify(body)).toString('base64url')}.${sig}`;
    expect(() => verifyOAuthState(tampered)).toThrow('Invalid OAuth state signature');
  });

  it('rejects a tampered signature', () => {
    const raw = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
    const [encoded] = raw.split('.');
    expect(() => verifyOAuthState(`${encoded}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toThrow(
      'Invalid OAuth state signature',
    );
  });

  it('rejects an expired state', () => {
    const body = { workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail', exp: Date.now() - 1000 };
    const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
    const sig = createHmac('sha256', process.env.OAUTH_STATE_SECRET!).update(encoded).digest('base64url');
    expect(() => verifyOAuthState(`${encoded}.${sig}`)).toThrow('OAuth state expired');
  });

  it('rejects a state signed with a different secret', () => {
    const raw = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
    const prev = process.env.OAUTH_STATE_SECRET;
    process.env.OAUTH_STATE_SECRET = 'a-completely-different-secret-0123456789';
    try {
      expect(() => verifyOAuthState(raw)).toThrow('Invalid OAuth state signature');
    } finally {
      process.env.OAUTH_STATE_SECRET = prev;
    }
  });

  it('rejects malformed state', () => {
    expect(() => verifyOAuthState('not-a-state')).toThrow('Invalid OAuth state');
    expect(() => verifyOAuthState('')).toThrow('Invalid OAuth state');
  });
});

describe('Gmail OAuth callback (channels router)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockResolvedValue({ id: 'conn_1' });
  });

  it('callback with tampered state → 400 and no connection stored', async () => {
    const app = mountChannels();
    const good = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'gmail' });
    const [encoded, sig] = good.split('.');
    const body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    body.workspaceId = 'ws_victim';
    const tampered = `${Buffer.from(JSON.stringify(body)).toString('base64url')}.${sig}`;

    const res = await request(app).get(`/api/channels/gmail/callback?code=authcode&state=${encodeURIComponent(tampered)}`);
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/Invalid OAuth state/);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('callback with valid signed state → binds to the state workspace', async () => {
    const app = mountChannels();
    const state = signOAuthState({ workspaceId: 'ws_state', userId: 'u_state', provider: 'gmail' });

    const res = await request(app).get(`/api/channels/gmail/callback?code=authcode&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(302);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const args = upsertMock.mock.calls[0][0];
    expect(args.where.workspaceId_provider_email.workspaceId).toBe('ws_state');
    expect(args.where.workspaceId_provider_email.email).toBe('owner@example.com');
    expect(args.create.userId).toBe('u_state');
  });

  it('callback with a state signed for another provider → 400', async () => {
    const app = mountChannels();
    const state = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'outlook' });
    const res = await request(app).get(`/api/channels/gmail/callback?code=authcode&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('connect issues a signed state (not bare base64 JSON)', async () => {
    const app = mountChannels();
    const res = await request(app).get('/api/channels/gmail/connect');
    expect(res.status).toBe(200);
    const url = res.body.url as string;
    const state = new URL(url).searchParams.get('state')!;
    expect(state).toContain('.');
    expect(verifyOAuthState(state)).toEqual({ workspaceId: 'ws_session', userId: 'user_session', provider: 'gmail' });
  });
});

describe('Meta OAuth (integrations router)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertMock.mockResolvedValue({ id: 'int_1' });
    vi.mocked(axios.get).mockImplementation(async (url: any, config: any) => {
      if (String(url).includes('oauth/access_token')) {
        if (config?.params?.grant_type === 'fb_exchange_token') return { data: { access_token: 'long_token' } } as any;
        return { data: { access_token: 'short_token' } } as any;
      }
      if (String(url).includes('/me/accounts')) return { data: { data: [{ id: 'page_1' }] } } as any;
      throw new Error(`unexpected axios.get ${url}`);
    });
  });

  it('auth URL carries a signed state param', async () => {
    const app = mountIntegrations();
    const res = await request(app).get('/api/integrations/auth/facebook');
    expect(res.status).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain('state=');
    const state = new URL(location).searchParams.get('state')!;
    expect(verifyOAuthState(state)).toEqual({ workspaceId: 'ws_session', userId: 'user_session', provider: 'facebook' });
  });

  it('callback rejects a mismatched/tampered state without exchanging any token', async () => {
    const app = mountIntegrations();
    const good = signOAuthState({ workspaceId: 'ws_1', userId: 'u_1', provider: 'facebook' });
    const [encoded, sig] = good.split('.');
    const body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    body.workspaceId = 'ws_victim';
    const tampered = `${Buffer.from(JSON.stringify(body)).toString('base64url')}.${sig}`;

    const res = await request(app).get(`/api/integrations/callback/facebook?code=authcode&state=${encodeURIComponent(tampered)}`);
    expect(res.status).toBe(400);
    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('callback with a valid signed state exchanges the token and binds the state workspace', async () => {
    const app = mountIntegrations();
    const state = signOAuthState({ workspaceId: 'ws_state', userId: 'u_state', provider: 'facebook' });

    const res = await request(app).get(`/api/integrations/callback/facebook?code=authcode&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('integration_success=true');
    expect(vi.mocked(axios.get)).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const args = upsertMock.mock.calls[0][0];
    expect(args.where.workspaceId_provider.workspaceId).toBe('ws_state');
    expect(args.create.accessToken).toBe('long_token');
  });
});
