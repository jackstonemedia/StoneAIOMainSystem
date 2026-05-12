import { Router, Request, Response, NextFunction } from 'express';
import { env } from '../../infrastructure/config/env.js';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// ── Secret validation middleware (applies to ALL routes in this file) ──────────
function validateSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-stone-aio-secret'];
  console.log(`[VALIDATE SECRET] checking secret: ${secret} against ${env.ACTIVEPIECES_WEBHOOK_SECRET}`);
  if (secret !== env.ACTIVEPIECES_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(validateSecret);

// ── POST /api/internal/action ─────────────────────────────────────────────────
router.post('/action', async (req: Request, res: Response) => {
  const { workspaceId, action, payload } = req.body as {
    workspaceId: string;
    action: string;
    payload: Record<string, any>;
  };

  if (env.NODE_ENV !== 'production') {
    console.log(`[INTERNAL WEBHOOK] ${action} ${workspaceId}`);
  }

  try {
    switch (action) {

      // ── crm.create_contact ─────────────────────────────────────────────────
      case 'crm.create_contact': {
        const { name = '', email, phone, tags = [], source } = payload;
        const [firstName, ...rest] = String(name).trim().split(' ');
        const lastName = rest.join(' ') || '';

        const contact = await db.contact.create({
          data: {
            workspaceId,
            firstName,
            lastName,
            email: email ?? null,
            phone: phone ?? null,
            tagsJson: JSON.stringify(tags),
            source: source ?? 'automation',
          },
        });
        return res.json({ success: true, contactId: contact.id });
      }

      // ── crm.update_contact ─────────────────────────────────────────────────
      case 'crm.update_contact': {
        const { contactId, fields } = payload as { contactId: string; fields: Record<string, any> };
        await db.contact.update({
          where: { id: contactId },
          data: fields,
        });
        return res.json({ success: true });
      }

      // ── crm.create_deal ────────────────────────────────────────────────────
      case 'crm.create_deal': {
        const { contactId, title, value, stageId } = payload as {
          contactId?: string;
          title: string;
          value?: number;
          stageId?: string;
        };
        const deal = await db.deal.create({
          data: {
            workspaceId,
            contactId: contactId ?? null,
            title,
            amount: value ?? 0,
            pipelineStageId: stageId ?? null,
          },
        });
        return res.json({ success: true, dealId: deal.id });
      }

      // ── crm.update_deal_stage ──────────────────────────────────────────────
      case 'crm.update_deal_stage': {
        const { dealId, stageId } = payload as { dealId: string; stageId: string };
        await db.deal.update({
          where: { id: dealId },
          data: { pipelineStageId: stageId },
        });
        return res.json({ success: true });
      }

      // ── crm.add_tag ────────────────────────────────────────────────────────
      case 'crm.add_tag': {
        const { contactId, tag } = payload as { contactId: string; tag: string };
        const existing = await db.contact.findUnique({
          where: { id: contactId },
          select: { tagsJson: true },
        });
        const currentTags: string[] = existing?.tagsJson
          ? JSON.parse(existing.tagsJson)
          : [];
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
        }
        await db.contact.update({
          where: { id: contactId },
          data: { tagsJson: JSON.stringify(currentTags) },
        });
        return res.json({ success: true });
      }

      // ── crm.create_task ────────────────────────────────────────────────────
      case 'crm.create_task': {
        const { contactId, title, dueDate, assignedTo } = payload as {
          contactId?: string;
          title: string;
          dueDate?: string;
          assignedTo?: string;
        };
        const task = await db.task.create({
          data: {
            workspaceId,
            contactId: contactId ?? null,
            title,
            dueDate: dueDate ? new Date(dueDate) : null,
            assigneeId: assignedTo ?? null,
          },
        });
        return res.json({ success: true, taskId: task.id });
      }

      // ── notifications.send ─────────────────────────────────────────────────
      case 'notifications.send': {
        const { title, body, type = 'info' } = payload as {
          title: string;
          body?: string;
          type?: string;
        };
        await db.notification.create({
          data: {
            workspaceId,
            title,
            body: body ?? null,
            type,
          },
        });
        return res.json({ success: true });
      }

      // ── campaigns.trigger ──────────────────────────────────────────────────
      case 'campaigns.trigger': {
        const { campaignId, contactId } = payload as { campaignId: string; contactId: string };
        // Full campaign execution is handled by the campaign service.
        // Log the trigger intent here for audit/debug purposes.
        console.log(`[CAMPAIGN TRIGGER] campaignId=${campaignId} contactId=${contactId} workspaceId=${workspaceId}`);
        return res.json({ success: true });
      }

      // ── conversations.send_message ─────────────────────────────────────────
      case 'conversations.send_message': {
        const { conversationId, body: msgBody, type: msgType = 'sms' } = payload as {
          conversationId: string;
          body: string;
          type?: 'sms' | 'email';
        };

        // Log the message in the database
        await db.conversationMessage.create({
          data: {
            conversationId,
            sender: 'automation',
            body: msgBody,
            direction: 'outbound',
          },
        });

        // Dispatch via appropriate channel
        if (msgType === 'sms' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
          const { default: twilio } = await import('twilio');
          const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
          const convo = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
          });
          if (convo?.contact?.phone && env.TWILIO_PHONE_NUMBER) {
            await client.messages.create({
              body: msgBody,
              from: env.TWILIO_PHONE_NUMBER,
              to: convo.contact.phone,
            });
          }
        } else if (msgType === 'email' && env.RESEND_API_KEY) {
          const { Resend } = await import('resend');
          const resend = new Resend(env.RESEND_API_KEY);
          const convo = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { contact: true },
          });
          if (convo?.contact?.email) {
            await resend.emails.send({
              from: 'Stone AIO <noreply@stoneaio.com>',
              to: convo.contact.email,
              subject: 'Message from Stone AIO',
              text: msgBody,
            });
          }
        }

        return res.json({ success: true });
      }

      // ── unknown action ─────────────────────────────────────────────────────
      default:
        return res.status(400).json({ error: 'Unknown action', action });
    }
  } catch (err: any) {
    console.error(`[INTERNAL WEBHOOK ERROR] ${action} ${workspaceId}:`, err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

export default router;
