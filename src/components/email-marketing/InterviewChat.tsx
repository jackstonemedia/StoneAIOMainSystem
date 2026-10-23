import React, { useEffect, useRef } from 'react';
import { 
  Sparkles,
  RotateCcw, Check
} from 'lucide-react';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import type { CampaignDraftState, ChatMessageState, InterviewPhase } from '../../lib/createWithAiApi';

const PHASE_ORDER: InterviewPhase[] = ['goal', 'audience', 'cta', 'sequence', 'reactions', 'ab_testing'];
const PHASE_NUMBERS: Record<InterviewPhase, number> = { goal: 1, audience: 2, cta: 3, sequence: 4, reactions: 5, ab_testing: 6 };
const PHASE_NAMES: Record<InterviewPhase, string> = {
  goal: 'Goal',
  audience: 'Audience',
  cta: 'Call to Action',
  sequence: 'Sequence and Timing',
  reactions: 'Reactions',
  ab_testing: 'A/B Testing',
};

export function phaseIndex(draft: CampaignDraftState): number {
  if (draft.currentPhase === 'brief_confirm') return 3;
  if (draft.currentPhase === 'sequence') return 3;
  if (draft.currentPhase === 'sequence_confirmed') return 4;
  if (draft.currentPhase === 'reactions' || draft.currentPhase === 'reactions_confirm') return 4;
  if (draft.currentPhase === 'reactions_confirmed') return 5;
  if (draft.currentPhase === 'ab_testing' || draft.currentPhase === 'ab_confirm') return 5;
  if (draft.currentPhase === 'ab_confirmed') return 6;
  if (draft.currentPhase === 'draft_refine') return 6;
  if (draft.currentPhase === 'review_send') return 7;
  return PHASE_ORDER.indexOf(draft.currentPhase as InterviewPhase);
}

export default function InterviewChat({
  draft,
  input,
  onInputChange,
  sending,
  aiError,
  examplePlaceholder,
  micSupported,
  listening,
  onMic,
  onSend,
  onRetry,
  onBack,
  onEditProfile,
  onEscapeHatch,
  onCorrectRecap,
  onConfirmBrief,
  onConfirmReactions,
  onConfirmPlan,
  profileChanged,
  onRegenerateProfile,
  onKeepProfile,
  onStartNew,
  isBigChat = false,
}: {
  draft: CampaignDraftState;
  input: string;
  onInputChange: (v: string) => void;
  sending: boolean;
  aiError: string | null;
  examplePlaceholder: string;
  micSupported: boolean;
  listening: boolean;
  onMic: () => void;
  onSend: () => void;
  onRetry: () => void;
  onBack: () => void;
  onEditProfile: () => void;
  onEscapeHatch: () => void;
  onCorrectRecap: (phase: InterviewPhase) => void;
  onConfirmBrief: (text: string) => void;
  onConfirmReactions: (text: string) => void;
  onConfirmPlan: (text: string) => void;
  profileChanged: boolean;
  onRegenerateProfile: () => void;
  onKeepProfile: () => void;
  onStartNew: () => void;
  isBigChat?: boolean;
}) {
  const copy = createWithAiCopy.interview;
  const phases = createWithAiCopy.flow.phases;
  const currentIdx = phaseIndex(draft);
  const briefConfirmed = draft.status === 'brief_confirmed';
  const inBriefConfirm = draft.currentPhase === 'brief_confirm' && !briefConfirmed;
  const inReactionsConfirm = draft.currentPhase === 'reactions_confirm' && draft.status !== 'reactions_confirmed';
  const inAbConfirm = draft.currentPhase === 'ab_confirm' && draft.status !== 'ab_confirmed';
  const currentPhase =
    draft.currentPhase === 'brief_confirm' || draft.currentPhase === 'sequence_confirmed' || draft.currentPhase === 'reactions_confirm' || draft.currentPhase === 'reactions_confirmed' || draft.currentPhase === 'ab_confirm' || draft.currentPhase === 'ab_confirmed' || draft.currentPhase === 'draft_refine' || draft.currentPhase === 'review_send'
      ? null
      : (draft.currentPhase as InterviewPhase);
  const userAnswersInPhase = currentPhase
    ? draft.conversation.filter((m) => m.role === 'user' && m.phase === currentPhase).length
    : 0;
  const finishedPhases = PHASE_ORDER.filter((p) => {
    const idx = PHASE_ORDER.indexOf(p);
    if (idx >= currentIdx) return false;
    const items = draft.checklists[p]?.items || [];
    return items.some((i) => i.status === 'complete' || i.status === 'placeholder');
  });
  const transitions = draft.conversation.filter((m) => m.kind === 'transition');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [draft.conversation.length, sending]);

  const send = () => {
    if (inBriefConfirm) onConfirmBrief(input);
    else if (inReactionsConfirm) onConfirmReactions(input);
    else if (inAbConfirm) onConfirmPlan(input);
    else onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !sending) {
        send();
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden relative" data-testid="interview-chat">
      {/* AI Assistant Studio Header */}
      <div className="px-5 py-3 border-b border-border/50 bg-surface/20 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold text-text-main tracking-wide uppercase">
            AI Campaign Studio
          </span>
        </div>

        <span className="text-[11px] font-semibold text-text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-border/50">
          {draft.brief?.liveEmail ? 'Email Drafted' : 'Discovery'}
        </span>
      </div>

      {/* Scrollable Conversation Stream */}
      <div className={`flex-1 overflow-y-auto ${isBigChat ? 'p-6 lg:p-8 space-y-5' : 'p-5 space-y-4'}`}>
        {/* Conversation Message List */}
        <div className="space-y-3.5 pt-2">
          {draft.conversation
            .filter((m) => m.kind !== 'brief')
            .map((m: ChatMessageState, i: number) => {
              if (m.kind === 'system') {
                return (
                  <p key={i} className="text-[11px] text-center text-text-muted py-1 font-medium">
                    {m.text}
                  </p>
                );
              }
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`flex items-end ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 text-xs rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-primary text-white rounded-br-sm shadow-interactive'
                        : 'bg-surface/70 text-text-main border border-border/70 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

          {/* AI Thinking Indicator */}
          {sending && (
            <div className="flex items-end justify-start animate-in fade-in duration-150">
              <div
                className={`${
                  isBigChat ? 'max-w-[80%] px-5 py-3 text-[13px]' : 'max-w-[85%] px-4 py-2.5 text-xs'
                } rounded-2xl rounded-bl-sm bg-surface/80 text-text-muted border border-border/70 shadow-sm flex items-center gap-2.5`}
              >
                <Sparkles className="w-4 h-4 text-primary animate-spin shrink-0" />
                <span className="font-medium text-text-main animate-pulse">AI is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* AI Error & Retry */}
        {aiError && (
          <div className="p-4 rounded-[12px] bg-red-500/10 border border-red-500/30 space-y-2">
            <p className="text-xs text-red-400 font-medium">{aiError}</p>
            <button type="button" onClick={onRetry} className="btn-secondary text-xs" disabled={sending}>
              {copy.retry}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Console */}
      {!briefConfirmed && (
        <div className={`${isBigChat ? 'p-5 lg:p-6' : 'p-4'} border-t border-border/50 bg-surface/70 backdrop-blur-xl shrink-0 space-y-3`}>
          {/* Textarea Input Box */}
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <textarea
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  draft.brief?.liveEmail
                    ? "Tell me what you'd like to adjust (e.g. 'make it shorter', 'change the hook')..."
                    : "Tell me about the campaign or email you want to send..."
                }
                rows={isBigChat ? 3 : 2}
                className="flex-1 border border-border bg-surface-hover/80 text-text-main rounded-[12px] px-3.5 py-2.5 text-xs hover:border-primary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60 shadow-inner-sm resize-none"
                aria-label={
                  inBriefConfirm
                    ? 'Brief confirmation'
                    : inReactionsConfirm
                    ? 'Reactions confirmation'
                    : inAbConfirm
                    ? 'Plan confirmation'
                    : 'Your answer'
                }
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={onMic}
                  className="btn-secondary text-xs h-10 px-3 shrink-0"
                  title={copy.micHint}
                >
                  {listening ? 'Listening…' : copy.micLabel}
                </button>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={send}
                  className="btn-primary text-xs"
                  disabled={!input.trim() || sending}
                >
                  {sending ? copy.sending : copy.send}
                </button>
                {finishedPhases.length > 0 && (
                  <button type="button" onClick={onBack} className="btn-secondary text-xs" disabled={sending}>
                    {copy.back}
                  </button>
                )}
                {currentPhase && userAnswersInPhase >= 1 && (
                  <button type="button" onClick={onEscapeHatch} className="btn-secondary text-xs" disabled={sending}>
                    {copy.escapeHatch}
                  </button>
                )}
              </div>

              <span className="text-[10px] text-text-muted hidden sm:inline">
                Enter ↵ to reply
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Brief Confirmed Banner */}
      {briefConfirmed && (
        <div className="p-4 border-t border-border/50 bg-surface/70 backdrop-blur-xl shrink-0 space-y-2">
          <p className="text-xs font-semibold text-text-main">{copy.briefConfirmed}</p>
          <p className="text-xs text-text-muted">{createWithAiCopy.flow.comingNext}</p>
          <div
            onClick={onStartNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text-main cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{createWithAiCopy.flow.startNew}</span>
          </div>
        </div>
      )}
    </div>
  );
}

