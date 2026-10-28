// Phase 4 tools — unit tests (registry, gates, pure helpers, old-route
// approval set). No db, no key.
import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  decideGate,
  isGrantable,
  whitelistDealUpdate,
  validateAppointmentTimes,
} from '../tools.js';
import { APPROVAL_REQUIRED_TOOLS } from '../../../routes/ai-executor.js';

describe('Phase 4 registry', () => {
  it('has 27 tools: 16 reads, 7 writes, 4 sends', () => {
    const defs = Object.values(TOOL_REGISTRY);
    expect(defs).toHaveLength(27);
    expect(defs.filter((d) => d.kind === 'read')).toHaveLength(16);
    expect(defs.filter((d) => d.kind === 'write')).toHaveLength(7);
    expect(defs.filter((d) => d.kind === 'send')).toHaveLength(4);
  });

  it('classifies the new tools correctly', () => {
    const reads = ['list_inbox_conversations', 'get_inbox_messages', 'list_conversations', 'get_conversation_messages', 'draft_inbox_reply', 'get_campaign_details', 'list_appointments', 'list_pipelines', 'get_workspace_info', 'get_pipeline_summary'];
    for (const t of reads) expect(TOOL_REGISTRY[t]?.kind).toBe('read');
    expect(TOOL_REGISTRY.update_deal?.kind).toBe('write');
    expect(TOOL_REGISTRY.create_appointment?.kind).toBe('write');
    expect(TOOL_REGISTRY.send_campaign?.kind).toBe('send');
  });
});

describe('Phase 4 gates', () => {
  it('new reads execute in every mode, including read-only', () => {
    for (const mode of ['approve', 'autonomy', 'read-only'] as const) {
      expect(decideGate(mode, 'list_inbox_conversations', new Set())).toBe('execute');
      expect(decideGate(mode, 'draft_inbox_reply', new Set())).toBe('execute');
      expect(decideGate(mode, 'get_pipeline_summary', new Set())).toBe('execute');
    }
  });

  it('new writes queue in approve/read-only, execute only granted in autonomy', () => {
    expect(decideGate('approve', 'update_deal', new Set(['update_deal']))).toBe('queue');
    expect(decideGate('read-only', 'create_appointment', new Set(['create_appointment']))).toBe('queue');
    expect(decideGate('autonomy', 'update_deal', new Set())).toBe('queue');
    expect(decideGate('autonomy', 'update_deal', new Set(['update_deal']))).toBe('execute');
    expect(decideGate('autonomy', 'create_appointment', new Set(['create_appointment']))).toBe('execute');
  });

  it('send_campaign queues even when "granted" and is never grantable', () => {
    expect(decideGate('autonomy', 'send_campaign', new Set(['send_campaign']))).toBe('queue');
    expect(isGrantable('send_campaign')).toBe(false);
    expect(isGrantable('update_deal')).toBe(true);
    expect(isGrantable('create_appointment')).toBe(true);
  });
});

describe('update_deal whitelist', () => {
  it('keeps allowed fields and drops everything else', () => {
    expect(whitelistDealUpdate({
      title: 'New title', amount: 15000, workspaceId: 'ws_other',
      ownerId: 'evil', pipelineStageId: 'st_1', closeDate: '2026-12-01',
    })).toEqual({
      title: 'New title', amount: 15000, pipelineStageId: 'st_1', closeDate: '2026-12-01',
    });
  });

  it('returns empty when nothing allowed is given', () => {
    expect(whitelistDealUpdate({ workspaceId: 'ws_other' })).toEqual({});
  });
});

describe('appointment time validation', () => {
  it('parses valid ISO times', () => {
    const r = validateAppointmentTimes('2026-11-10T15:00:00.000Z', '2026-11-10T16:00:00.000Z');
    expect('error' in r).toBe(false);
  });

  it('rejects missing or unparseable times before any write', () => {
    expect(validateAppointmentTimes(undefined, '2026-11-10T16:00:00.000Z')).toEqual(
      { error: 'create_appointment needs valid startTime and endTime' },
    );
    expect(validateAppointmentTimes('not a date', '2026-11-10T16:00:00.000Z')).toEqual(
      { error: 'create_appointment needs valid startTime and endTime' },
    );
  });
});

describe('old-route approval set (Phase 4 safety)', () => {
  it('contains every new write/send tool', () => {
    for (const t of ['update_deal', 'create_appointment', 'send_campaign']) {
      expect(APPROVAL_REQUIRED_TOOLS.has(t)).toBe(true);
    }
  });

  it('still contains the original seven', () => {
    for (const t of ['create_contact', 'update_contact', 'create_deal', 'create_task', 'send_email', 'send_sms', 'create_campaign']) {
      expect(APPROVAL_REQUIRED_TOOLS.has(t)).toBe(true);
    }
  });
});
