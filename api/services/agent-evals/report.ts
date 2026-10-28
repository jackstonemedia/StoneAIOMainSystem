// Phase 1 eval harness — report.
// One markdown page per run + a JSON twin for diffing. The diff compares
// against the most recent previous run JSON in the same out dir.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RunReport, CaseRunResult, CategoryTotals } from './types.js';

export function emptyTotals(): CategoryTotals {
  return { cases: 0, pass: 0, fail: 0, infra_error: 0, llm_error: 0 };
}

export function buildReport(
  partial: Omit<RunReport, 'totals' | 'byCategory' | 'latencyMs' | 'estimatedTokens' | 'sendsViolated'>,
  cases: CaseRunResult[],
): RunReport {
  const totals = emptyTotals();
  const byCategory: Record<string, CategoryTotals> = {};
  let latencyTotal = 0;
  let latencyMax = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let sendsViolated = false;

  for (const c of cases) {
    totals.cases += 1;
    totals[c.status] += 1;
    byCategory[c.category] ??= emptyTotals();
    byCategory[c.category].cases += 1;
    byCategory[c.category][c.status] += 1;
    latencyTotal += c.latencyMs;
    latencyMax = Math.max(latencyMax, c.latencyMs);
    inputTokens += c.estimatedInputTokens;
    outputTokens += c.estimatedOutputTokens;
    if (c.sendsExecuted) sendsViolated = true;
  }

  const scored = totals.pass + totals.fail;
  return {
    ...partial,
    cases,
    totals: { ...totals, passRate: scored === 0 ? 0 : Math.round((totals.pass / scored) * 1000) / 10 },
    byCategory,
    latencyMs: {
      total: latencyTotal,
      avg: cases.length === 0 ? 0 : Math.round(latencyTotal / cases.length),
      max: latencyMax,
    },
    estimatedTokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    sendsViolated,
  };
}

function categoryTable(byCategory: Record<string, CategoryTotals>): string {
  const rows = Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([cat, t]) =>
        `| ${cat} | ${t.cases} | ${t.pass} | ${t.fail} | ${t.infra_error} | ${t.llm_error} |`,
    );
  return [
    '| Category | Cases | Pass | Fail | Infra errors | LLM errors |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function diffSection(prev: RunReport | null, curr: RunReport): string {
  if (!prev) return '_No previous run in this out dir — this run is the baseline._';
  const lines: string[] = [];
  const delta = curr.totals.passRate - prev.totals.passRate;
  lines.push(
    `Pass rate: ${prev.totals.passRate}% → ${curr.totals.passRate}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts). ` +
      `Cases: ${prev.totals.cases} → ${curr.totals.cases}.`,
  );
  const prevById = new Map(prev.cases.map((c) => [c.caseId, c.status]));
  const flipped: string[] = [];
  for (const c of curr.cases) {
    const old = prevById.get(c.caseId);
    if (old && old !== c.status) flipped.push(`- ${c.caseId}: ${old} → ${c.status}`);
  }
  lines.push(flipped.length === 0 ? 'No case changed status.' : `Status flips:\n${flipped.join('\n')}`);
  return lines.join('\n');
}

export function renderMarkdown(report: RunReport, prev: RunReport | null): string {
  const failures = report.cases.filter((c) => c.status === 'fail');
  const errors = report.cases.filter((c) => c.status === 'infra_error' || c.status === 'llm_error');
  const out: string[] = [];
  out.push(`# Agent eval run — ${report.runId}`);
  out.push('');
  out.push(`- Started: ${report.startedAt} · Finished: ${report.finishedAt}`);
  out.push(`- Branch: ${report.branch || '(unknown)'} · API: ${report.apiBase}${report.apiPath ?? ''} · Workspace: ${report.evalWorkspaceId}`);
  out.push(`- Overall: ${report.totals.pass}/${report.totals.pass + report.totals.fail} scored passed (${report.totals.passRate}%) · ` +
    `${report.totals.cases} cases · ${report.totals.infra_error} infra errors · ${report.totals.llm_error} llm errors`);
  out.push(`- Latency: total ${report.latencyMs.total}ms, avg ${report.latencyMs.avg}ms, max ${report.latencyMs.max}ms`);
  out.push(`- Estimated tokens (chars/4, NOT metered — metering lands in Phase 5): input ${report.estimatedTokens.input}, output ${report.estimatedTokens.output}, total ${report.estimatedTokens.total}`);
  if (report.sendsViolated) out.push(`- ⚠️ SAFETY VIOLATION: a send executed during this run. The run is void for safety.`);
  out.push('');
  out.push('## Per-category');
  out.push('');
  out.push(categoryTable(report.byCategory));
  out.push('');
  out.push('## Diff vs previous run');
  out.push('');
  out.push(diffSection(prev, report));
  out.push('');
  if (failures.length > 0) {
    out.push('## Failures (response attached)');
    out.push('');
    for (const c of failures) {
      out.push(`### ${c.caseId} — ${c.title} (${c.category})`);
      out.push('');
      for (const check of c.checks.filter((x) => !x.passed)) {
        out.push(`- FAILED CHECK: ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
      }
      out.push('');
      out.push('Response:');
      out.push('');
      out.push('```');
      out.push(c.response.slice(0, 2000));
      out.push('```');
      out.push('');
    }
  }
  if (errors.length > 0) {
    out.push('## Errors (not scored)');
    out.push('');
    for (const c of errors) {
      out.push(`- ${c.caseId} (${c.status}): ${c.error ?? '(no detail)'}`);
    }
    out.push('');
  }
  if (report.notes.length > 0) {
    out.push('## Notes');
    out.push('');
    for (const n of report.notes) out.push(`- ${n}`);
    out.push('');
  }
  return out.join('\n');
}

/** Finds the most recent previous run JSON in outDir (excluding runId). */
export async function loadPreviousReport(outDir: string, runId: string): Promise<RunReport | null> {
  try {
    const files = (await fs.readdir(outDir))
      .filter((f) => f.endsWith('.json') && f !== `${runId}.json`)
      .sort();
    if (files.length === 0) return null;
    const raw = await fs.readFile(path.join(outDir, files[files.length - 1]), 'utf-8');
    return JSON.parse(raw) as RunReport;
  } catch {
    return null;
  }
}

/** Writes <runId>.json + <runId>.md into outDir. Returns both paths. */
export async function writeReport(
  outDir: string,
  report: RunReport,
): Promise<{ jsonPath: string; mdPath: string }> {
  await fs.mkdir(outDir, { recursive: true });
  const prev = await loadPreviousReport(outDir, report.runId);
  const jsonPath = path.join(outDir, `${report.runId}.json`);
  const mdPath = path.join(outDir, `${report.runId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(mdPath, renderMarkdown(report, prev));
  return { jsonPath, mdPath };
}
