/**
 * Create with AI — Draft + Review flow container (Milestone 3, spec §12–§13;
 * Milestone 4 multi-email sequences, spec §9).
 *
 * Owns the post-Brief flow. Single email (M3): generate the one email
 * (Phase 7), refine it, then Review and Send (Phase 8). Multi-email
 * sequence (M4, draft.sequence.count > 1): generate all sequence emails,
 * refine each one from the email list, then SequenceReview (Phase 8) —
 * one recipient pick, checks per email, one confirm-all. "Edit Brief"
 * reopens the Call to Action phase and returns to the interview.
 */

import React, { useCallback, useEffect, useState } from 'react';
import DraftEditor from './DraftEditor';
import ReviewSend from './ReviewSend';
import SequenceTimeline from './SequenceTimeline';
import SequenceReview from './SequenceReview';
import ReactionEmailsSection from './ReactionEmailsSection';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import {
  generateEmail,
  generateSequence,
  listDraftEmails,
  getReactionStatus,
  type BusinessProfile,
  type CampaignDraftState,
  type DraftEmailState,
  type ReactionRuleState,
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
  const [emails, setEmails] = useState<DraftEmailState[]>([]);
  const [reactionRules, setReactionRules] = useState<ReactionRuleState[]>([]);
  const [view, setView] = useState<'draft' | 'review'>('draft');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sequence = (draft.sequence || {}) as { count?: number };
  const isSequence = !!draft.sequence && Number(sequence.count) > 1;
  const scheduledEmails = emails.filter((e) => e.kind === 'scheduled');
  const reactionEmails = emails.filter((e) => e.kind === 'reaction');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { emails: all } = await listDraftEmails(draft.id);
      const sorted = [...all].sort((a, b) => a.order - b.order);
      setEmails(sorted);
      const first = sorted.find((e) => e.kind === 'scheduled') || null;
      setEmail(first);
      if (first && (first.status === 'scheduled' || first.status === 'sending' || first.status === 'sent')) {
        setView('review');
      }
    } catch (err) {
      toast('error', 'Could not load the draft email', extractApiError(err));
    } finally {
      setLoading(false);
    }
    // M5: reaction plan is best-effort here (older drafts have no rules).
    try {
      const status = await getReactionStatus(draft.id);
      setReactionRules(status.rules);
    } catch {
      setReactionRules([]);
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

  const handleGenerateSequence = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { emails: all } = await generateSequence(draft.id);
      const sorted = [...all].sort((a, b) => a.order - b.order);
      setEmails(sorted);
      setEmail(sorted[0] || null);
      setView('draft');
      onDraftChange({ ...draft, status: 'drafted', currentPhase: 'draft_refine' });
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-6 text-text-muted">Loading…</div>;

  // ── Multi-email sequence (M4) ──────────────────────────────────────────
  if (isSequence) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <SequenceTimeline sequence={draft.sequence as Record<string, unknown>} />

        {emails.length === 0 && (
          <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
            <p className="text-sm text-text-main">{createWithAiCopy.draft.opening}</p>
            <p className="text-sm text-text-muted">
              Your sequence is confirmed. Generate all {Number(sequence.count)} emails for this campaign — each one gets
              3 subject options, preview text, HTML + plain-text bodies, and a fact map validated by code. Later emails
              build on the earlier ones so the series reads as one story.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={handleGenerateSequence} className="btn-primary text-sm" disabled={generating}>
                {generating ? createWithAiCopy.draft.generating : `Generate all ${Number(sequence.count)} emails`}
              </button>
              <button type="button" onClick={onEditBrief} className="btn-secondary text-sm">
                Edit Brief
              </button>
            </div>
          </div>
        )}

        {emails.length > 0 && view === 'draft' && (
          <>
            <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
              <p className="text-sm font-semibold text-text-main">Emails in this sequence</p>
              <div className="flex flex-wrap gap-2">
                {scheduledEmails.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEmail(e)}
                    className={
                      email?.id === e.id
                        ? 'px-3 py-1 rounded-full bg-primary text-white text-sm font-semibold'
                        : 'px-3 py-1 rounded-full bg-surface text-text-main text-sm'
                    }
                  >
                    Email {e.order} · {e.status}
                  </button>
                ))}
              </div>
            </div>
            {email && (
              <DraftEditor email={email} profile={profile} onChanged={setEmail} onContinue={() => setView('review')} />
            )}
            <ReactionEmailsSection
              draftId={draft.id}
              rules={reactionRules}
              reactionEmails={reactionEmails}
              scheduledReady={scheduledEmails.length > 0}
              profile={profile}
              onGenerated={load}
            />
            <button type="button" onClick={() => setView('review')} className="btn-primary text-sm">
              Continue to Review and Send
            </button>
          </>
        )}

        {emails.length > 0 && view === 'review' && (
          <SequenceReview draft={draft} emails={emails} profile={profile} onBack={() => setView('draft')} />
        )}

        {emails.length > 0 && (
          <button type="button" onClick={onEditBrief} className="btn-secondary text-xs">
            Edit Brief
          </button>
        )}
      </div>
    );
  }

  // ── Single email (M3, unchanged) ───────────────────────────────────────
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
        <>
          <DraftEditor email={email} profile={profile} onChanged={setEmail} onContinue={() => setView('review')} />
          <ReactionEmailsSection
            draftId={draft.id}
            rules={reactionRules}
            reactionEmails={reactionEmails}
            scheduledReady={scheduledEmails.length > 0}
            profile={profile}
            onGenerated={load}
          />
        </>
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
