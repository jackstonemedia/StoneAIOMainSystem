/**
 * Phase 4 eval harness — unit tests for the SHIPPING-assistant runner.
 * Covers the named-event SSE parser, the old→new tool-name map, the
 * scorer's proposal-text and mapping behavior, and the send-safety
 * snapshot diff. No live LLM: all of these run against canned input
 * and a fake db.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseAssistantSse,
  snapshotAssistantSends,
  sendsExecutedBetween,
} from '../services/agent-evals/runner-assistant.js';
import { scoreCase } from '../services/agent-evals/scorer.js';
import { mapToolName, UNMAPPABLE_TOOLS } from '../services/agent-evals/tool-map.js';
import type { EvalCase, CaseRunResult } from '../services/agent-evals/types.js';

const { fakeDb } = vi.hoisted(() => ({
  fakeDb: {
    assistantToolCall: { findMany: vi.fn() },
    conversation: { findMany: vi.fn() },
    conversationMessage: { findMany: vi.fn() },
  },
}));

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));

function baseRun(over: Partial<Omit<CaseRunResult, 'checks' | 'status'>> = {}) {
  return {
    caseId: 't1',
    category: 'qa' as const,
    title: 'test',
    response: '',
    queuedTools: [],
    executedMarkers: [],
    latencyMs: 10,
    estimatedInputTokens: 100,
    estimatedOutputTokens: 50,
    sendsExecuted: false,
    ...over,
  };
}

function baseCase(over: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 't1',
    category: 'qa',
    title: 'test',
    turns: ['hello'],
    origin: 'azareth-starter',
    ...over,
  };
}

describe('parseAssistantSse', () => {
  it('assembles delta text, queues proposals, records tool starts and real tokens', () => {
    const body = [
      'event: message_start',
      'data: {"userMessageId":"u1"}',
      '',
      'event: delta',
      'data: {"text":"Hi Alex "}',
      '',
      'event: delta',
      'data: {"text":"Rivera."}',
      '',
      'event: tool_start',
      'data: {"toolCallId":"tc1","toolName":"search_contacts","args":{}}',
      '',
      'event: proposal',
      'data: {"toolCallId":"tc2","toolName":"draft_email","args":{"subject":"Hello"},"reason":"Draft proposal"}',
      '',
      'event: done',
      'data: {"assistantMessageId":"m1","inputTokens":4700,"outputTokens":120}',
      '',
    ].join('\n');
    const parsed = parseAssistantSse(body);
    expect(parsed.text).toBe('Hi Alex Rivera.');
    expect(parsed.queuedTools).toEqual(['draft_email']);
    expect(parsed.executedTools).toEqual(['search_contacts']);
    expect(parsed.proposalText).toContain('Hello');
    expect(parsed.inputTokens).toBe(4700);
    expect(parsed.outputTokens).toBe(120);
    expect(parsed.error).toBeNull();
  });

  it('ignores heartbeats, thought summaries and non-JSON lines', () => {
    const body = ': ping\n\nevent: thought_summary\ndata: {"text":"thinking"}\n\nevent: delta\ndata: not-json\n\nevent: delta\ndata: {"text":"ok"}\n\n';
    const parsed = parseAssistantSse(body);
    expect(parsed.text).toBe('ok');
    expect(parsed.error).toBeNull();
  });

  it('canonicalizes a credits-depleted error so it scores as infra, not llm', () => {
    const body =
      'event: error\ndata: {"code":"credits_depleted","message":"Google AI Studio: Your prepayment credits are depleted ($0.00 balance). Please refill or create a new free API key.","retryable":false}\n\n';
    const parsed = parseAssistantSse(body);
    expect(parsed.error).toBe('Gemini prepayment credits depleted (402)');
    expect(parsed.error).not.toContain('API key');
  });

  it('passes other stream errors through with their message', () => {
    const body = 'event: error\ndata: {"code":"provider_error","message":"boom","retryable":true}\n\n';
    expect(parseAssistantSse(body).error).toBe('boom');
  });

  it('empty body parses to empty everything', () => {
    const parsed = parseAssistantSse('');
    expect(parsed.text).toBe('');
    expect(parsed.queuedTools).toEqual([]);
    expect(parsed.error).toBeNull();
  });
});

describe('tool map', () => {
  it('renames create_appointment to book_appointment', () => {
    expect(mapToolName('create_appointment')).toBe('book_appointment');
  });

  it('leaves unchanged names alone', () => {
    expect(mapToolName('send_email')).toBe('send_email');
    expect(mapToolName('create_task')).toBe('create_task');
  });

  it('names the unmappable tools and why', () => {
    expect(UNMAPPABLE_TOOLS.update_deal).toContain('no update_deal tool');
    expect(UNMAPPABLE_TOOLS.send_campaign).toContain('no send_campaign tool');
  });
});

describe('scoreCase with the assistant runner', () => {
  it('passes mustContain when the text is only in the queued proposal args', () => {
    const run = baseRun({
      response: 'Here is a draft for your review.',
      proposalText: JSON.stringify([{ subject: 'Hello', body: 'Hi Alex Rivera, welcome!' }]),
    });
    const { checks, status } = scoreCase(
      baseCase({ expect: { mustContain: ['Alex Rivera'] } }),
      run,
    );
    expect(status).toBe('pass');
    expect(checks[1].detail).toContain('matched in queued proposal args');
  });

  it('fails mustContain when the text is in neither the reply nor the proposal', () => {
    const run = baseRun({ response: 'Here is a draft.', proposalText: JSON.stringify([{ body: 'Hi Dana,' }]) });
    const { status } = scoreCase(baseCase({ expect: { mustContain: ['Alex Rivera'] } }), run);
    expect(status).toBe('fail');
  });

  it('fails mustNotContain when the trap name is in the proposal args', () => {
    const run = baseRun({
      response: 'Draft ready.',
      proposalText: JSON.stringify([{ body: 'Hi Alex Ramirez,' }]),
    });
    const { status } = scoreCase(
      baseCase({ expect: { mustNotContain: ['Alex Ramirez'] } }),
      run,
    );
    expect(status).toBe('fail');
  });

  it('maps an old expected tool name to the new one', () => {
    const run = baseRun({ queuedTools: ['book_appointment'] });
    const { status } = scoreCase(
      baseCase({ expect: { queuedTools: ['create_appointment'] } }),
      run,
    );
    expect(status).toBe('pass');
  });

  it('fails an unmappable expected tool and names the gap', () => {
    const run = baseRun({ queuedTools: [] });
    const { checks, status } = scoreCase(
      baseCase({ expect: { queuedTools: ['update_deal'] } }),
      run,
    );
    expect(status).toBe('fail');
    expect(checks.find((c) => c.name.includes('update_deal'))?.detail).toContain('no update_deal tool');
  });
});

describe('send-safety snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeDb.assistantToolCall.findMany.mockResolvedValue([{ id: 'tc1' }]);
    fakeDb.conversation.findMany.mockResolvedValue([{ id: 'cv1' }]);
    fakeDb.conversationMessage.findMany.mockResolvedValue([{ id: 'cm1' }]);
  });

  it('snapshots send tool calls and sent messages in the eval workspace', async () => {
    const snap = await snapshotAssistantSends();
    expect(snap.sentToolCallIds).toEqual(new Set(['tc1']));
    expect(snap.sentMessageIds).toEqual(new Set(['cm1']));
    expect(fakeDb.assistantToolCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ risk: 'send', status: 'done' }),
      }),
    );
  });

  it('detects a new send between snapshots and ignores unchanged state', () => {
    const before = { sentToolCallIds: new Set(['tc1']), sentMessageIds: new Set(['cm1']) };
    expect(
      sendsExecutedBetween(before, {
        sentToolCallIds: new Set(['tc1', 'tc2']),
        sentMessageIds: new Set(['cm1']),
      }),
    ).toBe(true);
    expect(
      sendsExecutedBetween(before, {
        sentToolCallIds: new Set(['tc1']),
        sentMessageIds: new Set(['cm1', 'cm2']),
      }),
    ).toBe(true);
    expect(sendsExecutedBetween(before, { ...before })).toBe(false);
  });
});
