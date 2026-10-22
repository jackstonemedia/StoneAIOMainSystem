'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';
import { sendGmailMessage } from '../../channels/gmail.service.js';

/**
 * Send Email node.
 *
 * Sends an email via the connected Gmail channel (Gmail-only; no fallback —
 * without Gmail the node returns an honest error).
 *
 * Configuration:
 *   - to       (text, required)      — Recipient email address; supports {{variables}}
 *   - subject  (text, required)      — Email subject line
 *   - body     (textarea, required)  — Email body (HTML or plain text)
 *   - html     (boolean, default true) — Whether body is HTML; enables rich formatting
 *   - fromName (text, optional)      — Display name for the sender
 */
export const communicationSendEmail: NodeImplementation = {
  type: 'communication.send_email',
  category: 'communication',
  displayName: 'Send Email',
  description: 'Send an email via Gmail.',
  iconName: 'mail',
  color: '#3B82F6',
  outputHandles: [
    { id: 'default', label: 'Sent', color: '#3B82F6' },
    { id: 'error', label: 'Error', color: '#EF4444' },
  ],
  configSchema: [
    {
      key: 'to',
      label: 'To',
      type: 'text',
      required: true,
      default: '{{$trigger.data.email}}',
      placeholder: 'e.g. {{$trigger.data.email}} or hello@example.com',
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'text',
      required: true,
      placeholder: 'e.g. Welcome, {{$trigger.data.firstName}}!',
    },
    {
      key: 'fromName',
      label: 'From Name (optional)',
      type: 'text',
      advanced: true,
      placeholder: 'e.g. Your Business Name',
      description: 'Display name that appears in the "From" field.',
    },
    {
      key: 'body',
      label: 'Body',
      type: 'textarea',
      required: true,
      placeholder: '<p>Hi {{$trigger.data.firstName}},</p><p>Your message here.</p>',
    },
    {
      key: 'html',
      label: 'Body is HTML',
      type: 'boolean',
      advanced: true,
      default: true,
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const to = (config.to as string)?.trim();
    const subject = (config.subject as string)?.trim();
    const body = config.body as string;
    const html = (config.html as boolean) !== false;
    const fromName = (config.fromName as string)?.trim() || undefined;

    if (!to) throw new Error('Recipient email (to) is required.');
    if (!subject) throw new Error('Subject is required.');
    if (!body) throw new Error('Body is required.');

    // ── 1. Select available mailbox from pool (Gmail or Outlook) with safe daily limits ──
    const { selectNextMailbox, recordSendSuccess, recordSendAuthError } = await import(
      '../../email-marketing/mailbox-pool.service.js'
    );
    const mailbox = await selectNextMailbox(context.workspaceId);

    if (!mailbox) {
      throw new Error(
        'No available outreach mailboxes (Gmail or Outlook) in this workspace. All daily send limits may be reached or no inboxes are connected. Check Settings → Email Outreach.'
      );
    }

    const plainText = html ? stripHtml(body) : body;
    const htmlBody  = html ? body : undefined;

    if (mailbox.provider === 'gmail') {
      try {
        const result = await sendGmailMessage(
          mailbox.id,
          to,
          subject,
          plainText,
          undefined,
          htmlBody,
          fromName,
        );
        await recordSendSuccess(mailbox.id);
        await writeContactEmailEvent(context.workspaceId, to, subject, body);
        return {
          output: [{ json: { messageId: result.messageId, threadId: result.threadId ?? null, to, subject, provider: 'gmail', from: mailbox.email } }],
        };
      } catch (err: any) {
        await recordSendAuthError(mailbox.id, err);
        throw new Error(
          `Gmail send failed via ${mailbox.email}: ${err?.message ?? String(err)}. ` +
          `Check that your Gmail connection is active and has send permissions (Settings → Channels).`
        );
      }
    } else if (mailbox.provider === 'outlook') {
      try {
        const { sendOutlookEmail } = await import('../../channels/outlook.service.js');
        await sendOutlookEmail(mailbox.id, to, subject, plainText);
        await recordSendSuccess(mailbox.id);
        await writeContactEmailEvent(context.workspaceId, to, subject, body);
        return {
          output: [{ json: { messageId: null, to, subject, provider: 'outlook', from: mailbox.email } }],
        };
      } catch (err: any) {
        await recordSendAuthError(mailbox.id, err);
        throw new Error(`Outlook send failed via ${mailbox.email}: ${err?.message ?? String(err)}`);
      }
    }

    throw new Error(`Unsupported mailbox provider: ${(mailbox as any).provider}`);
  },
};

/**
 * Write a ContactEvent to the contact's activity timeline after a workflow email is sent.
 * Looks up the contact by email address within the workspace — fails silently so it never
 * blocks the email send itself.
 */
async function writeContactEmailEvent(
  workspaceId: string,
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  try {
    const contact = await db.contact.findFirst({
      where: { workspaceId, email: toEmail },
      select: { id: true },
    });
    if (!contact) return; // Contact not in CRM — skip silently

    await db.contactEvent.create({
      data: {
        contactId: contact.id,
        type: 'email_sent',
        title: `Email sent: ${subject}`,
        content: body,
        metadataJson: JSON.stringify({ subject, to: toEmail, source: 'workflow' }),
      },
    });
  } catch (err: any) {
    // Never block email delivery on a timeline write failure
    console.warn('[SendEmail] Failed to write ContactEvent:', err?.message ?? String(err));
  }
}



/** Strip HTML tags to produce a readable plain-text fallback for the MIME text/plain part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
