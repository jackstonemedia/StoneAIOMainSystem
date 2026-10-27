// Phase 1 eval harness — CLI runner.
// Usage (from the repo root):
//   npx tsx scripts/agent-evals.ts [--api http://localhost:4000]
//     [--out <dir>] [--no-seed]
//
// Exit codes: 0 = run completed (eval failures are data, not a crash).
// 1 = safety violation (a send executed) or harness crash.
// Reports land in <out>/<runId>.md + <runId>.json.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedEvalWorkspace, EVAL_WORKSPACE_ID } from '../api/services/agent-evals/fixture.js';
import { runCase } from '../api/services/agent-evals/runner.js';
import { scoreCase } from '../api/services/agent-evals/scorer.js';
import { buildReport, writeReport } from '../api/services/agent-evals/report.js';
import { STARTER_CASES } from '../api/services/agent-evals/cases-starter.js';
import type { CaseRunResult } from '../api/services/agent-evals/types.js';

function parseArgs(argv: string[]): { api: string; out: string; seed: boolean } {
  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = {
    api: 'http://localhost:4000',
    out: path.join(repoRoot, '..', 'ai-agent-outline', 'phase1-evals', 'runs'),
    seed: true,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--api' && argv[i + 1]) args.api = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (argv[i] === '--no-seed') args.seed = false;
  }
  return args;
}

function gitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const { api, out, seed } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const runId = `run-${startedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;

  console.log(`[evals] run ${runId} · api ${api} · workspace ${EVAL_WORKSPACE_ID}`);
  if (seed) {
    await seedEvalWorkspace();
    console.log('[evals] fixture seeded');
  }

  const results: CaseRunResult[] = [];
  for (const evalCase of STARTER_CASES) {
    process.stdout.write(`[evals] ${evalCase.id} (${evalCase.category}) ... `);
    const run = await runCase(evalCase, { apiBase: api });
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
      evalWorkspaceId: EVAL_WORKSPACE_ID,
      cases: results,
      notes: [
        'Token counts are ESTIMATED (chars/4). Real metering lands in Phase 5.',
        'Starter cases are drafted by Azareth (origin: azareth-starter), NOT Jack\'s 100 seed messages — those still await Jack.',
        'Voice slice deferred: no voice agent exists yet (Retell routes only).',
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
