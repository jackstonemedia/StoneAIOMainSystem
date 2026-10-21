/**
 * Create with AI — Draft + Review flow container (Milestone 3, spec §12–§13).
 *
 * Owns the post-Brief flow: generate the single email (Phase 7), refine it,
 * then Review and Send (Phase 8). "Edit Brief" reopens the Call to Action
 * phase and returns to the interview.
 */

import React, { useCallback, useEffect, useState } from 'react';
import DraftEditor from './DraftEditor';
import ReviewSend from './ReviewSend';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import {
  generateEmail,
  listDraftEmails,
  type BusinessProfile,
  type CampaignDraftState,
  type DraftEmailState,
} from '../../lib/createWithAiApi';

export default function DraftReviewFlow({
  draft,
  profile,
  onDraftChange,
  onEditBrief,
}: {
  draft: CampaignDraftState;
  profile: BusinessProfile;
  onDraftChange: (draft: CampaignDraftState) => void;
  onEditBrief: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState<DraftEmailState | null>(null);
  const [view, setView] = useState<'draft' | 'review'>('draft');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { emails } = await listDraftEmails(draft.id);
      const first = emails[0] || null;
      setEmail(first);
      if (first && (first.status === 'scheduled' || first.status === 'sending' || first.status === 'sent')) {
        setView('review');
      }
    } catch (err) {
      toast('error', 'Could not load the draft email', extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [draft.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { email: next } = await generateEmail(draft.id);
      setEmail(next);
      setView('draft');
      onDraftChange({ ...draft, status: 'drafted', currentPhase: 'draft_refine' });
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-6 text-text-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!email && (
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
          <p className="text-sm text-text-main">{createWithAiCopy.draft.opening}</p>
          <p className="text-sm text-text-muted">
            Your Brief is confirmed. Generate the single email for this campaign — 3 subject options, preview text, HTML + plain-text
            bodies, and a fact map validated by code.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleGenerate} className="btn-primary text-sm" disabled={generating}>
              {generating ? createWithAiCopy.draft.generating : createWithAiCopy.draft.generate}
            </button>
            <button type="button" onClick={onEditBrief} className="btn-secondary text-sm">
              Edit Brief
            </button>
          </div>
        </div>
      )}

      {email && view === 'draft' && (
        <DraftEditor email={email} profile={profile} onChanged={setEmail} onContinue={() => setView('review')} />
      )}

      {email && view === 'review' && (
        <ReviewSend draft={draft} email={email} profile={profile} onBack={() => setView('draft')} />
      )}

      {email && (
        <button type="button" onClick={onEditBrief} className="btn-secondary text-xs">
          Edit Brief
        </button>
      )}
    </div>
  );
}
