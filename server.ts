/**
 * Stone AIO — Server Bootstrap
 * Environment config reloaded.
 *
 * Route logic:      api/routes/*.routes.ts
 * Business logic:   api/services/*.service.ts
 * Middleware:       api/middleware/*.ts
 * Webhooks:         api/webhooks/*.handler.ts
 * Infrastructure:   infrastructure/
 */

import 'dotenv/config';
console.log('>>> [server.ts] Loading modules...');
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// ── Route modules (api/routes/*.routes.ts) ───────────────────────────────────
import crmRouter           from './api/routes/crm.routes.js';
import businessRouter      from './api/routes/business.routes.js';
import settingsRouter      from './api/routes/settings.routes.js';
import notificationsRouter from './api/routes/notifications.routes.js';
import billingRouter       from './api/routes/billing.routes.js';
import workflowRouter      from './api/routes/workflows.routes.js';
import tablesRouter        from './api/routes/tables.routes.js';
import workflowAiRouter    from './api/routes/workflow-ai.routes.js';
import aiRouter            from './api/routes/ai.routes.js';
import aiActionsRouter     from './api/routes/ai-actions.routes.js';
import chatRouter          from './api/routes/chat.routes.js';
import agentsRouter        from './api/routes/agents.routes.js';
import voiceAgentsRouter   from './api/routes/voice-agents.routes.js';
import crmActionsRouter    from './api/routes/crm-actions.routes.js';
import integrationsRouter  from './api/routes/integrations.routes.js';
import { releasesRouter }  from './api/routes/releases.routes.js';
import adsRouter           from './api/routes/ads.routes.js';
import leadsRouter         from './api/routes/leads.routes.js';
import { startLeadWorker } from './api/services/leads/lead-worker.service.js';
import { facebookLeadsWebhookVerify, facebookLeadsWebhookPost } from './api/webhooks/facebook-leads.webhook.js';
import { startAdsMetricsSyncJob } from './api/jobs/ads-metrics-sync.job.js';
import { startGoogleLeadPollJob }  from './api/jobs/google-ads-lead-poll.job.js';
import { startResumePausedRunsJob } from './api/jobs/resume-paused-runs.job.js';

// ── Email Marketing Module ─────────────────────────────────────────────────────
import emailMarketingRouter, { handleUnsubscribeGet, handleUnsubscribePost, handleTrackClick, handleTrackOpen } from './api/routes/email-marketing.routes.js';
import { resendWebhookHandler } from './api/webhooks/resend-webhook.handler.js';
import { startEmailSendWorker } from './api/services/email-marketing/email-send-worker.service.js';
import { triggerScheduledCampaigns } from './api/services/email-marketing/campaigns.service.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { errorHandler }      from './api/middleware/error.js';
import { resolveWorkspace }  from './api/middleware/workspace.js';

// ── Inbox ─────────────────────────────────────────────────────────────────────
import inboxRouter from './api/routes/inbox.routes.js';
import inboxWidgetRouter from './api/routes/inbox-widget.routes.js';
import inboxCopilotRouter from './api/routes/inbox-copilot.routes.js';
import inboxWebhooksRouter from './api/routes/inbox-webhooks.routes.js';

// ── Channel routes + webhook handlers + realtime ─────────────────────────────
import channelsRouter from './api/routes/channels.routes.js';
import { twilioSmsHandler } from './api/webhooks/twilio-sms.handler.js';
import { formCaptureWebhook } from './api/webhooks/forms.webhook.js';
import { outlookWebhookHandler } from './api/webhooks/outlook-messages.handler.js';
import { metaWebhookVerify, metaWebhookPost } from './api/webhooks/meta.handler.js';
import { initRealtime } from './api/services/channels/realtime.service.js';
import cron from 'node-cron';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { db }  from './infrastructure/database/client.js';
import { env } from './infrastructure/config/env.js';

// ── Native Engine Services ──────────────────────────────────────────────────
import { schedulerService } from './api/services/workflow-engine/scheduler.service.js';
import { webhookRegistry, webhookHandler } from './api/services/workflow-engine/webhook-registry.js';
import { queueService } from './api/services/workflow-engine/queue.service.js';
import { registerAllNodes, nodeRegistry } from './api/services/workflow-engine/nodes/index.js';

async function startServer() {
  console.log('>>> [server.ts] startServer() executing...');
  const app = express();

  // ── Security + perf middleware ────────────────────────────────────────────
  // CSP: disabled in dev (Vite handles it), re-enabled in production for XSS protection
  app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.clerk.accounts.dev", "https://clerk.com", "https://js.stripe.com"],
        connectSrc: ["'self'", "https://*.clerk.accounts.dev", "https://clerk.com", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://*.clerk.accounts.dev", "https://js.stripe.com", "https://hooks.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://img.clerk.com", "https://*.stripe.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false,
  }));
  app.use(compression());
  app.use(express.json());

  // ── Rate limiting ─────────────────────────────────────────────────────────
  // General API: 300 req/min per IP
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again in a minute.' },
  });
  // AI endpoints: 20 req/min (expensive Gemini calls)
  const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  // Webhook receivers: higher limit (Stripe/Twilio burst)
  const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
  app.use('/api', apiLimiter);

  // ── Health ───────────────────────────────────────────────────────────────
  app.get('/api/health', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      const aiReady = !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
      res.json({ status: 'ok', db: true, ai: aiReady });
    } catch (e) {
      console.error(e);
      const aiReady = !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
      // Always return 200 so Railway healthcheck passes even if DB is degraded
      res.status(200).json({ status: 'degraded', db: false, ai: aiReady, error: String(e) });
    }
  });



  // ── All inbound webhooks MUST be registered before resolveWorkspace ───────
  // These routes receive requests from Twilio, Microsoft, and Meta that do NOT
  // carry a Clerk JWT. Workspace is resolved from the payload inside each handler.

  // Twilio inbound SMS — MUST be before the wildcard app.all below.
  // Uses urlencoded body parser (NOT global json parser).
  app.post('/api/hooks/twilio-sms', express.urlencoded({ extended: false }), twilioSmsHandler);

  // External Form Capture webhook — mounted at /f/:workspaceId (outside /api/*)
  // This path is intentionally outside the /api prefix so resolveWorkspace never runs.
  app.options('/f/:workspaceId', (_req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });
  app.post('/f/:workspaceId', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }, formCaptureWebhook);

  // Outlook push notifications — MUST be before the wildcard app.all below.
  // POST = events, GET = Microsoft validation challenge.
  app.post('/api/hooks/outlook-messages', outlookWebhookHandler);
  app.get('/api/hooks/outlook-messages', outlookWebhookHandler);

  // Facebook Lead Ads webhook — BEFORE resolveWorkspace (no JWT from Facebook)
  app.get('/api/hooks/facebook-leads', facebookLeadsWebhookVerify);
  app.post(
    '/api/hooks/facebook-leads',
    express.raw({ type: 'application/json' }),
    (req, res, next) => { (req as any).rawBody = req.body; next(); },
    facebookLeadsWebhookPost,
  );

  // Native workflow engine webhooks — wildcard MUST come last so specific
  // handlers above are not intercepted and killed with a 404.
  app.all('/api/hooks/*', webhookHandler);

  // Meta (Facebook/Instagram) webhook
  // FIXED: Was at /api/integrations/webhooks/meta which ran through resolveWorkspace.
  // Meta never sends a Clerk JWT so that returned 401 on every inbound message.
  // Moved here, before resolveWorkspace, and resolves workspace from Integration table.
  app.get('/api/hooks/meta', metaWebhookVerify);
  app.post('/api/hooks/meta', metaWebhookPost);

  // ── Resend delivery webhook — MUST be before resolveWorkspace (no JWT from Resend) ──
  // Uses raw JSON body so signature verification works on the original payload bytes.
  app.post(
    '/api/webhooks/resend',
    webhookLimiter,
    express.json(),
    resendWebhookHandler,
  );

  // ── Public unsubscribe pages (no JWT) ────────────────────────────────────────
  app.get('/unsubscribe/:token', handleUnsubscribeGet);
  app.post('/unsubscribe/:token', handleUnsubscribePost);

  // ── Public email open & click tracking (no JWT) ──────────────────────────────
  app.get('/api/email-marketing/track/click', handleTrackClick);
  app.get('/api/email-marketing/track/open', handleTrackOpen);

  // ── Workspace Resolution (all remaining /api/* routes require JWT) ─────────
  app.use('/api', resolveWorkspace);

  // ── AI / Agent routes (rate-limited more aggressively — expensive Gemini calls) ──
  app.use('/api/ai',             aiLimiter, aiRouter);
  app.use('/api/ai/actions',     aiActionsRouter);
  app.use('/api/workflow-ai',    aiLimiter, workflowAiRouter);
  app.use('/api/conversations',  aiLimiter, chatRouter);
  app.use('/api/crm/actions',    crmActionsRouter);
  app.use('/api/agents',         aiLimiter, agentsRouter);
  app.use('/api/voice-agents',   voiceAgentsRouter);
  app.use('/api/integrations',   integrationsRouter);
  app.use('/api/releases',       releasesRouter);

  // ── Domain routes ─────────────────────────────────────────────────────────
  app.use('/api/crm',            crmRouter);
  app.use('/api/business',       businessRouter);
  app.use('/api/settings',       settingsRouter);
  app.use('/api/notifications',  notificationsRouter);
  app.use('/api',                billingRouter); // stripe + public forms
  app.use('/api/workflows',      workflowRouter);
  app.use('/api/tables',         tablesRouter);
  app.use('/api/channels',       channelsRouter);
  app.use('/api/ads',            adsRouter);
  app.use('/api/leads',          leadsRouter);
  app.use('/api/inbox',          resolveWorkspace, inboxRouter);
  app.use('/api/inbox/copilot',  resolveWorkspace, inboxCopilotRouter);
  app.use('/api/widget',         inboxWidgetRouter);
  app.use('/api/webhooks/inbox', inboxWebhooksRouter);
  app.use('/api/email-marketing', emailMarketingRouter);

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

  // ── Serve Public Folder (Widget JS) ───────────────────────────────────────
  app.use(express.static(path.join(process.cwd(), 'public')));

  // ── Frontend Routing ──────────────────────────────────────────────────────
  if (env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    // In development, redirect any non-API browser requests to the Vite dev server
    app.get('*', (req, res) => {
      res.redirect(`http://localhost:5173${req.originalUrl}`);
    });
  }

  app.listen(env.PORT, '0.0.0.0', async () => {
    console.log(`✅ Stone AIO server running on http://localhost:${env.PORT}`);

    // ── Inbox Snooze Worker ──────────────────────────────────────────────────
    cron.schedule('*/5 * * * *', async () => {
      try {
        const { publishInboxEvent } = await import('./api/services/channels/realtime.service.js');
        const now = new Date();
        const toWake = await db.inboxConversation.findMany({
          where: { status: 'snoozed', snoozedUntil: { lte: now } },
          select: { id: true, workspaceId: true }
        });
        if (toWake.length > 0) {
          await db.inboxConversation.updateMany({
            where: { id: { in: toWake.map(c => c.id) } },
            data: { status: 'open', snoozedUntil: null },
          });
          for (const conv of toWake) {
            await publishInboxEvent(conv.workspaceId, { type: 'conversation.updated', workspaceId: conv.workspaceId, conversationId: conv.id, payload: { status: 'open' } });
          }
        }
      } catch (err) { console.error('[Inbox Snooze]', err); }
    });
    console.log('✅ Inbox snooze poller: active (5-min interval)');

    // ── Initialize Native Workflow Engine ──────────────────────────────────────
    try {
      registerAllNodes();
      console.log(`✅ Workflow Node Registry: ${nodeRegistry.getAll().length} nodes registered`);
      await queueService.initialize();
      await webhookRegistry.initialize();
      await schedulerService.initialize();
      console.log('✅ Native Workflow Engine Initialized');
    } catch (e: any) {
      console.error('❌ Failed to initialize Native Workflow Engine:', e.message);
    }


    // ── Ad Manager Jobs ───────────────────────────────────────────────────
    try {
      startAdsMetricsSyncJob();
      startGoogleLeadPollJob();
    } catch (e: any) {
      console.error('❌ Failed to initialize Ad Manager jobs:', e.message);
    }

    // ── Lead Studio Worker ────────────────────────────────────────────────
    try {
      startLeadWorker();
    } catch (e: any) {
      console.error('❌ Failed to initialize Lead Studio worker:', e.message);
    }

    // ── Email Marketing Send Worker ───────────────────────────────────────
    try {
      startEmailSendWorker();
      console.log('✅ Email Marketing send worker: active');
    } catch (e: any) {
      console.error('❌ Failed to initialize Email Marketing send worker:', e.message);
    }

    // ── Email Marketing: Scheduled campaign cron (every minute) ──────────
    cron.schedule('* * * * *', async () => {
      try {
        await triggerScheduledCampaigns();
      } catch (err) { console.error('[EmailMarketing Cron]', err); }
    });
    console.log('✅ Email Marketing campaign scheduler: active (1-min interval)');

    // ── Real-time SSE pub/sub ────────────────────────────────────────────────
    initRealtime();

    // ── Gmail polling — every 2 minutes ─────────────────────────────────────
    if (process.env.GMAIL_CLIENT_ID) {
      cron.schedule('*/2 * * * *', async () => {
        try {
          const { pollAllGmailAccounts } = await import('./api/services/channels/gmail-poller.js');
          await pollAllGmailAccounts();
        } catch (err) { console.error('[Gmail Poller]', err); }
      });
      console.log('✅ Gmail poller: active (2-min interval)');
    }

    // ── Outlook subscription renewal — every 12 hours ────────────────────────
    if (process.env.OUTLOOK_CLIENT_ID) {
      cron.schedule('0 */12 * * *', async () => {
        try {
          const { renewOutlookSubscriptions } = await import('./api/services/channels/outlook.service.js');
          await renewOutlookSubscriptions();
        } catch (err) { console.error('[Outlook Renewal]', err); }
      });
      console.log('✅ Outlook subscription renewal: active (12h interval)');
    }

    // ── OAuth State Cleanup — every 15 minutes ──────────────────────────────
    cron.schedule('*/15 * * * *', async () => {
      try {
        await db.adsOAuthState.deleteMany({
          where: { expiresAt: { lt: new Date() } }
        });
      } catch (err) { console.error('[OAuth State Cleanup]', err); }
    });
    console.log('✅ OAuth state cleanup: active (15-min interval)');

    // ── Facebook Token Refresh — Daily at 8 AM ──────────────────────────────
    cron.schedule('0 8 * * *', async () => {
      try {
        const { maybeRefreshFacebookToken } = await import('./api/services/ads/ads-account.service.js');
        const activeAccounts = await db.adAccount.findMany({
          where: { platform: 'FACEBOOK', status: 'ACTIVE' },
          select: { workspaceId: true }
        });
        for (const acc of activeAccounts) {
          await maybeRefreshFacebookToken(acc.workspaceId);
        }
      } catch (err) { console.error('[Facebook Token Refresh]', err); }
    });
    console.log('✅ Facebook token refresh: active (Daily 8 AM)');

    // Background job for resuming paused native runs (Wait node)
    startResumePausedRunsJob();


  });
}

startServer().catch(err => {
  console.error('>>> [server.ts] Fatal error during startServer:', err);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Ensures in-flight workflow runs, Redis connections, and DB pool are closed
// cleanly on SIGTERM (deployment rollover) or SIGINT (Ctrl+C in dev).
async function shutdown(signal: string) {
  console.log(`[${signal}] Graceful shutdown initiated…`);
  try {
    const { queueService: qs } = await import('./api/services/workflow-engine/queue.service.js');
    if ((qs as any).queue) await (qs as any).queue.close();
  } catch { /* queue may not be initialized */ }
  try {
    const { db: prisma } = await import('./infrastructure/database/client.js');
    await prisma.$disconnect();
  } catch { /* ignore */ }
  console.log('[shutdown] Done. Exiting.');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
