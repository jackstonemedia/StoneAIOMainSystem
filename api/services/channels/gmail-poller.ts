import { db } from '../../../infrastructure/database/client.js';
import { fetchGmailHistory } from './gmail.service.js';

/** Polls all active Gmail connections for new messages. Called by cron every 2 minutes. */
export async function pollAllGmailAccounts(): Promise<void> {
  const connections = await db.channelConnection.findMany({
    where: { provider: 'gmail', isActive: true },
  });

  for (const conn of connections) {
    try {
      await fetchGmailHistory(conn.id);
    } catch (err) {
      console.error(`[Gmail Poller] Error for connection ${conn.id}:`, err);
    }
    // M5 (Gmail-only): bounce DSNs arrive as ordinary mail — scan for
    // them on the same cadence. Never breaks reply polling above.
    try {
      const { scanBounceNotifications } = await import('../email-marketing/gmail-bounce.service.js');
      await scanBounceNotifications(conn.id);
    } catch (err) {
      console.error(`[Gmail Poller] Bounce scan error for connection ${conn.id}:`, err);
    }
  }
}
