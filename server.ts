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
import path from 'path';

// ── Route modules (split from api/*.ts) ──────────────────────────────────────
import crmRouter        from './api/routes/crm.routes.js';
import businessRouter   from './api/routes/business.routes.js';
import settingsRouter   from './api/routes/settings.routes.js';
import notificationsRouter from './api/routes/notifications.routes.js';
import billingRouter    from './api/routes/billing.routes.js';
import workflowRouter   from './api/workflows.js';
import tablesRouter     from './api/tables.js';

// ── API feature modules ───────────────────────────────────────────────────────
import workflowAiRouter   from './api/workflow-ai.js';
import chatRouter         from './api/chat.js';
import agentsRouter       from './api/agents.js';
import voiceAgentsRouter  from './api/voice-agents.js';
import crmActionsRouter   from './api/crm-actions.js';
import integrationsRouter from './api/integrations.js';
import { releasesRouter } from './api/releases.js';

// ── Middleware ────────────────────────────────────────────────────────────────
import { errorHandler }      from './api/middleware/error.js';
import { resolveWorkspace }  from './api/middleware/workspace.js';

// ── Channel routes + webhook handlers + realtime ─────────────────────────────
import channelsRouter from './api/routes/channels.routes.js';
import { twilioSmsHandler } from './api/webhooks/twilio-sms.handler.js';
import { outlookWebhookHandler } from './api/webhooks/outlook-messages.handler.js';
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



  // ── All inbound webhooks MUST be registered before resolveWorkspace ───────
  // These routes receive requests from Twilio, Microsoft, and Meta that do NOT
  // carry a Clerk JWT. Workspace is resolved from the payload inside each handler.

  // Native workflow engine webhooks (existing)
  app.all('/api/hooks/*', webhookHandler);

  // Twilio inbound SMS — uses urlencoded body parser (NOT global json parser)
  app.post('/api/hooks/twilio-sms', express.urlencoded({ extended: false }), twilioSmsHandler);

  // Outlook push notifications (POST = events, GET = validation challenge)
  app.post('/api/hooks/outlook-messages', outlookWebhookHandler);
  app.get('/api/hooks/outlook-messages', outlookWebhookHandler);

  // Meta (Facebook/Instagram) webhook
  // FIXED: Was at /api/integrations/webhooks/meta which ran through resolveWorkspace.
  // Meta never sends a Clerk JWT so that returned 401 on every inbound message.
  // Moved here, before resolveWorkspace, and resolves workspace from Integration table.
  app.get('/api/hooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      console.log('[Meta Webhook] Verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  app.post('/api/hooks/meta', async (req, res) => {
    res.status(200).send('EVENT_RECEIVED'); // Must respond quickly — Meta retries on timeout
    const body = req.body;
    if (body.object !== 'page' && body.object !== 'instagram') return;
    try {
      for (const entry of body.entry ?? []) {
        // entry.id is the Facebook Page ID or Instagram account ID
        const pageId = entry.id as string | undefined;
        const webhookEvent = entry.messaging?.[0];
        if (!webhookEvent?.message) continue;
        const senderId: string = webhookEvent.sender.id;
        const msgText: string = webhookEvent.message.text ?? '';
        const provider = body.object === 'instagram' ? 'instagram' : 'facebook';
        
        // Resolve workspace by matching the specific page/account ID
        const whereClause: any = { provider };
        if (pageId) whereClause.accountId = pageId;
        
        const integration = await db.integration.findFirst({
          where: whereClause,
          select: { workspaceId: true },
        });
        if (!integration) continue;
        const { workspaceId } = integration;
        let convo = await db.conversation.findFirst({
          where: { workspaceId, externalId: senderId, channel: provider as any },
        });
        if (!convo) {
          convo = await db.conversation.create({
            data: {
              workspaceId,
              channel: provider as any,
              externalId: senderId,
              status: 'open',
              lastMessageAt: new Date(),
              unreadCount: 1,
            },
          });
        }
        await db.conversationMessage.create({
          data: {
            conversationId: convo.id,
            sender: senderId,
            direction: 'inbound',
            body: msgText,
            channel: provider,
          },
        });
        await db.conversation.update({
          where: { id: convo.id },
          data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), updatedAt: new Date() },
        });
      }
    } catch (e) {
      console.error('[Meta Webhook] Error:', e);
    }
  });

  // ── Workspace Resolution (all remaining /api/* routes require JWT) ─────────
  app.use('/api', resolveWorkspace);

  // ── AI / Agent routes ─────────────────────────────────────────────────────
  app.use('/api/workflow-ai',    workflowAiRouter);
  app.use('/api/conversations',  chatRouter);
  app.use('/api/crm/actions',    crmActionsRouter);
  app.use('/api/agents',         agentsRouter);
  app.use('/api/voice-agents',   voiceAgentsRouter);
  app.use('/api/integrations',   integrationsRouter);
  app.use('/api/releases',       releasesRouter);

  // ── Domain routes ─────────────────────────────────────────────────────────
  app.use('/api/crm',            crmRouter);
  app.use('/api/business',       businessRouter);
  app.use('/api/business/analytics', businessRouter); // analytics sub-path
  app.use('/api/settings',       settingsRouter);
  app.use('/api/notifications',  notificationsRouter);
  app.use('/api',                billingRouter); // stripe + public forms
  app.use('/api/workflows',      workflowRouter);
  app.use('/api/tables',         tablesRouter);
  app.use('/api/channels',       channelsRouter);

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

    // Background job for resuming paused native runs (Wait node)
    setInterval(async () => {
      try {
        const { engineService } = await import('./api/services/workflow-engine/engine.service.js');
        const pausedRuns = await db.workflowRun.findMany({
          where: { status: 'PAUSED', resumeAt: { lte: new Date() } }
        });
        for (const run of pausedRuns) {
          await engineService.resumeRun(run.id).catch((err: unknown) => 
            console.error(`Failed to resume run ${run.id}:`, err)
          );
        }
      } catch (err) {
        console.error('Error in pause resume background job', err);
      }
    }, 60 * 1000); // Check every minute


  });
}

startServer();
