/**
 * Thought-signature carry-forward — regression test.
 *
 * Found by the Phase 4 eval smoke run (2026-11-13): 4 of 12 starter
 * cases died with Gemini 400 "Function call is missing a
 * thought_signature". Root cause, verified live: the model re-called
 * the same tool in a later round, and the streamed chunk carrying that
 * repeat call had NO thoughtSignature anywhere (not on the part, not
 * on the functionCalls object, not on any other part in the chunk).
 * The engine yielded a signature-less call, the orchestrator echoed it
 * back as a history part, and Gemini 400d the next round.
 *
 * The fix: the stream carries the last-seen signature forward (per
 * tool, else the last seen overall) instead of yielding a
 * signature-less call. These tests pin that behavior with a mocked
 * Gemini client — no live key, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatEngine } from '../../packages/ai/engine/chat-engine.js';

const { mockGenerateContentStream } = vi.hoisted(() => ({
  mockGenerateContentStream: vi.fn(),
}));

vi.mock('../../packages/ai/client.js', () => ({
  tryGetAIClient: () => ({
    models: { generateContentStream: mockGenerateContentStream },
  }),
}));

async function* chunkStream(chunks: any[]) {
  for (const c of chunks) yield c;
}

function fnChunk(opts: {
  name: string;
  sigOnPart?: string;
  sigOnCall?: string;
  args?: Record<string, unknown>;
  id?: string;
}) {
  const part: any = {
    functionCall: { name: opts.name, args: opts.args ?? { query: 'Alex' }, id: opts.id ?? 'call_1' },
  };
  if (opts.sigOnPart) part.thoughtSignature = opts.sigOnPart;
  const call: any = { name: opts.name, args: opts.args ?? { query: 'Alex' }, id: opts.id ?? 'call_1' };
  if (opts.sigOnCall) call.thoughtSignature = opts.sigOnCall;
  return {
    text: '',
    candidates: [{ content: { parts: [part] } }],
    functionCalls: [call],
    usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 16 },
  };
}

function textChunk() {
  return {
    text: '',
    candidates: [{ content: { parts: [{ text: '' }] } }],
    functionCalls: undefined,
    usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 16 },
  };
}

async function collectEvents(engine: ChatEngine) {
  const events: any[] = [];
  for await (const e of engine.stream([{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }], {})) {
    events.push(e);
  }
  return events;
}

describe('thought-signature carry-forward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carries the signature forward to a repeat call that arrives without one', async () => {
    mockGenerateContentStream.mockResolvedValue(
      chunkStream([
        fnChunk({ name: 'search_contacts', sigOnPart: 'sig-1', id: 'call_1' }),
        fnChunk({ name: 'search_contacts', id: 'call_2' }),
        textChunk(),
      ]),
    );
    const engine = new ChatEngine();
    const events = await collectEvents(engine);
    const calls = events.filter((e) => e.type === 'function_call');
    expect(calls).toHaveLength(2);
    expect(calls[0].thoughtSignature).toBe('sig-1');
    // The repeat call arrived with no signature anywhere — it inherits
    // the first call's signature instead of going out signature-less.
    expect(calls[1].thoughtSignature).toBe('sig-1');
    const done = events.find((e) => e.type === 'done');
    expect(done.functionCalls.map((c: any) => c.thoughtSignature)).toEqual(['sig-1', 'sig-1']);
  });

  it('falls back to the last-seen signature for a different tool', async () => {
    mockGenerateContentStream.mockResolvedValue(
      chunkStream([
        fnChunk({ name: 'search_contacts', sigOnPart: 'sig-1', id: 'call_1' }),
        fnChunk({ name: 'list_tasks', id: 'call_2' }),
        textChunk(),
      ]),
    );
    const engine = new ChatEngine();
    const events = await collectEvents(engine);
    const calls = events.filter((e) => e.type === 'function_call');
    expect(calls).toHaveLength(2);
    expect(calls[1].name).toBe('list_tasks');
    expect(calls[1].thoughtSignature).toBe('sig-1');
  });

  it('yields no signature when none was ever seen (nothing to invent)', async () => {
    mockGenerateContentStream.mockResolvedValue(
      chunkStream([fnChunk({ name: 'search_contacts', id: 'call_1' }), textChunk()]),
    );
    const engine = new ChatEngine();
    const events = await collectEvents(engine);
    const calls = events.filter((e) => e.type === 'function_call');
    expect(calls).toHaveLength(1);
    expect(calls[0].thoughtSignature).toBeUndefined();
  });

  it('formatContents keeps a signature on the echoed-back part', () => {
    const engine = new ChatEngine();
    const out = (engine as any).formatContents([
      {
        role: 'assistant',
        parts: [
          {
            type: 'function_call',
            name: 'search_contacts',
            args: { query: 'Alex' },
            thoughtSignature: 'sig-1',
          },
        ],
      },
    ]);
    const part = out[0].parts[0];
    expect(part.thoughtSignature).toBe('sig-1');
    expect(part.functionCall.name).toBe('search_contacts');
  });
});
