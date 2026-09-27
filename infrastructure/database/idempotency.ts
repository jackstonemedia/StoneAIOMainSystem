import { db } from './client.js';

export interface ClaimWebhookResult {
  claimed: boolean;
  existingStatus?: string;
}

/**
 * Atomically claims a webhook event by provider + eventId.
 * Returns true if this is the first time the event is received and claimed for processing.
 * Returns false if the event was already claimed or processed (duplicate delivery).
 */
export async function claimWebhookEvent(
  provider: 'stripe' | 'twilio' | 'meta' | 'resend' | 'outlook' | string,
  eventId: string,
  meta?: Record<string, any>
): Promise<boolean> {
  if (!eventId) return true; // If no eventId is provided, proceed without deduplication

  try {
    await (db as any).processedWebhookEvent.create({
      data: {
        provider,
        eventId,
        status: 'processed',
        metaJson: meta ? JSON.stringify(meta) : null,
      },
    });
    return true; // Successfully claimed
  } catch (error: any) {
    // Unique constraint violation (Prisma P2002 or duplicate key) indicates duplicate webhook delivery
    if (error?.code === 'P2002' || error?.message?.includes('Unique constraint') || error?.message?.includes('UNIQUE constraint')) {
      console.warn(`[WebhookIdempotency] Duplicate webhook ignored: provider=${provider}, eventId=${eventId}`);
      return false; // Already processed
    }
    // For other transient errors, log and allow processing so we don't drop webhooks
    console.error(`[WebhookIdempotency] Failed to check event idempotency:`, error?.message || error);
    return true;
  }
}
