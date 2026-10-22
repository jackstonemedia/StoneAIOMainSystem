/**
 * Create with AI — Reaction emails section (Milestone 5, spec §10).
 *
 * Shows the confirmed reaction plan in plain language, generates the
 * reaction emails (Phase 7 output for send_reaction rules) once the
 * scheduled emails exist, and lets the user refine each reaction email
 * with the same DraftEditor used for scheduled emails. Reaction emails
 * are never part of the sequence picker — they fire only when their rule
 * fires, and the Phase 8 check blocks launch until every send_reaction
 * rule has a drafted reaction email.
 */

import React, { useState } from 'react';
import DraftEditor from './DraftEditor';
import { generateReactionEmails, type BusinessProfile, type DraftEmailState, type ReactionRuleState } from '../../lib/createWithAiApi';
import { extractApiError } from '../../lib/apiClient';

export default function ReactionEmailsSection({
  draftId,
  rules,
  reactionEmails,
  scheduledReady,
  profile,
  onGenerated,
}: {
  draftId: string;
  rules: ReactionRuleState[];
  reactionEmails: DraftEmailState[];
  scheduledReady: boolean;
  profile: BusinessProfile;
  onGenerated: () => void;
}) {
  const [selected, setSelected] = useState<DraftEmailState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rules.length === 0) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateReactionEmails(draftId);
      onGenerated();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3">
      <p className="text-sm font-semibold text-text-main">Reaction emails (Phase 5)</p>
      <ul className="space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="text-sm text-text-main">
            {r.readback}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!scheduledReady && (
        <p className="text-sm text-text-muted">
          Generate the scheduled emails first — reaction emails build on them.
        </p>
      )}
      {scheduledReady && reactionEmails.length === 0 && (
        <button type="button" onClick={handleGenerate} className="btn-primary text-sm" disabled={generating}>
          {generating ? 'Generating…' : 'Generate reaction emails'}
        </button>
      )}
      {reactionEmails.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {reactionEmails.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(e)}
                className={
                  selected?.id === e.id
                    ? 'px-3 py-1 rounded-full bg-primary text-white text-sm font-semibold'
                    : 'px-3 py-1 rounded-full bg-surface text-text-main text-sm'
                }
              >
                Reaction · {e.purpose || `Email ${e.order}`} · {e.status}
              </button>
            ))}
          </div>
          {selected && (
            <DraftEditor email={selected} profile={profile} onChanged={setSelected} onContinue={() => setSelected(null)} />
          )}
        </>
      )}
      <p className="text-xs text-text-muted">
        Reaction emails send only when their rule fires. A reply, booking, unsubscribe, bounce, or complaint stops the
        campaign for that contact immediately. Opens are approximate — plans lean on clicks, and machine opens never
        count as a person reading.
      </p>
    </div>
  );
}
