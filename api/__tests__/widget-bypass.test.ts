/**
 * Complete-platform item 10 — the public widget must serve token-less.
 *
 * The widget router authenticates with its own inbox embed token
 * (resolveInboxChannel), not a Clerk JWT — but it sits behind the global
 * `app.use('/api', resolveWorkspace)`, which 401s a token-less request
 * in production before the widget router ever runs. resolveWorkspace now
 * bypasses /widget/* the same way it bypasses OAuth callbacks and form
 * capture. These tests mount the real middleware in production mode
 * (CLERK_SECRET_KEY set) and assert the bypass — and that a normal
 * route still 401s without a token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspaceMember: { findFirst: vi.fn(async () => ({ workspaceId: 'ws_test' })) },
  },
}));

import { resolveWorkspace } from '../middleware/workspace.js';

const OLD_ENV = { ...process.env };

function widgetApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', resolveWorkspace);
  app.get('/api/widget/channels/current', (_req, res) => res.json({ ok: true }));
  app.get('/api/crm/contacts', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('resolveWorkspace widget bypass', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.CLERK_SECRET_KEY = 'sk_test_widget_bypass';
  });

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV.NODE_ENV;
    if (OLD_ENV.CLERK_SECRET_KEY === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = OLD_ENV.CLERK_SECRET_KEY;
  });

  it('lets a token-less widget request through in production', async () => {
    const res = await request(widgetApp()).get('/api/widget/channels/current');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('still 401s a token-less request to a normal route in production', async () => {
    const res = await request(widgetApp()).get('/api/crm/contacts');
    expect(res.status).toBe(401);
  });
});
