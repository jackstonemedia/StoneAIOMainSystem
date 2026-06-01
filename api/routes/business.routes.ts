/**
 * Business Hub Routes — thin HTTP controller layer.
 * All business logic lives in api/services/business.service.ts.
 */
import { Router } from 'express';
import * as biz from '../services/business.service.js';
import { queueCampaign, getCampaignStats } from '../services/campaign-engine.js';
import { emitTrigger } from '../services/trigger-emitter.service.js';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

const err500 = (res: any, e: unknown) => {
  console.error('[Business]', e);
  res.status(500).json({ error: String(e) });
};

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get('/metrics', async (req, res) => {
  try { res.json(await biz.getBusinessMetrics(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  try { res.json(await biz.listCampaigns(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

router.post('/campaigns', async (req, res) => {
  try { res.json(await biz.createCampaign(req.workspaceId, req.body)); }
  catch (e) { err500(res, e); }
});

router.put('/campaigns/:id', async (req, res) => {
  try { res.json(await biz.updateCampaign(req.params.id, req.workspaceId, req.body)); }
  catch (e) { err500(res, e); }
});

router.delete('/campaigns/:id', async (req, res) => {
  try { await biz.deleteCampaign(req.params.id, req.workspaceId); res.json({ success: true }); }
  catch (e) { err500(res, e); }
});

router.post('/campaigns/:id/send', async (req, res) => {
  try {
    const result = await queueCampaign(req.params.id, req.workspaceId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, queued: result.queued, message: `Campaign queued for ${result.queued} contacts` });
  } catch (e) { err500(res, e); }
});

router.post('/campaigns/:id/duplicate', async (req, res) => {
  try {
    const result = await biz.duplicateCampaign(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) { err500(res, e); }
});

router.get('/campaigns/:id/stats', async (req, res) => {
  try {
    const stats = await getCampaignStats(req.params.id);
    res.json(stats);
  } catch (e) { err500(res, e); }
});

// ── Forms ─────────────────────────────────────────────────────────────────────
router.get('/forms', async (req, res) => {
  try { res.json(await biz.listForms(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

router.post('/forms', async (req, res) => {
  try { res.json(await biz.createForm(req.workspaceId, req.body)); }
  catch (e) { err500(res, e); }
});

router.put('/forms/:id', async (req, res) => {
  try { res.json(await biz.updateForm(req.params.id, req.body)); }
  catch (e) { err500(res, e); }
});

router.delete('/forms/:id', async (req, res) => {
  try {

    await db.form.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.get('/forms/:id/submissions', async (req, res) => {
  try {

    const subs = await db.formSubmission.findMany({ where: { formId: req.params.id }, orderBy: { submittedAt: 'desc' } });
    res.json(subs.map((s) => ({ ...s, data: JSON.parse((s as any).data ?? '{}') })));
  } catch (e) { res.json([]); }
});

router.post('/forms/:id/submissions', async (req, res) => {
  try {

    const sub = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
    await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } }).catch(() => {});
    
    emitTrigger(req.workspaceId, 'form.submitted', { 
      formId: req.params.id, 
      data: req.body,
      submissionId: sub.id
    }).catch(console.error);
    
    res.json(sub);
  } catch (e) { res.json({ id: `sub_${Date.now()}`, submittedAt: new Date().toISOString() }); }
});

// ── Reviews ───────────────────────────────────────────────────────────────────
router.get('/reviews', async (req, res) => {
  try { res.json(await biz.listReviews(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

router.post('/reviews', async (req, res) => {
  try {

    const { platform, rating, body, reviewerName } = req.body;
    const review = await db.review.create({
      data: {
        workspaceId: req.workspaceId,
        source: platform ?? 'google',
        rating: rating ?? 5,
        text: body ?? '',
        author: reviewerName ?? 'Anonymous',
        date: new Date()
      }
    });

    emitTrigger(req.workspaceId, 'review.received', {
      reviewId: review.id,
      platform: review.source,
      rating: review.rating,
      body: review.text,
      reviewerName: review.author,
      receivedAt: review.date.toISOString(),
    }).catch(console.error);

    res.json(review);
  } catch (e) { err500(res, e); }
});

router.put('/reviews/:id', async (req, res) => {
  try { res.json(await biz.updateReview(req.params.id, req.body)); }
  catch (e) { err500(res, e); }
});

router.delete('/reviews/:id', async (req, res) => {
  try {

    await db.review.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/reviews/request', async (req, res) => {
  try {

    await db.activity.create({
      data: { workspaceId: req.workspaceId, type: 'email', title: 'Review Request Campaign Sent', notes: `Sent review request. Message: ${req.body.message ?? ''}` },
    });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

// ── Appointments ──────────────────────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try { res.json(await biz.listAppointments(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

router.post('/appointments', async (req, res) => {
  try { res.json(await biz.createAppointment(req.workspaceId, req.body)); }
  catch (e) { err500(res, e); }
});

router.put('/appointments/:id', async (req, res) => {
  try { res.json(await biz.updateAppointment(req.params.id, req.body)); }
  catch (e) { err500(res, e); }
});

router.delete('/appointments/:id', async (req, res) => {
  try { await biz.deleteAppointment(req.params.id); res.json({ success: true }); }
  catch (e) { err500(res, e); }
});

// ── Conversations ─────────────────────────────────────────────────────────────
router.get('/conversations', async (req, res) => {
  try { res.json(await biz.listConversations(req.workspaceId)); }
  catch (e) { err500(res, e); }
});

router.post('/conversations', async (req, res) => {
  try {

    const { contactId, channel, subject } = req.body;
    if (!channel) return res.status(400).json({ error: 'channel is required' });
    const convo = await db.conversation.create({
      data: {
        workspaceId: req.workspaceId,
        contactId: contactId ?? null,
        channel,
        subject: subject ?? null,
        status: 'open',
        unreadCount: 0,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    res.json(convo);
  } catch (e) { err500(res, e); }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try { res.json(await biz.getConversationMessages(req.params.id)); }
  catch (e) { res.json([]); }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {

    const {
      body: msgBody, sender, direction = 'outbound',
      channel: msgChannel, to: msgTo,
      subject: msgSubject, htmlBody: msgHtmlBody,
    } = req.body;
    if (!msgBody?.trim()) return res.status(400).json({ error: 'body is required' });

    const msg = await biz.sendConversationMessage(req.params.id, msgBody, sender ?? 'agent', direction);

    // ── Dispatch outbound messages via the real channel ──────────────────────
    // NOTE: Wrapped in its own try/catch — dispatch failure must never fail the
    // message-save. The message is already persisted in the DB at this point.
    if (direction === 'outbound') {
      try {
        const convo = await db.conversation.findUnique({
          where: { id: req.params.id },
          include: { contact: true },
        });
        const activeChannel = msgChannel ?? convo?.channel;

        if (activeChannel === 'email' || activeChannel === 'gmail') {
          // ── Gmail outbound ────────────────────────────────────────────────
          const conn = await db.channelConnection.findFirst({
            where: { workspaceId: req.workspaceId, provider: 'gmail', isActive: true },
          });
          const recipientEmail = msgTo || convo?.contact?.email;
          const emailSubject = msgSubject || convo?.subject || '(no subject)';
          if (conn && recipientEmail) {
            if (msgSubject && msgSubject !== convo?.subject) {
              await db.conversation.update({ where: { id: req.params.id }, data: { subject: msgSubject } }).catch(() => null);
            }
            const now = new Date().toUTCString();
            await db.conversationMessage.update({
              where: { id: msg.id },
              data: { attachments: JSON.stringify({ toEmail: recipientEmail, subject: emailSubject, date: now, htmlBody: msgHtmlBody ?? null }) },
            }).catch(() => null);
            const { sendGmailMessage } = await import('../services/channels/gmail.service.js');
            const sent = await sendGmailMessage(
              conn.id, recipientEmail, emailSubject, msgBody,
              convo?.externalId ?? undefined, msgHtmlBody ?? undefined,
            ).catch(err => { console.error('[Outbound Gmail] ❌ Failed:', err.message); return null; });
            if (sent && !convo?.externalId && sent.threadId) {
              await db.conversation.update({ where: { id: req.params.id }, data: { externalId: sent.threadId } }).catch(() => null);
            }
          }
        } else if (activeChannel === 'outlook') {
          // ── Outlook outbound ──────────────────────────────────────────────
          const conn = await db.channelConnection.findFirst({
            where: { workspaceId: req.workspaceId, provider: 'outlook', isActive: true },
          });
          const recipientEmail = msgTo || convo?.contact?.email;
          const emailSubject = msgSubject || convo?.subject || '(no subject)';
          if (conn && recipientEmail) {
            if (msgSubject && msgSubject !== convo?.subject) {
              await db.conversation.update({ where: { id: req.params.id }, data: { subject: msgSubject } }).catch(() => null);
            }
            const now = new Date().toUTCString();
            await db.conversationMessage.update({
              where: { id: msg.id },
              data: { attachments: JSON.stringify({ toEmail: recipientEmail, subject: emailSubject, date: now, htmlBody: msgHtmlBody ?? null }) },
            }).catch(() => null);
            const { sendOutlookMessage } = await import('../services/channels/outlook.service.js');
            const sent = await sendOutlookMessage(
              conn.id, recipientEmail, emailSubject, msgBody, convo?.externalId ?? undefined,
            ).catch((err: Error) => { console.error('[Outbound Outlook] ❌ Failed:', err.message); return null; });
            if (sent && !convo?.externalId && sent.conversationId) {
              await db.conversation.update({ where: { id: req.params.id }, data: { externalId: sent.conversationId } }).catch(() => null);
            }
          }
        } else if (activeChannel === 'sms') {
          // ── SMS / Twilio outbound ─────────────────────────────────────────
          const conn = await db.channelConnection.findFirst({
            where: { workspaceId: req.workspaceId, provider: 'twilio', isActive: true },
          });
          if (conn && convo?.contact?.phone) {
            const { decryptJson } = await import('../services/channels/encryption.js');
            const creds = decryptJson(conn.credentialsJson as string) as { accountSid: string; authToken: string };
            const twilio = (await import('twilio')).default;
            const client = twilio(creds.accountSid, creds.authToken);
            await client.messages.create({
              body: msgBody,
              from: conn.twilioPhoneNumber!,
              to: convo.contact.phone,
            }).catch(console.error);
            if (!convo?.externalId) {
              await db.conversation.update({ where: { id: req.params.id }, data: { externalId: convo.contact.phone } }).catch(() => null);
            }
          }
        }
      } catch (dispatchErr: unknown) {
        console.error('[Outbound dispatch] Non-fatal error during channel dispatch:', dispatchErr);
      }
    }

    res.json(msg);
  } catch (e) { err500(res, e); }
});

router.patch('/conversations/:id', async (req, res) => {
  try {

    const { status, starred, assignedUserId, subject } = req.body;
    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (starred !== undefined) data.starred = starred;
    if (assignedUserId !== undefined) data.assignedUserId = assignedUserId;
    if (subject !== undefined) data.subject = subject;
    const updated = await db.conversation.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    res.json(updated);
  } catch (e) { err500(res, e); }
});

router.delete('/conversations/:id', async (req, res) => {
  try {

    // Messages cascade-delete via the schema onDelete: Cascade
    await db.conversation.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/conversations/:id/read-receipts', async (req, res) => {
  try {

    await db.conversation.update({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: { unreadCount: 0 } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/overview', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    res.json(await biz.getAnalyticsOverview(req.workspaceId, days));
  } catch (e) { err500(res, e); }
});

export default router;
