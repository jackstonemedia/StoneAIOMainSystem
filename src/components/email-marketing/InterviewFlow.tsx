/**
 * Create with AI — Interview flow container (Milestone 2, spec §3 + §5).
 *
 * Owns draft state: resume-or-start-new, turns, retry, escape hatch, Back,
 * recap corrections, Brief confirmation, and the profile-change prompt.
 * All interview text input is typed (or dictated into the box for review);
 * there are no clickable answer options anywhere in this flow.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ArrowLeft, RefreshCw, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import LiveEmailCanvas from './LiveEmailCanvas';
import InterviewChat from './InterviewChat';
import DraftReviewFlow from './DraftReviewFlow';
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
  type ChatMessageState,
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
    const textToSend = input.trim();
    setInput('');
    setSending(true);
    setAiError(null);

    // Optimistically update conversation so message appears instantly
    const optimisticMessage: ChatMessageState = {
      role: 'user',
      text: textToSend,
      at: new Date().toISOString(),
      kind: 'answer',
      phase: draft.currentPhase,
    };
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            conversation: [...prev.conversation, optimisticMessage],
          }
        : prev
    );

    try {
      const result = await sendTurn(draft.id, textToSend);
      setDraft(result.draft);
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
    const textToSend = text.trim();
    setInput('');
    setSending(true);
    setAiError(null);

    const optimisticMessage: ChatMessageState = {
      role: 'user',
      text: textToSend,
      at: new Date().toISOString(),
      kind: 'answer',
      phase: draft.currentPhase,
    };
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            conversation: [...prev.conversation, optimisticMessage],
          }
        : prev
    );

    try {
      const result = await confirmBrief(draft.id, textToSend);
      setDraft(result.draft);
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
    } finally {
      setSending(false);
    }
  };

  const handleConfirmReactions = async (text: string) => {
    if (!draft || !text.trim() || sending) return;
    const textToSend = text.trim();
    setInput('');
    setSending(true);
    setAiError(null);

    const optimisticMessage: ChatMessageState = {
      role: 'user',
      text: textToSend,
      at: new Date().toISOString(),
      kind: 'answer',
      phase: draft.currentPhase,
    };
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            conversation: [...prev.conversation, optimisticMessage],
          }
        : prev
    );

    try {
      const result = await confirmReactions(draft.id, textToSend);
      setDraft(result.draft);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
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
            <div className="w-9 h-9 rounded-lg bg-surface border border-border/60 flex items-center justify-center text-text-muted">
              <FileText className="w-4 h-4" />
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
    const textToSend = text.trim();
    setInput('');
    setSending(true);
    setAiError(null);

    const optimisticMessage: ChatMessageState = {
      role: 'user',
      text: textToSend,
      at: new Date().toISOString(),
      kind: 'answer',
      phase: draft.currentPhase,
    };
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            conversation: [...prev.conversation, optimisticMessage],
          }
        : prev
    );

    try {
      const result = await confirmPlan(draft.id, textToSend);
      setDraft(result.draft);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAiError(e?.response?.data?.error || e?.message || createWithAiCopy.errors.generic);
      try {
        const { draft: fresh } = await getDraft(draft.id);
        setDraft(fresh);
      } catch {
        // Keep the stale draft; Retry will surface the server state.
      }
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
      <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full divide-x divide-border/60">
        {/* Left Pane: Confirmed Brief & Settings */}
        <div className="w-[420px] xl:w-[460px] shrink-0 flex flex-col h-full bg-surface/20 min-h-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50 bg-surface/40 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-bold text-text-main uppercase tracking-wide">Campaign Brief</h3>
              <p className="text-[11px] text-text-muted">Draft & Polish Stage</p>
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

            <div className="p-4 rounded-[12px] bg-surface/30 border border-border/50 space-y-1.5">
              <h4 className="text-xs font-bold text-text-main">Campaign Insights</h4>
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
            </div>
          </div>
        </div>

        {/* Right Pane: DraftReviewFlow */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-surface/10 min-h-0 overflow-y-auto p-6 sm:p-8">
          <DraftReviewFlow draft={draft} profile={profile} onDraftChange={setDraft} onEditBrief={handleEditBrief} />
        </div>
      </div>
    );
  }

  // Active Unified Copywriter Flow: Discovery Big Chat vs Two-Pane Studio
  const isStudioMode = Boolean(draft.brief?.liveEmail);

  if (!isStudioMode) {
    return (
      <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full bg-surface/10">
        <div className="w-full flex flex-col h-full bg-surface/20 min-h-0 overflow-hidden">
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
            onEditProfile={() => {}}
            onEscapeHatch={handleEscapeHatch}
            onCorrectRecap={handleCorrectRecap}
            onConfirmBrief={handleConfirmBrief}
            onConfirmReactions={handleConfirmReactions}
            onConfirmPlan={handleConfirmPlan}
            profileChanged={false}
            onRegenerateProfile={() => {}}
            onKeepProfile={() => {}}
            onStartNew={startNew}
            isBigChat={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full divide-x divide-border/60">
      {/* Left Pane: Chat Studio */}
      <div className="w-[440px] xl:w-[480px] shrink-0 flex flex-col h-full bg-surface/20 min-h-0 overflow-hidden">
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
          onEditProfile={() => {}}
          onEscapeHatch={handleEscapeHatch}
          onCorrectRecap={handleCorrectRecap}
          onConfirmBrief={handleConfirmBrief}
          onConfirmReactions={handleConfirmReactions}
          onConfirmPlan={handleConfirmPlan}
          profileChanged={false}
          onRegenerateProfile={() => {}}
          onKeepProfile={() => {}}
          onStartNew={startNew}
          isBigChat={false}
        />
      </div>

      {/* Right Pane: Live Email Canvas */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-surface/10 min-h-0 overflow-hidden">
        <LiveEmailCanvas draft={draft} isGenerating={sending} />
      </div>
    </div>
  );
}
