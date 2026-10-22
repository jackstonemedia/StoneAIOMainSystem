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

/**
 * Pure MIME builder (extracted for unit tests). Default shape is unchanged:
 * multipart/alternative with a plain-text part plus an HTML part. With
 * textOnly, the message is a single text/plain part — no HTML part at all
 * (M7 cold outreach: plain-text style, no images, no heavy layout).
 */
export function buildGmailMime(opts: {
  fromEmail?: string | null;
  fromName?: string | null;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  textOnly?: boolean;
}): string {
  const { fromEmail, fromName, to, subject, body, htmlBody, textOnly } = opts;
  // RFC 5321: "Display Name <email@domain>" or just the email address
  const fromHeader = fromName && fromEmail
    ? `From: ${fromName} <${fromEmail}>`
    : fromEmail
      ? `From: ${fromEmail}`
      : '';
  const head = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];
  if (textOnly) {
    return [...head, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', body].join('\r\n');
  }
  // Build a multipart/alternative MIME email so recipients see proper HTML formatting
  // while also having a plain-text fallback for email clients that don't render HTML.
  const boundary = `boundary_${Date.now().toString(36)}`;
  const htmlPart = htmlBody
    ?? body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/\n/g, '<br>');
  const mimeLines = [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlPart.includes('<html') || htmlPart.includes('<!DOCTYPE')
      ? htmlPart
      : `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222;">${htmlPart}</body></html>`,
    '',
    `--${boundary}--`,
  ];
  return mimeLines.join('\r\n');
}

export async function sendGmailMessage(
  connectionId: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string,
  htmlBody?: string,
  fromName?: string,
  textOnly?: boolean,
): Promise<{ messageId: string; threadId: string }> {
  const { gmail, conn } = await getAuthenticatedGmail(connectionId);

  const mime = buildGmailMime({
    fromEmail: conn.email,
    fromName,
    to,
    subject,
    body,
    htmlBody,
    textOnly,
  });
  const raw = Buffer.from(mime).toString('base64url');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });
  return { messageId: res.data.id!, threadId: res.data.threadId! };
}

/** Called by the Gmail poller every 2 minutes for one connection. */export async function fetchGmailHistory(connectionId: string): Promise<void> {
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

/**
 * M5 (Gmail-only bounce scanning): search one connection's mailbox.
 * Returns Gmail message ids only; callers fetch what they need.
 */
export async function searchGmailMessages(connectionId: string, query: string, maxResults = 50): Promise<string[]> {
  const { gmail } = await getAuthenticatedGmail(connectionId);
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
  return (res.data.messages || []).map((m) => m.id!).filter(Boolean);
}

/** M5: fetch one message in RAW MIME form, base64url-decoded to text. */
export async function getGmailMessageRaw(connectionId: string, messageId: string): Promise<string> {
  const { gmail } = await getAuthenticatedGmail(connectionId);
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'RAW' });
  const raw = res.data.raw || '';
  return Buffer.from(raw, 'base64url').toString('utf8');
}

/** M5: resolve a sent message by its RFC Message-ID (exact DSN mapping). */
export async function findGmailMessageByRfcId(connectionId: string, rfcMessageId: string): Promise<string | null> {
  const clean = rfcMessageId.replace(/[<>]/g, '').trim();
  if (!clean) return null;
  const ids = await searchGmailMessages(connectionId, `rfc822msgid:${clean}`, 5);
  return ids[0] || null;
}
