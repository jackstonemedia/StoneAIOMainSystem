import Redis from 'ioredis';
import { EventEmitter } from 'events';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(100);

// Reference counter: tracks how many SSE clients are subscribed to each channel.
const channelRefs = new Map<string, number>();

/** Call once inside startServer() after the listen callback. */
export function initRealtime(): void {
  if (!process.env.REDIS_URL) {
    console.log('[Realtime] No REDIS_URL — using in-memory local emitter for SSE fallback.');
    return;
  }
  publisher = new Redis(process.env.REDIS_URL);
  subscriber = new Redis(process.env.REDIS_URL);
  console.log('[Realtime] ✅ SSE pub/sub initialized.');
}

// ── Existing Conversations (CRM) ──────────────────────────────────────────────

export async function publishConversationEvent(workspaceId: string, payload: object): Promise<void> {
  const channel = `workspace:${workspaceId}:conversations`;
  if (publisher) {
    await publisher.publish(channel, JSON.stringify(payload));
  } else {
    localEmitter.emit(channel, JSON.stringify(payload));
  }
}

export function subscribeToWorkspace(workspaceId: string, onMessage: (payload: object) => void): () => void {
  const channel = `workspace:${workspaceId}:conversations`;
  return _subscribe(channel, onMessage);
}

// ── Inbox (New) ───────────────────────────────────────────────────────────────

export async function publishInboxEvent(workspaceId: string, event: object): Promise<void> {
  const channel = `workspace:${workspaceId}:inbox`;
  if (publisher) {
    await publisher.publish(channel, JSON.stringify(event));
  } else {
    localEmitter.emit(channel, JSON.stringify(event));
  }
}

export function subscribeToInbox(workspaceId: string, onMessage: (payload: object) => void): () => void {
  const channel = `workspace:${workspaceId}:inbox`;
  return _subscribe(channel, onMessage);
}

// Widget-specific channel for end-user live chat
export async function publishWidgetEvent(conversationId: string, event: object): Promise<void> {
  const channel = `widget:${conversationId}:inbox`;
  if (publisher) {
    await publisher.publish(channel, JSON.stringify(event));
  } else {
    localEmitter.emit(channel, JSON.stringify(event));
  }
}

export function subscribeToWidget(conversationId: string, onMessage: (payload: object) => void): () => void {
  const channel = `widget:${conversationId}:inbox`;
  return _subscribe(channel, onMessage);
}

// ── Internal Helper ───────────────────────────────────────────────────────────

function _subscribe(channel: string, onMessage: (payload: object) => void): () => void {
  const handler = (ch: string, msg: string) => {
    if (ch === channel) {
      try { onMessage(JSON.parse(msg)); } catch {}
    }
  };

  const localHandler = (msg: string) => {
    try { onMessage(JSON.parse(msg)); } catch {}
  };

  if (!subscriber) {
    localEmitter.on(channel, localHandler);
    return () => localEmitter.off(channel, localHandler);
  }

  const refs = (channelRefs.get(channel) ?? 0) + 1;
  channelRefs.set(channel, refs);
  if (refs === 1) subscriber.subscribe(channel);

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
