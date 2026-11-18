/**
 * Shared Meta (Facebook / Instagram) outbound sender.
 *
 * The Conversations UI dispatch (business.routes.ts) and the integrations
 * route both need to send a message to a Meta PSID; this is the one place
 * that knows how. The PSID is the conversation's externalId.
 */
import axios from 'axios';
import { db } from '../../../infrastructure/database/client.js';

export async function sendMetaMessage(opts: {
  workspaceId: string;
  provider: 'facebook' | 'instagram';
  psid: string;
  body: string;
}): Promise<{ messageId: string }> {
  const integration = await db.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: opts.workspaceId, provider: opts.provider } },
  });
  if (!integration?.accessToken) {
    throw new Error(
      `No ${opts.provider} account connected. Connect it in Settings > Integrations to reply.`,
    );
  }
  try {
    const response = await axios.post(
      'https://graph.facebook.com/v18.0/me/messages',
      {
        recipient: { id: opts.psid },
        message: { text: opts.body },
        messaging_type: 'RESPONSE',
      },
      { headers: { Authorization: `Bearer ${integration.accessToken}` } },
    );
    return { messageId: response.data.message_id as string };
  } catch (err: any) {
    const metaError = err.response?.data?.error?.message;
    throw new Error(metaError || err.message || 'Meta send failed.');
  }
}
