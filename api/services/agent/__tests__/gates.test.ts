// Phase 2 gate logic — unit tests (pure functions + stubbed db).
// No API, no key, no real database needed.
import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  decideGate,
  isGrantable,
  verifyWriteReferences,
  type AgentMode,
} from '../tools.js';
import { parseModeSwitch } from '../modes.js';

describe('TOOL_REGISTRY', () => {
  it('covers all 27 tools with the right kinds (14 Phase 2 + 13 Phase 4)', () => {
    const names = Object.keys(TOOL_REGISTRY).sort();
    expect(names).toEqual(
      [
        'add_contact_note',
        'create_appointment',
        'create_campaign',
        'create_contact',
        'create_deal',
        'create_task',
        'draft_inbox_reply',
        'get_campaign_details',
        'get_contact_details',
        'get_conversation_messages',
        'get_crm_dashboard',
        'get_inbox_messages',
        'get_pipeline_summary',
        'get_workspace_info',
        'list_appointments',
        'list_campaigns',
        'list_conversations',
        'list_deals',
        'list_inbox_conversations',
        'list_pipelines',
        'list_tasks',
        'search_contacts',
        'send_campaign',
        'send_email',
        'send_sms',
        'update_contact',
        'update_deal',
      ].sort(),
    );
    const kinds = Object.values(TOOL_REGISTRY).reduce<Record<string, number>>((acc, t) => {
      acc[t.kind] = (acc[t.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(kinds).toEqual({ read: 16, write: 7, send: 4 });
  });

  it('only write tools are grantable', () => {
    expect(isGrantable('create_task')).toBe(true);
    expect(isGrantable('add_contact_note')).toBe(true);
    expect(isGrantable('send_email')).toBe(false);
    expect(isGrantable('send_sms')).toBe(false);
    expect(isGrantable('create_campaign')).toBe(false);
    expect(isGrantable('search_contacts')).toBe(false);
  });
});

describe('decideGate', () => {
  const modes: AgentMode[] = ['approve', 'autonomy', 'read-only'];
  it('reads always execute', () => {
    for (const mode of modes) {
      expect(decideGate(mode, 'search_contacts', new Set())).toBe('execute');
      expect(decideGate(mode, 'list_deals', new Set())).toBe('execute');
    }
  });

  it('sends always queue, even when granted', () => {
    for (const mode of modes) {
      expect(decideGate(mode, 'send_email', new Set(['send_email']))).toBe('queue');
      expect(decideGate(mode, 'send_sms', new Set())).toBe('queue');
      expect(decideGate(mode, 'create_campaign', new Set(['create_campaign']))).toBe('queue');
    }
  });

  it('writes queue in approve and read-only, execute only when granted in autonomy', () => {
    expect(decideGate('approve', 'create_task', new Set(['create_task']))).toBe('queue');
    expect(decideGate('read-only', 'create_task', new Set(['create_task']))).toBe('queue');
    expect(decideGate('autonomy', 'create_task', new Set(['create_task']))).toBe('execute');
    expect(decideGate('autonomy', 'create_task', new Set())).toBe('queue');
    expect(decideGate('autonomy', 'update_contact', new Set(['create_task']))).toBe('queue');
  });

  it('unknown tools are rejected, never executed', () => {
    for (const mode of modes) {
      expect(decideGate(mode, 'delete_everything', new Set())).toBe('reject');
    }
  });
});

describe('parseModeSwitch', () => {
  it('matches the three mode commands', () => {
    expect(parseModeSwitch('switch to read-only')).toBe('read-only');
    expect(parseModeSwitch('Switch to readonly.')).toBe('read-only');
    expect(parseModeSwitch('switch to autonomy')).toBe('autonomy');
    expect(parseModeSwitch('switch to autonomous!')).toBe('autonomy');
    expect(parseModeSwitch('switch to approve')).toBe('approve');
    expect(parseModeSwitch('switch to approval mode')).toBe('approve');
  });

  it('does not fire on ordinary messages', () => {
    expect(parseModeSwitch('please switch to read-only')).toBeNull();
    expect(parseModeSwitch('switch to read-only mode please')).toBeNull();
    expect(parseModeSwitch('should I switch to autonomy?')).toBeNull();
    expect(parseModeSwitch('')).toBeNull();
  });
});

describe('verifyWriteReferences', () => {
  const stubDb = (owned: Record<string, boolean>) =>
    ({
      contact: { findFirst: async ({ where }: any) => (owned[`contact:${where.id}`] ? { id: where.id } : null) },
      deal: { findFirst: async ({ where }: any) => (owned[`deal:${where.id}`] ? { id: where.id } : null) },
      task: { findFirst: async ({ where }: any) => (owned[`task:${where.id}`] ? { id: where.id } : null) },
    }) as any;

  it('passes when every reference belongs to the workspace', async () => {
    const db = stubDb({ 'contact:ct_1': true, 'deal:dl_1': true });
    expect(await verifyWriteReferences(db, 'ws_1', { contactId: 'ct_1', dealId: 'dl_1' })).toBeNull();
  });

  it('fails on a foreign reference', async () => {
    const db = stubDb({ 'contact:ct_1': true });
    expect(await verifyWriteReferences(db, 'ws_1', { contactId: 'ct_other' })).toMatch(/not found in this workspace/);
  });

  it('passes with no references', async () => {
    const db = stubDb({});
    expect(await verifyWriteReferences(db, 'ws_1', { title: 'hello' })).toBeNull();
  });
});
