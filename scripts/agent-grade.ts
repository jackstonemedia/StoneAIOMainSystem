// Phase 6 grading — human review over a harness run.
// Usage (from the repo root):
//   npx tsx scripts/agent-grade.ts --template --run <run.json> --out <grades.json>
//     Emits one row per case (nothing pre-filtered) with empty score
//     fields for Jack to fill. Automated failures and refusals are
//     flagged needsReview: true to sort the review order.
//   npx tsx scripts/agent-grade.ts --grade --run <run.json> --grades <grades.json> [--out <dir>]
//     Emits a graded report (markdown + JSON) with the human pass rate,
//     per-category rates, and critical count.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { gradeRun, type HumanGrade } from '../api/services/agent-evals/grading.js';
import type { RunReport } from '../api/services/agent-evals/types.js';

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[argv[i].slice(2)] = argv[++i];
    } else if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = 'true';
    }
  }
  return args;
}

function needsReviewFlag(c: any): boolean {
  if (c.status === 'fail') return true;
  if (c.status === 'pass' && /refus|cannot|can't|unable/i.test(c.response ?? '')) return true;
  return false;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) {
    console.error('usage: agent-grade.ts --template|--grade --run <run.json> [--grades <grades.json>] [--out <path>]');
    process.exit(2);
  }
  const run = JSON.parse(fs.readFileSync(args.run, 'utf8')) as RunReport;

  if (args.template) {
    const out = args.out ?? 'grades-template.json';
    const rows = run.cases.map((c) => ({
      caseId: c.caseId,
      title: c.title,
      category: c.category,
      automatedStatus: c.status,
      needsReview: needsReviewFlag(c),
      responseExcerpt: (c.response ?? '').slice(0, 500),
      accuracy: null,
      judgment: null,
      helpfulness: null,
      safety: null,
      note: '',
    }));
    fs.writeFileSync(out, JSON.stringify({ runId: run.runId, grades: rows }, null, 2));
    console.log(`[grade] template: ${rows.length} cases (${rows.filter((r) => r.needsReview).length} flagged for review) -> ${out}`);
    return;
  }

  if (args.grade) {
    if (!args.grades) {
      console.error('usage: agent-grade.ts --grade --run <run.json> --grades <grades.json> [--out <dir>]');
      process.exit(2);
    }
    const gradesDoc = JSON.parse(fs.readFileSync(args.grades, 'utf8'));
    const grades = new Map<string, HumanGrade>();
    for (const g of gradesDoc.grades ?? []) {
      if (g.accuracy === null || g.accuracy === undefined) continue; // ungraded, not a pass
      for (const k of ['accuracy', 'judgment', 'helpfulness', 'safety']) {
        const v = g[k];
        if (typeof v !== 'number' || v < 1 || v > 5) {
          console.error(`[grade] invalid score for ${g.caseId}: ${k}=${v} (must be 1-5)`);
          process.exit(2);
        }
      }
      grades.set(g.caseId, g);
    }
    const graded = gradeRun(run, grades);
    const outDir = args.out ?? path.dirname(args.run);
    const base = `graded-${run.runId}`;
    const lines = [
      `# Graded report — ${run.runId}`,
      '',
      `Human pass: ${graded.humanPass}/${graded.graded} (${Math.round(graded.humanPassRate * 100)}% over graded cases), ${graded.ungraded} ungraded, ${graded.critical} critical.`,
      '',
      '## By category',
      ...Object.entries(graded.byCategory).map(([cat, t]) => `- ${cat}: ${t.pass}/${t.graded} (${Math.round(t.passRate * 100)}%)`),
      '',
      '## Critical cases',
      ...(graded.cases.filter((c) => c.critical).map((c) => `- ${c.caseId} (${c.title})`) || ['- none']),
      '',
      '## Ungraded cases (not counted either way)',
      ...(graded.cases.filter((c) => c.humanPass === null).map((c) => `- ${c.caseId} (${c.title})`) || ['- none']),
      '',
    ];
    fs.writeFileSync(path.join(outDir, `${base}.md`), lines.join('\n'));
    fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(graded, null, 2));
    console.log(`[grade] graded: ${graded.humanPass}/${graded.graded} pass (${Math.round(graded.humanPassRate * 100)}%), ${graded.critical} critical, ${graded.ungraded} ungraded -> ${outDir}/${base}.md`);
    return;
  }

  console.error('specify --template or --grade');
  process.exit(2);
}

main();
