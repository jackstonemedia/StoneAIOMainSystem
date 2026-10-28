// Phase 3 memory curation — unit tests (pure functions, no db, no key).
import { describe, it, expect } from 'vitest';
import {
  parseRememberCommand,
  parseCorrection,
  isMemoryKind,
  formatMemoriesForPrompt,
  MEMORY_PROMPT_CAP,
} from '../memories.js';

describe('parseRememberCommand', () => {
  it('matches both remember forms and keeps the content', () => {
    expect(parseRememberCommand('remember that Evalworks prefers morning calls')).toBe(
      'Evalworks prefers morning calls',
    );
    expect(parseRememberCommand('Remember: Dana Kim prefers email')).toBe('Dana Kim prefers email');
    expect(parseRememberCommand('  remember that  spaced out  ')).toBe('spaced out');
  });

  it('does not fire on ordinary messages', () => {
    expect(parseRememberCommand('remember the meeting tomorrow')).toBeNull();
    expect(parseRememberCommand('I remember that day')).toBeNull();
    expect(parseRememberCommand('remember that')).toBeNull();
    expect(parseRememberCommand('')).toBeNull();
  });
});

describe('parseCorrection', () => {
  it('strips each marker and keeps the distilled statement', () => {
    expect(parseCorrection('No, I meant Ramirez, not Rivera')).toBe('I meant Ramirez, not Rivera');
    expect(parseCorrection('Actually, avoid Mondays instead')).toBe('avoid Mondays instead');
    expect(parseCorrection('Correction: the retainer closes December 1')).toBe('the retainer closes December 1');
    expect(parseCorrection('Wrong, the deal is worth 12000')).toBe('the deal is worth 12000');
    expect(parseCorrection('I meant Dana, not Priya')).toBe('Dana, not Priya');
  });

  it('does not fire on ordinary messages', () => {
    expect(parseCorrection('No worries, thanks')).toBeNull();
    expect(parseCorrection('Actually this is a normal sentence')).toBeNull();
    expect(parseCorrection('Note: the retainer is 24000')).toBeNull();
    expect(parseCorrection('no')).toBeNull();
  });
});

describe('isMemoryKind', () => {
  it('accepts only the five kinds', () => {
    for (const k of ['correction', 'preference', 'fact', 'decision', 'rule']) {
      expect(isMemoryKind(k)).toBe(true);
    }
    expect(isMemoryKind('transcript')).toBe(false);
    expect(isMemoryKind('')).toBe(false);
    expect(isMemoryKind(undefined)).toBe(false);
  });
});

describe('formatMemoriesForPrompt', () => {
  it('returns empty for no memories', () => {
    expect(formatMemoriesForPrompt([])).toBe('');
  });

  it('orders corrections first, newest first within groups', () => {
    const old = new Date('2026-01-01');
    const mid = new Date('2026-02-01');
    const latest = new Date('2026-03-01');
    const out = formatMemoriesForPrompt([
      { kind: 'fact', content: 'old fact', createdAt: old },
      { kind: 'correction', content: 'old correction', createdAt: old },
      { kind: 'fact', content: 'new fact', createdAt: latest },
      { kind: 'correction', content: 'new correction', createdAt: mid },
    ]);
    const lines = out.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toEqual([
      '- [correction] new correction',
      '- [correction] old correction',
      '- [fact] new fact',
      '- [fact] old fact',
    ]);
    expect(out).toContain('later corrections override earlier ones');
  });

  it('caps at 50 and truncates long content', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      kind: 'fact',
      content: `fact-${i} ${'x'.repeat(600)}`,
      createdAt: new Date(2026, 0, i + 1),
    }));
    const out = formatMemoriesForPrompt(rows);
    const lines = out.split('\n').filter((l) => l.startsWith('- '));
    expect(lines).toHaveLength(MEMORY_PROMPT_CAP);
    expect(lines[0]).toContain('…');
  });
});
