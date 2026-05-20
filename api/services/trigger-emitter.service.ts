import { db } from '../../infrastructure/database/client.js';

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
 * Fires events to the native workflow engine.
 * (Activepieces integration removed — ap-workspace-sync.service no longer exists)
 *
 * This function NEVER throws — a trigger failure must never
 * block or fail the originating request.
 */
export async function emitTrigger(
  workspaceId: string,
  event: StoneAIOEvent,
  payload: Record<string, unknown>
): Promise<void> {
  // ── Dispatch to Native Workflow Engine ──────────────────────────────────────
  dispatchToNativeEngine(workspaceId, event, payload).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[TRIGGER ERROR NATIVE] ${event} ${workspaceId} — ${message}`);
  });
}

/**
 * Looks up CrmTriggerSubscription records for this workspace + event,
 * and enqueues a native workflow run for each active subscription.
 */
async function dispatchToNativeEngine(
  workspaceId: string,
  event: StoneAIOEvent,
  payload: Record<string, unknown>
): Promise<void> {
  // Derive entityType and eventType from the event string
  // e.g. 'contact.created' → entityType='contact', eventType='created'
  const [entityType, eventType] = event.split('.');
  if (!entityType || !eventType) return;

  let subscriptions: any[] = [];
  try {
    subscriptions = await (db as any).crmTriggerSubscription?.findMany({
      where: {
        workspaceId,
        entityType,
        eventType,
        active: true
      },
      include: { workflow: { select: { id: true, status: true, engineType: true } } }
    }) ?? [];
  } catch {
    // Model may not exist yet in an early migration — skip silently
    return;
  }

  if (!subscriptions.length) return;

  // Lazy-import queue service to avoid circular dependency at module load time
  const { queueService } = await import('./workflow-engine/queue.service.js');

  for (const sub of subscriptions) {
    // Only fire for published native workflows
    if (sub.workflow?.status !== 'published') continue;
    if (sub.workflow?.engineType !== 'native') continue;

    // Apply optional filters stored in filtersJson
    let filtersJson: Record<string, unknown> = {};
    try {
      filtersJson = sub.filtersJson ? JSON.parse(sub.filtersJson) : {};
    } catch { /* ignore */ }

    // Simple filter check: pipelineId / stageId / tagName, etc.
    if (filtersJson.pipelineId && payload.pipelineId !== filtersJson.pipelineId) continue;
    if (filtersJson.stageId && payload.stageId !== filtersJson.stageId) continue;
    if (filtersJson.tagName && !String(payload.tags || '').includes(String(filtersJson.tagName))) continue;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[NATIVE TRIGGER] ${event} → workflow ${sub.workflowId}`);
    }

    await queueService.enqueue({
      workspaceId,
      workflowId: sub.workflowId,
      triggerData: { event, entityType, eventType, data: payload },
      mode: 'production'
    });
  }
}
