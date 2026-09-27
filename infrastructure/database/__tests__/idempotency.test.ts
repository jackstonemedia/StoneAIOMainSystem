import { describe, it, expect, vi } from 'vitest';
import { claimWebhookEvent } from '../idempotency.js';
import { db } from '../client.js';

vi.mock('../client.js', () => ({
  db: {
    processedWebhookEvent: {
      create: vi.fn(),
    },
  },
}));

describe('Webhook Idempotency Layer (P1.2)', () => {
  it('allows fresh webhook event to be claimed', async () => {
    (db.processedWebhookEvent.create as any).mockResolvedValue({
      id: 'evt-1',
      provider: 'stripe',
      eventId: 'evt_stripe_100',
    });

    const isNew = await claimWebhookEvent('stripe', 'evt_stripe_100', { type: 'checkout.session.completed' });
    expect(isNew).toBe(true);
    expect(db.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        provider: 'stripe',
        eventId: 'evt_stripe_100',
        status: 'processed',
        metaJson: JSON.stringify({ type: 'checkout.session.completed' }),
      },
    });
  });

  it('rejects duplicate webhook event on unique constraint error', async () => {
    (db.processedWebhookEvent.create as any).mockRejectedValue({
      code: 'P2002',
      message: 'Unique constraint failed on processed_webhook_events_provider_event_id_key',
    });

    const isNew = await claimWebhookEvent('stripe', 'evt_stripe_100');
    expect(isNew).toBe(false);
  });

  it('handles empty eventId gracefully without blocking', async () => {
    const isNew = await claimWebhookEvent('twilio', '');
    expect(isNew).toBe(true);
  });
});
