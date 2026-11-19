import { db } from '../../infrastructure/database/client.js';
// Static (not lazy) import: the runner only statically imports db +
// plan-guard, neither of which imports this module, so there is no cycle —
// and a static import makes concurrent dispatches share one module
// instance. (A per-call dynamic import stalled the SECOND concurrent
// dispatch in the test runner: vite-node never settled the duplicate
// import. Real Node shares the load, but the static form is also faster.)
import { evaluateAutomationTrigger } from './email-marketing/automation-runner.service.js';

// ── All internal Stone AIO event types ────────────────────────────────────────
export type StoneAIOEvent =
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contact.tag_added'
  | 'contact.tag_removed'
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
  | 'subscription.activated'
  | 'subscription.canceled'
  | 'trial.ending'
  | 'sequence.enrolled'
  | 'sequence.completed'
  | 'task.created'
  | 'task.completed';

/**
 * emitTrigger — fire-and-forget internal event publisher.
 *
 * Fires events to BOTH consumers:
 *  - the native workflow engine (CrmTriggerSubscription → queueService)
 *  - the email Automation runner (evaluateAutomationTrigger — Slice 1c)
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

  // ── Dispatch to Email Automations (Slice 1c) ───────────────────────────────
  dispatchToAutomations(workspaceId, event, payload).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[TRIGGER ERROR AUTOMATIONS] ${event} ${workspaceId} — ${message}`);
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

  const eligible = subscriptions.filter(sub => {
    if (sub.workflow?.status !== 'published') return false;
    if (sub.workflow?.engineType !== 'native') return false;

    let filtersJson: Record<string, unknown> = {};
    try { filtersJson = sub.filtersJson ? JSON.parse(sub.filtersJson) : {}; } catch { /* ignore */ }

    if (filtersJson.pipelineId && payload.pipelineId !== filtersJson.pipelineId) return false;
    if (filtersJson.stageId && payload.stageId !== filtersJson.stageId) return false;
    if (filtersJson.tagName && !String(payload.tags || '').includes(String(filtersJson.tagName))) return false;

    return true;
  });

  if (process.env.NODE_ENV !== 'production' && eligible.length) {
    console.log(`[NATIVE TRIGGER] ${event} → ${eligible.length} workflow(s)`);
  }

  await Promise.all(
    eligible.map(sub =>
      queueService.enqueue({
        workspaceId,
        workflowId: sub.workflowId,
        triggerData: { event, entityType, eventType, data: payload },
        mode: 'production',
      })
    )
  );
}

/**
 * Normalize a StoneAIOEvent into an AutomationTriggerEvent and hand it to
 * the email Automation runner (Slice 1c). Unmapped events are ignored —
 * the runner only cares about the 8 event→trigger mappings in
 * EVENT_TO_TRIGGER.
 *
 * Normalization notes (the emit sites do NOT all share one payload shape):
 *  - contact.created / contact.updated carry `contactId` directly (service
 *    emits); the runner also resolves contactId from payload.contact.id /
 *    payload.deal.contactId as a fallback.
 *  - deal.stage_changed (service emit) carries `newStageId` + `contactId`;
 *    the route's old `{ deal, newStage }` shape was a second, duplicate
 *    emit and was removed in Slice 1c — only the service shape is mapped.
 *  - contact.updated carries `changedCustomFields` (custom field NAMES that
 *    changed — computed by updateContact from a before/after diff); the
 *    runner matches CUSTOM_FIELD_CHANGED against that list.
 *  - form.submitted carries `contactId` + `pageId` (landing page id; the
 *    raw capture webhook has no page, so pageId is absent and matches
 *    "any page" configs).
 */
async function dispatchToAutomations(
  workspaceId: string,
  event: StoneAIOEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const p = payload as Record<string, unknown>;
  const contactId =
    typeof p.contactId === 'string' ? (p.contactId as string) : undefined;
  const base = { payload: p };

  switch (event) {
    case 'contact.created':
      return evaluateAutomationTrigger(workspaceId, { type: event, contactId, ...base });
    case 'contact.tag_added':
    case 'contact.tag_removed':
      return evaluateAutomationTrigger(workspaceId, {
        type: event,
        contactId,
        tag: typeof p.tag === 'string' ? (p.tag as string) : undefined,
        ...base,
      });
    case 'form.submitted':
      return evaluateAutomationTrigger(workspaceId, {
        type: event,
        contactId,
        pageId: typeof p.pageId === 'string' ? (p.pageId as string) : undefined,
        ...base,
      });
    case 'deal.stage_changed':
      return evaluateAutomationTrigger(workspaceId, {
        type: event,
        contactId,
        stageId:
          typeof p.newStageId === 'string'
            ? (p.newStageId as string)
            : typeof p.newStage === 'string'
              ? (p.newStage as string)
              : undefined,
        ...base,
      });
    case 'contact.updated':
      return evaluateAutomationTrigger(workspaceId, {
        type: event,
        contactId,
        changedFields: Array.isArray(p.changedCustomFields)
          ? (p.changedCustomFields as string[])
          : [],
        ...base,
      });
    case 'campaign.opened':
    case 'campaign.clicked':
      return evaluateAutomationTrigger(workspaceId, {
        type: event,
        contactId,
        campaignId: typeof p.campaignId === 'string' ? (p.campaignId as string) : undefined,
        ...base,
      });
    default:
      return;
  }
}
