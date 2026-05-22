import { google } from 'googleapis';
import { db } from '../../../infrastructure/database/client.js';
import { encryptJson, decryptJson } from './encryption.js';

interface GmailCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  );
}

export function getGmailAuthUrl(state: string): string {
  console.log('[Gmail OAuth] Using redirect URI:', process.env.GMAIL_REDIRECT_URI);
  return makeOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    state,
  });
}

export async function exchangeGmailCode(
  code: string
): Promise<{ credentials: GmailCredentials; email: string }> {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: client });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return {
    credentials: {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
    },
    email: profile.data.emailAddress!,
  };
}

async function getAuthenticatedGmail(connectionId: string) {
  const conn = await db.channelConnection.findUnique({ where: { id: connectionId } });
  if (!conn) throw new Error(`Gmail connection ${connectionId} not found`);
  const creds = decryptJson<GmailCredentials>(conn.credentialsJson);
  const client = makeOAuthClient();
  client.setCredentials(creds);
  // Persist refreshed tokens automatically
  client.on('tokens', async (newTokens) => {
    const updated = { ...creds, ...newTokens };
    await db.channelConnection.update({
      where: { id: connectionId },
      data: { credentialsJson: encryptJson(updated), updatedAt: new Date() },
    });
  });
  return { gmail: google.gmail({ version: 'v1', auth: client }), conn };
}

export async function sendGmailMessage(
  connectionId: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  htmlBody?: string,
): Promise<string> {
  const { gmail } = await getAuthenticatedGmail(connectionId);

  // Build a multipart/alternative MIME email so recipients see proper HTML formatting
  // while also having a plain-text fallback for email clients that don't render HTML.
  const boundary = `boundary_${Date.now().toString(36)}`;
  const htmlPart = htmlBody
    ?? body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/\n/g, '<br>');

  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222;">${htmlPart}</body></html>`,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const raw = Buffer.from(mime).toString('base64url');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });
  return res.data.id!;
}

/** Called by the Gmail poller every 2 minutes for one connection. */
export async function fetchGmailHistory(connectionId: string): Promise<void> {
  const { gmail, conn } = await getAuthenticatedGmail(connectionId);

  // First-ever poll: save current historyId and return (processing starts next run)
  if (!conn.gmailHistoryId) {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    await db.channelConnection.update({
      where: { id: conn.id },
      data: { gmailHistoryId: profile.data.historyId!, lastPolledAt: new Date() },
    });
    return;
  }

  let historyRes;
  try {
    historyRes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: conn.gmailHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });
  } catch (err: any) {
    if (err.code === 404) {
      // historyId expired — reset baseline
      const profile = await gmail.users.getProfile({ userId: 'me' });
      await db.channelConnection.update({
        where: { id: conn.id },
        data: { gmailHistoryId: profile.data.historyId!, lastPolledAt: new Date() },
      });
      return;
    }
    throw err;
  }

  const history = historyRes.data.history ?? [];
  const newHistoryId = historyRes.data.historyId ?? conn.gmailHistoryId;

  for (const item of history) {
    for (const added of item.messagesAdded ?? []) {
      const msgId = added.message?.id;
      if (!msgId) continue;

      // Deduplication check
      const alreadyStored = await db.conversationMessage.findFirst({
        where: { externalId: msgId },
      });
      if (alreadyStored) continue;

      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full',
      });

      // Skip messages we sent
      if (fullMsg.data.labelIds?.includes('SENT')) continue;

      // Skip promotional, social, update, forum, spam, and trash emails
      const SKIP_LABELS = [
        'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES',
        'CATEGORY_FORUMS', 'SPAM', 'TRASH',
      ];
      if (SKIP_LABELS.some(l => fullMsg.data.labelIds?.includes(l))) continue;

      const headers = fullMsg.data.payload?.headers ?? [];
      const from = headers.find(h => h.name === 'From')?.value ?? '';
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)';
      const threadId = fullMsg.data.threadId!;
      const { text: bodyText, html: bodyHtml } = extractGmailBody(fullMsg.data.payload);
      const bodyStr = bodyText || htmlToText(bodyHtml);

      // Find or create conversation keyed by Gmail threadId
      let convo = await db.conversation.findFirst({
        where: { workspaceId: conn.workspaceId, externalId: threadId },
      });

      if (!convo) {
        const senderEmail = from.match(/<(.+?)>/)?.[1] ?? from.trim();
        const contact = await db.contact.findFirst({
          where: { workspaceId: conn.workspaceId, email: senderEmail },
        });
        convo = await db.conversation.create({
          data: {
            workspaceId: conn.workspaceId,
            contactId: contact?.id ?? null,
            channel: 'email',
            status: 'open',
            subject,
            externalId: threadId,
            channelConnectionId: conn.id,
            lastMessageAt: new Date(),
            unreadCount: 1,
          },
        });
      }

      const date = headers.find(h => h.name === 'Date')?.value ?? new Date().toISOString();

      // Store HTML body + metadata in attachments JSON so the UI can render it properly
      const msgMeta = JSON.stringify({
        fromEmail: from,
        subject,
        date,
        htmlBody: bodyHtml || null,
      });

      await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: from,
          body: bodyStr,
          direction: 'inbound',
          externalId: msgId,
          channel: 'email',
          attachments: msgMeta,
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), updatedAt: new Date() },
      });
    }
  }

  await db.channelConnection.update({
    where: { id: conn.id },
    data: { gmailHistoryId: String(newHistoryId), lastPolledAt: new Date() },
  });
}

function extractGmailBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: '', html: '' };

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { text: Buffer.from(payload.body.data, 'base64url').toString('utf-8'), html: '' };
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { text: '', html: Buffer.from(payload.body.data, 'base64url').toString('utf-8') };
  }

  // multipart — collect best text and html from all parts
  let text = '';
  let html = '';
  for (const part of payload.parts ?? []) {
    const r = extractGmailBody(part);
    if (!text && r.text) text = r.text;
    if (!html && r.html) html = r.html;
    if (text && html) break;
  }
  return { text, html };
}

/** Strip HTML tags to plain text for storage in `body`. */
function htmlToText(html: string): string {
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
