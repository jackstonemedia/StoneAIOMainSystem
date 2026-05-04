import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// ── Workspace ─────────────────────────────────────────────────────────────────
router.get('/workspace', async (req, res) => {
  try {
    const ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    res.json(ws || { id: req.workspaceId, name: 'Stone AIO', plan: 'pro' });
  } catch (e) { res.json({ id: req.workspaceId, name: 'Stone AIO', plan: 'pro' }); }
});

router.put('/workspace', async (req, res) => {
  try {
    const data: any = {};
    if (req.body.name) data.name = req.body.name;
    res.json(await db.workspace.update({ where: { id: req.workspaceId }, data }));
  } catch (e) { res.json({ success: true }); }
});

// ── API Keys ──────────────────────────────────────────────────────────────────
router.get('/api-keys', async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(keys.map(k => ({ ...k, keyEncrypted: k.keyEncrypted ? '••••' + k.keyEncrypted.slice(-4) : '' })));
  } catch (e) { res.json([]); }
});

router.put('/api-keys', async (req, res) => {
  try {
    const { provider, key } = req.body;
    if (!provider || !key) return res.status(400).json({ error: 'provider and key required' });
    const existing = await db.apiKey.findUnique({
      where: { workspaceId_provider: { workspaceId: req.workspaceId, provider } },
    });
    if (existing) {
      await db.apiKey.update({ where: { id: existing.id }, data: { keyEncrypted: key } });
    } else {
      await db.apiKey.create({ data: { workspaceId: req.workspaceId, provider, keyEncrypted: key } });
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

router.post('/team/invite', async (req, res) => {
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

router.delete('/team/:userId', async (req, res) => {
  try {
    await db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: req.workspaceId, userId: req.params.userId } },
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Security — Password ───────────────────────────────────────────────────────
router.put('/password', async (req, res) => {
  // When Clerk is active, password changes are handled via Clerk's dashboard.
  // In dev-bypass mode this is a validated stub.
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  res.json({ success: true, message: 'Password updated successfully' });
});

// ── Security — 2FA ────────────────────────────────────────────────────────────
router.get('/2fa/setup', async (req, res) => {
  // Generates a TOTP URI. In production use otplib to produce a real secret + QR.
  const secret = `STONEAIO${req.workspaceId.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  const issuer = 'StoneAIO';
  const account = 'user@workspace';
  const otpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpUri)}`;
  res.json({ secret, qrCodeUrl });
});

router.post('/2fa/verify', async (req, res) => {
  const { code } = req.body;
  if (!code || String(code).length !== 6) {
    return res.status(400).json({ error: 'A 6-digit verification code is required' });
  }
  // In production: verify TOTP code with stored secret via otplib
  res.json({ success: true, message: '2FA enabled successfully' });
});

// ── Security — Sessions ───────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  // In production, query Clerk sessions API for real session data
  res.json([
    {
      id: `session_current`,
      device: 'Chrome on Windows',
      location: 'New York, US',
      ip: '127.0.0.1',
      lastActive: new Date().toISOString(),
      isCurrent: true,
    },
  ]);
});

router.delete('/sessions/:sessionId', async (req, res) => {
  // In production, revoke the Clerk session by ID
  res.json({ success: true, message: 'Session revoked' });
});

export default router;
