/**
 * Complete-platform item 10 — one day definition.
 *
 * The Dashboard page uses the browser-local day, but the server computed
 * "today" from server-local time (UTC on the VM). These tests pin the
 * timezone-aware day/week bounds: midnight means midnight in the
 * viewer's zone, not the server's. All fixtures use explicit instants,
 * so they are deterministic regardless of the runner's TZ.
 */
import { describe, it, expect } from 'vitest';
import { dayBoundsInTimezone, zonedMidnightUtc, tzOffsetMs } from '../services/business.service.js';

describe('dayBoundsInTimezone', () => {
  it('midnight in Los Angeles is 08:00 UTC (PST)', () => {
    const bounds = dayBoundsInTimezone('America/Los_Angeles', new Date('2026-11-19T08:00:00.000Z'));
    expect(bounds).not.toBeNull();
    expect(bounds!.startOfToday.toISOString()).toBe('2026-11-19T08:00:00.000Z');
    expect(bounds!.endOfToday.toISOString()).toBe('2026-11-20T07:59:59.999Z');
  });

  it('at 07:00 UTC it is still Nov 18 in Los Angeles — the server-UTC day would be wrong', () => {
    const bounds = dayBoundsInTimezone('America/Los_Angeles', new Date('2026-11-19T07:00:00.000Z'));
    expect(bounds!.startOfToday.toISOString()).toBe('2026-11-18T08:00:00.000Z');
    expect(bounds!.endOfToday.toISOString()).toBe('2026-11-19T07:59:59.999Z');
  });

  it('UTC bounds fall on UTC midnight', () => {
    const bounds = dayBoundsInTimezone('UTC', new Date('2026-11-19T12:00:00.000Z'));
    expect(bounds!.startOfToday.toISOString()).toBe('2026-11-19T00:00:00.000Z');
    expect(bounds!.endOfToday.toISOString()).toBe('2026-11-19T23:59:59.999Z');
  });

  it('the week starts on Sunday in the viewer zone (Nov 19 2026 is a Thursday)', () => {
    const bounds = dayBoundsInTimezone('America/Los_Angeles', new Date('2026-11-19T20:00:00.000Z'));
    expect(bounds!.startOfWeek.toISOString()).toBe('2026-11-15T08:00:00.000Z');
    expect(bounds!.endOfWeek.toISOString()).toBe('2026-11-22T07:59:59.999Z');
  });

  it('an invalid timezone returns null so the caller falls back to server-local', () => {
    expect(dayBoundsInTimezone('Not/AZone', new Date())).toBeNull();
    expect(dayBoundsInTimezone('', new Date())).toBeNull();
  });

  it('zonedMidnightUtc handles a DST day (Mar 8 2026 springs forward in LA)', () => {
    // Midnight at the start of Mar 8 2026 in LA is still PST (UTC-8);
    // midnight at the start of Mar 9 is PDT (UTC-7).
    expect(zonedMidnightUtc('America/Los_Angeles', 2026, 3, 8).toISOString()).toBe('2026-03-08T08:00:00.000Z');
    expect(zonedMidnightUtc('America/Los_Angeles', 2026, 3, 9).toISOString()).toBe('2026-03-09T07:00:00.000Z');
    expect(tzOffsetMs('America/Los_Angeles', new Date('2026-03-08T08:00:00.000Z'))).toBe(-8 * 3_600_000);
    expect(tzOffsetMs('America/Los_Angeles', new Date('2026-03-09T07:00:00.000Z'))).toBe(-7 * 3_600_000);
  });
});
