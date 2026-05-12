import axios from 'axios';
import { env } from '../../infrastructure/config/env.js';
import { ensureAPProject } from './ap-workspace-sync.service.js';

// ── All internal Stone AIO event types ────────────────────────────────────────
export type StoneAIOEvent =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contact.tag_added'
  | 'contact.health_score_changed'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'form.submitted'
  | 'conversation.message_received'
  | 'conversation.message_sent'
  | 'appointment.booked'
  | 'appointment.cancelled'
  | 'appointment.completed'
  | 'review.received'
  | 'campaign.sent'
  | 'campaign.opened'
  | 'campaign.clicked'
  | 'agent.call_started'
  | 'agent.call_ended'
  | 'payment.received'
  | 'payment.failed'
  | 'sequence.enrolled'
  | 'sequence.completed'
  | 'task.created'
  | 'task.completed';

/**
 * emitTrigger — fire-and-forget internal event publisher.
 *
 * Fires a webhook from Stone AIO → Activepieces CE whenever a platform
 * event occurs. This function NEVER throws — a trigger failure must never
 * block or fail the originating request.
 *
 * @param workspaceId  The workspace that generated the event
 * @param event        The StoneAIOEvent type string
 * @param payload      Arbitrary event-specific data
 */
export async function emitTrigger(
  workspaceId: string,
  event: StoneAIOEvent,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const projectId = await ensureAPProject(workspaceId);

    const webhookUrl = `${env.ACTIVEPIECES_URL}/v1/webhooks/${projectId}/${event}`;

    const body = {
      event,
      workspaceId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Dev-mode console tracing
    if (env.NODE_ENV !== 'production') {
      console.log(`[TRIGGER] ${event} ${workspaceId} -> Project ${projectId}`);
    }

    // Fire-and-forget: kick off the request without awaiting, so the caller
    // is never delayed or failed by a trigger emission.
    axios
      .post(webhookUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          'x-stone-aio-secret': env.ACTIVEPIECES_WEBHOOK_SECRET,
        },
        // Short timeout so a dead Activepieces instance never causes a
        // dangling background request that holds resources.
        timeout: 5000,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[TRIGGER ERROR] ${event} ${workspaceId} — ${message}`);
      });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[TRIGGER ERROR] Config failure ${event} ${workspaceId} — ${message}`);
  }
}
