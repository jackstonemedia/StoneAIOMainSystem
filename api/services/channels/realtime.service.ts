import Redis from 'ioredis';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

// Reference counter: tracks how many SSE clients are subscribed to each channel.
// We only call Redis SUBSCRIBE on the first client and UNSUBSCRIBE on the last.
// Without this, one client disconnecting would unsubscribe the channel for everyone.
const channelRefs = new Map<string, number>();

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
 *  Returns an unsubscribe function — call it when the SSE client disconnects.
 *  Uses a ref-count so that disconnecting one client does not drop the Redis
 *  subscription while other clients for the same workspace are still connected. */
export function subscribeToWorkspace(
  workspaceId: string,
  onMessage: (payload: object) => void,
): () => void {
  if (!subscriber) return () => {};
  const channel = `workspace:${workspaceId}:conversations`;

  // Increment ref count; only issue SUBSCRIBE on the first subscriber
  const refs = (channelRefs.get(channel) ?? 0) + 1;
  channelRefs.set(channel, refs);
  if (refs === 1) subscriber.subscribe(channel);

  const handler = (ch: string, msg: string) => {
    if (ch === channel) {
      try { onMessage(JSON.parse(msg)); } catch {}
    }
  };
  subscriber.on('message', handler);

  return () => {
    subscriber!.off('message', handler);
    const remaining = (channelRefs.get(channel) ?? 1) - 1;
    if (remaining <= 0) {
      channelRefs.delete(channel);
      subscriber!.unsubscribe(channel);
    } else {
      channelRefs.set(channel, remaining);
    }
  };
}
