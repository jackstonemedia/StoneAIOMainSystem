/**
 * Create with AI — Sequence timeline (Milestone 4, spec §9).
 *
 * Presentational only: renders the confirmed sequence plan — each email's
 * purpose and offset, the planned start, the deadline, and the per-person
 * timing note. Later emails are timed from when EACH recipient got Email 1,
 * not from one campaign clock, so the dates shown are the plan for a
 * recipient whose Email 1 goes out at the start.
 */

import React from 'react';

type SequenceEmail = { order: number; offsetDays: number; purpose: string };

function plannedDate(startUtc: string | null, offsetDays: number, timeZone: string): string | null {
  if (!startUtc) return null;
  try {
    const d = new Date(new Date(startUtc).getTime() + offsetDays * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  } catch {
    return null;
  }
}

export default function SequenceTimeline({ sequence }: { sequence: Record<string, unknown> }) {
  const emails = (Array.isArray(sequence.emails) ? sequence.emails : []) as SequenceEmail[];
  const count = Number(sequence.count || emails.length || 0);
  // ValidatedSequence field names (sequence.service.ts): startUtc,
  // deadlineUtc, sendWindow — not start/deadline/window.
  const window = (sequence.sendWindow || {}) as { timeZone?: string; startHour?: number; endHour?: number };
  const timeZone = String(window.timeZone || 'UTC');
  const start = typeof sequence.startUtc === 'string' ? sequence.startUtc : null;
  const deadline = typeof sequence.deadlineUtc === 'string' ? sequence.deadlineUtc : null;
  const compressed = sequence.compressed === true;
  const compressionNote = typeof sequence.compressionNote === 'string' ? sequence.compressionNote : null;

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3" data-testid="sequence-timeline">
      <p className="text-sm font-semibold text-text-main">Sequence timeline — {count} email{count === 1 ? '' : 's'}</p>
      <ol className="space-y-2">
        {emails.map((e) => {
          const date = plannedDate(start, e.offsetDays, timeZone);
          return (
            <li key={e.order} className="text-sm text-text-main">
              <span className="font-semibold">Email {e.order}</span>
              {e.purpose ? <span> — {e.purpose}</span> : null}
              <span className="text-text-muted">
                {' '}· Day +{e.offsetDays}
                {date ? ` (planned ${date})` : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-text-muted">
        Timing is per person: each recipient's later emails are timed from when THEY got Email 1, not from one campaign
        clock. Sends happen weekdays {window.startHour ?? 8}:00–{window.endHour ?? 17}:00 in the business time zone.
      </p>
      {compressed && compressionNote && (
        <p className="text-sm text-amber-400">Compressed to fit the deadline: {compressionNote}</p>
      )}
      {deadline && (
        <p className="text-sm text-text-muted">
          Deadline: nothing sends after {plannedDate(deadline, 0, timeZone) || deadline}.
        </p>
      )}
    </div>
  );
}
