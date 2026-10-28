// Phase 6 corrections loop — Jack's corrections as regression cases
// and standing rules. Entries are Jack's words (origin 'jack'), never
// Azareth's. Invalid entries throw: a corrupt corrections file must
// fail loudly, never silently test against unknown rules.
import * as fs from 'node:fs';
import type { EvalCase, EvalExpect } from './types.js';

export interface CorrectionEntry {
  id: string;
  turns: string[];
  expect: EvalExpect;
  /** Standing-rule text, seeded as a kind-'rule' memory (Phase 3). */
  rule?: string;
  note?: string;
}

const CORRECTIONS_PATH = new URL('./corrections.json', import.meta.url).pathname;

/** Load + validate the corrections file (empty array when absent). */
export function loadCorrections(path: string = CORRECTIONS_PATH): CorrectionEntry[] {
  let raw: string;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`corrections.json is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('corrections.json must be an array of correction entries');
  }
  const entries: CorrectionEntry[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const e: any = parsed[i];
    if (typeof e !== 'object' || e === null) {
      throw new Error(`corrections[${i}]: entry must be an object`);
    }
    if (typeof e.id !== 'string' || !e.id.trim()) {
      throw new Error(`corrections[${i}]: id is required`);
    }
    if (!Array.isArray(e.turns) || e.turns.length === 0 || !e.turns.every((t: any) => typeof t === 'string' && t.trim())) {
      throw new Error(`corrections[${i}] (${e.id}): turns must be a non-empty string array`);
    }
    if (typeof e.expect !== 'object' || e.expect === null) {
      throw new Error(`corrections[${i}] (${e.id}): expect is required`);
    }
    if (e.rule !== undefined && (typeof e.rule !== 'string' || !e.rule.trim())) {
      throw new Error(`corrections[${i}] (${e.id}): rule must be a non-empty string when present`);
    }
    entries.push({ id: e.id, turns: e.turns, expect: e.expect, rule: e.rule, note: e.note });
  }
  const ids = new Set<string>();
  for (const e of entries) {
    if (ids.has(e.id)) throw new Error(`corrections: duplicate id "${e.id}"`);
    ids.add(e.id);
  }
  return entries;
}

/** Corrections → eval cases (origin 'jack'). */
export function correctionsToCases(entries: CorrectionEntry[]): EvalCase[] {
  return entries.map((e) => ({
    id: e.id,
    category: 'qa',
    title: `Correction: ${e.id}`,
    turns: e.turns,
    origin: 'jack',
    expect: e.expect,
  }));
}
