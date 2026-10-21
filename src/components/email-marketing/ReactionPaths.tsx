/**
 * Create with AI — Reaction paths view (Milestone 5, spec §10 + §13).
 *
 * Lives inside SequenceReview's launched view (and the single-email
 * review view via ReviewSend's parent when applicable). Shows:
 * - the confirmed reaction plan in plain language,
 * - each contact's live path (status, rules fired, pending reaction send),
 * - the path simulator: the same 7 scenarios run through the same rules
 *   the live tick uses, so the preview matches live behavior.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  getReactionStatus,
  getPathSimulator,
  type DraftEmailState,
  type PathScenarioState,
  type ReactionStatusState,
} from '../../lib/createWithAiApi';
import { extractApiError } from '../../lib/apiClient';

const SCENARIO_LABELS: Record<string, string> = {
  did_not_open: 'Did not open',
  opened_no_click: 'Opened but did not click',
  clicked: 'Clicked',
  clicked_link: 'Clicked a specific link',
  clicked_not_replied: 'Clicked but did not reply',
  replied: 'Replied',
  bounced: 'Bounced',
};

export default function ReactionPaths({ draftId, emails }: { draftId: string; emails: DraftEmailState[] }) {
  const [status, setStatus] = useState<ReactionStatusState | null>(null);
  const [scenarios, setScenarios] = useState<PathScenarioState[]>([]);
  const [picked, setPicked] = useState<string>('clicked');
  const [error, setError] = useState<string | null>(null);

  const anchor = emails.find((e) => e.kind === 'scheduled') || emails[0];

  const load = useCallback(async () => {
    try {
      const s = await getReactionStatus(draftId);
      setStatus(s);
    } catch (err) {
      setError(extractApiError(err));
    }
    if (anchor) {
      try {
        const sim = await getPathSimulator(anchor.id);
        setScenarios(sim.scenarios);
        if (sim.scenarios.length > 0) setPicked(sim.scenarios[0].scenario);
      } catch {
        // Simulator is best-effort; the live paths above are the record.
      }
    }
  }, [draftId, anchor?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!status || status.rules.length === 0) return null;
  const current = scenarios.find((s) => s.scenario === picked) || scenarios[0];

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3">
      <p className="text-sm font-semibold text-text-main">Reaction paths (Phase 5)</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="space-y-1">
        {status.rules.map((r) => (
          <li key={r.id} className="text-sm text-text-main">
            {r.readback}
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <p className="text-sm font-semibold text-text-main">Live paths</p>
        {status.states.map((s) => (
          <div key={s.contactId} className="text-sm">
            <span className="text-text-main">{s.email || s.contactId}</span>
            <span className="text-text-muted">
              {' '}
              · {s.status}
              {s.rulesFired.length > 0 ? ` · rules fired: ${s.rulesFired.length}` : ''}
              {s.reactionPending ? ` · reaction queued for ${new Date(String((s.reactionPending as { sendAt?: string }).sendAt || '')).toLocaleString()}` : ''}
            </span>
          </div>
        ))}
        {status.states.length === 0 && (
          <p className="text-sm text-text-muted">No recipients enrolled yet — paths appear once Email 1 sends.</p>
        )}
      </div>
      {scenarios.length > 0 && current && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-main">Path simulator — see what happens for one contact</p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s) => (
              <button
                key={s.scenario}
                type="button"
                onClick={() => setPicked(s.scenario)}
                className={
                  picked === s.scenario
                    ? 'px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold'
                    : 'px-3 py-1 rounded-full bg-surface text-text-main text-xs'
                }
              >
                {SCENARIO_LABELS[s.scenario] || s.scenario}
              </button>
            ))}
          </div>
          <ol className="space-y-1">
            {current.steps.map((step, i) => (
              <li key={i} className="text-sm text-text-main">
                {new Date(step.at).toLocaleString()} — {step.what}
              </li>
            ))}
          </ol>
          <p className="text-sm text-text-muted">Final state: {current.finalState}</p>
          <p className="text-xs text-text-muted">
            The simulator runs the same rules as the live tick. Unsubscribe exits behave like replied; booked exits
            behave like replied when an appointment is recorded. Complaints have no Gmail equivalent — see the
            campaign notes for that gap.
          </p>
        </div>
      )}
      <button type="button" onClick={load} className="btn-secondary text-xs">
        Refresh paths
      </button>
    </div>
  );
}
