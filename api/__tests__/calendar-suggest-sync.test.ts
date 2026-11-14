/**
 * Tier 2 fix 19 — Calendar shows no fake meetings; suggest uses real
 * appointments; sync status stops implying a calendar sync exists.
 *
 * The page used to render 6 hardcoded seed meetings whenever the workspace
 * had no real appointments, `generateAiScheduleSuggestion` returned canned
 * ['10:00','14:00','15:30'] regardless of the day, and
 * `getCalendarSyncStatus` reported a Gmail/Outlook *mail* connection as a
 * calendar sync. Now: an empty workspace shows an empty calendar, the
 * suggester returns only slots free against the day's real appointments,
 * and sync status reports mail connections as mail connections with an
 * explicit "no calendar sync is connected" message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCalendarSyncStatus,
  generateAiScheduleSuggestion,
} from '../services/business.service.js';

const state = {
  connections: [] as any[],
  appointments: [] as any[],
};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findMany: vi.fn().mockImplementation(() => Promise.resolve(state.connections)),
    },
    appointment: {
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        let list = state.appointments;
        if (where?.startTime) {
          const gte = where.startTime.gte ? new Date(where.startTime.gte).getTime() : -Infinity;
          const lte = where.startTime.lte ? new Date(where.startTime.lte).getTime() : Infinity;
          list = list.filter((a: any) => {
            const t = new Date(a.startTime).getTime();
            return t >= gte && t <= lte;
          });
        }
        // getAvailableSlots excludes cancelled / no-show in its query.
        if (where?.status?.notIn) {
          list = list.filter((a: any) => !where.status.notIn.includes(a.status));
        }
        return Promise.resolve([...list].sort((a: any, b: any) => +new Date(a.startTime) - +new Date(b.startTime)));
      }),
    },
  },
}));

const WS = 'ws-test';
const DAY = '2026-11-20';

function appt(startHHMM: string, endHHMM: string, status = 'scheduled') {
  // UTC times: getAvailableSlots computes its grid in UTC, matching how
  // the database stores appointment times.
  return {
    id: `apt-${startHHMM}`,
    workspaceId: WS,
    title: `Meeting ${startHHMM}`,
    startTime: new Date(`${DAY}T${startHHMM}:00.000Z`),
    endTime: new Date(`${DAY}T${endHHMM}:00.000Z`),
    status,
    contact: null,
  };
}

describe('Tier 2 fix 19 — calendar honesty', () => {
  beforeEach(() => {
    state.connections = [];
    state.appointments = [];
  });

  it('sync status: a Gmail mail connection is mail, not a calendar sync', async () => {
    state.connections = [{ provider: 'gmail', isActive: true }];
    const s = await getCalendarSyncStatus(WS);
    expect(s.hasGoogleMail).toBe(true);
    expect(s.hasGoogleCalendar).toBe(false);
    expect(s.calendarSyncConnected).toBe(false);
    expect(s.message).toMatch(/No calendar sync is connected/);
  });

  it('sync status: no connections at all is plainly no sync', async () => {
    const s = await getCalendarSyncStatus(WS);
    expect(s.hasGoogleMail).toBe(false);
    expect(s.hasOutlookMail).toBe(false);
    expect(s.hasGoogleCalendar).toBe(false);
    expect(s.hasOutlookCalendar).toBe(false);
    expect(s.calendarSyncConnected).toBe(false);
    expect(s.message).toMatch(/No calendar sync is connected/);
  });

  it('sync status: a real google_calendar connection counts as a sync', async () => {
    state.connections = [{ provider: 'google_calendar', isActive: true }];
    const s = await getCalendarSyncStatus(WS);
    expect(s.hasGoogleCalendar).toBe(true);
    expect(s.calendarSyncConnected).toBe(true);
    expect(s.message).not.toMatch(/No calendar sync/);
  });

  it('suggest: returns only slots free against real appointments', async () => {
    state.appointments = [appt('10:00', '10:45'), appt('14:00', '15:00')];
    const r = await generateAiScheduleSuggestion(WS, { date: DAY, durationMinutes: 30 });
    // The old canned answer was ['10:00','14:00','15:30'] — 10:00 and 14:00
    // collide with real bookings and must never be suggested.
    expect(r.suggestedSlots).not.toContain('10:00');
    expect(r.suggestedSlots).not.toContain('10:30');
    expect(r.suggestedSlots).not.toContain('14:00');
    expect(r.suggestedSlots).not.toContain('14:30');
    expect(r.suggestedSlots).toContain('09:00');
    expect(r.suggestedSlots).toContain('11:00');
    // Only the 3 earliest free slots are returned, so 15:00 (free but
    // later) is correctly beyond the cap.
    expect(r.suggestedSlots).toEqual(['09:00', '09:30', '11:00']);
    expect(r.suggestedSlots.length).toBeLessThanOrEqual(3);
    expect(r.date).toBe(DAY);
    expect(r.rationale).toMatch(/Free 30-minute slots on 2026-11-20, checked against the workspace's existing appointments/);
  });

  it('suggest: a cancelled appointment does not block its slot', async () => {
    state.appointments = [appt('10:00', '10:45', 'cancelled')];
    const r = await generateAiScheduleSuggestion(WS, { date: DAY, durationMinutes: 30 });
    expect(r.suggestedSlots).toContain('10:00');
  });

  it('suggest: an empty day returns the first free slots, not canned times', async () => {
    const r = await generateAiScheduleSuggestion(WS, { date: DAY, durationMinutes: 30 });
    expect(r.suggestedSlots).toEqual(['09:00', '09:30', '10:00']);
    expect(r.rationale).toMatch(/Free 30-minute slots on 2026-11-20/);
  });

  it('suggest: a fully booked day returns no slots and says so', async () => {
    // Back-to-back 30-min appointments covering 09:00–17:00.
    state.appointments = [];
    for (let h = 9; h < 17; h++) {
      state.appointments.push(appt(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`));
      state.appointments.push(appt(`${String(h).padStart(2, '0')}:30`, `${String(h + 1).padStart(2, '0')}:00`));
    }
    const r = await generateAiScheduleSuggestion(WS, { date: DAY, durationMinutes: 30 });
    expect(r.suggestedSlots).toEqual([]);
    expect(r.rationale).toMatch(/No free 30-minute slots/);
  });

  it('suggest: a 60-minute request only returns slots that fit before 17:00', async () => {
    state.appointments = [appt('09:00', '16:00')];
    const r = await generateAiScheduleSuggestion(WS, { date: DAY, durationMinutes: 60 });
    expect(r.suggestedSlots).toEqual(['16:00']);
  });
});
