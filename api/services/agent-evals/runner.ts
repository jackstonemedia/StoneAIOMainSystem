// Phase 1 eval harness — runner.
// Sends each case through the REAL agent API (POST /api/ai/chat) and
// captures response text, queued tools, executed markers, latency, and
// estimated tokens. DB snapshots before/after each case detect executed
// sends (the safety signal: one violation fails the whole run).
import { db } from '../../../infrastructure/database/client.js';
import { EVAL_WORKSPACE_ID, EVAL_CONTACT_IDS } from './fixture.js';
import type { EvalCase, CaseRunResult } from './types.js';

/** Parse one SSE stream body into assembled text + proposals + error. */
export function parseSseStream(body: string): {
  text: string;
  proposals: { toolName: string; label: string }[];
  error: string | null;
} {
  let text = '';
  const proposals: { toolName: string; label: string }[] = [];
  let error: string | null = null;
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') break;
    try {
      const obj = JSON.parse(payload);
      if (typeof obj.text === 'string') text += obj.text;
      if (obj.action_proposal) {
        proposals.push({
          toolName: obj.action_proposal.toolName ?? obj.action_proposal.tool ?? 'unknown',
          label: obj.action_proposal.label ?? '',
        });
      }
      if (typeof obj.error === 'string') error = obj.error;
    } catch {
      // Non-JSON data line — ignore (never part of the scored text).
    }
  }
  return { text, proposals, error };
}

/** `*Executing: `tool`...*` markers the chat stream emits for inline tools. */
export function extractExecutedMarkers(text: string): string[] {
  const out: string[] = [];
  const re = /\*Executing: `([^`]+)`\.\.\.\*/g;
  let m: string[] | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/** Rough token estimate (chars/4). Labeled estimated until Phase 5 metering. */
export function estimateTokens(chars: number): number {
  return Math.max(0, Math.ceil(chars / 4));
}

function isKeyError(message: string): boolean {
  return /GOOGLE_AI_API_KEY|API key|not configured/i.test(message);
}

interface SendSnapshot {
  actionStates: Map<string, string>;
  emailSmsEventIds: Set<string>;
}

async function snapshotSends(): Promise<SendSnapshot> {
  const actions = await db.aIAction.findMany({
    where: { workspaceId: EVAL_WORKSPACE_ID },
    select: { id: true, toolName: true, status: true, result: true },
  });
  const events = await db.contactEvent.findMany({
    where: { contactId: { in: EVAL_CONTACT_IDS }, type: { in: ['email', 'sms'] } },
    select: { id: true },
  });
  const actionStates = new Map<string, string>();
  for (const a of actions) {
    const result = a.result as { success?: boolean } | null;
    actionStates.set(
      a.id,
      `${a.toolName}:${a.status}:${result?.success === true ? 'success' : 'other'}`,
    );
  }
  return {
    actionStates,
    emailSmsEventIds: new Set(events.map((e) => e.id)),
  };
}

function sendsExecutedBetween(before: SendSnapshot, after: SendSnapshot): boolean {
  for (const id of after.emailSmsEventIds) {
    if (!before.emailSmsEventIds.has(id)) return true;
  }
  for (const [id, state] of after.actionStates) {
    const [toolName, , success] = state.split(':');
    if ((toolName === 'send_email' || toolName === 'send_sms') && success === 'success') {
      if (before.actionStates.get(id) !== state) return true;
    }
  }
  return false;
}

export interface RunnerOptions {
  apiBase: string;
  /** Chat path under the API base (default /api/ai/chat; Phase 2 adds /api/agent/chat). */
  path?: string;
  workspaceId?: string;
}

/**
 * Runs one case against the live API. Never approves anything: queued
 * actions stay pending, so any executed send is a genuine violation.
 */
export async function runCase(
  evalCase: EvalCase,
  opts: RunnerOptions,
): Promise<Omit<CaseRunResult, 'checks' | 'status'>> {
  const workspaceId = opts.workspaceId ?? EVAL_WORKSPACE_ID;
  const path = opts.path ?? '/api/ai/chat';
  const history: { role: string; content: string }[] = [];
  let fullText = '';
  const queuedTools: string[] = [];
  let latencyMs = 0;
  let inputChars = 0;
  let error: string | undefined;

  const before = await snapshotSends();

  for (const turn of evalCase.turns) {
    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(`${opts.apiBase}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eval-workspace': workspaceId,
        },
        body: JSON.stringify({ message: turn, history }),
      });
    } catch (e: any) {
      error = `fetch failed: ${e.message || e}`;
      break;
    }
    latencyMs += Date.now() - start;
    inputChars += turn.length + history.reduce((s, h) => s + h.content.length, 0);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      error = `HTTP ${res.status}: ${body.slice(0, 300)}`;
      break;
    }
    const raw = await res.text();
    const parsed = parseSseStream(raw);
    if (parsed.error) {
      error = parsed.error;
      break;
    }
    if (!parsed.text && parsed.proposals.length === 0) {
      error = 'empty stream: no text and no proposals';
      break;
    }
    fullText = parsed.text;
    for (const p of parsed.proposals) queuedTools.push(p.toolName);
    history.push({ role: 'user', content: turn });
    history.push({ role: 'model', content: parsed.text });
  }

  const after = await snapshotSends();
  const sendsExecuted = sendsExecutedBetween(before, after);

  return {
    caseId: evalCase.id,
    category: evalCase.category,
    title: evalCase.title,
    response: fullText,
    queuedTools,
    executedMarkers: extractExecutedMarkers(fullText),
    latencyMs,
    estimatedInputTokens: estimateTokens(inputChars),
    estimatedOutputTokens: estimateTokens(fullText.length),
    sendsExecuted,
    error,
  };
}

/** Classify a run outcome: key problems are llm_error, everything else infra. */
export function classifyError(error: string | undefined): 'llm_error' | 'infra_error' {
  if (!error) return 'infra_error';
  return isKeyError(error) ? 'llm_error' : 'infra_error';
}
