/**
 * M7 unit tests (pure logic, no DB, no network): ramp caps, day numbers,
 * word counts, cold-format validation, and the text-only MIME builder.
 */
import { describe, expect, it } from 'vitest';
import {
  coldDailyCap,
  coldDayNumber,
  coldWordCount,
  validateColdFormat,
  withinColdWindow,
} from '../cold-outreach.service.js';
import { buildGmailMime } from '../../channels/gmail.service.js';

describe('coldDailyCap — spec §13 ramp', () => {
  it('days 1–3 → 20, days 4–7 → 40, week 2 → 75, after → 100', () => {
    expect(coldDailyCap(1)).toBe(20);
    expect(coldDailyCap(3)).toBe(20);
    expect(coldDailyCap(4)).toBe(40);
    expect(coldDailyCap(7)).toBe(40);
    expect(coldDailyCap(8)).toBe(75);
    expect(coldDailyCap(14)).toBe(75);
    expect(coldDailyCap(15)).toBe(100);
    expect(coldDailyCap(365)).toBe(100);
  });
  it('day 0 and negatives clamp to day 1', () => {
    expect(coldDailyCap(0)).toBe(20);
    expect(coldDailyCap(-5)).toBe(20);
  });
});

describe('coldDayNumber', () => {
  const anchor = new Date('2026-10-20T16:00:00.000Z');
  it('same day → 1, +3 days → 4, before anchor → 1', () => {
    expect(coldDayNumber(anchor, new Date('2026-10-20T20:00:00.000Z'))).toBe(1);
    expect(coldDayNumber(anchor, new Date('2026-10-23T16:00:00.000Z'))).toBe(4);
    expect(coldDayNumber(anchor, new Date('2026-10-19T16:00:00.000Z'))).toBe(1);
  });
});

describe('coldWordCount + validateColdFormat', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
  it('50 and 100 words pass; 49 and 101 block', () => {
    expect(validateColdFormat('<p>Hi</p>', words(50), true)).toEqual([]);
    expect(validateColdFormat('<p>Hi</p>', words(100), true)).toEqual([]);
    expect(validateColdFormat('<p>Hi</p>', words(49), true).length).toBe(1);
    expect(validateColdFormat('<p>Hi</p>', words(101), true).length).toBe(1);
  });
  it('an image blocks even at a valid word count', () => {
    const msgs = validateColdFormat('<p>Hi</p><img src="https://x.test/i.png">', words(75), true);
    expect(msgs.length).toBe(1);
    expect(msgs[0]).toContain('no images');
  });
  it('non-cold emails are never format-blocked', () => {
    expect(validateColdFormat('<img src="x">', 'too short', false)).toEqual([]);
  });
  it('word count ignores extra whitespace', () => {
    expect(coldWordCount('  hello   world\n\nfoo  ')).toBe(3);
  });
});

describe('withinColdWindow', () => {
  it('weekday 10am LA is inside; Saturday and 19:00 are outside', () => {
    // 2026-10-21 is a Wednesday; 10:00 PDT = 17:00 UTC.
    expect(withinColdWindow('America/Los_Angeles', new Date('2026-10-21T17:00:00.000Z'))).toBe(true);
    // Saturday 10:00 PDT = 17:00 UTC.
    expect(withinColdWindow('America/Los_Angeles', new Date('2026-10-24T17:00:00.000Z'))).toBe(false);
    // Wednesday 19:00 PDT = 2026-10-22T02:00Z.
    expect(withinColdWindow('America/Los_Angeles', new Date('2026-10-22T02:00:00.000Z'))).toBe(false);
  });
});

describe('buildGmailMime textOnly (M7 cold format)', () => {
  const base = {
    fromEmail: 'hello@sparkling.example',
    fromName: 'Jack Stone',
    to: 'a@test.example',
    subject: 'Hi',
    body: 'Hi there,\nYour home could shine again.',
  };
  it('default shape is multipart with an HTML part', () => {
    const mime = buildGmailMime({ ...base, htmlBody: '<p>Hi</p>' });
    expect(mime).toContain('multipart/alternative');
    expect(mime).toContain('Content-Type: text/html');
  });
  it('textOnly has no HTML part, no boundary, no images', () => {
    const mime = buildGmailMime({ ...base, textOnly: true });
    expect(mime).toContain('Content-Type: text/plain; charset=utf-8');
    expect(mime).not.toContain('text/html');
    expect(mime).not.toContain('multipart');
    expect(mime).not.toContain('<img');
    expect(mime).toContain('Your home could shine again.');
  });
});
