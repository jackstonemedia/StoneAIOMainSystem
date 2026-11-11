import { Router } from 'express';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { db } from '../../infrastructure/database/client.js';
import { decryptString, encryptString } from '../services/channels/encryption.js';
import { requireRole } from '../middleware/requireRole.js';

// TOTP clock-skew tolerance: ±30s (one step) when verifying codes.
const TOTP_TOLERANCE_SECONDS = 30;

const router = Router();

// ── Workspace ─────────────────────────────────────────────────────────────────
router.get('/workspace', async (req, res) => {
  try {
    const ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    res.json(ws || { id: req.workspaceId, name: 'Stone AIO', plan: 'pro' });
  } catch (e) { res.json({ id: req.workspaceId, name: 'Stone AIO', plan: 'pro' }); }
});

router.put('/workspace', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { name } = req.body;
    let ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    if (ws) {
      ws = await db.workspace.update({
        where: { id: req.workspaceId },
        data: { ...(name ? { name } : {}) },
      });
    } else {
      ws = await db.workspace.create({
        data: {
          id: req.workspaceId,
          name: name || 'Stone AIO Workspace',
          ownerId: (req as any).auth?.userId || 'owner_default',
        },
      });
    }

    // Seed default pipeline if workspace has no pipelines yet
    const existingPipeline = await db.pipeline.findFirst({ where: { workspaceId: req.workspaceId } });
    if (!existingPipeline) {
      const pipeline = await db.pipeline.create({
        data: {
          workspaceId: req.workspaceId,
          name: 'Sales Pipeline',
          isDefault: true,
        },
      });

      const defaultStages = [
        { name: 'Lead', order: 0, color: '#64748b' },
        { name: 'Qualified', order: 1, color: '#818cf8' },
        { name: 'Proposal', order: 2, color: '#fbbf24' },
        { name: 'Negotiation', order: 3, color: '#a78bfa' },
        { name: 'Won', order: 4, color: '#34d399' },
        { name: 'Lost', order: 5, color: '#f87171' },
      ];

      for (const stg of defaultStages) {
        await db.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name: stg.name,
            order: stg.order,
            color: stg.color,
          },
        });
      }
    }

    res.json(ws);
  } catch (e) {
    console.error('[Workspace PUT Error]', e);
    res.status(500).json({ error: String(e) });
  }
});

// ── API Keys ──────────────────────────────────────────────────────────────────
router.get('/api-keys', async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(keys.map(k => ({ ...k, keyEncrypted: k.keyEncrypted ? '••••' + k.keyEncrypted.slice(-4) : '' })));
  } catch (e) { res.json([]); }
});

router.put('/api-keys', requireRole('admin'), async (req, res) => {
  try {
    const { provider, key } = req.body;
    if (!provider || !key) return res.status(400).json({ error: 'provider and key required' });
    const encrypted = encryptString(key);
    const existing = await db.apiKey.findUnique({
      where: { workspaceId_provider: { workspaceId: req.workspaceId, provider } },
    });
    if (existing) {
      await db.apiKey.update({ where: { id: existing.id }, data: { keyEncrypted: encrypted } });
    } else {
      await db.apiKey.create({ data: { workspaceId: req.workspaceId, provider, keyEncrypted: encrypted } });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Integrations ──────────────────────────────────────────────────────────────
router.get('/integrations', async (req, res) => {
  try {
    const integrations = await db.integration.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(integrations.map(i => ({ provider: i.provider, connected: true, accountId: i.accountId })));
  } catch (e) { res.json([]); }
});

// ── Team ──────────────────────────────────────────────────────────────────────
router.get('/team', async (req, res) => {
  try {
    const members = await db.workspaceMember.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(members);
  } catch (e) { res.json([{ userId: 'user_admin', role: 'admin' }]); }
});

router.post('/team/invite', requireRole('admin'), async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    // Generate a pending userId — in production this would trigger an email invite
    const userId = `pending_${email.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}`;
    const member = await db.workspaceMember.create({
      data: { workspaceId: req.workspaceId, userId, role },
    });
    res.json({ success: true, member, invited: email });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete('/team/:userId', requireRole('admin'), async (req, res) => {
  try {
    await db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: req.workspaceId, userId: req.params.userId } },
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Security — Password ───────────────────────────────────────────────────────
// REMOVED (Tier 1 Fix 1): the old PUT /password returned success without
// changing anything. Passwords are owned by Clerk — the frontend now calls
// Clerk's user.updatePassword() directly. There is no password endpoint here
// on purpose, so no client can ever see a fake success again.

// ── Security — 2FA (real TOTP) ────────────────────────────────────────────────
// The secret is random per user, stored ENCRYPTED (AES-256-GCM), and returned
// exactly once at setup (as the manual key + a locally-generated QR data URL
// — the secret is never sent to a third-party QR service). Verify checks the
// code against the stored secret; only then is 2FA enabled.

function clerkConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY;
}

// The Clerk session id (sid) from the already-verified JWT, used only to mark
// which session is the current one. Null in dev-bypass mode (no token).
function currentSessionId(req: any): string | null {
  const auth = req.headers?.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
}

router.get('/2fa/status', async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const row = userId ? await db.userTwoFactor.findUnique({ where: { userId } }) : null;
    res.json({ enabled: !!row?.enabled, configured: !!row });
  } catch (e) {
    res.json({ enabled: false, configured: false });
  }
});

router.get('/2fa/setup', async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const secret = generateSecret();
    const otpUri = generateURI({ issuer: 'StoneAIO', label: userId, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpUri);
    await db.userTwoFactor.upsert({
      where: { userId },
      update: { secretEncrypted: encryptString(secret), enabled: false, enabledAt: null },
      create: { userId, secretEncrypted: encryptString(secret), enabled: false },
    });
    res.json({ secret, qrCodeUrl });
  } catch (e) {
    console.error('[2FA setup]', e);
    res.status(500).json({ error: 'Failed to start 2FA setup' });
  }
});

router.post('/2fa/verify', async (req, res) => {
  const { code } = req.body;
  if (!code || String(code).length !== 6) {
    return res.status(400).json({ error: 'A 6-digit verification code is required' });
  }
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const row = await db.userTwoFactor.findUnique({ where: { userId } });
    if (!row) {
      return res.status(400).json({ error: 'Set up 2FA first — no secret is stored for this account.' });
    }
    const ok = verifySync({
      token: String(code),
      secret: decryptString(row.secretEncrypted),
      epochTolerance: TOTP_TOLERANCE_SECONDS,
    }).valid;
    if (!ok) {
      return res.status(400).json({ error: 'Invalid code. Check your authenticator app and try again.' });
    }
    await db.userTwoFactor.update({
      where: { userId },
      data: { enabled: true, enabledAt: new Date() },
    });
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (e) {
    console.error('[2FA verify]', e);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

router.delete('/2fa', async (req, res) => {
  const { code } = req.body ?? {};
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const row = await db.userTwoFactor.findUnique({ where: { userId } });
    if (!row?.enabled) return res.status(400).json({ error: '2FA is not enabled for this account.' });
    if (!code || String(code).length !== 6) {
      return res.status(400).json({ error: 'Enter the current 6-digit code from your authenticator app to disable 2FA.' });
    }
    const ok = verifySync({
      token: String(code),
      secret: decryptString(row.secretEncrypted),
      epochTolerance: TOTP_TOLERANCE_SECONDS,
    }).valid;
    if (!ok) return res.status(400).json({ error: 'Invalid code.' });
    await db.userTwoFactor.delete({ where: { userId } });
    res.json({ success: true, message: '2FA disabled' });
  } catch (e) {
    console.error('[2FA disable]', e);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ── Security — Sessions (real Clerk sessions) ────────────────────────────────
// Lists and revokes the current user's real Clerk sessions. In dev-bypass
// mode (no CLERK_SECRET_KEY) these honestly 503 instead of returning fake rows.
router.get('/sessions', async (req, res) => {
  if (!clerkConfigured()) {
    return res.status(503).json({ error: 'Sessions are managed by Clerk and are unavailable in dev mode (no CLERK_SECRET_KEY).' });
  }
  try {
    const { clerkClient } = await import('@clerk/express');
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const sessions = (await clerkClient.sessions.getSessionList({ userId })).data;
    const currentId = currentSessionId(req);
    res.json(
      sessions.map((s: any) => ({
        id: s.id,
        status: s.status,
        lastActiveAt: s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : null,
        expireAt: s.expireAt ? new Date(s.expireAt).toISOString() : null,
        isCurrent: currentId ? s.id === currentId : false,
      })),
    );
  } catch (e) {
    console.error('[Sessions list]', e);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.delete('/sessions/:sessionId', async (req, res) => {
  if (!clerkConfigured()) {
    return res.status(503).json({ error: 'Sessions are managed by Clerk and are unavailable in dev mode (no CLERK_SECRET_KEY).' });
  }
  try {
    const { clerkClient } = await import('@clerk/express');
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const currentId = currentSessionId(req);
    if (currentId && req.params.sessionId === currentId) {
      return res.status(400).json({ error: 'You cannot revoke your current session here. Sign out instead.' });
    }
    const sessions = (await clerkClient.sessions.getSessionList({ userId })).data;
    if (!sessions.some((s: any) => s.id === req.params.sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await clerkClient.sessions.revokeSession(req.params.sessionId);
    res.json({ success: true, message: 'Session revoked' });
  } catch (e) {
    console.error('[Session revoke]', e);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

export default router;
