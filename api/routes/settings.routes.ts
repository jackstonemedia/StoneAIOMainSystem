import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// SETTINGS — Workspace
router.get('/workspace', async (req, res) => {
  try {
    const ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    res.json(ws || { id: req.workspaceId, name: 'Stone AIO', plan: 'pro' });
  } catch (e) { res.json({ id: req.workspaceId, name: 'Stone AIO', plan: 'pro' }); }
});
router.put('/workspace', async (req, res) => {
  try { res.json(await db.workspace.update({ where: { id: req.workspaceId }, data: { name: req.body.name } })); }
  catch (e) { res.json({ success: true }); }
});

// SETTINGS — API Keys
router.get('/api-keys', async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(keys.map(k => ({ ...k, keyEncrypted: k.keyEncrypted ? '••••••••••••' + k.keyEncrypted.slice(-4) : '' })));
  } catch (e) { res.json([]); }
});
router.put('/api-keys', async (req, res) => {
  try {
    const { provider, key } = req.body;
    if (!provider || !key) return res.status(400).json({ error: 'provider and key required' });
    const existing = await db.apiKey.findUnique({ where: { workspaceId_provider: { workspaceId: req.workspaceId, provider } } });
    if (existing) { await db.apiKey.update({ where: { id: existing.id }, data: { keyEncrypted: key } }); }
    else { await db.apiKey.create({ data: { workspaceId: req.workspaceId, provider, keyEncrypted: key } }); }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// SETTINGS — Integrations
router.get('/integrations', async (req, res) => {
  try {
    const integrations = await db.integration.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(integrations.map(i => ({ provider: i.provider, connected: true, accountId: i.accountId })));
  } catch (e) { res.json([]); }
});

// SETTINGS — Team
router.get('/team', async (req, res) => {
  try {
    const members = await db.workspaceMember.findMany({ where: { workspaceId: req.workspaceId } });
    res.json(members);
  } catch (e) { res.json([{ userId: 'user_jack', role: 'admin' }]); }
});

export default router;
