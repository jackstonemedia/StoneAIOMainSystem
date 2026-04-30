/**
 * Stone AIO — Server Bootstrap
 *
 * This file is intentionally slim: ~60 lines.
 * All route logic lives in api/routes/*.routes.ts
 * All API modules live in api/*.ts
 * Infrastructure lives in infrastructure/
 */

import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// ── Route modules (split from api/*.ts) ──────────────────────────────────────
import crmRouter        from './api/routes/crm.routes.js';
import businessRouter   from './api/routes/business.routes.js';
import settingsRouter   from './api/routes/settings.routes.js';
import notificationsRouter from './api/routes/notifications.routes.js';
import billingRouter    from './api/routes/billing.routes.js';

// ── API feature modules ───────────────────────────────────────────────────────
import workflowAiRouter   from './api/workflow-ai.js';
import chatRouter         from './api/chat.js';
import agentsRouter       from './api/agents.js';
import voiceAgentsRouter  from './api/voice-agents.js';
import crmActionsRouter   from './api/crm-actions.js';
import integrationsRouter from './api/integrations.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { errorHandler }      from './api/middleware/error.js';
import { resolveWorkspace }  from './api/middleware/workspace.js';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { db }  from './infrastructure/database/client.js';
import { env } from './infrastructure/config/env.js';

async function startServer() {
  const app = express();
  app.use(express.json());

  // ── Health ───────────────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      const aiReady = !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
      res.json({ status: 'ok', db: true, ai: aiReady });
    } catch (e) {
      console.error(e);
      const aiReady = !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
      res.status(500).json({ status: 'degraded', db: false, ai: aiReady, error: String(e) });
    }
  });

  // ── Workspace Resolution ──────────────────────────────────────────────────
  app.use('/api', resolveWorkspace);

  // ── AI / Agent routes ─────────────────────────────────────────────────────
  app.use('/api/workflow-ai',    workflowAiRouter);
  app.use('/api/conversations',  chatRouter);
  app.use('/api/crm/actions',    crmActionsRouter);
  app.use('/api/agents',         agentsRouter);
  app.use('/api/voice-agents',   voiceAgentsRouter);
  app.use('/api/integrations',   integrationsRouter);

  // ── Domain routes ─────────────────────────────────────────────────────────
  app.use('/api/crm',            crmRouter);
  app.use('/api/business',       businessRouter);
  app.use('/api/business/analytics', businessRouter); // analytics sub-path
  app.use('/api/settings',       settingsRouter);
  app.use('/api/notifications',  notificationsRouter);
  app.use('/api',                billingRouter); // stripe + public forms

  // ── Dev seed ─────────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    app.post('/api/dev/seed', async (_req, res) => {
      try {
        const { execSync } = await import('child_process');
        execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
        res.json({ success: true, message: 'Database seeded successfully' });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  }

  // ── Global error handler (must be last) ──────────────────────────────────
  app.use(errorHandler);

  // ── Vite / Static ─────────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(env.PORT, '0.0.0.0', () =>
    console.log(`✅ Stone AIO server running on http://localhost:${env.PORT}`),
  );
}

startServer();
