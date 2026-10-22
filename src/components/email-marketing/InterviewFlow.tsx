/**
 * Create with AI — Interview flow container (Milestone 2, spec §3 + §5).
 *
 * Owns draft state: resume-or-start-new, turns, retry, escape hatch, Back,
 * recap corrections, Brief confirmation, and the profile-change prompt.
 * All interview text input is typed (or dictated into the box for review);
 * there are no clickable answer options anywhere in this flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Bot, FileText, ArrowLeft, RefreshCw, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import LiveEmailCanvas from './LiveEmailCanvas';
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
      <div className="flex-1 flex items-center justify-center p-6 w-full h-full">
        <div className="w-full max-w-xl p-7 rounded-[18px] bg-surface/50 border border-border/70 backdrop-blur-xl shadow-luxury space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 pb-3 border-b border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-main">{createWithAiCopy.flow.resume}</h3>
              <p className="text-xs text-text-muted">{createWithAiCopy.flow.resumeHint}</p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {pickList.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3.5 rounded-[12px] bg-surface/60 border border-border/60 hover:border-primary/50 transition-colors">
                <div className="min-w-0">
                  <span className="text-xs text-text-main font-semibold block truncate">
                    Campaign Draft ({new Date(d.expiresAt).toLocaleDateString()})
                  </span>
                  <span className="text-[11px] text-text-muted">Current Stage: Phase {d.currentPhase}</span>
                </div>
                <button type="button" onClick={() => setDraft(d)} className="btn-primary text-xs shrink-0 cursor-pointer">
                  Resume
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-text-muted">{createWithAiCopy.flow.startNewHint}</span>
            <button type="button" onClick={startNew} className="btn-secondary text-xs cursor-pointer">
              {createWithAiCopy.flow.startNew}
            </button>
          </div>
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
      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 w-full h-full">
        {/* Left Pane: AI Strategist & Campaign Strategy Blueprint */}
        <div className="w-[42%] min-w-[380px] max-w-[500px] flex flex-col h-full bg-surface/30 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-border/50 bg-surface/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-primary p-0.5 shadow-interactive">
                <div className="w-full h-full bg-bg rounded-full flex items-center justify-center text-primary">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">AI Campaign Copilot</h3>
                <p className="text-[11px] text-text-muted">Draft & Polish Stage</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Draft Ready
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-4 rounded-[12px] bg-surface/40 border border-border/60 shadow-sm space-y-2">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Confirmed Campaign Brief</span>
              </h4>
              <p className="text-xs text-text-main leading-relaxed whitespace-pre-line">
                {typeof (draft.brief as any)?.text === 'string'
                  ? (draft.brief as any).text
                  : 'Campaign brief synthesized from your interview answers.'}
              </p>
            </div>

            <div className="p-4 rounded-[12px] bg-primary/5 border border-primary/20 space-y-2">
              <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>AI Copywriter Insights</span>
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Your draft was created using your confirmed business profile and tone. Use the editor on the right to tweak copy, test subject lines, or send a test email.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleEditBrief}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border bg-surface-hover hover:bg-surface rounded-[10px] text-xs font-semibold text-text-main transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Campaign Brief (Reopen Interview)</span>
              </button>

              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border bg-surface/50 hover:bg-surface-hover rounded-[10px] text-xs font-medium text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <span>Edit Business Profile Details</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: DraftReviewFlow */}
        <div className="flex-1 flex flex-col h-full bg-surface/20 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-6">
            <DraftReviewFlow draft={draft} profile={profile} onDraftChange={setDraft} onEditBrief={handleEditBrief} />
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

  // Phase transition entries (Sequence, Reactions, A/B testing)
  if (needsSequenceEntry || needsReactionsEntry || needsAbEntry) {
    const isSeq = needsSequenceEntry;
    const isReact = needsReactionsEntry;
    const phaseNum = isSeq ? 4 : isReact ? 5 : 6;
    const phaseTitle = isSeq
      ? 'Phase 4 of 8: Sequence and Timing'
      : isReact
      ? 'Phase 5 of 8: Reactions'
      : 'Phase 6 of 8: A/B Testing';
    const phaseDesc = isSeq
      ? 'Your Brief is confirmed. Now decide how many emails go out, over how many days, and what each email is for.'
      : isReact
      ? 'Your sequence is planned. Now decide what happens after each email goes out — who gets a follow-up, and when.'
      : 'Your reactions are planned. Now decide whether to test two subject variations to see which gets higher open rates.';
    const actionBtn = isSeq
      ? { label: 'Continue to Sequence and Timing', fn: handleStartSequence }
      : isReact
      ? { label: 'Continue to Reactions', fn: handleStartReactions }
      : { label: 'Continue to A/B Testing', fn: handleStartAbTesting };

    return (
      <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 w-full h-full">
        {/* Left Pane: Phase Transition Card */}
        <div className="w-[44%] min-w-[420px] max-w-[560px] flex flex-col h-full bg-surface/30 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-border/50 bg-surface/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-primary p-0.5 shadow-interactive">
                <div className="w-full h-full bg-bg rounded-full flex items-center justify-center text-primary">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">Stone AI Strategist</h3>
                <p className="text-[11px] text-text-muted">Campaign Progression</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-primary px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              Phase {phaseNum} of 8
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center space-y-6">
            <div className="p-6 rounded-[16px] bg-gradient-to-br from-surface/80 via-surface/60 to-primary/10 border border-primary/30 shadow-luxury space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/15 text-primary text-xs font-bold rounded-full">
                <Layers className="w-3.5 h-3.5" />
                <span>{phaseTitle}</span>
              </div>

              <h3 className="text-lg font-bold text-text-main leading-snug">
                Ready for the Next Strategic Step
              </h3>

              <p className="text-xs text-text-muted leading-relaxed">
                {phaseDesc}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={actionBtn.fn}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-xs font-bold shadow-interactive transition-all cursor-pointer"
                >
                  <span>{actionBtn.label}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleEditBrief}
                  className="px-4 py-2.5 border border-border bg-surface-hover hover:bg-surface rounded-[10px] text-xs font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  Edit Brief
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Live Email Canvas */}
        <div className="flex-1 flex flex-col h-full bg-surface/20 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden min-w-0">
          <LiveEmailCanvas draft={draft} profile={profile} />
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

  // Active Interview (Phases 1-6) Two-Pane Studio
  return (
    <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 w-full h-full">
      {/* Left Pane: AI Chat Studio (~44% width) */}
      <div className="w-[44%] min-w-[420px] max-w-[560px] flex flex-col h-full bg-surface/30 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden shrink-0">
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
      </div>

      {/* Right Pane: Live Email Canvas (~56% width) */}
      <div className="flex-1 flex flex-col h-full bg-surface/20 backdrop-blur-md border border-border/50 rounded-[16px] shadow-luxury overflow-hidden min-w-0">
        <LiveEmailCanvas draft={draft} profile={profile} />
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
