import Redis from 'ioredis';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

/** Call once inside startServer() after the listen callback. Safe to call without REDIS_URL. */
export function initRealtime(): void {
  if (!process.env.REDIS_URL) {
    console.log('[Realtime] No REDIS_URL — SSE disabled. Inbox updates via 15s polling only.');
    return;
  }
  publisher = new Redis(process.env.REDIS_URL);
  subscriber = new Redis(process.env.REDIS_URL); // must be a SEPARATE connection
  console.log('[Realtime] ✅ SSE pub/sub initialized.');
}

/** Publishes a conversation event for a workspace. No-op if Redis is not configured. */
export async function publishConversationEvent(workspaceId: string, payload: object): Promise<void> {
  if (!publisher) return;
  await publisher.publish(`workspace:${workspaceId}:conversations`, JSON.stringify(payload));
}

/** Subscribes to conversation events for a workspace.
 *  Returns an unsubscribe function — call it when the SSE client disconnects. */
export function subscribeToWorkspace(
  workspaceId: string,
  onMessage: (payload: object) => void,
): () => void {
  if (!subscriber) return () => {};
  const channel = `workspace:${workspaceId}:conversations`;
  subscriber.subscribe(channel);

  const handler = (ch: string, msg: string) => {
    if (ch === channel) {
      try { onMessage(JSON.parse(msg)); } catch {}
    }
  };
  subscriber.on('message', handler);

  return () => {
    subscriber!.unsubscribe(channel);
    subscriber!.off('message', handler);
  };
}
