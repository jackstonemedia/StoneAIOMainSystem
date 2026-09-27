/**
 * Email Marketing Routes — Stone AIO
 *
 * All routes require the resolveWorkspace middleware (applied in server.ts).
 * workspaceId is read from req.workspaceId — NEVER from req.body or req.query.
 *
 * Route structure:
 *   Lists & Audience
 *     GET    /api/email-marketing/lists
 *     POST   /api/email-marketing/lists
 *     GET    /api/email-marketing/lists/:listId
 *     PATCH  /api/email-marketing/lists/:listId
 *     DELETE /api/email-marketing/lists/:listId
 *     GET    /api/email-marketing/lists/:listId/members
 *     POST   /api/email-marketing/lists/:listId/members
 *     DELETE /api/email-marketing/lists/:listId/members/:contactId
 *     POST   /api/email-marketing/lists/:listId/import
 *     GET    /api/email-marketing/lists/:listId/export
 *
 *   Segments
 *     GET    /api/email-marketing/segments
 *     POST   /api/email-marketing/segments
 *     PATCH  /api/email-marketing/segments/:segmentId
 *     DELETE /api/email-marketing/segments/:segmentId
 *     POST   /api/email-marketing/segments/:segmentId/preview  (count matching contacts)
 *
 *   Suppression
 *     GET    /api/email-marketing/suppression
 *     POST   /api/email-marketing/suppression
 *     DELETE /api/email-marketing/suppression/:email
 *
 *   Templates
 *     GET    /api/email-marketing/templates
 *     POST   /api/email-marketing/templates
 *     GET    /api/email-marketing/templates/:templateId
 *     PATCH  /api/email-marketing/templates/:templateId
 *     DELETE /api/email-marketing/templates/:templateId
 *
 *   Campaigns
 *     GET    /api/email-marketing/campaigns
 *     POST   /api/email-marketing/campaigns
 *     GET    /api/email-marketing/campaigns/:campaignId
 *     PATCH  /api/email-marketing/campaigns/:campaignId
 *     DELETE /api/email-marketing/campaigns/:campaignId
 *     POST   /api/email-marketing/campaigns/:campaignId/send
 *     POST   /api/email-marketing/campaigns/:campaignId/schedule
 *     POST   /api/email-marketing/campaigns/:campaignId/cancel
 *     GET    /api/email-marketing/campaigns/:campaignId/preview  (returns compiled HTML)
 *     GET    /api/email-marketing/campaigns/:campaignId/analytics
 *
 *   Unsubscribe (public — no auth)
 *     GET    /api/email-marketing/unsubscribe/:token
 *     POST   /api/email-marketing/unsubscribe/:token  (RFC 8058 one-click)
 */

import { Router, type Request, type Response } from 'express';
import {
  createEmailList, getEmailLists, getEmailList,
  updateEmailList, deleteEmailList,
  addContactToList, removeContactFromList, getListMemberships,
  importContactsCsv, exportListAsCsv,
  createSegment, getSegments, updateSegment, deleteSegment, evaluateSegment,
  getSuppressionList, addToSuppressionList, removeFromSuppressionList,
  unsubscribeByEmail,
} from '../services/email-marketing/audience.service.js';
import {
  createTemplate, getTemplates, getTemplate, updateTemplate, deleteTemplate,
  createCampaign, getCampaigns, getCampaign, updateCampaign, deleteCampaign,
  sendCampaign, scheduleCampaign, cancelCampaign, selectABTestWinner,
  previewCampaignHtml, getCampaignAnalytics, processScheduledCampaigns,
} from '../services/email-marketing/campaigns.service.js';
import {
  getCampaignSequenceOverview,
  markContactReplied,
  processDripSequences,
} from '../services/email-marketing/sequence-scheduler.service.js';
import {
  createSendingDomain,
  getSendingDomains,
  verifySendingDomain,
  deleteSendingDomain,
} from '../services/email-marketing/sending-domain.service.js';
import emailCopilotRouter from './email-copilot.routes.js';

// Background runner: check for due scheduled campaigns & drip sequence follow-ups
setInterval(() => {
  processScheduledCampaigns().catch(err => console.error('[ScheduledCampaigns] Background runner error:', err));
  processDripSequences().catch(err => console.error('[SequenceScheduler] Background runner error:', err));
}, 30_000);

import { ConsentSource } from '@prisma/client';

const router = Router();

// Mount AI Campaign Copilot
router.use('/ai-copilot', emailCopilotRouter);

// ── Helper ────────────────────────────────────────────────────────────────────

function getWid(req: Request): string {
  const wid = (req as any).workspaceId as string;
  if (!wid) throw new Error('workspaceId not resolved — resolveWorkspace middleware missing');
  return wid;
}

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((err: Error) => {
      console.error('[EmailMarketing] Route error:', err.message);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });
  };
}

// ── Lists ─────────────────────────────────────────────────────────────────────

router.get('/lists', asyncHandler(async (req, res) => {
  const lists = await getEmailLists(getWid(req));
  res.json(lists);
}));

router.post('/lists', asyncHandler(async (req, res) => {
  const { name, doubleOptIn } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const list = await createEmailList(getWid(req), name, doubleOptIn ?? false);
  res.status(201).json(list);
}));

router.get('/lists/:listId', asyncHandler(async (req, res) => {
  const list = await getEmailList(getWid(req), req.params.listId);
  if (!list) { res.status(404).json({ error: 'List not found' }); return; }
  res.json(list);
}));

router.patch('/lists/:listId', asyncHandler(async (req, res) => {
  const { name, doubleOptIn } = req.body;
  await updateEmailList(getWid(req), req.params.listId, { name, doubleOptIn });
  res.json({ ok: true });
}));

router.delete('/lists/:listId', asyncHandler(async (req, res) => {
  await deleteEmailList(getWid(req), req.params.listId);
  res.json({ ok: true });
}));

// ── List members ──────────────────────────────────────────────────────────────

router.get('/lists/:listId/members', asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const pageSize = parseInt(String(req.query.pageSize ?? '50'), 10);
  const result = await getListMemberships(getWid(req), req.params.listId, page, pageSize);
  res.json(result);
}));

router.post('/lists/:listId/members', asyncHandler(async (req, res) => {
  const { contactId, consentSource } = req.body;
  if (!contactId) { res.status(400).json({ error: 'contactId is required' }); return; }
  const source: ConsentSource = (consentSource as ConsentSource) || ConsentSource.MANUAL_ADD;
  const membership = await addContactToList(getWid(req), contactId, req.params.listId, source);
  res.status(201).json(membership);
}));

router.delete('/lists/:listId/members/:contactId', asyncHandler(async (req, res) => {
  await removeContactFromList(getWid(req), req.params.contactId, req.params.listId);
  res.json({ ok: true });
}));

// ── CSV import/export ─────────────────────────────────────────────────────────

router.post('/lists/:listId/import', asyncHandler(async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) { res.status(400).json({ error: 'rows must be an array' }); return; }
  const result = await importContactsCsv(getWid(req), req.params.listId, rows);
  res.json(result);
}));

router.get('/lists/:listId/export', asyncHandler(async (req, res) => {
  const csv = await exportListAsCsv(getWid(req), req.params.listId);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="list-${req.params.listId}.csv"`);
  res.send(csv);
}));

// ── Segments ──────────────────────────────────────────────────────────────────

router.get('/segments', asyncHandler(async (req, res) => {
  res.json(await getSegments(getWid(req)));
}));

router.post('/segments', asyncHandler(async (req, res) => {
  const { name, filterDefinition } = req.body;
  if (!name || !filterDefinition) { res.status(400).json({ error: 'name and filterDefinition are required' }); return; }
  res.status(201).json(await createSegment(getWid(req), name, filterDefinition));
}));

router.patch('/segments/:segmentId', asyncHandler(async (req, res) => {
  const { name, filterDefinition } = req.body;
  await updateSegment(getWid(req), req.params.segmentId, { name, filterDefinition });
  res.json({ ok: true });
}));

router.delete('/segments/:segmentId', asyncHandler(async (req, res) => {
  await deleteSegment(getWid(req), req.params.segmentId);
  res.json({ ok: true });
}));

router.post('/segments/:segmentId/preview', asyncHandler(async (req, res) => {
  const { filterDefinition } = req.body;
  const contactIds = await evaluateSegment(getWid(req), filterDefinition);
  res.json({ count: contactIds.length });
}));

// ── Suppression ───────────────────────────────────────────────────────────────

router.get('/suppression', asyncHandler(async (req, res) => {
  const page = parseInt(String(req.query.page ?? '1'), 10);
  const pageSize = parseInt(String(req.query.pageSize ?? '50'), 10);
  res.json(await getSuppressionList(getWid(req), page, pageSize));
}));

router.post('/suppression', asyncHandler(async (req, res) => {
  const { email, reason } = req.body;
  if (!email) { res.status(400).json({ error: 'email is required' }); return; }
  const entry = await addToSuppressionList(getWid(req), email, reason || 'manual');
  res.status(201).json(entry);
}));

router.delete('/suppression/:email', asyncHandler(async (req, res) => {
  await removeFromSuppressionList(getWid(req), req.params.email);
  res.json({ ok: true });
}));

// ── Templates ─────────────────────────────────────────────────────────────────

router.get('/templates', asyncHandler(async (req, res) => {
  res.json(await getTemplates(getWid(req)));
}));

router.post('/templates', asyncHandler(async (req, res) => {
  const { name, blockJson } = req.body;
  if (!name || !blockJson) { res.status(400).json({ error: 'name and blockJson are required' }); return; }
  res.status(201).json(await createTemplate(getWid(req), name, blockJson));
}));

router.get('/templates/:templateId', asyncHandler(async (req, res) => {
  const t = await getTemplate(getWid(req), req.params.templateId);
  if (!t) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(t);
}));

router.patch('/templates/:templateId', asyncHandler(async (req, res) => {
  const { name, blockJson } = req.body;
  await updateTemplate(getWid(req), req.params.templateId, { name, blockJson });
  res.json({ ok: true });
}));

router.delete('/templates/:templateId', asyncHandler(async (req, res) => {
  await deleteTemplate(getWid(req), req.params.templateId);
  res.json({ ok: true });
}));

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.get('/campaigns', asyncHandler(async (req, res) => {
  res.json(await getCampaigns(getWid(req)));
}));

router.post('/campaigns', asyncHandler(async (req, res) => {
  const { name, subject, blockJson, listId, segmentId, smartListId, scheduledAtUtc, abTestConfig } = req.body;
  if (!name || !subject || !blockJson) {
    res.status(400).json({ error: 'name, subject, and blockJson are required' }); return;
  }
  const campaign = await createCampaign(getWid(req), {
    name, subject, blockJson,
    listId: listId || null,
    segmentId: segmentId || null,
    smartListId: smartListId || null,
    scheduledAtUtc: scheduledAtUtc ? new Date(scheduledAtUtc) : null,
    abTestConfig: abTestConfig || null,
  });
  res.status(201).json(campaign);
}));

router.get('/campaigns/:campaignId', asyncHandler(async (req, res) => {
  const campaign = await getCampaign(getWid(req), req.params.campaignId);
  if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }
  res.json(campaign);
}));

router.patch('/campaigns/:campaignId', asyncHandler(async (req, res) => {
  const { name, subject, blockJson, listId, segmentId, smartListId, scheduledAtUtc, abTestConfig } = req.body;
  await updateCampaign(getWid(req), req.params.campaignId, {
    name, subject, blockJson,
    listId: listId !== undefined ? listId : undefined,
    segmentId: segmentId !== undefined ? segmentId : undefined,
    smartListId: smartListId !== undefined ? smartListId : undefined,
    scheduledAtUtc: scheduledAtUtc !== undefined ? new Date(scheduledAtUtc) : undefined,
    abTestConfig: abTestConfig !== undefined ? abTestConfig : undefined,
  });
  res.json({ ok: true });
}));

// ── Smart List Integration ───────────────────────────────────────────────────

router.post('/smart-lists/:smartListId/sync', asyncHandler(async (req, res) => {
  const { smartListId } = req.params;
  const workspaceId = getWid(req);
  const { getSmartListContacts } = await import('../services/crm.service.js');
  const { createEmailList, addContactToList } = await import('../services/email-marketing/audience.service.js');

  const contactsRes = await getSmartListContacts(smartListId, workspaceId, 1, 100000);
  if (!contactsRes || !contactsRes.contacts) {
    res.status(404).json({ error: 'Smart List not found or empty' });
    return;
  }

  const { db } = await import('../../infrastructure/database/client.js');
  const smartList = await db.smartList.findFirst({ where: { id: smartListId, workspaceId } });
  const listName = smartList ? `Smart List: ${smartList.name}` : `Smart List ${smartListId}`;
  const list = await createEmailList(workspaceId, listName, false);

  let synced = 0;
  for (const c of contactsRes.contacts) {
    if (c.email) {
      await addContactToList(workspaceId, c.id, list.id, 'MANUAL_ADD' as any);
      synced++;
    }
  }

  res.json({ success: true, listId: list.id, listName: list.name, syncedCount: synced });
}));

router.delete('/campaigns/:campaignId', asyncHandler(async (req, res) => {
  await deleteCampaign(getWid(req), req.params.campaignId);
  res.json({ ok: true });
}));

router.post('/campaigns/:campaignId/send', asyncHandler(async (req, res) => {
  const result = await sendCampaign(getWid(req), req.params.campaignId);
  res.json(result);
}));

router.post('/campaigns/:campaignId/schedule', asyncHandler(async (req, res) => {
  const { scheduledAtUtc } = req.body;
  if (!scheduledAtUtc) { res.status(400).json({ error: 'scheduledAtUtc is required' }); return; }
  await scheduleCampaign(getWid(req), req.params.campaignId, new Date(scheduledAtUtc));
  res.json({ ok: true });
}));

router.post('/campaigns/:campaignId/cancel', asyncHandler(async (req, res) => {
  await cancelCampaign(getWid(req), req.params.campaignId);
  res.json({ ok: true });
}));

router.get('/campaigns/:campaignId/preview', asyncHandler(async (req, res) => {
  const variant = (req.query.variant as 'A' | 'B') || 'A';
  const html = await previewCampaignHtml(getWid(req), req.params.campaignId, variant);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}));

router.post('/campaigns/:campaignId/select-winner', asyncHandler(async (req, res) => {
  const { winnerVariant } = req.body;
  if (!winnerVariant || (winnerVariant !== 'A' && winnerVariant !== 'B')) {
    res.status(400).json({ error: 'winnerVariant must be "A" or "B"' });
    return;
  }
  const result = await selectABTestWinner(getWid(req), req.params.campaignId, winnerVariant, true);
  res.json(result);
}));

router.post('/campaigns/:campaignId/send-test', asyncHandler(async (req, res) => {
  const { email, subject, html, fromName } = req.body;
  if (!email) { res.status(400).json({ error: 'Recipient email is required' }); return; }
  const workspaceId = getWid(req);

  const { db } = await import('../../infrastructure/database/client.js');
  let gmailConn = await db.channelConnection.findFirst({
    where: { workspaceId, provider: 'gmail', isActive: true },
  }).catch(() => null);

  if (!gmailConn) {
    gmailConn = await db.channelConnection.findFirst({
      where: { provider: 'gmail', isActive: true },
    }).catch(() => null);
  }

  if (gmailConn) {
    const { sendGmailMessage } = await import('../services/channels/gmail.service.js');
    const plainText = (html || '').replace(/<[^>]*>?/gm, '').trim();
    await sendGmailMessage(
      gmailConn.id,
      email,
      `[TEST] ${subject || 'Campaign Preview'}`,
      plainText,
      undefined,
      html,
      fromName || 'Stone AIO Preview'
    );
    res.json({ ok: true, sentTo: email });
  } else {
    // Return simulated success if no Gmail connected in dev
    res.json({ ok: true, sentTo: email, simulated: true });
  }
}));

router.get('/campaigns/:campaignId/analytics', asyncHandler(async (req, res) => {
  res.json(await getCampaignAnalytics(getWid(req), req.params.campaignId));
}));

router.get('/campaigns/:campaignId/sequence-overview', asyncHandler(async (req, res) => {
  res.json(await getCampaignSequenceOverview(getWid(req), req.params.campaignId));
}));

router.post('/campaigns/:campaignId/recipients/:contactId/reply', asyncHandler(async (req, res) => {
  res.json(await markContactReplied(getWid(req), req.params.campaignId, req.params.contactId));
}));

// ── Automations ───────────────────────────────────────────────────────────────

router.get('/automations', asyncHandler(async (req, res) => {
  const { db } = await import('../../infrastructure/database/client.js');
  const automations = await db.automation.findMany({
    where: { workspaceId: getWid(req) },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { enrollments: true } } },
  });
  res.json(automations);
}));

router.post('/automations', asyncHandler(async (req, res) => {
  const { name, triggerType, triggerConfig, canvasJson, reentryAllowed, reentryCooldownDays, status } = req.body;
  if (!name || !triggerType) { res.status(400).json({ error: 'name and triggerType are required' }); return; }
  const { db } = await import('../../infrastructure/database/client.js');
  const automation = await db.automation.create({
    data: {
      workspaceId: getWid(req),
      name,
      triggerType,
      triggerConfig: triggerConfig || {},
      canvasJson: canvasJson || { nodes: [], edges: [] },
      reentryAllowed: reentryAllowed ?? false,
      reentryCooldownDays: reentryCooldownDays ?? 0,
      status: status || 'DRAFT',
    },
  });
  res.status(201).json(automation);
}));

router.get('/automations/:automationId', asyncHandler(async (req, res) => {
  const { db } = await import('../../infrastructure/database/client.js');
  const automation = await db.automation.findFirst({ where: { id: req.params.automationId, workspaceId: getWid(req) } });
  if (!automation) { res.status(404).json({ error: 'Automation not found' }); return; }
  res.json(automation);
}));

router.patch('/automations/:automationId', asyncHandler(async (req, res) => {
  const { name, triggerConfig, canvasJson, status, reentryAllowed, reentryCooldownDays } = req.body;
  const { db } = await import('../../infrastructure/database/client.js');
  await db.automation.updateMany({
    where: { id: req.params.automationId, workspaceId: getWid(req) },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(triggerConfig !== undefined ? { triggerConfig } : {}),
      ...(canvasJson !== undefined ? { canvasJson } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(reentryAllowed !== undefined ? { reentryAllowed } : {}),
      ...(reentryCooldownDays !== undefined ? { reentryCooldownDays } : {}),
    },
  });
  res.json({ ok: true });
}));

router.delete('/automations/:automationId', asyncHandler(async (req, res) => {
  const { db } = await import('../../infrastructure/database/client.js');
  await db.automation.deleteMany({ where: { id: req.params.automationId, workspaceId: getWid(req) } });
  res.json({ ok: true });
}));

// ── Open & Click Tracking (public routes — no resolveWorkspace) ─────────────
// Registered in server.ts before resolveWorkspace middleware so recipient clicks/opens
// are tracked immediately without requiring authentication.

export async function handleTrackClick(req: Request, res: Response): Promise<void> {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
  const targetUrl = rawUrl ? decodeURIComponent(rawUrl) : '';
  let workspaceId = typeof req.query.w === 'string' ? req.query.w : '';
  const contactId = typeof req.query.c === 'string' ? req.query.c : '';
  const campaignId = typeof req.query.cmp === 'string' && req.query.cmp ? req.query.cmp : null;
  const automationEnrollmentId = typeof req.query.ae === 'string' && req.query.ae ? req.query.ae : null;

  // Safe redirect destination
  const safeUrl = (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) ? targetUrl : '/';

  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { EmailEventType } = await import('@prisma/client');

    // Auto-resolve workspaceId if missing
    if (!workspaceId) {
      if (campaignId) {
        const cmp = await db.campaign.findFirst({ where: { id: campaignId }, select: { workspaceId: true } });
        if (cmp) workspaceId = cmp.workspaceId;
      }
      if (!workspaceId && contactId) {
        const ct = await db.contact.findFirst({ where: { id: contactId }, select: { workspaceId: true } });
        if (ct) workspaceId = ct.workspaceId;
      }
    }

    if (workspaceId && contactId) {
      // 1. Record EmailEvent
      await db.emailEvent.create({
        data: {
          workspaceId,
          contactId,
          campaignId,
          automationEnrollmentId,
          eventType: EmailEventType.CLICKED,
          linkUrl: safeUrl,
        },
      });

      // 2. Update contact lastEmailClickedAt
      await db.contact.updateMany({
        where: { id: contactId, workspaceId },
        data: {
          lastEmailClickedAt: new Date(),
        },
      });

      // 3. Record contact event for CRM timeline
      try {
        await db.contactEvent.create({
          data: {
            contactId,
            type: 'email',
            title: `Clicked link in email: ${safeUrl}`,
            content: `Recipient clicked: ${safeUrl}`,
            metadataJson: JSON.stringify({ campaignId, linkUrl: safeUrl }),
          },
        });
      } catch {}

      // 4. Emit internal trigger for automations / workflows
      try {
        const { emitTrigger } = await import('../services/trigger-emitter.service.js');
        emitTrigger(workspaceId, 'campaign.clicked', {
          contactId,
          campaignId,
          linkUrl: safeUrl,
        });
      } catch {}
    }
  } catch (err) {
    console.error('[TrackClick] Error recording click event:', err);
  }

  // HTTP 302 Redirect to destination URL
  res.writeHead(302, {
    Location: safeUrl,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end();
}

export async function handleTrackOpen(req: Request, res: Response): Promise<void> {
  let workspaceId = typeof req.query.w === 'string' ? req.query.w : '';
  const contactId = typeof req.query.c === 'string' ? req.query.c : '';
  const campaignId = typeof req.query.cmp === 'string' && req.query.cmp ? req.query.cmp : null;
  const automationEnrollmentId = typeof req.query.ae === 'string' && req.query.ae ? req.query.ae : null;

  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { EmailEventType } = await import('@prisma/client');

    // Auto-resolve workspaceId if missing
    if (!workspaceId) {
      if (campaignId) {
        const cmp = await db.campaign.findFirst({ where: { id: campaignId }, select: { workspaceId: true } });
        if (cmp) workspaceId = cmp.workspaceId;
      }
      if (!workspaceId && contactId) {
        const ct = await db.contact.findFirst({ where: { id: contactId }, select: { workspaceId: true } });
        if (ct) workspaceId = ct.workspaceId;
      }
    }

    if (workspaceId && contactId) {
      // 1. Record EmailEvent
      await db.emailEvent.create({
        data: {
          workspaceId,
          contactId,
          campaignId,
          automationEnrollmentId,
          eventType: EmailEventType.OPENED,
        },
      });

      // 2. Update contact lastEmailOpenedAt
      await db.contact.updateMany({
        where: { id: contactId, workspaceId },
        data: {
          lastEmailOpenedAt: new Date(),
        },
      });

      // 3. Emit internal trigger
      try {
        const { emitTrigger } = await import('../services/trigger-emitter.service.js');
        emitTrigger(workspaceId, 'campaign.opened', {
          contactId,
          campaignId,
        });
      } catch {}
    }
  } catch (err) {
    console.error('[TrackOpen] Error recording open event:', err);
  }

  // 1x1 transparent GIF pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(pixel);
}

// Attach track routes to router as well
router.get('/track/click', handleTrackClick);
router.get('/track/open', handleTrackOpen);

// ── Sending Domains ─────────────────────────────────────────────────────────

router.get('/domains', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const domains = await getSendingDomains(wid);
  res.json(domains);
}));

router.post('/domains', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const { domain, region } = req.body;
  if (!domain || typeof domain !== 'string') {
    res.status(400).json({ error: 'Valid domain is required' });
    return;
  }
  const result = await createSendingDomain(wid, domain, region);
  res.status(201).json(result);
}));

router.post('/domains/:id/verify', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  const result = await verifySendingDomain(wid, req.params.id);
  res.json(result);
}));

router.delete('/domains/:id', asyncHandler(async (req, res) => {
  const wid = getWid(req);
  await deleteSendingDomain(wid, req.params.id);
  res.json({ success: true });
}));

// ── Unsubscribe (public routes — no resolveWorkspace) ────────────────────────
export async function handleUnsubscribeGet(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [workspaceId, contactId] = decoded.split(':');
    if (!workspaceId || !contactId) { res.status(400).send('Invalid unsubscribe link'); return; }

    const contact = await import('../../infrastructure/database/client.js').then(m =>
      m.db.contact.findFirst({ where: { id: contactId, workspaceId }, select: { email: true } })
    );
    if (!contact?.email) { res.status(404).send('Contact not found'); return; }

    await unsubscribeByEmail(workspaceId, contact.email);

    res.send(`
      <!DOCTYPE html><html><head><title>Unsubscribed</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;}
      .card{text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.08);}
      h1{color:#111827;font-size:24px;}p{color:#6b7280;}</style></head>
      <body><div class="card"><h1>You've been unsubscribed</h1>
      <p>You won't receive any more marketing emails from this sender.</p></div></body></html>
    `);
  } catch (err: any) {
    console.error('[Unsubscribe] Error:', err);
    res.status(500).send('An error occurred');
  }
}

export async function handleUnsubscribePost(req: Request, res: Response): Promise<void> {
  await handleUnsubscribeGet(req, res);
}

export default router;
