/**
 * Integrations orphan fields + fake MCP panel — Tier 3 Tranche A, Fix 14.
 *
 * The Settings Integrations tab used to show saveable credential fields
 * (twilio_sid/token/from, google/outlook client id/secret) that no code
 * anywhere read: they were stored in the ApiKey table and nothing ever
 * queried it. Worse, the "Connected" badge was driven by that same orphan
 * store, so pasting any credential marked the integration Connected.
 * The Automations settings MCP tab was a hardcoded URL
 * (https://api.stoneaio.com/v1/mcp/env_123456) with decorative checkboxes.
 *
 * Fix: delete, don't wire. Fields + ApiKey routes + ApiKey model are gone;
 * the MCP panel is gone; "Connected" now means a real channel connection.
 * These tests pin the backend half: /api-keys is gone and /integrations
 * still reports the real connections.
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    integration: {
      findMany: vi.fn(async () => [
        { provider: 'gmail', accountId: 'acc_1' },
      ]),
    },
  },
}));

import settingsRouter from '../routes/settings.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    req.userId = 'user_1';
    next();
  });
  app.use('/api/settings', settingsRouter);
  return app;
}

describe('integrations orphan fields removal (Fix 14)', () => {
  it('GET /api-keys is gone (404)', async () => {
    const res = await request(makeApp()).get('/api/settings/api-keys');
    expect(res.status).toBe(404);
  });

  it('PUT /api-keys is gone (404)', async () => {
    const res = await request(makeApp())
      .put('/api/settings/api-keys')
      .send({ provider: 'twilio_sid', key: 'ACxxx' });
    expect(res.status).toBe(404);
  });

  it('GET /integrations still reports the real connections', async () => {
    const res = await request(makeApp()).get('/api/settings/integrations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ provider: 'gmail', connected: true, accountId: 'acc_1' }]);
  });
});
