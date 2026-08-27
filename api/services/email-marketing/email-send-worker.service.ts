/**
 * Email Send Worker — Email Marketing Module
 *
 * BullMQ queue "email-marketing-send" processes individual recipient sends for
 * both campaign broadcasts and automation step emails.
 *
 * Per-send pipeline:
 *   1. Verify workspace still exists (tombstone guard)
 *   2. Load contact data
 *   3. Check suppression list & subscription status → skip if suppressed
 *   4. Compile block JSON → MJML → email-safe HTML (per-recipient personalization)
 *   5. Send via Resend with RFC 8058 List-Unsubscribe headers
 *   6. Record CampaignRecipient status + EmailEvent
 *
 * Rate limiting: reads RESEND_RATE_LIMIT_PER_SECOND (default 10) from env.
 * Retries: up to 3 retries with exponential backoff starting at 30 seconds.
 * One failed recipient never blocks the rest of the batch.
 */

import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '../../../infrastructure/database/client.js';
import { env } from '../../../infrastructure/config/env.js';
import { isEmailSuppressed } from './audience.service.js';
import { EmailEventType, SubscriptionStatus } from '@prisma/client';

// ── Queue setup ───────────────────────────────────────────────────────────────

const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
  : null;

const QUEUE_NAME = 'email-marketing-send';
const RATE_LIMIT_PER_SECOND = env.RESEND_RATE_LIMIT_PER_SECOND ?? 10;

/**
 * The BullMQ queue for all email marketing sends.
 * Exported so campaigns.service.ts can enqueue jobs.
 */
export const emailMarketingSendQueue = redisConnection
  ? new Queue(QUEUE_NAME, {
      connection: redisConnection as any,
      defaultJobOptions: {
        attempts: 4, // initial attempt + 3 retries
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: false,
      },
    })
  : ({
      // Mock queue for dev without Redis
      add: async (_name: string, data: any, _opts?: any) => {
        console.log(`[MockEmailSendQueue] Would enqueue job:`, data);
        return { id: 'mock-' + Date.now() };
      },
    } as any);

// ── Job payload type ──────────────────────────────────────────────────────────

export interface EmailSendJobData {
  workspaceId: string;
  campaignId?: string;
  automationEnrollmentId?: string;
  campaignRecipientId: string;
  contactId: string;
  type: 'CAMPAIGN' | 'AUTOMATION';
  subject?: string;
  fromName?: string;
  fromEmail?: string;
}

export async function processEmailSendJobDirectly(data: EmailSendJobData): Promise<{ ok: boolean; error?: string }> {
  // In direct mode we always run as if it's the final attempt so errors mark
  // the recipient FAILED rather than re-throwing and blocking the rest of the batch.
  const fakeJob = {
    id: `direct-${Date.now()}`,
    data,
    attemptsMade: 3,  // treat as last attempt so catch block calls markRecipientFailed
    opts: { attempts: 4 },
  } as any;
  try {
    await processEmailSendJob(fakeJob);
    return { ok: true };
  } catch (err: any) {
    // Should not reach here since last-attempt catches and marks FAILED, but be safe
    console.error(`[processEmailSendJobDirectly] Unexpected throw for contact ${data.contactId}:`, err.message);
    try {
      await db.campaignRecipient.updateMany({
        where: { id: data.campaignRecipientId },
        data: { status: `FAILED:${String(err.message).slice(0, 100)}` },
      });
    } catch {}
    return { ok: false, error: err.message };
  }
}

// ── Worker processor ──────────────────────────────────────────────────────────

async function processEmailSendJob(job: Job<EmailSendJobData>): Promise<void> {
  const {
    workspaceId,
    campaignId,
    campaignRecipientId,
    contactId,
    automationEnrollmentId,
    type,
    subject: overrideSubject,
    fromName,
    fromEmail,
  } = job.data;

  // ── 1. Workspace tombstone guard ──────────────────────────────────────────
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) {
    console.warn(`[EmailSendWorker] Workspace ${workspaceId} not found — skipping job ${job.id}`);
    return; // Workspace was deleted — discard silently
  }

  // ── 2. Load contact ───────────────────────────────────────────────────────
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
  });
  if (!contact || !contact.email) {
    await markRecipientFailed(campaignRecipientId, 'Contact not found or has no email');
    return;
  }

  // ── 3. Suppression + subscription check ──────────────────────────────────
  const suppressed = await isEmailSuppressed(workspaceId, contact.email);
  if (suppressed) {
    await markRecipientSkipped(campaignRecipientId, 'SUPPRESSED');
    console.log(`[EmailSendWorker] Skipping ${contact.email} — suppressed`);
    return;
  }

  // Check if contact explicitly unsubscribed
  const unsubscribedMembership = await db.contactListMembership.findFirst({
    where: {
      workspaceId,
      contactId,
      status: SubscriptionStatus.UNSUBSCRIBED,
    },
  });
  if (unsubscribedMembership) {
    await markRecipientSkipped(campaignRecipientId, 'UNSUBSCRIBED');
    console.log(`[EmailSendWorker] Skipping ${contact.email} — unsubscribed`);
    return;
  }

  // ── 4. Load campaign & compile HTML ──────────────────────────────────────
  let emailHtml: string;
  let emailSubject: string;
  let sendFromName = fromName || 'Stone AIO';
  let bj: any = null;

  if (type === 'CAMPAIGN' && campaignId) {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, workspaceId },
    });
    if (!campaign) {
      await markRecipientFailed(campaignRecipientId, 'Campaign not found');
      return;
    }

    const recipient = await db.campaignRecipient.findFirst({
      where: { id: campaignRecipientId },
      select: { variant: true },
    }).catch(() => null);

    const variant = recipient?.variant || 'A';
    const abConfig = (campaign.abTestConfig as any);
    const isAbTest = abConfig && abConfig.enabled;

    let rawBody = '';
    bj = campaign.blockJson as any;

    if (isAbTest && variant === 'B') {
      if (abConfig.bodyHtmlB && abConfig.bodyHtmlB.trim()) {
        rawBody = abConfig.bodyHtmlB;
      } else if (typeof bj === 'string') {
        rawBody = bj;
      } else if (bj?.html) {
        rawBody = bj.html;
      } else if (bj?.body) {
        rawBody = bj.body;
      } else if (bj?.text) {
        rawBody = bj.text;
      }
      emailSubject = overrideSubject || abConfig.subjectB || campaign.subject;
      if (abConfig.fromNameB) {
        sendFromName = abConfig.fromNameB;
      } else if (bj?.sender?.fromName) {
        sendFromName = bj.sender.fromName;
      }
    } else if (isAbTest && variant === 'A') {
      if (abConfig.bodyHtmlA && abConfig.bodyHtmlA.trim()) {
        rawBody = abConfig.bodyHtmlA;
      } else if (typeof bj === 'string') {
        rawBody = bj;
      } else if (bj?.html) {
        rawBody = bj.html;
      } else if (bj?.body) {
        rawBody = bj.body;
      } else if (bj?.text) {
        rawBody = bj.text;
      }
      emailSubject = overrideSubject || abConfig.subjectA || campaign.subject;
      if (abConfig.fromNameA) {
        sendFromName = abConfig.fromNameA;
      } else if (bj?.sender?.fromName) {
        sendFromName = bj.sender.fromName;
      }
    } else {
      if (typeof bj === 'string') {
        rawBody = bj;
      } else if (bj?.html) {
        rawBody = bj.html;
      } else if (bj?.body) {
        rawBody = bj.body;
      } else if (bj?.text) {
        rawBody = bj.text;
      }
      emailSubject = overrideSubject || campaign.subject;
      if (bj?.sender?.fromName) {
        sendFromName = bj.sender.fromName;
      }
    }

    if (!rawBody.trim()) {
      rawBody = emailSubject || campaign.subject || 'Campaign Message';
    }

    const firstName = contact.firstName || 'there';
    const lastName = contact.lastName || '';
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Valued Contact';
    const email = contact.email || '';
    const businessName = (contact as any).company?.name || (contact as any).businessName || '';
    const phone = contact.phone || '';

    emailHtml = rawBody
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{firstName\}\}/gi, firstName)
      .replace(/\{\{last_name\}\}/gi, lastName)
      .replace(/\{\{lastName\}\}/gi, lastName)
      .replace(/\{\{name\}\}/gi, fullName)
      .replace(/\{\{full_name\}\}/gi, fullName)
      .replace(/\{\{email\}\}/gi, email)
      .replace(/\{\{business_name\}\}/gi, businessName)
      .replace(/\{\{businessName\}\}/gi, businessName)
      .replace(/\{\{company\}\}/gi, businessName)
      .replace(/\{\{phone\}\}/gi, phone);

    emailSubject = emailSubject
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{firstName\}\}/gi, firstName)
      .replace(/\{\{last_name\}\}/gi, lastName)
      .replace(/\{\{lastName\}\}/gi, lastName)
      .replace(/\{\{name\}\}/gi, fullName)
      .replace(/\{\{full_name\}\}/gi, fullName)
      .replace(/\{\{email\}\}/gi, email)
      .replace(/\{\{business_name\}\}/gi, businessName)
      .replace(/\{\{businessName\}\}/gi, businessName)
      .replace(/\{\{company\}\}/gi, businessName)
      .replace(/\{\{phone\}\}/gi, phone);

    if (!emailHtml.includes('<') || !emailHtml.includes('>')) {
      emailHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">${emailHtml.replace(/\n/g, '<br/>')}</div>`;
    }
  } else {
    // Automation step email — subject and HTML passed directly
    emailHtml = '<p>Automation email content unavailable</p>';
    emailSubject = overrideSubject || 'Message from Stone AIO';
  }

  // ── 4b. Inject Open & Click Tracking ────────────────────────────────────
  const trackingEnabled = (type === 'CAMPAIGN' ? (bj?.tracking?.clicks !== false && bj?.tracking?.opens !== false) : true);
  if (trackingEnabled && emailHtml) {
    const baseUrl = env.PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || env.VITE_APP_URL || 'http://localhost:4000';

    // 0. Auto-convert plain URLs not already inside an <a> tag
    emailHtml = emailHtml.replace(/(^|[^"'>=\/])((https?:\/\/|www\.)[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+)/gi, (match, prefix, url) => {
      const href = url.startsWith('www.') ? `https://${url}` : url;
      return `${prefix}<a href="${href}">${url}</a>`;
    });

    // 1. Rewrite <a href="..."> links for Click Tracking
    emailHtml = emailHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']([^>]*)>/gi, (match, href, rest) => {
      if (
        !href ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('#') ||
        href.includes('/unsubscribe') ||
        href.includes('/api/email-marketing/track')
      ) {
        return match;
      }

      const encodedUrl = encodeURIComponent(href);
      const trackingUrl = `${baseUrl}/api/email-marketing/track/click?url=${encodedUrl}&w=${encodeURIComponent(workspaceId)}&c=${encodeURIComponent(contactId)}&cmp=${encodeURIComponent(campaignId || '')}&ae=${encodeURIComponent(automationEnrollmentId || '')}`;
      return `<a href="${trackingUrl}"${rest}>`;
    });

    // 2. Append Open Tracking 1x1 Pixel
    const openPixelUrl = `${baseUrl}/api/email-marketing/track/open?w=${encodeURIComponent(workspaceId)}&c=${encodeURIComponent(contactId)}&cmp=${encodeURIComponent(campaignId || '')}&ae=${encodeURIComponent(automationEnrollmentId || '')}`;
    const openPixelTag = `<img src="${openPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;" />`;

    if (emailHtml.includes('</body>')) {
      emailHtml = emailHtml.replace('</body>', `${openPixelTag}</body>`);
    } else {
      emailHtml = `${emailHtml}${openPixelTag}`;
    }
  }

  // ── 5. Send via Gmail Channel ──────────────────────────────────────────
  let gmailConn = await db.channelConnection.findFirst({
    where: { workspaceId, provider: 'gmail', isActive: true },
  }).catch(() => null);

  if (!gmailConn) {
    gmailConn = await db.channelConnection.findFirst({
      where: { provider: 'gmail', isActive: true },
    }).catch(() => null);
  }

  if (gmailConn) {
    try {
      const { sendGmailMessage } = await import('../channels/gmail.service.js');
      const plainText = emailHtml.replace(/<[^>]*>?/gm, '').trim();
      const result = await sendGmailMessage(
        gmailConn.id,
        contact.email,
        emailSubject,
        plainText,
        undefined,
        emailHtml,
        sendFromName,
      );

      const messageId = result.messageId || null;
      await markRecipientSent(campaignRecipientId, messageId);

      await db.emailEvent.create({
        data: {
          workspaceId,
          contactId,
          campaignId: campaignId || null,
          automationEnrollmentId: automationEnrollmentId || null,
          eventType: EmailEventType.SENT,
        },
      });

      try {
        await db.contactEvent.create({
          data: {
            contactId,
            type: 'email',
            title: `Campaign: ${emailSubject}`,
            content: emailHtml,
            metadataJson: JSON.stringify({ campaignId, provider: 'gmail', messageId }),
          },
        });
      } catch {}

      await db.contact.updateMany({
        where: { id: contactId, workspaceId },
        data: {
          totalEmailsReceived: { increment: 1 },
          lastContactedAt: new Date(),
        },
      });

      return;
    } catch (gmailErr: any) {
      console.error(`[EmailSendWorker] Gmail send failed for ${contact.email}:`, gmailErr.message);
      
      const errorMsg = `Gmail send failed: ${gmailErr.message}`;
      if (job.attemptsMade >= (job.opts.attempts ?? 4) - 1) {
        await markRecipientFailed(campaignRecipientId, errorMsg);
        return;
      }
      throw new Error(errorMsg);
    }
  } else {
    const errorMsg = 'No active Gmail connection found for this workspace. A connected Gmail account is required to send emails.';
    if (job.attemptsMade >= (job.opts.attempts ?? 4) - 1) {
      await markRecipientFailed(campaignRecipientId, errorMsg);
      return;
    }
    throw new Error(errorMsg);
  }
}

// ── Helper functions ──────────────────────────────────────────────────────────

function buildUnsubscribeUrl(workspaceId: string, contactId: string): string {
  const baseUrl = env.VITE_APP_URL || 'http://localhost:3000';
  // Simple signed URL — in production you'd sign this with HMAC
  const token = Buffer.from(`${workspaceId}:${contactId}`).toString('base64url');
  return `${baseUrl}/unsubscribe/${token}`;
}

function parseCustomFields(customFieldsJson: string | null | undefined): Record<string, any> {
  if (!customFieldsJson) return {};
  try {
    return JSON.parse(customFieldsJson);
  } catch {
    return {};
  }
}

async function markRecipientSent(recipientId: string, resendMessageId: string | null) {
  await db.campaignRecipient.updateMany({
    where: { id: recipientId },
    data: { status: 'SENT', sentAt: new Date(), resendMessageId },
  });
}

async function markRecipientFailed(recipientId: string, reason: string) {
  await db.campaignRecipient.updateMany({
    where: { id: recipientId },
    data: { status: `FAILED:${reason.slice(0, 100)}` },
  });
}

async function markRecipientSkipped(recipientId: string, reason: string) {
  await db.campaignRecipient.updateMany({
    where: { id: recipientId },
    data: { status: `SKIPPED:${reason}` },
  });
}

// ── Worker bootstrap ──────────────────────────────────────────────────────────

/**
 * Starts the email-marketing-send BullMQ worker.
 * Called once at server startup from server.ts.
 */
export function startEmailSendWorker(): void {
  if (!redisConnection) {
    console.warn('[EmailSendWorker] REDIS_URL not set — running in mock mode (no actual sends)');
    return;
  }

  const worker = new Worker(QUEUE_NAME, processEmailSendJob, {
    connection: redisConnection as any,
    concurrency: 5,
    limiter: {
      max: RATE_LIMIT_PER_SECOND,
      duration: 1000, // per second
    },
  });

  worker.on('failed', (job, err) => {
    console.error(`[EmailSendWorker] Job ${job?.id} permanently failed:`, err.message);
  });

  worker.on('completed', (job) => {
    if (env.NODE_ENV !== 'production') {
      console.log(`[EmailSendWorker] Job ${job?.id} completed`);
    }
  });

  console.log(`[EmailSendWorker] Started. Rate limit: ${RATE_LIMIT_PER_SECOND} emails/sec`);
}
