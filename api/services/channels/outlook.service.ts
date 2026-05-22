import axios from 'axios';
import { db } from '../../../infrastructure/database/client.js';
import { encryptJson, decryptJson } from './encryption.js';

interface OutlookCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export function getOutlookAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    scope: 'offline_access Mail.Read Mail.Send',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookCode(
  code: string
): Promise<{ credentials: OutlookCredentials; email: string }> {
  const res = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
      redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
      grant_type: 'authorization_code',
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const credentials: OutlookCredentials = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
  };
  const profile = await axios.get(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${credentials.access_token}` },
  });
  return { credentials, email: profile.data.mail ?? profile.data.userPrincipalName };
}

async function getToken(connectionId: string): Promise<string> {
  const conn = await db.channelConnection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new Error(`Outlook connection ${connectionId} not found`);
  const creds = decryptJson<OutlookCredentials>(conn.credentialsJson);

  if (creds.expires_at - Date.now() < 5 * 60 * 1000) {
    const res = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: creds.refresh_token,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const updated: OutlookCredentials = {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token ?? creds.refresh_token,
      expires_at: Date.now() + res.data.expires_in * 1000,
    };
    await db.channelConnection.update({
      where: { id: connectionId },
      data: { credentialsJson: encryptJson(updated), updatedAt: new Date() },
    });
    return updated.access_token;
  }
  return creds.access_token;
}

export async function sendOutlookEmail(
  connectionId: string,
  to: string,
  subject: string,
  body: string,
  outlookConversationId?: string,
): Promise<void> {
  const token = await getToken(connectionId);
  const payload: any = {
    message: {
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };
  if (outlookConversationId) payload.message.conversationId = outlookConversationId;
  await axios.post(`${GRAPH}/me/sendMail`, payload, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

/** Creates a Microsoft push subscription so Outlook messages arrive in real-time.
 *  Only call this when VITE_APP_URL is a publicly reachable HTTPS URL.
 *  Subscriptions expire every 3 days — renewOutlookSubscriptions() handles renewal. */
export async function createOutlookSubscription(connectionId: string): Promise<void> {
  const token = await getToken(connectionId);
  const notificationUrl = `${process.env.VITE_APP_URL}/api/hooks/outlook-messages`;
  const expiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const res = await axios.post(
    `${GRAPH}/subscriptions`,
    {
      changeType: 'created',
      notificationUrl,
      resource: 'me/messages',
      expirationDateTime: expiry,
      clientState: connectionId, // echoed back in webhook — used to look up the connection
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  await db.channelConnection.update({
    where: { id: connectionId },
    data: {
      outlookSubscriptionId: res.data.id,
      outlookSubscriptionExpiry: new Date(expiry),
      updatedAt: new Date(),
    },
  });
}

/** Renews subscriptions expiring within 12 hours. Called by the 12h cron in server.ts. */
export async function renewOutlookSubscriptions(): Promise<void> {
  const within12h = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const expiring = await db.channelConnection.findMany({
    where: {
      provider: 'outlook',
      isActive: true,
      outlookSubscriptionId: { not: null },
      outlookSubscriptionExpiry: { lte: within12h },
    },
  });

  for (const conn of expiring) {
    try {
      const token = await getToken(conn.id);
      const newExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await axios.patch(
        `${GRAPH}/subscriptions/${conn.outlookSubscriptionId}`,
        { expirationDateTime: newExpiry },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      await db.channelConnection.update({
        where: { id: conn.id },
        data: { outlookSubscriptionExpiry: new Date(newExpiry), updatedAt: new Date() },
      });
    } catch (err) {
      console.error(`[Outlook] Failed to renew subscription for connection ${conn.id}:`, err);
    }
  }
}
