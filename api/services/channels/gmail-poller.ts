import { db } from '../../../infrastructure/database/client.js';
import { fetchGmailHistory } from './gmail.service.js';

/** Polls all active Gmail connections for new messages. Called by cron every 2 minutes. */
export async function pollAllGmailAccounts(): Promise<void> {
  // Guard: db.channelConnection requires the Prisma client to be regenerated.
  // Run `npx prisma generate` after stopping the server if this logs below.
  if (typeof (db as any).channelConnection === 'undefined') {
    console.error('[Gmail Poller] ⚠️  db.channelConnection unavailable — run `npx prisma generate` then restart.');
    return;
  }

  const connections = await db.channelConnection.findMany({
    where: { provider: 'gmail', isActive: true },
  });

  for (const conn of connections) {
    try {
      await fetchGmailHistory(conn.id);
    } catch (err) {
      console.error(`[Gmail Poller] Error for connection ${conn.id}:`, err);
    }
  }
}
