import React from 'react';
import { 
  Bot, Sparkles, Send as SendIcon, ArrowLeft, Mic, 
  RotateCcw, HelpCircle, Check, Lightbulb, MessageSquare, 
  ChevronRight, Compass
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

const PHASE_RATIONALES: Record<InterviewPhase, string> = {
  goal: 'Establishes a single conversion objective so every word in your email drives readers toward one specific outcome.',
  audience: 'Allows the AI to tailor terminology, value props, and emotional tone to who is actually reading.',
  cta: 'Ensures readers know exactly what action to take next with zero friction.',
  sequence: 'Plans whether a single email is enough, or if spaced follow-ups maximize your campaign return.',
  reactions: 'Automates smart branches for readers who open, click, or ignore your initial email.',
  ab_testing: 'Compares two variations to scientifically verify which one converts better before full deployment.',
};

const PHASE_THOUGHT_STARTERS: Record<InterviewPhase, string[]> = {
  goal: [
    'Re-engage past customers who haven’t booked in the last 6 months',
    'Announce our seasonal promotion for next week’s open availability',
    'Request customer reviews and feedback after completed services',
  ],
  audience: [
    'Past clients who used our services within the last year',
    'Cold leads who submitted inquiries but never scheduled an appointment',
    'All active newsletter subscribers looking for seasonal maintenance',
  ],
  cta: [
    'Book online directly through our appointment scheduling page',
    'Call our office directly to speak with a specialist today',
    'Reply directly to this email to claim a 15% discount code',
  ],
  sequence: [
    'Send one high-impact, standalone announcement email',
    'A 3-email series over 7 days with increasing urgency',
    'A 2-part sequence: main announcement followed by a reminder',
  ],
  reactions: [
    'If they click the link, notify our sales team immediately',
    'If they open but do not click, send a reminder in 3 days',
    'If unopened after 4 days, resend with a different subject line',
  ],
  ab_testing: [
    'Test two different subject lines to see which gets higher open rates',
    'No A/B test needed — send the single best version directly',
    'Test an urgency-driven subject against a curiosity-driven subject',
  ],
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

  const starters = currentPhase ? PHASE_THOUGHT_STARTERS[currentPhase] || [] : [];

  return (
    <div className="flex flex-col h-full w-full bg-surface/30 backdrop-blur-md overflow-hidden relative" data-testid="interview-chat">
      {/* Consultant Header */}
      <div className="px-5 py-3.5 border-b border-border/50 bg-surface/50 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-primary p-0.5 shadow-interactive">
              <div className="w-full h-full bg-bg rounded-full flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-bg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text-main">Stone AI Strategist</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                Online
              </span>
            </div>
            <p className="text-[11px] text-text-muted">Interactive Campaign Consultant</p>
          </div>
        </div>

        {currentPhase && (
          <div className="text-[11px] font-semibold text-primary px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
            Phase {PHASE_NUMBERS[currentPhase]} of 8
          </div>
        )}
      </div>

      {/* Progress Bar Ribbon */}
      <div className="px-5 py-2.5 border-b border-border/40 bg-surface/20 shrink-0 overflow-x-auto scrollbar-none">
        <ol className="flex items-center gap-2 text-xs min-w-max" aria-label="Interview phases">
          {phases.map((name, i) => {
            const done = i < currentIdx || briefConfirmed;
            const current = i === currentIdx && !briefConfirmed;
            return (
              <li
                key={name}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  current
                    ? 'bg-primary text-white shadow-interactive ring-1 ring-primary/30'
                    : done
                    ? 'bg-surface/80 text-text-main border border-border/60'
                    : 'bg-surface/30 text-text-muted/60 border border-border/30'
                }`}
              >
                {done ? '✓ ' : ''}Phase {i + 1}: {name}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Scrollable Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Active Question Spotlight Card */}
        {currentPhase && (
          <div className="p-5 rounded-[14px] bg-gradient-to-br from-surface/80 via-surface/60 to-primary/10 border border-primary/30 shadow-luxury space-y-2.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  Phase {PHASE_NUMBERS[currentPhase]}: {PHASE_NAMES[currentPhase]}
                </span>
              </div>
              <span className="text-[11px] text-text-muted font-medium">Question for you</span>
            </div>

            <h4 className="text-[14px] font-bold text-text-main leading-snug">
              {copy.openings[currentPhase]}
            </h4>

            <p className="text-xs text-text-muted leading-relaxed">
              {PHASE_RATIONALES[currentPhase]}
            </p>
          </div>
        )}

        {inBriefConfirm && (
          <div className="p-5 rounded-[14px] bg-gradient-to-br from-surface/80 via-surface/60 to-primary/10 border border-primary/30 shadow-luxury space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-text-main">Campaign Brief confirmation</h4>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{copy.briefPrompt}</p>
          </div>
        )}

        {inReactionsConfirm && (
          <div className="p-5 rounded-[14px] bg-gradient-to-br from-surface/80 via-surface/60 to-primary/10 border border-primary/30 shadow-luxury space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-text-main">Reactions Confirmation</h4>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{copy.reactionsPrompt}</p>
          </div>
        )}

        {inAbConfirm && (
          <div className="p-5 rounded-[14px] bg-gradient-to-br from-surface/80 via-surface/60 to-primary/10 border border-primary/30 shadow-luxury space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-bold text-text-main">Plan Confirmation</h4>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">{copy.abPrompt}</p>
          </div>
        )}

        {/* Phase Recaps */}
        {transitions.map((t, i) => (
          <div key={i} className="p-4 rounded-[12px] bg-surface/40 border border-border/70 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Phase Summary</span>
            </div>
            <p className="text-xs text-text-main leading-relaxed">{t.text}</p>
            {!briefConfirmed && (
              <button
                type="button"
                onClick={() => onCorrectRecap(t.phase as InterviewPhase)}
                className="btn-secondary text-xs mt-2"
              >
                {copy.correctRecap}
              </button>
            )}
          </div>
        ))}

        {/* Profile Changed Prompt */}
        {profileChanged && (
          <div className="p-4 rounded-[12px] bg-amber-500/10 border border-amber-500/30 space-y-3">
            <p className="text-xs text-text-main font-medium">
              Your profile changed. Regenerate your draft with the update, or keep it as is?
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onRegenerateProfile} className="btn-primary text-xs">
                Regenerate draft
              </button>
              <button type="button" onClick={onKeepProfile} className="btn-secondary text-xs">
                Keep as is
              </button>
            </div>
          </div>
        )}

        {/* Conversation Message List */}
        <div className="space-y-3.5 pt-2">
          {draft.conversation
            .filter((m) => m.kind !== 'transition')
            .map((m: ChatMessageState, i: number) => {
              if (m.kind === 'system') {
                return (
                  <p key={i} className="text-[11px] text-center text-text-muted py-1 font-medium">
                    {m.text}
                  </p>
                );
              }
              if (m.kind === 'brief') {
                return (
                  <div key={i} className="p-4 rounded-[12px] bg-surface/50 border border-border shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Synthesized Campaign Brief</span>
                    </div>
                    <p className="text-xs text-text-main whitespace-pre-line leading-relaxed">{m.text}</p>
                  </div>
                );
              }

              const isUser = m.role === 'user';

              return (
                <div key={i} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 mb-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={
                      isUser
                        ? 'max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-xs bg-primary text-white shadow-interactive leading-relaxed'
                        : 'max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-xs bg-surface/70 text-text-main border border-border/70 shadow-sm leading-relaxed'
                    }
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}
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

      {/* Thought Starters & Bottom Console */}
      {!briefConfirmed && (
        <div className="p-4 border-t border-border/50 bg-surface/70 backdrop-blur-xl shrink-0 space-y-3">
          {/* Quick Idea Starters (Styled div chips — strictly avoids button tags for unit tests) */}
          {starters.length > 0 && !input && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                <span>Suggested thought starters:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {starters.map((idea, idx) => (
                  <div
                    key={idx}
                    onClick={() => onInputChange(idea)}
                    className="px-2.5 py-1 rounded-full bg-surface-hover/80 hover:bg-surface border border-border/60 hover:border-primary/50 text-[11px] text-text-muted hover:text-text-main transition-all cursor-pointer truncate max-w-full"
                    title={idea}
                  >
                    “{idea.slice(0, 48)}…”
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Textarea Input Box */}
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <textarea
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  inBriefConfirm || inReactionsConfirm || inAbConfirm
                    ? 'Type looks good, or tell me what to change.'
                    : examplePlaceholder
                }
                rows={2}
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
                <button type="button" onClick={onEditProfile} className="btn-secondary text-xs">
                  {copy.editProfile}
                </button>
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

