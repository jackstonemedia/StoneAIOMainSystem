import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from '../services/notifications/preferences.service.js';

const router = Router();

// ── Notification preferences (Tranche A fix 11) ─────────────────────────────
// The Settings toggles used to be local state that only showed a toast.
// They now persist per workspace and the producers read them.
router.get('/preferences', async (req, res) => {
  try {
    res.json({ preferences: await getNotificationPreferences(req.workspaceId!) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load notification preferences' });
  }
});
router.put('/preferences', async (req, res) => {
  try {
    const prefs = (req.body?.preferences ?? {}) as Record<string, boolean>;
    res.json({ preferences: await setNotificationPreferences(req.workspaceId!, prefs) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save notification preferences' });
  }
});

// SSE clients registry
const sseClients = new Set<any>();

// NOTIFICATIONS
router.get('/', async (req, res) => {
  try { res.json(await db.notification.findMany({ where: { workspaceId: req.workspaceId }, orderBy: { createdAt: 'desc' }, take: 50 })); }
  catch (e) { res.json([]); }
});
router.get('/unread-count', async (req, res) => {
  try { res.json({ count: await db.notification.count({ where: { workspaceId: req.workspaceId, read: false } }) }); }
  catch (e) { res.json({ count: 0 }); }
});
router.post('/:id/read', async (req, res) => {
  try { await db.notification.update({ where: { id: req.params.id }, data: { read: true } }); res.json({ success: true }); }
  catch (e) { res.json({ success: true }); }
});
router.post('/read-all', async (req, res) => {
  try { await db.notification.updateMany({ where: { workspaceId: req.workspaceId, read: false }, data: { read: true } }); res.json({ success: true }); }
  catch (e) { res.json({ success: true }); }
});
router.delete('/:id', async (req, res) => {
  try { await db.notification.delete({ where: { id: req.params.id } }); res.json({ success: true }); }
  catch (e) { res.json({ success: true }); }
});

// SSE endpoint
router.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  const client = { res, id: Date.now() };
  sseClients.add(client);
  const ping = setInterval(() => {
    try { res.write(`event: ping\ndata: {}\n\n`); } catch { clearInterval(ping); sseClients.delete(client); }
  }, 15000);
  req.on('close', () => { clearInterval(ping); sseClients.delete(client); });
});

export function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.res.write(payload); } catch { sseClients.delete(client); }
  }
}

export default router;
