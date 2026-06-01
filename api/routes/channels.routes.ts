import { Router } from 'express';
import twilio from 'twilio';
import { db } from '../../infrastructure/database/client.js';
import { encryptJson } from '../services/channels/encryption.js';
import { getGmailAuthUrl, exchangeGmailCode } from '../services/channels/gmail.service.js';
import { getOutlookAuthUrl, exchangeOutlookCode, createOutlookSubscription } from '../services/channels/outlook.service.js';
import { subscribeToWorkspace } from '../services/channels/realtime.service.js';

const router = Router();

// ── List all channel connections for the workspace ────────────────────────────
router.get('/connections', async (req, res) => {
  try {
    const connections = await db.channelConnection.findMany({
      where: { workspaceId: req.workspaceId },
      select: {
        id: true, userId: true, provider: true, label: true, email: true,
        twilioPhoneNumber: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(connections);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Disconnect a channel connection ───────────────────────────────────────────
// SECURITY: Validates BOTH workspaceId AND userId.
// A workspace member cannot delete another member's connection.
router.delete('/connections/:id', async (req, res) => {
  try {
    const conn = await db.channelConnection.findUnique({ where: { id: req.params.id } });
    if (!conn) return res.status(404).json({ error: 'Not found' });
    if (conn.workspaceId !== req.workspaceId) return res.status(403).json({ error: 'Forbidden' });
    if (conn.userId !== req.userId) return res.status(403).json({ error: 'You can only disconnect your own accounts' });
    await db.channelConnection.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Gmail OAuth — start ───────────────────────────────────────────────────────
router.get('/gmail/connect', (req, res) => {
  if (!process.env.GMAIL_CLIENT_ID) {
    return res.status(400).json({ error: 'Gmail OAuth is not configured on this server.' });
  }
  const state = Buffer.from(JSON.stringify({
    workspaceId: req.workspaceId,
    userId: req.userId,
    provider: 'gmail',
  })).toString('base64');
  res.json({ url: getGmailAuthUrl(state) });
});

// ── Gmail OAuth — callback ────────────────────────────────────────────────────
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state: rawState, error } = req.query as Record<string, string>;
    if (error) return res.status(400).send(`OAuth error: ${error}`);
    if (!code || !rawState) return res.status(400).send('Missing code or state');

    const state = JSON.parse(Buffer.from(rawState, 'base64').toString());

    const { credentials, email } = await exchangeGmailCode(code);

    await db.channelConnection.upsert({
      where: {
        workspaceId_userId_provider: {
          workspaceId: state.workspaceId,
          userId: state.userId,
          provider: 'gmail',
        },
      },
      update: { credentialsJson: encryptJson(credentials), email, isActive: true, updatedAt: new Date() },
      create: {
        workspaceId: state.workspaceId,
        userId: state.userId,
        provider: 'gmail',
        label: `Gmail (${email})`,
        email,
        credentialsJson: encryptJson(credentials),
        isActive: true,
      },
    });

    res.redirect('/conversations/chat?channel_connected=gmail');
  } catch (e) {
    console.error('[Gmail callback]', e);
    res.status(500).send('Failed to connect Gmail. Check server logs.');
  }
});

// ── Outlook OAuth — start ─────────────────────────────────────────────────────
router.get('/outlook/connect', (req, res) => {
  if (!process.env.OUTLOOK_CLIENT_ID) {
    return res.status(400).json({ error: 'Outlook OAuth is not configured on this server.' });
  }
  const state = Buffer.from(JSON.stringify({
    workspaceId: req.workspaceId,
    userId: req.userId,
    provider: 'outlook',
  })).toString('base64');
  res.json({ url: getOutlookAuthUrl(state) });
});

// ── Outlook OAuth — callback ──────────────────────────────────────────────────
router.get('/outlook/callback', async (req, res) => {
  try {
    const { code, state: rawState, error } = req.query as Record<string, string>;
    if (error) return res.status(400).send(`OAuth error: ${error}`);
    if (!code || !rawState) return res.status(400).send('Missing code or state');

    const state = JSON.parse(Buffer.from(rawState, 'base64').toString());

    const { credentials, email } = await exchangeOutlookCode(code);

    const conn = await db.channelConnection.upsert({
      where: {
        workspaceId_userId_provider: {
          workspaceId: state.workspaceId,
          userId: state.userId,
          provider: 'outlook',
        },
      },
      update: { credentialsJson: encryptJson(credentials), email, isActive: true, updatedAt: new Date() },
      create: {
        workspaceId: state.workspaceId,
        userId: state.userId,
        provider: 'outlook',
        label: `Outlook (${email})`,
        email,
        credentialsJson: encryptJson(credentials),
        isActive: true,
      },
    });

    // Only create MS push subscription on a real public URL (not localhost)
    const appUrl = process.env.VITE_APP_URL ?? '';
    if (appUrl.startsWith('https://')) {
      await createOutlookSubscription(conn.id).catch(err =>
        console.error('[Outlook] Subscription creation failed (non-fatal):', err)
      );
    }

    res.redirect('/conversations/chat?channel_connected=outlook');
  } catch (e) {
    console.error('[Outlook callback]', e);
    res.status(500).send('Failed to connect Outlook. Check server logs.');
  }
});

// ── SMS / Twilio — connect a user's own Twilio account ───────────────────────
router.post('/sms/connect', async (req, res) => {
  const { accountSid, authToken, phoneNumber } = req.body ?? {};

  if (!accountSid || !authToken || !phoneNumber) {
    return res.status(400).json({ error: 'accountSid, authToken, and phoneNumber are required.' });
  }

  // Validate the credentials by making a real Twilio API call before storing anything
  try {
    const client = twilio(accountSid, authToken);
    await client.incomingPhoneNumbers.list({ limit: 1 });
  } catch {
    return res.status(400).json({ error: 'Invalid Twilio credentials. Double-check your Account SID and Auth Token.' });
  }

  try {
    const conn = await db.channelConnection.upsert({
      where: {
        workspaceId_userId_provider: {
          workspaceId: req.workspaceId,
          userId: req.userId!,
          provider: 'twilio',
        },
      },
      update: {
        credentialsJson: encryptJson({ accountSid, authToken }),
        twilioPhoneNumber: phoneNumber,
        label: `SMS (${phoneNumber})`,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        workspaceId: req.workspaceId,
        userId: req.userId!,
        provider: 'twilio',
        label: `SMS (${phoneNumber})`,
        twilioPhoneNumber: phoneNumber,
        credentialsJson: encryptJson({ accountSid, authToken }),
        isActive: true,
      },
    });
    res.json({ success: true, id: conn.id, label: conn.label, phoneNumber: conn.twilioPhoneNumber });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── SSE — real-time conversation updates ──────────────────────────────────────
router.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Keepalive ping every 25 seconds — prevents reverse proxy timeouts
  const ping = setInterval(() => res.write(':ping\n\n'), 25_000);

  const unsubscribe = subscribeToWorkspace(req.workspaceId, (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

export default router;
