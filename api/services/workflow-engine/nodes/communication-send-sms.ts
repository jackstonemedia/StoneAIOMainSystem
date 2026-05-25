'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { db } from '../../../infrastructure/database/client.js';
import { decryptJson } from '../../channels/encryption.js';

/**
 * Send SMS node.
 *
 * Sends an SMS message via a connected Twilio channel.
 *
 * Configuration:
 *   - to        (text, required)    — Recipient phone number
 *   - body      (textarea, required)— SMS message body
 *   - contactId (text, optional)     — If provided, look up the contact's phone number and override 'to'
 */
export const communicationSendSms: NodeImplementation = {
  type: 'communication.send_sms',
  category: 'communication',
  displayName: 'Send SMS',
  description: 'Send an SMS message via Twilio.',
  iconName: 'message-square',
  color: '#10B981',
  outputHandles: [
    { id: 'default', label: 'Sent', color: '#10B981' },
    { id: 'error', label: 'Error', color: '#EF4444' },
  ],
  configSchema: [
    {
      key: 'to',
      label: 'To (Phone Number)',
      type: 'text',
      required: true,
    },
    {
      key: 'body',
      label: 'Message',
      type: 'textarea',
      required: true,
    },
    {
      key: 'contactId',
      label: 'Contact ID (optional)',
      type: 'text',
      description: 'If provided, look up the contact\'s phone number and use it.',
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const body = config.body as string;

    if (!body) throw new Error('Message body is required.');

    // Resolve the recipient phone number
    let to = config.to as string;

    if (config.contactId) {
      const contactId = config.contactId as string;
      const contact = await db.contact.findFirst({
        where: { id: contactId, workspaceId: context.workspaceId },
      }).catch(() => null);

      if (!contact || !contact.phone) {
        throw new Error(`Contact ${contactId} not found or has no phone number.`);
      }
      to = contact.phone;
    }

    if (!to) throw new Error('Recipient phone number (to) is required.');

    // Find the Twilio channel connection
    const twilioConn = await db.channelConnection.findFirst({
      where: { workspaceId: context.workspaceId, type: 'twilio', status: 'connected' },
    }).catch(() => null);

    if (!twilioConn || !twilioConn.credentialsJson) {
      throw new Error('No connected Twilio channel found.');
    }

    // Decrypt credentials
    const creds = decryptJson<{
      twilioAccountSid: string;
      twilioAuthToken: string;
      twilioPhoneNumber: string;
    }>(twilioConn.credentialsJson as string);

    const twilio = (await import('twilio')).default;
    const client = twilio(creds.twilioAccountSid ?? creds.accountSid, creds.twilioAuthToken ?? creds.authToken);

    const message = await client.messages.create({
      body,
      from: creds.twilioPhoneNumber,
      to,
    });

    return {
      output: [
        {
          json: {
            messageId: message.sid,
            to,
            body,
            status: message.status,
            provider: 'twilio',
          },
        },
      ],
    };
  },
};
