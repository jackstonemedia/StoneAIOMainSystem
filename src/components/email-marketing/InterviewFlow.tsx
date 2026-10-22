/**
 * Create with AI — Interview flow container (Milestone 2, spec §3 + §5).
 *
 * Owns draft state: resume-or-start-new, turns, retry, escape hatch, Back,
 * recap corrections, Brief confirmation, and the profile-change prompt.
 * All interview text input is typed (or dictated into the box for review);
 * there are no clickable answer options anywhere in this flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InterviewChat from './InterviewChat';
import DraftReviewFlow from './DraftReviewFlow';
import ProfileSidePanel from './ProfileSidePanel';
import { profileToFormValues, type ProfileFormValues } from './ProfileForm';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import {
  createDraft,
  listDrafts,
  getDraft,
  sendTurn,
  retryTurn,
  escapeHatch,
  reopenPhase,
  confirmBrief,
  startSequence,
  startReactions,
  confirmReactions,
  startAbTesting,
  confirmPlan,
  updateDraftSnapshot,
  type CampaignDraftState,
  type InterviewPhase,
  type BusinessProfile,
} from '../../lib/createWithAiApi';

const PHASE_ORDER: InterviewPhase[] = ['goal', 'audience', 'cta', 'sequence', 'reactions', 'ab_testing'];

function pickExample(pool: string[], key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return pool[h % pool.length];
}

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, SpeechRecognitionCtor | undefined>;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function InterviewFlow({
  profile,
  onSaveProfile,
  saving,
  serverErrors,
}: {
  profile: BusinessProfile;
  onSaveProfile: (values: ProfileFormValues) => Promise<void>;
  saving: boolean;
  serverErrors?: Record<string, string>;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<CampaignDraftState | null>(null);
  const [pickList, setPickList] = useState<CampaignDraftState[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  // Guards the auto-create against React StrictMode's double-effect in dev:
  // without it, two concurrent loads both see an empty list and create a
  // blank draft each, leaving a stray duplicate.
  const autoCreateRef = useRef(false);

  const micSupported = useMemo(() => getSpeechRecognition() !== null, []);
  const examplePlaceholder = useMemo(() => {
    if (!draft || draft.currentPhase === 'brief_confirm' || draft.currentPhase === 'reactions_confirm') return '';
    if (!PHASE_ORDER.includes(draft.currentPhase as InterviewPhase)) return '';
    return pickExample(createWithAiCopy.interview.examplePools[draft.currentPhase as InterviewPhase], `${draft.id}:${draft.currentPhase}`);
  }, [draft]);

  const loadPick = useCallback(async () => {
    setLoading(true);
    try {
      const { drafts } = await listDrafts();
      if (drafts.length === 0) {
        if (autoCreateRef.current) return;
        autoCreateRef.current = true;
        try {
          const { draft: fresh } = await createDraft();
          setDraft(fresh);
          setPickList(null);
        } catch (err) {
          autoCreateRef.current = false;
          throw err;
        }
      } else {
        setPickList(drafts);
      }
    } catch (err) {
      toast('error', 'Could not load drafts', extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPick();
  }, [loadPick]);

  const profileChanged = useMemo(() => {
    if (!draft) return false;
    const snapUpdated = (draft.profileSnapshot as { updatedAt?: string }).updatedAt;
    if (!snapUpdated) return false;
    if (new Date(profile.updatedAt).getTime() <= new Date(snapUpdated).getTime()) return false;
    if (draft.profileNotedAt && new Date(profile.updatedAt).getTime() <= new Date(draft.profileNotedAt).getTime()) return false;
    return true;
  }, [draft, profile]);

  const handleSend = async () => {
    if (!draft || !input.trim() || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const result = await sendTurn(draft.id, input.trim());
      setDraft(result.draft);
      setInput('');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic;
      setAiError(msg);
      // The answer IS saved server-side even on AI failure: refresh so it
      // shows in the conversation, clear the box, and let Retry re-run it
      // (re-sending the same text would duplicate the saved answer).
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async () => {
    if (!draft || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const result = await retryTurn(draft.id);
      setDraft(result.draft);
      setInput('');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
    } finally {
      setSending(false);
    }
  };

  const handleEscapeHatch = async () => {
    if (!draft || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const { draft: next } = await escapeHatch(draft.id);
      setDraft(next);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
    } finally {
      setSending(false);
    }
  };

  const handleBack = async () => {
    if (!draft || sending) return;
    const idx = PHASE_ORDER.indexOf(draft.currentPhase as InterviewPhase);
    const finished = PHASE_ORDER.filter((p, i) => {
      if (draft.currentPhase === 'brief_confirm') return true;
      return i < idx;
    });
    const target = finished[finished.length - 1];
    if (!target) return;
    setSending(true);
    try {
      const { draft: next } = await reopenPhase(draft.id, target);
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not go back', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleCorrectRecap = async (phase: InterviewPhase) => {
    if (!draft || sending) return;
    setSending(true);
    try {
      const { draft: next } = await reopenPhase(draft.id, phase);
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not reopen that phase', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleConfirmBrief = async (text: string) => {
    if (!draft || !text.trim() || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const result = await confirmBrief(draft.id, text.trim());
      setDraft(result.draft);
      setInput('');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
      // A correction is saved before the turn runs; refresh so it shows.
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmReactions = async (text: string) => {
    if (!draft || !text.trim() || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const result = await confirmReactions(draft.id, text.trim());
      setDraft(result.draft);
      setInput('');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleSnapshot = async (action: 'regenerate' | 'keep') => {
    if (!draft) return;
    try {
      const { draft: next } = await updateDraftSnapshot(draft.id, action);
      setDraft(next);
      setPanelOpen(false);
    } catch (err) {
      toast('error', 'Could not update the draft snapshot', extractApiError(err));
    }
  };

  const handleMic = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const startNew = async () => {
    setLoading(true);
    try {
      const { draft: fresh } = await createDraft();
      setDraft(fresh);
      setPickList(null);
      setInput('');
      setAiError(null);
    } catch (err) {
      toast('error', 'Could not start a new campaign', extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-text-muted">Loading…</div>;

  if (pickList && !draft) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3">
        <p className="text-sm font-semibold text-text-main">{createWithAiCopy.flow.resume}</p>
        <p className="text-sm text-text-muted">{createWithAiCopy.flow.resumeHint}</p>
        {pickList.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-3">
            <div className="text-sm">
              <span className="text-text-main font-medium">Draft from {new Date(d.expiresAt).toLocaleDateString()}</span>
              <span className="text-text-muted"> · Phase {d.currentPhase}</span>
            </div>
            <button type="button" onClick={() => setDraft(d)} className="btn-primary text-xs">
              Resume
            </button>
          </div>
        ))}
        <div className="pt-1">
          <p className="text-xs text-text-muted mb-2">{createWithAiCopy.flow.startNewHint}</p>
          <button type="button" onClick={startNew} className="btn-secondary text-xs">
            {createWithAiCopy.flow.startNew}
          </button>
        </div>
      </div>
    );
  }

  if (!draft) return <div className="p-6 text-text-muted">No draft available.</div>;

  // Past the interview (Reactions confirmed onward): Phase 7 Draft +
  // Phase 8 Review live in DraftReviewFlow. "Edit Brief" reopens Call to
  // Action. M5: a sequence_confirmed draft WITHOUT reactions confirmed
  // stops at the Phase 5 entry card below (the user must plan reactions
  // first; the Phase 5 escape hatch assembles from what they have).
  const hasSequence =
    !!draft.sequence &&
    typeof draft.sequence === 'object' &&
    Number((draft.sequence as Record<string, unknown>).count) > 0;
  const reactionsDone =
    draft.status === 'reactions_confirmed' ||
    draft.status === 'drafted' ||
    draft.status === 'scheduled' ||
    draft.currentPhase === 'draft_refine' ||
    draft.currentPhase === 'review_send';
  const abDone =
    draft.status === 'ab_confirmed' ||
    draft.status === 'drafted' ||
    draft.status === 'scheduled' ||
    draft.currentPhase === 'draft_refine' ||
    draft.currentPhase === 'review_send';
  const pastInterview = abDone;
  const needsSequenceEntry = draft.status === 'brief_confirmed' && !hasSequence;
  const needsReactionsEntry =
    !reactionsDone && (draft.status === 'sequence_confirmed' || (draft.status === 'brief_confirmed' && hasSequence));
  const needsAbEntry = !abDone && draft.status === 'reactions_confirmed';

  const handleStartSequence = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { draft: next } = await startSequence(draft.id);
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not start Sequence and Timing', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleStartAbTesting = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { draft: next } = await startAbTesting(draft.id);
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not start A/B Testing', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleConfirmPlan = async (text: string) => {
    if (!draft || !text.trim() || sending) return;
    setSending(true);
    setAiError(null);
    try {
      const result = await confirmPlan(draft.id, text.trim());
      setDraft(result.draft);
      setInput('');
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleStartReactions = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { draft: next } = await startReactions(draft.id);
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not start Reactions', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  const handleEditBrief = async () => {
    if (sending) return;
    setSending(true);
    try {
      const { draft: next } = await reopenPhase(draft.id, 'cta');
      setDraft(next);
    } catch (err) {
      toast('error', 'Could not reopen the Brief', extractApiError(err));
    } finally {
      setSending(false);
    }
  };

  if (pastInterview) {
    return (
      <div className="space-y-4">
        <DraftReviewFlow draft={draft} profile={profile} onDraftChange={setDraft} onEditBrief={handleEditBrief} />
        <ProfileSidePanel
          open={panelOpen}
          profile={profile}
          onClose={() => setPanelOpen(false)}
          onSave={onSaveProfile}
          saving={saving}
          serverErrors={serverErrors}
          inProgress
          onRegenerate={() => handleSnapshot('regenerate')}
          onKeep={() => handleSnapshot('keep')}
        />
      </div>
    );
  }

  // M4 Phase 4 entry card: the Brief is confirmed but no sequence exists
  // yet. One action only — start the sequence interview. There is no
  // "skip Phase 4" fork: answering "one email" in Phase 4 keeps the
  // single-email flow (M3 behavior).
  if (needsSequenceEntry) {
    return (
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
          <p className="text-sm font-semibold text-text-main">Phase 4 of 8: Sequence and Timing</p>
          <p className="text-sm text-text-main">{createWithAiCopy.flow.comingNext}</p>
          <p className="text-sm text-text-muted">
            Answer in your own words — how many emails, over how many days, and what each one is for. If one email is
            enough, say so and this campaign stays a single email.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleStartSequence} className="btn-primary text-sm" disabled={sending}>
              Continue to Sequence and Timing
            </button>
            <button type="button" onClick={handleEditBrief} className="btn-secondary text-sm">
              Edit Brief
            </button>
          </div>
        </div>
        <ProfileSidePanel
          open={panelOpen}
          profile={profile}
          onClose={() => setPanelOpen(false)}
          onSave={onSaveProfile}
          saving={saving}
          serverErrors={serverErrors}
          inProgress
          onRegenerate={() => handleSnapshot('regenerate')}
          onKeep={() => handleSnapshot('keep')}
        />
      </div>
    );
  }

  // M5 Phase 5 entry card: the sequence is planned but reactions are not
  // yet. One action only — start the reactions interview. There is no
  // "skip Phase 5" fork: the Phase 5 escape hatch assembles a plan from
  // whatever the user has said (skipping anything unanswered, and saying
  // so in the readback).
  if (needsReactionsEntry) {
    return (
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
          <p className="text-sm font-semibold text-text-main">Phase 5 of 8: Reactions</p>
          <p className="text-sm text-text-main">
            Your sequence is planned. Now decide what happens after each email goes out — who gets a follow-up, who
            gets a different email, and when you want to hear about it.
          </p>
          <p className="text-sm text-text-muted">
            Answer in your own words. Opens are approximate, so the plan leans on clicks — and a machine-opened email
            is never treated as if a person read it.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleStartReactions} className="btn-primary text-sm" disabled={sending}>
              Continue to Reactions
            </button>
            <button type="button" onClick={handleEditBrief} className="btn-secondary text-sm">
              Edit Brief
            </button>
          </div>
        </div>
        <ProfileSidePanel
          open={panelOpen}
          profile={profile}
          onClose={() => setPanelOpen(false)}
          onSave={onSaveProfile}
          saving={saving}
          serverErrors={serverErrors}
          inProgress
          onRegenerate={() => handleSnapshot('regenerate')}
          onKeep={() => handleSnapshot('keep')}
        />
      </div>
    );
  }

  // M6 Phase 6 entry card: reactions are confirmed but the plan is not
  // yet. One action only — start the A/B testing interview. There is no
  // "skip Phase 6" fork: answering "no test" in Phase 6 is itself a valid
  // plan (B4a), and the Phase 6 escape hatch locks a plan from whatever
  // the user has said.
  if (needsAbEntry) {
    return (
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
          <p className="text-sm font-semibold text-text-main">Phase 6 of 8: A/B Testing</p>
          <p className="text-sm text-text-main">
            Your reactions are planned. Now decide whether to test two versions of something — and which one wins.
          </p>
          <p className="text-sm text-text-muted">
            An A/B test sends two versions of one part of an email to two small groups, sees which gets more clicks,
            then sends the better one to everyone else. With a small list, skipping the test is the right call.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleStartAbTesting} className="btn-primary text-sm" disabled={sending}>
              Continue to A/B Testing
            </button>
            <button type="button" onClick={handleEditBrief} className="btn-secondary text-sm">
              Edit Brief
            </button>
          </div>
        </div>
        <ProfileSidePanel
          open={panelOpen}
          profile={profile}
          onClose={() => setPanelOpen(false)}
          onSave={onSaveProfile}
          saving={saving}
          serverErrors={serverErrors}
          inProgress
          onRegenerate={() => handleSnapshot('regenerate')}
          onKeep={() => handleSnapshot('keep')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InterviewChat
        draft={draft}
        input={input}
        onInputChange={setInput}
        sending={sending}
        aiError={aiError}
        examplePlaceholder={examplePlaceholder}
        micSupported={micSupported}
        listening={listening}
        onMic={handleMic}
        onSend={handleSend}
        onRetry={handleRetry}
        onBack={handleBack}
        onEditProfile={() => setPanelOpen(true)}
        onEscapeHatch={handleEscapeHatch}
        onCorrectRecap={handleCorrectRecap}
        onConfirmBrief={handleConfirmBrief}
        onConfirmReactions={handleConfirmReactions}
        onConfirmPlan={handleConfirmPlan}
        profileChanged={profileChanged}
        onRegenerateProfile={() => handleSnapshot('regenerate')}
        onKeepProfile={() => handleSnapshot('keep')}
        onStartNew={startNew}
      />
      <ProfileSidePanel
        open={panelOpen}
        profile={profile}
        onClose={() => setPanelOpen(false)}
        onSave={onSaveProfile}
        saving={saving}
        serverErrors={serverErrors}
        inProgress
        onRegenerate={() => handleSnapshot('regenerate')}
        onKeep={() => handleSnapshot('keep')}
      />
    </div>
  );
}
