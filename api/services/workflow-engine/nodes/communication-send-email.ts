'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { db } from '../../../infrastructure/database/client.js';
import { decryptJson } from '../../channels/encryption.js';
import { sendGmailMessage } from '../../channels/gmail.service.js';

/**
 * Send Email node.
 *
 * Sends an email via Gmail (if a connected Gmail channel exists) or Resend (as fallback).
 *
 * Configuration:
 *   - to      (text, required)    — Recipient email address
 *   - subject (text, required)    — Email subject
 *   - body    (textarea, required)— Email body content
 *   - html    (boolean, default true) — Whether body is HTML
 */
export const communicationSendEmail: NodeImplementation = {
  type: 'communication.send_email',
  category: 'communication',
  displayName: 'Send Email',
  description: 'Send an email via Gmail or Resend.',
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
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'text',
      required: true,
    },
    {
      key: 'body',
      label: 'Body',
      type: 'textarea',
      required: true,
    },
    {
      key: 'html',
      label: 'Body is HTML',
      type: 'boolean',
      defaultValue: true,
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const to = config.to as string;
    const subject = config.subject as string;
    const body = config.body as string;
    const html = (config.html as boolean) !== false;

    if (!to) throw new Error('Recipient email (to) is required.');
    if (!subject) throw new Error('Subject is required.');
    if (!body) throw new Error('Body is required.');

    // ── Try Gmail first ─────────────────────────────────────────────────────
    const gmailConn = await db.channelConnection.findFirst({
      where: { workspaceId: context.workspaceId, type: 'gmail', status: 'connected' },
    }).catch(() => null);

    if (gmailConn && gmailConn.credentialsJson) {
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
        if (result) {
          return {
            output: [
              {
                json: {
                  messageId: result.messageId ?? result.id ?? gmailConn.id,
                  threadId: result.threadId ?? null,
                  to,
                  subject,
                  provider: 'gmail',
                },
              },
            ],
          };
        }
      } catch (gmailErr) {
        console.warn('[SendEmail] Gmail send failed, trying Resend fallback:', gmailErr);
      }
    }

    // ── Fallback: Resend ─────────────────────────────────────────────────────
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const Resend = (await import('resend')).Resend;
      const resend = new Resend(resendApiKey);

      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [to],
        subject,
        ...(html ? { html: body } : { text: body }),
      });

      if (error) {
        throw new Error(`Resend failed: ${error.message}`);
      }

      return {
        output: [
          {
            json: {
              messageId: data?.id ?? '',
              to,
              subject,
              provider: 'resend',
            },
          },
        ],
      };
    }

    throw new Error('No email provider available. Connect a Gmail channel or set RESEND_API_KEY.');
  },
};
