/**
 * Campaign Email Engine
 * 
 * Handles bulk campaign email sending via Bull queue for rate limiting and progress tracking.
 * Uses the same Gmail/Resend sending logic as the workflow send-email node.
 */

import Queue from 'bull';
import cron from 'node-cron';
import { db } from '../../infrastructure/database/client.js';
import { decryptJson } from './channels/encryption.js';
import { sendGmailMessage } from './channels/gmail.service.js';

// ── Queue Setup ──────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL;

const campaignQueue = redisUrl
  ? new Queue('campaign-emails', redisUrl)
  : new Queue('campaign-emails', { // Inline mode without Redis
      redis: null as any, // Bull needs this cast
      limiter: { max: 10, duration: 1000 } // Max 10 emails per second
    } as any);

// ── Email Sending Logic (reused from communication-send-email node) ───────────

async function sendEmail(to: string, subject: string, body: string, html: boolean, workspaceId: string): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
  // Try Gmail first
  if (process.env.GMAIL_CLIENT_ID) {
    const gmailConn = await db.channelConnection.findFirst({
      where: { workspaceId, type: 'gmail', status: 'connected', isActive: true },
    }).catch(() => null);

    if (gmailConn?.credentialsJson) {
      try {
        const creds = decryptJson<{ accessToken?: string; refreshToken?: string }>(gmailConn.credentialsJson as string);
        const result = await sendGmailMessage(
          gmailConn.id,
          to,
          subject,
          body,
          undefined,
          html ? body : undefined,
        );
        return { success: true, messageId: result?.messageId, provider: 'gmail' };
      } catch (gmailErr) {
        console.warn(`[Campaign] Gmail send failed for ${to}:`, gmailErr);
      }
    }
  }

  // Fallback: Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const Resend = (await import('resend')).Resend;
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: 'info@stoneaio.com', // TODO: configurable sender
        to: [to],
        subject,
        ...(html ? { html: body } : { text: body }),
      });

      if (error) return { success: false, error: error.message };
      return { success: true, messageId: data?.id, provider: 'resend' };
    } catch (resendErr: any) {
      return { success: false, error: resendErr.message || String(resendErr) };
    }
  }

  return { success: false, error: 'No email provider configured (GMAIL_CLIENT_ID or RESEND_API_KEY)' };
}

// ── Queue Worker ─────────────────────────────────────────────────────────────

export function initializeCampaignQueue(): void {
  console.log('[CampaignQueue] Initializing campaign email worker...');

  campaignQueue.process(async (job) => {
    const { campaignId, workspaceId, email, subject, body, html, contactId } = job.data;

    try {
      const result = await sendEmail(email, subject, body, html, workspaceId);

      if (result.success) {
        // Update campaign sent count
        await db.campaign.update({
          where: { id: campaignId },
          data: {
            metricsJson: JSON.stringify({
              sent: { increment: 1 },
              lastSentAt: new Date().toISOString(),
            }),
          },
        }).catch(() => {}); // Safe update - race conditions with JSON increment can fail

        // Log sent activity
        await db.activity.create({
          data: {
            workspaceId,
            contactId: contactId || undefined,
            type: 'email_sent',
            title: 'Campaign email sent',
            content: `${email} - ${subject}`,
            metadataJson: JSON.stringify({ campaignId, provider: result.provider }),
          },
        }).catch(() => {});

        return { success: true, messageId: result.messageId };
      } else {
        // Update failed count
        await db.campaign.update({
          where: { id: campaignId },
          data: {
            metricsJson: JSON.stringify({
              failed: { increment: 1 },
              lastFailedAt: new Date().toISOString(),
            }),
          },
        }).catch(() => {});

        return { success: false, error: result.error };
      }
    } catch (err: any) {
      console.error(`[CampaignQueue] Error sending to ${email}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  });

  campaignQueue.on('completed', (job) => {
    console.log(`[CampaignQueue] Job ${job.id} completed for ${job.data.email}`);
  });

  campaignQueue.on('failed', (job, err) => {
    console.error(`[CampaignQueue] Job ${job.id} failed for ${job.data.email}:`, err.message);
  });

  // Clean up completed jobs after 24 hours
  campaignQueue.clean(86400000, 'completed').catch(() => {});

  console.log('[CampaignQueue] Worker ready');
}

// ── Campaign Send API ────────────────────────────────────────────────────────

/**
 * Enqueue all contacts for a campaign.
 * Contacts are fetched from the workspace and emails queued with rate limiting.
 */
export async function queueCampaign(id: string, workspaceId: string): Promise<{ success: boolean; queued: number; error?: string }> {
  const campaign = await db.campaign.findUnique({ where: { id, workspaceId } });
  if (!campaign) return { success: false, queued: 0, error: 'Campaign not found' };

  // Get all contacts for this workspace
  const contacts = await db.contact.findMany({
    where: { workspaceId, email: { not: '' } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (contacts.length === 0) {
    return { success: false, queued: 0, error: 'No contacts with emails found' };
  }

  // Update campaign status to sending
  await db.campaign.update({
    where: { id },
    data: { status: 'sending', updatedAt: new Date() },
  });

  let queuedCount = 0;

  for (const contact of contacts) {
    // Personalize subject/body with contact name
    let subject = campaign.subject || 'No subject';
    let body = campaign.body || '';

    // Simple template substitution
    subject = subject.replace(/\{\{first_name\}\}/gi, contact.firstName || 'there');
    subject = subject.replace(/\{\{last_name\}\}/gi, contact.lastName || '');
    subject = subject.replace(/\{\{email\}\}/gi, contact.email);
    body = body.replace(/\{\{first_name\}\}/gi, contact.firstName || 'there');
    body = body.replace(/\{\{last_name\}\}/gi, contact.lastName || '');
    body = body.replace(/\{\{email\}\}/gi, contact.email);

    await campaignQueue.add({
      campaignId: id,
      workspaceId,
      email: contact.email,
      subject,
      body,
      html: campaign.html !== false,
      contactId: contact.id,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }, // Retry up to 3 times with backoff
      jobId: `${id}-${contact.id}`, // Unique job ID per campaign+contact
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs for inspection
    });

    queuedCount++;
  }

  return { success: true, queued: queuedCount };
}

/**
 * Get current campaign queue stats for a campaign.
 */
export async function getCampaignStats(campaignId: string): Promise<{ queued: number; active: number; completed: number; failed: number }> {
  const [waiting, active, completed, failed] = await Promise.all([
    campaignQueue.getWaiting().then(jobs => jobs.filter(j => j.data.campaignId === campaignId).length).catch(() => 0),
    campaignQueue.getActive().then(jobs => jobs.filter(j => j.data.campaignId === campaignId).length).catch(() => 0),
    campaignQueue.getCompleted().then(jobs => jobs.filter(j => j.data.campaignId === campaignId).length).catch(() => 0),
    campaignQueue.getFailed().then(jobs => jobs.filter(j => j.data.campaignId === campaignId).length).catch(() => 0),
  ]);

  return { queued: waiting, active, completed, failed };
}

// ── Exports ──────────────────────────────────────────────────────────────────

export { campaignQueue };
