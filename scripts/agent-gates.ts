// Phase 6 rollout gates — the §6 "perfect" bar as a checkable table.
// Usage (from the repo root):
//   npx tsx scripts/agent-gates.ts --run <run.json> [--graded <graded.json>] [--gates <gates.json>]
// Reads gates.json for Jack's personal-test verdict (missing -> pending).
// The script never claims Jack's test passed: only his verdict in
// gates.json changes it. Exit 0 = all gates pass, 1 = any gate open.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatesVerdict, type GradedReport, type JackTestState } from '../api/services/agent-evals/grading.js';
import type { RunReport } from '../api/services/agent-evals/types.js';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[argv[i].slice(2)] = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) {
    console.error('usage: agent-gates.ts --run <run.json> [--graded <graded.json>] [--gates <gates.json>]');
    process.exit(2);
  }
  const run = JSON.parse(fs.readFileSync(args.run, 'utf8')) as RunReport;
  const graded = args.graded ? (JSON.parse(fs.readFileSync(args.graded, 'utf8')) as GradedReport) : null;
  let jackTest: JackTestState = 'pending';
  const gatesPath = args.gates ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ai-agent-outline', 'gates.json');
  try {
    const doc = JSON.parse(fs.readFileSync(gatesPath, 'utf8'));
    if (doc.jackTest === 'pass' || doc.jackTest === 'fail') jackTest = doc.jackTest;
  } catch {
    // missing or unreadable -> pending (never inferred)
  }
  const verdict = gatesVerdict(run, graded, jackTest);
  console.log(`[gates] run ${run.runId} — overall: ${verdict.overall ? 'PASS' : 'FAIL'}`);
  for (const g of verdict.gates) {
    console.log(`[gates] ${g.pass ? 'PASS' : 'FAIL'} ${g.name} — ${g.detail}`);
  }
  if (!verdict.overall) {
    console.log('[gates] unblockers:');
    for (const u of verdict.unblockers) console.log(`[gates] - ${u}`);
  }
  process.exit(verdict.overall ? 0 : 1);
}

main();
