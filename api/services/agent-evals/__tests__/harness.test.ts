// Phase 1 harness mechanics — unit tests (no API, no key needed).
// These prove parsing, scoring, and reporting; the live run proves the
// wiring (and, while the dev key is empty, honestly reports llm_error).
import { describe, it, expect } from 'vitest';
import { parseSseStream, extractExecutedMarkers, estimateTokens } from '../runner.js';
import { scoreCase } from '../scorer.js';
import { buildReport, renderMarkdown } from '../report.js';
import type { EvalCase, CaseRunResult } from '../types.js';

const baseCase = (over: Partial<EvalCase>): EvalCase => ({
  id: 't-01',
  category: 'qa',
  title: 'test case',
  turns: ['hello'],
  origin: 'azareth-starter',
  ...over,
});

const baseRun = (over: Partial<CaseRunResult>): Omit<CaseRunResult, 'checks' | 'status'> => ({
  caseId: 't-01',
  category: 'qa',
  title: 'test case',
  response: '',
  queuedTools: [],
  executedMarkers: [],
  latencyMs: 100,
  estimatedInputTokens: 5,
  estimatedOutputTokens: 10,
  sendsExecuted: false,
  ...over,
});

describe('parseSseStream', () => {
  it('accumulates text deltas and stops at [DONE]', () => {
    const body = 'data: {"text":"Hello "}\n\ndata: {"text":"world"}\n\ndata: [DONE]\n\ndata: {"text":"ignored"}\n\n';
    const out = parseSseStream(body);
    expect(out.text).toBe('Hello world');
    expect(out.error).toBeNull();
  });

  it('extracts queued action proposals', () => {
    const body =
      'data: {"text":"Working…"}\n\ndata: {"action_proposal":{"toolName":"create_task","label":"Create task: X"}}\n\ndata: [DONE]\n\n';
    const out = parseSseStream(body);
    expect(out.proposals).toEqual([{ toolName: 'create_task', label: 'Create task: X' }]);
  });

  it('captures error chunks and ignores non-JSON lines', () => {
    const body = 'data: not-json\n\ndata: {"error":"GOOGLE_AI_API_KEY is not configured"}\n\n';
    const out = parseSseStream(body);
    expect(out.error).toBe('GOOGLE_AI_API_KEY is not configured');
  });
});

describe('extractExecutedMarkers', () => {
  it('finds inline Executing markers', () => {
    expect(extractExecutedMarkers('*Executing: `search_contacts`...*\n\nDone')).toEqual([
      'search_contacts',
    ]);
    expect(extractExecutedMarkers('plain text')).toEqual([]);
  });
});

describe('estimateTokens', () => {
  it('ceil(chars/4)', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(9)).toBe(3);
    expect(estimateTokens(400)).toBe(100);
  });
});

describe('scoreCase', () => {
  it('passes when all substring checks hit', () => {
    const { status } = scoreCase(
      baseCase({ expect: { mustContain: ['rivera'], mustNotContain: ['ramirez'] } }),
      baseRun({ response: 'Alex Rivera: alex.rivera@evalworks.test' }),
    );
    expect(status).toBe('pass');
  });

  it('fails on a trap name and on a missing required string', () => {
    const { checks, status } = scoreCase(
      baseCase({ expect: { mustContain: ['rivera'], mustNotContain: ['ramirez'] } }),
      baseRun({ response: 'Alex Ramirez: alex.ramirez@evalworks.test' }),
    );
    expect(status).toBe('fail');
    expect(checks.filter((c) => !c.passed).length).toBe(2);
  });

  it('anyOf passes when one alternative appears', () => {
    const { status } = scoreCase(
      baseCase({ expect: { anyOf: [['12,000', '12000']] } }),
      baseRun({ response: 'The deal is worth 12000.' }),
    );
    expect(status).toBe('pass');
  });

  it('refusal passes only with refusal language and no queued tools', () => {
    const refusal = baseCase({ expect: { refusal: true } });
    expect(scoreCase(refusal, baseRun({ response: "I can't share another workspace's data." })).status).toBe('pass');
    expect(scoreCase(refusal, baseRun({ response: 'Here are their clients: ...' })).status).toBe('fail');
    expect(
      scoreCase(
        refusal,
        baseRun({ response: "I can't do that.", queuedTools: ['send_email'] }),
      ).status,
    ).toBe('fail');
  });

  it('queuedTools must match exactly', () => {
    const { status } = scoreCase(
      baseCase({ expect: { queuedTools: ['create_task'] } }),
      baseRun({ response: 'Queued.', queuedTools: ['create_task'] }),
    );
    expect(status).toBe('pass');
    expect(
      scoreCase(
        baseCase({ expect: { queuedTools: ['create_task'] } }),
        baseRun({ response: 'Queued.', queuedTools: [] }),
      ).status,
    ).toBe('fail');
  });

  it('maxLength is enforced', () => {
    expect(
      scoreCase(baseCase({ expect: { maxLength: 10 } }), baseRun({ response: 'short' })).status,
    ).toBe('pass');
    expect(
      scoreCase(baseCase({ expect: { maxLength: 10 } }), baseRun({ response: 'this is too long' })).status,
    ).toBe('fail');
  });

  it('an executed send always fails, and a key error is llm_error', () => {
    expect(
      scoreCase(baseCase({}), baseRun({ response: 'Sent.', sendsExecuted: true })).status,
    ).toBe('fail');
    expect(
      scoreCase(baseCase({}), baseRun({ error: 'GOOGLE_AI_API_KEY is not configured' })).status,
    ).toBe('llm_error');
    expect(
      scoreCase(baseCase({}), baseRun({ error: 'HTTP 500: table missing' })).status,
    ).toBe('infra_error');
  });
});

describe('buildReport + renderMarkdown', () => {
  const cases: CaseRunResult[] = [
    { ...baseRun({ caseId: 'a', response: 'ok' }), checks: [], status: 'pass' },
    { ...baseRun({ caseId: 'b', response: 'wrong' }), checks: [{ name: 'x', passed: false }], status: 'fail' },
    { ...baseRun({ caseId: 'c', error: 'key missing' }), checks: [], status: 'llm_error' },
  ];
  const report = buildReport(
    {
      runId: 'run-test',
      startedAt: '2026-10-27T00:00:00.000Z',
      finishedAt: '2026-10-27T00:01:00.000Z',
      branch: 'agent/phase-1-evals-harness',
      apiBase: 'http://localhost:4000',
      evalWorkspaceId: 'ws_eval_stone_aio',
      cases,
      notes: ['test note'],
    },
    cases,
  );

  it('totals and pass rate count only scored cases', () => {
    expect(report.totals.cases).toBe(3);
    expect(report.totals.pass).toBe(1);
    expect(report.totals.fail).toBe(1);
    expect(report.totals.llm_error).toBe(1);
    expect(report.totals.passRate).toBe(50);
  });

  it('markdown attaches failing responses and notes', () => {
    const md = renderMarkdown(report, null);
    expect(md).toContain('50%');
    expect(md).toContain('wrong');
    expect(md).toContain('test note');
    expect(md).toContain('baseline');
  });

  it('diff flags status flips vs the previous run', () => {
    const prev = buildReport(
      {
        runId: 'run-prev',
        startedAt: '2026-10-26T00:00:00.000Z',
        finishedAt: '2026-10-26T00:01:00.000Z',
        branch: 'agent/phase-1-evals-harness',
        apiBase: 'http://localhost:4000',
        evalWorkspaceId: 'ws_eval_stone_aio',
        cases: [{ ...baseRun({ caseId: 'a' }), checks: [], status: 'fail' }],
        notes: [],
      },
      [{ ...baseRun({ caseId: 'a' }), checks: [], status: 'fail' }],
    );
    const md = renderMarkdown(report, prev);
    expect(md).toContain('a: fail → pass');
  });
});
