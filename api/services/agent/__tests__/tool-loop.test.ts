// Multi-round tool loop — regression tests for baseline failure class #1
// (run-20261103-042619: 62 empty turns from the old single-round follow-up).
// These pin the loop mechanics with fake rounds: no DB, no key, no API.
import { describe, it, expect, vi } from 'vitest';
import { driveToolLoop } from '../tool-loop.js';

interface FakeRound {
  text?: string;
  calls?: Array<{ name: string; args?: Record<string, unknown> }>;
}

function setup(rounds: FakeRound[]) {
  const queue = [...rounds];
  const emitted: string[] = [];
  const handled: string[] = [];
  const contents: any[] = [{ role: 'user', parts: [{ text: 'hi' }] }];
  const generate = async (_c: any[], emit: (t: string) => void) => {
    const round = queue.shift() ?? {};
    if (round.text) emit(round.text);
    return round.calls ?? [];
  };
  const handleCall = async (call: any) => {
    handled.push(call.name);
    return { name: call.name, result: { ok: true } };
  };
  return { contents, emitted, handled, generate, handleCall };
}

describe('driveToolLoop', () => {
  it('stops after a text-only round', async () => {
    const s = setup([{ text: 'hello' }]);
    const out = await driveToolLoop({
      contents: s.contents,
      maxRounds: 5,
      generate: s.generate,
      handleCall: s.handleCall,
      emit: (t) => s.emitted.push(t),
      onEmpty: () => 'FALLBACK',
    });
    expect(out).toEqual({ rounds: 1, textEmitted: true });
    expect(s.emitted).toEqual(['hello']);
    expect(s.handled).toEqual([]);
    expect(s.contents).toHaveLength(1);
  });

  it('continues past a calls-only round to the text round (second hop)', async () => {
    const s = setup([
      { calls: [{ name: 'search_contacts', args: { query: 'Alex' } }] },
      { text: 'Found Alex Rivera.' },
    ]);
    const out = await driveToolLoop({
      contents: s.contents,
      maxRounds: 5,
      generate: s.generate,
      handleCall: s.handleCall,
      emit: (t) => s.emitted.push(t),
      onEmpty: () => 'FALLBACK',
    });
    expect(out).toEqual({ rounds: 2, textEmitted: true });
    expect(s.handled).toEqual(['search_contacts']);
    expect(s.emitted).toEqual(['Found Alex Rivera.']);
    // Model functionCall parts + user functionResponse parts appended.
    expect(s.contents).toHaveLength(3);
    expect(s.contents[1]).toEqual({
      role: 'model',
      parts: [{ functionCall: { name: 'search_contacts', args: { query: 'Alex' } } }],
    });
    expect(s.contents[2].parts[0].functionResponse.name).toBe('search_contacts');
  });

  it('keeps going when a round has both text and calls', async () => {
    const s = setup([
      { text: 'Looking that up. ', calls: [{ name: 'list_deals' }] },
      { text: 'Done.' },
    ]);
    const out = await driveToolLoop({
      contents: s.contents,
      maxRounds: 5,
      generate: s.generate,
      handleCall: s.handleCall,
      emit: (t) => s.emitted.push(t),
      onEmpty: () => 'FALLBACK',
    });
    expect(out.rounds).toBe(2);
    expect(out.textEmitted).toBe(true);
    expect(s.emitted).toEqual(['Looking that up. ', 'Done.']);
    expect(s.handled).toEqual(['list_deals']);
  });

  it('caps rounds and emits the fallback instead of ending empty', async () => {
    const s = setup([
      { calls: [{ name: 'search_contacts' }] },
      { calls: [{ name: 'list_deals' }] },
      { calls: [{ name: 'search_contacts' }] },
    ]);
    const onEmpty = vi.fn(() => 'FALLBACK SUMMARY');
    const out = await driveToolLoop({
      contents: s.contents,
      maxRounds: 2,
      generate: s.generate,
      handleCall: s.handleCall,
      emit: (t) => s.emitted.push(t),
      onEmpty,
    });
    expect(out).toEqual({ rounds: 2, textEmitted: true });
    expect(s.handled).toEqual(['search_contacts', 'list_deals']);
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(s.emitted).toEqual(['FALLBACK SUMMARY']);
  });

  it('dedupes identical calls within one round and skips nameless calls', async () => {
    const s = setup([
      {
        calls: [
          { name: 'search_contacts', args: { query: 'Alex' } },
          { name: 'search_contacts', args: { query: 'Alex' } },
          { name: '', args: {} } as any,
        ],
      },
      { text: 'ok' },
    ]);
    await driveToolLoop({
      contents: s.contents,
      maxRounds: 5,
      generate: s.generate,
      handleCall: s.handleCall,
      emit: (t) => s.emitted.push(t),
      onEmpty: () => 'FALLBACK',
    });
    expect(s.handled).toEqual(['search_contacts']);
  });
});
