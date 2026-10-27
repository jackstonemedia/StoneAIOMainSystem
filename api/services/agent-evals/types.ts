// Phase 1 eval harness — shared types.
// The harness runs the REAL agent API (POST /api/ai/chat) and scores what
// comes back. Nothing here is production agent code; it is a dev tool.

export type EvalCategory =
  | 'qa'
  | 'drafting'
  | 'tool_use'
  | 'memory'
  | 'ambiguous'
  | 'out_of_scope'
  | 'adversarial'
  | 'voice';

export type CaseOrigin = 'jack' | 'azareth-starter' | 'azareth-draft-100';

export interface EvalExpect {
  /** Substrings that must appear in the final response (case-insensitive). */
  mustContain?: string[];
  /** At least one group must fully appear (each group = AND of substrings). */
  anyOf?: string[][];
  /** Substrings that must NOT appear (trap names, invented values). */
  mustNotContain?: string[];
  /** Response must refuse (and must not queue or execute anything). */
  refusal?: boolean;
  /** Tools that must appear as queued action_proposals. */
  queuedTools?: string[];
  /** Final response char cap. */
  maxLength?: number;
  /** Default true: no send may execute during the case. */
  noSend?: boolean;
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  title: string;
  /** Messages in order; history accumulates within the case. */
  turns: string[];
  origin: CaseOrigin;
  expect?: EvalExpect;
}

export interface EvalCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export type CaseStatus = 'pass' | 'fail' | 'infra_error' | 'llm_error';

export interface CaseRunResult {
  caseId: string;
  category: EvalCategory;
  title: string;
  status: CaseStatus;
  /** Final turn's response text (empty on infra/llm errors). */
  response: string;
  queuedTools: string[];
  executedMarkers: string[];
  latencyMs: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  checks: EvalCheck[];
  /** True if any send executed during the case — fails the whole run. */
  sendsExecuted: boolean;
  error?: string;
}

export interface CategoryTotals {
  cases: number;
  pass: number;
  fail: number;
  infra_error: number;
  llm_error: number;
}

export interface RunReport {
  runId: string;
  startedAt: string;
  finishedAt: string;
  /** Git branch the harness ran against (best effort, may be empty). */
  branch: string;
  apiBase: string;
  /** Chat path tested (Phase 2: /api/ai/chat vs /api/agent/chat). */
  apiPath?: string;
  evalWorkspaceId: string;
  totals: CategoryTotals & { passRate: number };
  byCategory: Record<string, CategoryTotals>;
  latencyMs: { total: number; avg: number; max: number };
  /** ESTIMATED tokens (chars/4) — real metering lands in Phase 5. */
  estimatedTokens: { input: number; output: number; total: number };
  /** True if any case executed a send — the run is void for safety. */
  sendsViolated: boolean;
  cases: CaseRunResult[];
  /** Honest limitations of this run (key missing, deferred slices, ...). */
  notes: string[];
}
