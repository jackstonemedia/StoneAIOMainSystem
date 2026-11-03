// Multi-round tool loop (2026-11-03, failure class #1 from the scored baseline
// run-20261103-042619: 62 of 142 cases came back empty).
//
// Root cause: the agent service did exactly ONE tool round. After the first
// tool pass, the follow-up stream was read for text only — so when the model
// answered the tool results with ANOTHER function call (a second hop), every
// chunk had no text and the turn ended empty, with no proposal and no reply.
//
// This loop drives follow-up rounds until a round yields text and no calls,
// or the round cap is hit. It never drops a round's calls: calls from the
// final round are still handled (queued/executed) before the loop exits.
// And a turn NEVER ends textless: if no round emitted text, the caller's
// onEmpty summary is emitted, so the worst case is an honest summary,
// not a silent turn.
//
// The loop owns only round mechanics: generating a round, handling calls,
// and appending model/functionResponse contents. What a call DOES — the
// mode-gate matrix, queueing, execution, audit — lives in the caller's
// handleCall, unchanged from the single-round path.

export interface ToolCallLike {
  name?: string;
  args?: Record<string, unknown>;
}

export interface ToolResultLike {
  name: string;
  result?: unknown;
  error?: string;
}

export interface ToolLoopOutcome {
  rounds: number;
  textEmitted: boolean;
}

export async function driveToolLoop(opts: {
  contents: any[];
  maxRounds: number;
  /** Streams one round, emitting its text live; returns that round's calls. */
  generate: (contents: any[], emit: (text: string) => void) => Promise<ToolCallLike[]>;
  /** Runs one call through the caller's gate/execute/queue path. */
  handleCall: (call: ToolCallLike) => Promise<ToolResultLike>;
  emit: (text: string) => void;
  /** Honest summary text for the never-empty guarantee. */
  onEmpty: () => string;
}): Promise<ToolLoopOutcome> {
  let rounds = 0;
  let textEmitted = false;
  const emitTracked = (t: string) => {
    if (t) textEmitted = true;
    opts.emit(t);
  };

  while (rounds < opts.maxRounds) {
    const rawCalls = await opts.generate(opts.contents, emitTracked);
    rounds++;
    // Nameless calls are skipped (as in the first pass); identical calls
    // within one round are deduped so a repeated chunk can't double-run.
    const seen = new Set<string>();
    const calls = rawCalls.filter((c) => {
      if (!c?.name) return false;
      const key = JSON.stringify({ name: c.name, args: c.args ?? {} });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (calls.length === 0) break;
    const results: ToolResultLike[] = [];
    for (const call of calls) {
      results.push(await opts.handleCall(call));
    }
    opts.contents.push({
      role: 'model',
      parts: calls.map((call) => ({ functionCall: call })),
    });
    opts.contents.push({
      role: 'user',
      parts: results.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: { output: tr.result || tr.error },
        },
      })),
    });
  }

  if (!textEmitted) emitTracked(opts.onEmpty());
  return { rounds, textEmitted };
}
