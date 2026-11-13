/**
 * Tier 2 fix 14 — workflow triggers that can never fire.
 *
 * 'Form Submitted' (form.submitted) and 'Review Received' (review.received)
 * were offered in the CRM Event trigger picker, but neither can ever fire:
 * there is no form surface in the product (no Form model, no form route, no
 * submission endpoint) and no review source exists (Tier 1 #7: no reputation
 * backend at all). Both are removed from the picker. The same Form Submitted
 * option was also removed from the email-automation trigger select and the
 * frontend node library (trigger-form node definition).
 *
 * The StoneAIOEvent union in trigger-emitter.service.ts intentionally keeps
 * both event names: re-adding either trigger is a one-line change once its
 * source exists. These tests assert the user-facing pickers, not the union.
 */
process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import workflowsRouter from '../routes/workflows.routes.js';
import { triggerCrmEvent } from '../services/workflow-engine/nodes/trigger-crm-event.js';
import { registerAllNodes } from '../services/workflow-engine/nodes/index.js';
import { errorHandler } from '../middleware/error.js';

// The node registry is populated by registerAllNodes() at server startup
// (server.ts) — without it the catalog is empty even in production.
registerAllNodes();

vi.mock('../../infrastructure/database/client.js', () => ({ db: {} }));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).workspaceId = 'ws-test';
    (req as any).userId = 'user-test';
    next();
  });
  app.use('/api/workflows', workflowsRouter);
  app.use(errorHandler);
  return app;
}

function eventTypeOptions(node: any): string[] {
  const field = (node.configSchema || []).find((f: any) => f.key === 'eventType');
  return (field?.options || []).map((o: any) => o.value);
}

describe('Tier 2 fix 14 — unfireable workflow triggers', () => {
  it('the CRM Event node no longer offers form.submitted or review.received', () => {
    const values = eventTypeOptions(triggerCrmEvent);
    expect(values).not.toContain('form.submitted');
    expect(values).not.toContain('review.received');
    // The real triggers are still there.
    expect(values).toContain('contact.created');
    expect(values).toContain('contact.updated');
    expect(values).toContain('deal.won');
    expect(values).toContain('deal.stage_changed');
    expect(values).toContain('appointment.booked');
  });

  it('the node catalog the builder uses offers no form trigger and no review trigger', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/workflows/nodes/catalog');
    expect(res.status).toBe(200);

    // The catalog returns [{ category, nodes: [...] }, ...].
    const allNodes: any[] = (res.body as any[]).flatMap((g) => g.nodes);
    expect(allNodes.some((n) => n.type === 'trigger-form')).toBe(false);
    expect(allNodes.some((n) => n.displayName === 'Form Submitted')).toBe(false);

    const crmEvent = allNodes.find((n) => n.type === 'trigger.crm_event');
    expect(crmEvent).toBeDefined();
    const values = eventTypeOptions(crmEvent);
    expect(values).not.toContain('form.submitted');
    expect(values).not.toContain('review.received');
    expect(values).toContain('contact.created');
    expect(values).toContain('appointment.booked');
  });
});
