// Phase 6 corrections loader — unit tests.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadCorrections, correctionsToCases } from '../corrections.js';

function writeTmp(content: string): string {
  const p = path.join(os.tmpdir(), `corrections-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, content);
  return p;
}

describe('loadCorrections', () => {
  it('returns [] when the file is absent', () => {
    expect(loadCorrections('/tmp/definitely-not-here-corrections.json')).toEqual([]);
  });

  it('loads valid entries and converts them to jack-origin cases', () => {
    const p = writeTmp(JSON.stringify([
      { id: 'corr-1', turns: ['Do X'], expect: { mustContain: ['Y'] }, rule: 'Always do X this way.' },
      { id: 'corr-2', turns: ['Do Z'], expect: { refusal: true } },
    ]));
    const entries = loadCorrections(p);
    expect(entries).toHaveLength(2);
    expect(entries[0].rule).toBe('Always do X this way.');
    const cases = correctionsToCases(entries);
    expect(cases[0].origin).toBe('jack');
    expect(cases[0].id).toBe('corr-1');
    fs.unlinkSync(p);
  });

  it('throws on invalid JSON, wrong shape, and bad entries', () => {
    expect(() => loadCorrections(writeTmp('{nope'))).toThrow(/not valid JSON/);
    expect(() => loadCorrections(writeTmp('{"a":1}'))).toThrow(/must be an array/);
    expect(() => loadCorrections(writeTmp(JSON.stringify([{ turns: ['x'], expect: {} }])))).toThrow(/id is required/);
    expect(() => loadCorrections(writeTmp(JSON.stringify([{ id: 'x', turns: [], expect: {} }])))).toThrow(/turns/);
    expect(() => loadCorrections(writeTmp(JSON.stringify([{ id: 'x', turns: ['y'] }])))).toThrow(/expect is required/);
    expect(() => loadCorrections(writeTmp(JSON.stringify([
      { id: 'dup', turns: ['a'], expect: {} },
      { id: 'dup', turns: ['b'], expect: {} },
    ])))).toThrow(/duplicate id/);
  });
});
