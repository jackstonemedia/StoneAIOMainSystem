import { describe, it, expect, vi, beforeEach } from 'vitest';

// Slice 1c: emitTrigger must fan out to the email Automation runner with a
// normalized event — and never throw, whatever the consumers do.

const runnerCtl = vi.hoisted(() => ({
  evaluate: vi.fn(async () => undefined),
  failNext: false,
}));
vi.mock('../services/email-marketing/automation-runner.service.js', () => ({
  evaluateAutomationTrigger: vi.fn(async (...args: any[]) => {
    if (runnerCtl.failNext) {
      runnerCtl.failNext = false;
      throw new Error('runner down');
    }
    return runnerCtl.evaluate(...args);
  }),
}));

vi.mock('../services/workflow-engine/queue.service.js', () => ({
  queueService: { enqueue: vi.fn(async () => undefined) },
}));

// The native dispatch finds no subscriptions here (no delegate at all —
// the emitter's optional chaining treats that as "no subscriptions").
vi.mock('../../infrastructure/database/client.js', () => ({ db: {} }));

import { emitTrigger } from '../services/trigger-emitter.service';

const flush = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('trigger emitter → automations (complete-platform item 1, Slice 1c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runnerCtl.failNext = false;
  });

  it('maps contact.created with the contact id', async () => {
    await emitTrigger('ws1', 'contact.created', {
      contactId: 'ct1',
      name: 'Alice',
      tags: ['a'],
    });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(1);
    const [ws, event] = runnerCtl.evaluate.mock.calls[0];
    expect(ws).toBe('ws1');
    expect(event.type).toBe('contact.created');
    expect(event.contactId).toBe('ct1');
  });

  it('maps contact.tag_added / tag_removed with the tag', async () => {
    await emitTrigger('ws1', 'contact.tag_added', { contactId: 'ct1', tag: 'vip' });
    await emitTrigger('ws1', 'contact.tag_removed', { contactId: 'ct1', tag: 'cold' });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(2);
    expect(runnerCtl.evaluate.mock.calls[0][1]).toMatchObject({
      type: 'contact.tag_added',
      contactId: 'ct1',
      tag: 'vip',
    });
    expect(runnerCtl.evaluate.mock.calls[1][1]).toMatchObject({
      type: 'contact.tag_removed',
      contactId: 'ct1',
      tag: 'cold',
    });
  });

  it('maps deal.stage_changed newStageId → stageId with the contact id', async () => {
    await emitTrigger('ws1', 'deal.stage_changed', {
      dealId: 'dl1',
      previousStageId: 'st1',
      newStageId: 'st2',
      contactId: 'ct1',
    });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(1);
    expect(runnerCtl.evaluate.mock.calls[0][1]).toMatchObject({
      type: 'deal.stage_changed',
      contactId: 'ct1',
      stageId: 'st2',
    });
  });

  it('maps form.submitted with pageId, and without one for the raw webhook', async () => {
    await emitTrigger('ws1', 'form.submitted', { contactId: 'ct1', pageId: 'pg1' });
    await emitTrigger('ws1', 'form.submitted', { contactId: 'ct2' });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(2);
    expect(runnerCtl.evaluate.mock.calls[0][1]).toMatchObject({
      type: 'form.submitted',
      contactId: 'ct1',
      pageId: 'pg1',
    });
    expect(runnerCtl.evaluate.mock.calls[1][1].pageId).toBeUndefined();
  });

  it('maps contact.updated changedCustomFields → changedFields', async () => {
    await emitTrigger('ws1', 'contact.updated', {
      contactId: 'ct1',
      updatedFields: ['customFieldsJson'],
      changedCustomFields: ['company_size'],
    });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(1);
    expect(runnerCtl.evaluate.mock.calls[0][1]).toMatchObject({
      type: 'contact.updated',
      contactId: 'ct1',
      changedFields: ['company_size'],
    });
  });

  it('maps campaign.opened / campaign.clicked with the campaign id', async () => {
    await emitTrigger('ws1', 'campaign.opened', { contactId: 'ct1', campaignId: 'cp1' });
    await emitTrigger('ws1', 'campaign.clicked', { contactId: 'ct1', campaignId: 'cp1' });
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(2);
    expect(runnerCtl.evaluate.mock.calls[0][1]).toMatchObject({
      type: 'campaign.opened',
      campaignId: 'cp1',
    });
    expect(runnerCtl.evaluate.mock.calls[1][1]).toMatchObject({
      type: 'campaign.clicked',
      campaignId: 'cp1',
    });
  });

  it('ignores events with no automation mapping', async () => {
    await emitTrigger('ws1', 'contact.deleted', { contactId: 'ct1' });
    await emitTrigger('ws1', 'appointment.booked', { contactId: 'ct1' });
    await flush();
    expect(runnerCtl.evaluate).not.toHaveBeenCalled();
  });

  it('never throws when the runner throws', async () => {
    runnerCtl.failNext = true;
    await expect(
      emitTrigger('ws1', 'contact.created', { contactId: 'ct1' }),
    ).resolves.toBeUndefined();
    await flush();
    expect(runnerCtl.evaluate).toHaveBeenCalledTimes(0);
  });
});
