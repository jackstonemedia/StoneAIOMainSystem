// Phase 4 eval harness — runner for the SHIPPING assistant.
// Sends each case through the REAL assistant API
// (POST /api/assistant/conversations + POST /conversations/:id/messages,
// draft mode) and captures response text, queued tools, executed markers,
// latency, and REAL token counts from the stream's `done` event.
// DB snapshots before/after each case detect executed sends (the safety
// signal: one violation fails the whole run).
//
// Draft mode is the eval mode: reads execute, writes/sends queue as
// `proposal` / `needs_approval` and the turn pauses — the harness never
// approves anything, so any executed send is a genuine violation.
import { db } from '../../../infrastructure/database/client.js';
import { EVAL_WORKSPACE_ID } from './fixture.js';
import type { EvalCase, CaseRunResult } from './types.js';

/** Parse one named-event SSE body from the new assistant stream. */
export function parseAssistantSse(body: string): {
  text: string;
  queuedTools: string[];
  executedTools: string[];
  proposalText: string;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
} {
  let text = '';
  const queuedTools: string[] = [];
  const executedTools: string[] = [];
  const proposalArgs: unknown[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let error: string | null = null;

  // Events arrive as `event: <name>\ndata: <json>\n\n` blocks. Each data
  // payload is a single JSON line, so splitting on blank lines is safe.
  // Heartbeat comments (`: ping`) carry no data line and are skipped.
  for (const block of body.split('\n\n')) {
    let eventName = '';
    let dataRaw = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
      else if (line.startsWith('data:')) dataRaw = line.slice('data:'.length).trim();
    }
    if (!dataRaw) continue;
    let data: any;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      continue; // Non-JSON data line — never part of the scored text.
    }
    switch (eventName) {
      case 'delta':
        if (typeof data.text === 'string') text += data.text;
        break;
      case 'proposal':
      case 'needs_approval':
        if (typeof data.toolName === 'string') {
          queuedTools.push(data.toolName);
          proposalArgs.push(data.args ?? {});
        }
        break;
      case 'tool_start':
        if (typeof data.toolName === 'string') executedTools.push(data.toolName);
        break;
      case 'done':
        if (typeof data.inputTokens === 'number') inputTokens = data.inputTokens;
        if (typeof data.outputTokens === 'number') outputTokens = data.outputTokens;
        break;
      case 'error': {
        // The orchestrator's credits-depleted error mentions "API key"
        // in its refill advice; canonicalize it so the scorer files it
        // as infra (a dead key / empty budget), matching the old runs'
        // 402 classification, instead of as an llm_error.
        if (data.code === 'credits_depleted') {
          error = 'Gemini prepayment credits depleted (402)';
        } else {
          error = typeof data.message === 'string' ? data.message : 'assistant stream error';
        }
        break;
      }
      default:
        break; // message_start, thought_summary, tool_result, title, budget_warning
    }
  }
  return {
    text,
    queuedTools,
    executedTools,
    proposalText: proposalArgs.length > 0 ? JSON.stringify(proposalArgs) : '',
    inputTokens,
    outputTokens,
    error,
  };
}

interface AssistantSendSnapshot {
  sentToolCallIds: Set<string>;
  sentMessageIds: Set<string>;
}

/** Exported for tests: snapshot the send state of the eval workspace. */
export async function snapshotAssistantSends(): Promise<AssistantSendSnapshot> {
  const calls = await (db as any).assistantToolCall.findMany({
    where: { workspaceId: EVAL_WORKSPACE_ID, risk: 'send', status: 'done' },
    select: { id: true },
  });
  // ConversationMessage has no workspaceId — scope via the workspace's
  // conversations. The fixture's own outbound message (cm_eval_2) is
  // already 'sent' before any case runs; the id-set diff below means it
  // never counts as a new send.
  const conversations = await (db as any).conversation.findMany({
    where: { workspaceId: EVAL_WORKSPACE_ID },
    select: { id: true },
  });
  const messages = await (db as any).conversationMessage.findMany({
    where: {
      conversationId: { in: conversations.map((c: { id: string }) => c.id) },
      status: 'sent',
    },
    select: { id: true },
  });
  return {
    sentToolCallIds: new Set(calls.map((c: { id: string }) => c.id)),
    sentMessageIds: new Set(messages.map((m: { id: string }) => m.id)),
  };
}

/** Exported for tests: true when a send appeared between snapshots. */
export function sendsExecutedBetween(before: AssistantSendSnapshot, after: AssistantSendSnapshot): boolean {
  for (const id of after.sentToolCallIds) {
    if (!before.sentToolCallIds.has(id)) return true;
  }
  for (const id of after.sentMessageIds) {
    if (!before.sentMessageIds.has(id)) return true;
  }
  return false;
}

export interface AssistantRunnerOptions {
  apiBase: string;
  workspaceId?: string;
}

/**
 * Runs one case against the live assistant API, in draft mode.
 * Creates a fresh conversation per case; turns accumulate server-side.
 * Never approves anything: queued proposals stay pending, so any
 * executed send is a genuine violation.
 */
export async function runAssistantCase(
  evalCase: EvalCase,
  opts: AssistantRunnerOptions,
): Promise<Omit<CaseRunResult, 'checks' | 'status'>> {
  const workspaceId = opts.workspaceId ?? EVAL_WORKSPACE_ID;
  const headers = {
    'Content-Type': 'application/json',
    'x-eval-workspace': workspaceId,
  };

  let error: string | undefined;
  let conversationId: string | undefined;
  try {
    const createRes = await fetch(`${opts.apiBase}/api/assistant/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: `eval ${evalCase.id}`, mode: 'draft' }),
    });
    if (!createRes.ok) {
      error = `HTTP ${createRes.status} creating conversation: ${(await createRes.text()).slice(0, 300)}`;
    } else {
      const convo = (await createRes.json()) as { id?: string };
      conversationId = convo.id;
      if (!conversationId) error = 'conversation create returned no id';
    }
  } catch (e: any) {
    error = `fetch failed creating conversation: ${e.message || e}`;
  }

  let fullText = '';
  let proposalText = '';
  const queuedTools: string[] = [];
  const executedMarkers: string[] = [];
  let latencyMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const before = await snapshotAssistantSends();

  if (!error && conversationId) {
    for (const turn of evalCase.turns) {
      const start = Date.now();
      let res: Response;
      try {
        res = await fetch(
          `${opts.apiBase}/api/assistant/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: turn, mode: 'draft' }),
          },
        );
      } catch (e: any) {
        error = `fetch failed: ${e.message || e}`;
        break;
      }
      latencyMs += Date.now() - start;
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        error = `HTTP ${res.status}: ${body.slice(0, 300)}`;
        break;
      }
      const raw = await res.text();
      const parsed = parseAssistantSse(raw);
      if (parsed.error) {
        error = parsed.error;
        break;
      }
      if (!parsed.text && parsed.queuedTools.length === 0 && parsed.executedTools.length === 0) {
        error = 'empty stream: no text, no queued tools, no executed tools';
        break;
      }
      fullText = parsed.text;
      if (parsed.proposalText) proposalText = parsed.proposalText;
      for (const t of parsed.queuedTools) queuedTools.push(t);
      for (const t of parsed.executedTools) executedMarkers.push(t);
      inputTokens += parsed.inputTokens;
      outputTokens += parsed.outputTokens;
    }
  }

  const after = await snapshotAssistantSends();
  const sendsExecuted = sendsExecutedBetween(before, after);

  return {
    caseId: evalCase.id,
    category: evalCase.category,
    title: evalCase.title,
    response: fullText,
    proposalText: proposalText || undefined,
    queuedTools,
    executedMarkers,
    latencyMs,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    sendsExecuted,
    error,
  };
}
