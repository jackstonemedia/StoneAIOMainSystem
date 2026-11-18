// Phase 1 eval harness — CLI runner.
// Usage (from the repo root):
//   npx tsx scripts/agent-evals.ts [--api http://localhost:4000]
//     [--target assistant|legacy] [--path /api/ai/chat] [--out <dir>] [--no-seed]
//
// --target assistant (default): scores the SHIPPING assistant
//   (/api/assistant, draft mode, real tokens). The API must run with
//   FEATURE_ASSISTANT=true; the dev key must be live.
// --target legacy: the retired agent route (/api/ai/chat or /api/agent/chat).
//
// Exit codes: 0 = run completed (eval failures are data, not a crash).
// 1 = safety violation (a send executed) or harness crash.
// Reports land in <out>/<runId>.md + <runId>.json.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedEvalWorkspace, EVAL_WORKSPACE_ID } from '../api/services/agent-evals/fixture.js';
import { runCase } from '../api/services/agent-evals/runner.js';
import { runAssistantCase } from '../api/services/agent-evals/runner-assistant.js';
import { scoreCase } from '../api/services/agent-evals/scorer.js';
import { buildReport, writeReport } from '../api/services/agent-evals/report.js';
import { STARTER_CASES } from '../api/services/agent-evals/cases-starter.js';
import { DRAFT100_CASES } from '../api/services/agent-evals/cases-draft100.js';
import { PHASE4_CASES } from '../api/services/agent-evals/cases-phase4.js';
import { REDTEAM_CASES } from '../api/services/agent-evals/cases-redteam.js';
import { loadCorrections, correctionsToCases } from '../api/services/agent-evals/corrections.js';
import type { CaseRunResult, EvalCase } from '../api/services/agent-evals/types.js';

function parseArgs(argv: string[]): { api: string; path: string; out: string; seed: boolean; cases: string; target: string } {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = {
    api: 'http://localhost:4000',
    path: '/api/ai/chat',
    out: path.join(repoRoot, '..', 'ai-agent-outline', 'phase4-evals', 'runs'),
    seed: true,
    cases: 'starter',
    target: 'assistant',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--api' && argv[i + 1]) args.api = argv[++i];
    else if (argv[i] === '--path' && argv[i + 1]) args.path = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (argv[i] === '--cases' && argv[i + 1]) args.cases = argv[++i];
    else if (argv[i] === '--target' && argv[i + 1]) args.target = argv[++i];
    else if (argv[i] === '--no-seed') args.seed = false;
  }
  if (args.target === 'legacy' && args.out === path.join(repoRoot, '..', 'ai-agent-outline', 'phase4-evals', 'runs')) {
    args.out = path.join(repoRoot, '..', 'ai-agent-outline', 'phase1-evals', 'runs');
  }
  return args;
}

function selectCases(kind: string): { label: string; cases: EvalCase[] } {
  if (kind === 'draft100') return { label: 'draft100 (Azareth-drafted, for Jack review)', cases: DRAFT100_CASES };
  if (kind === 'phase4') return { label: 'phase4 (Azareth-drafted slice)', cases: PHASE4_CASES };
  if (kind === 'redteam') return { label: 'redteam (Azareth-drafted adversarial slice)', cases: REDTEAM_CASES };
  if (kind === 'corrections') return { label: 'corrections (Jack-authored)', cases: correctionsToCases(loadCorrections()) };
  if (kind === 'all') return { label: 'all (starter + draft100 + phase4 + redteam + corrections)', cases: [...STARTER_CASES, ...DRAFT100_CASES, ...PHASE4_CASES, ...REDTEAM_CASES, ...correctionsToCases(loadCorrections())] };
  return { label: 'starter (Azareth-drafted slice)', cases: STARTER_CASES };
}

function gitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const { api, path, out, seed, cases, target } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const runId = `run-${startedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;
  const selected = selectCases(cases);
  const isAssistant = target !== 'legacy';

  console.log(`[evals] run ${runId} · target ${isAssistant ? 'assistant (/api/assistant, draft mode)' : `legacy (${api}${path})`} · workspace ${EVAL_WORKSPACE_ID} · set ${selected.label} (${selected.cases.length} cases)`);
  if (seed) {
    await seedEvalWorkspace();
    console.log('[evals] fixture seeded');
  }

  const results: CaseRunResult[] = [];
  for (const evalCase of selected.cases) {
    process.stdout.write(`[evals] ${evalCase.id} (${evalCase.category}) ... `);
    const run = isAssistant
      ? await runAssistantCase(evalCase, { apiBase: api })
      : await runCase(evalCase, { apiBase: api, path });
    const { checks, status } = scoreCase(evalCase, run);
    results.push({ ...run, checks, status });
    console.log(`${status}${run.error ? ` — ${run.error.slice(0, 120)}` : ''}`);
  }

  const report = buildReport(
    {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      branch: gitBranch(),
      apiBase: api,
      apiPath: isAssistant ? '/api/assistant' : path,
      evalWorkspaceId: EVAL_WORKSPACE_ID,
      tokensReal: isAssistant,
      cases: results,
      notes: isAssistant
        ? [
            'Token counts are REAL (from the assistant stream usage accounting).',
            'Assistant runs in draft mode: writes/sends queue as proposals, never execute.',
            'Text expectations check the chat reply PLUS queued proposal args (a queued draft is readable in the UI proposal card).',
            'Expected tool names use the OLD agent names, mapped where renamed (create_appointment → book_appointment). update_deal and send_campaign have no equivalent in the shipping assistant and fail honestly.',
            `Case set: ${selected.label}. Draft-100 cases are Azareth-drafted for Jack's review, NOT Jack's own messages — he corrects or replaces them.`,
            'Voice cases are text proxies until a voice interface exists (voice AI was removed 2026-11-10).',
            'Memory cases: persisted facts come from assistant_memories seeded in the fixture; background memory extraction is async and may not land within a case.',
            'Eval runs share nothing with real workspaces: fixture lives in ws_eval_stone_aio, reached via the dev-only x-eval-workspace header.',
          ]
        : [
            'Token counts are ESTIMATED (chars/4). Real metering lands in Phase 5.',
            `Case set: ${selected.label}. Draft-100 cases are Azareth-drafted for Jack's review, NOT Jack's own messages — he corrects or replaces them.`,
            'Voice cases are text proxies until a voice interface exists (Retell routes only).',
            'Campaign tools untested here: this dev DB lacks the email-marketing tables (prisma db push engine download 404s from this VM).',
            'Memory slice is an in-conversation baseline only; persisted memory lands in Phase 3.',
            'Eval runs share nothing with real workspaces: fixture lives in ws_eval_stone_aio, reached via the dev-only x-eval-workspace header.',
          ],
    },
    results,
  );

  const { jsonPath, mdPath } = await writeReport(out, report);
  console.log(`[evals] report: ${mdPath}`);
  console.log(`[evals] json:   ${jsonPath}`);
  console.log(
    `[evals] totals: ${report.totals.pass} pass / ${report.totals.fail} fail / ` +
      `${report.totals.infra_error} infra / ${report.totals.llm_error} llm ` +
      `(${report.totals.passRate}% of scored)`,
  );
  if (report.sendsViolated) {
    console.log('[evals] SAFETY VIOLATION: a send executed — run is void.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[evals] harness crashed:', err);
  process.exitCode = 1;
});
