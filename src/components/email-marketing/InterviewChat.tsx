/**
 * Create with AI — Interview chat (Milestone 2, spec §3 + §5).
 *
 * Presentational only: all state and API calls live in InterviewFlow, so this
 * component renders from props and is unit-testable without a network.
 *
 * NO clickable answer options (spec §3 rule 3): the only buttons here are
 * controls — Send (Continue), Back, Edit profile, "Write it with what I have",
 * Retry, "Correct this recap", Regenerate/Keep (profile change), Dictate.
 * The progress bar phases are non-interactive spans, never buttons.
 */

import React from 'react';
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
  // Finished phases (for Back + recap cards): phases before the current one
  // that have at least one checklist item complete or placeholder.
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

  return (
    <div className="space-y-4" data-testid="interview-chat">
      {/* Progress bar: all 8 phases, current highlighted, finished check-marked. */}
      <ol className="flex flex-wrap gap-2 text-xs" aria-label="Interview phases">
        {phases.map((name, i) => {
          const done = i < currentIdx || briefConfirmed;
          const current = i === currentIdx && !briefConfirmed;
          return (
            <li
              key={name}
              className={
                current
                  ? 'px-2 py-1 rounded-full bg-primary text-white font-semibold'
                  : done
                    ? 'px-2 py-1 rounded-full bg-surface text-text-main'
                    : 'px-2 py-1 rounded-full bg-surface/50 text-text-muted'
              }
            >
              {done ? '✓ ' : ''}Phase {i + 1}: {name}
            </li>
          );
        })}
      </ol>

      {/* Phase banner (spec §3 rule 4). */}
      {currentPhase && (
        <div className="border border-border rounded-lg p-3 bg-surface/40">
          <p className="text-sm font-semibold text-text-main">
            {copy.banner(PHASE_NUMBERS[currentPhase], PHASE_NAMES[currentPhase], copy.bannerSentences[currentPhase])}
          </p>
          <p className="text-sm text-text-muted mt-1">{copy.openings[currentPhase]}</p>
        </div>
      )}
      {inBriefConfirm && (
        <div className="border border-border rounded-lg p-3 bg-surface/40">
          <p className="text-sm font-semibold text-text-main">Campaign Brief confirmation</p>
          <p className="text-sm text-text-muted mt-1">{copy.briefPrompt}</p>
        </div>
      )}
      {inReactionsConfirm && (
        <div className="border border-border rounded-lg p-3 bg-surface/40">
          <p className="text-sm font-semibold text-text-main">Reactions confirmation</p>
          <p className="text-sm text-text-muted mt-1">{copy.reactionsPrompt}</p>
        </div>
      )}
      {inAbConfirm && (
        <div className="border border-border rounded-lg p-3 bg-surface/40">
          <p className="text-sm font-semibold text-text-main">Plan confirmation</p>
          <p className="text-sm text-text-muted mt-1">{copy.abPrompt}</p>
        </div>
      )}

      {/* Recap cards: each finished phase's transition, correctable by typing. */}
      {transitions.map((t, i) => (
        <div key={i} className="border border-border rounded-lg p-3 bg-surface/30">
          <p className="text-sm text-text-main">{t.text}</p>
          {!briefConfirmed && (
            <button type="button" onClick={() => onCorrectRecap(t.phase as InterviewPhase)} className="btn-secondary text-xs mt-2">
              {copy.correctRecap}
            </button>
          )}
        </div>
      ))}

      {/* Profile-changed prompt (spec §4). Shown even after the Brief is
          confirmed: the choice only swaps the snapshot, never the locked Brief. */}
      {profileChanged && (
        <div className="border border-border rounded-lg p-3 bg-surface/40 space-y-2">
          <p className="text-sm text-text-main">Your profile changed. Regenerate your draft with the update, or keep it as is?</p>
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

      {/* Messages. */}
      <div className="space-y-3">
        {draft.conversation
          .filter((m) => m.kind !== 'transition')
          .map((m: ChatMessageState, i: number) => {
            if (m.kind === 'system') {
              return (
                <p key={i} className="text-xs text-center text-text-muted">
                  {m.text}
                </p>
              );
            }
            if (m.kind === 'brief') {
              return (
                <div key={i} className="border border-border rounded-lg p-3 bg-surface/40">
                  <p className="text-sm text-text-main whitespace-pre-line">{m.text}</p>
                </div>
              );
            }
            return (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-lg px-3 py-2 text-sm bg-primary text-white'
                      : 'max-w-[85%] rounded-lg px-3 py-2 text-sm bg-surface text-text-main border border-border'
                  }
                >
                  {m.text}
                </div>
              </div>
            );
          })}
      </div>

      {/* AI error + retry (answers are saved; Appendix A error copy). */}
      {aiError && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10 space-y-2">
          <p className="text-sm text-red-400">{aiError}</p>
          <button type="button" onClick={onRetry} className="btn-secondary text-xs" disabled={sending}>
            {copy.retry}
          </button>
        </div>
      )}

      {/* Input + controls (no answer options — typed input only). */}
      {!briefConfirmed && (
        <div className="space-y-2">
          <div className="flex gap-2 items-start">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={inBriefConfirm || inReactionsConfirm || inAbConfirm ? 'Type looks good, or tell me what to change.' : examplePlaceholder}
              rows={3}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
              aria-label={inBriefConfirm ? 'Brief confirmation' : inReactionsConfirm ? 'Reactions confirmation' : inAbConfirm ? 'Plan confirmation' : 'Your answer'}
            />
            {micSupported && (
              <button type="button" onClick={onMic} className="btn-secondary text-xs" title={copy.micHint}>
                {listening ? 'Listening…' : copy.micLabel}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={send} className="btn-primary text-xs" disabled={!input.trim() || sending}>
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
          {!inBriefConfirm && !inReactionsConfirm && !inAbConfirm && <p className="text-xs text-text-muted">{copy.requiredHint}</p>}
        </div>
      )}

      {briefConfirmed && (
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
          <p className="text-sm text-text-main">{copy.briefConfirmed}</p>
          <p className="text-sm text-text-muted">{createWithAiCopy.flow.comingNext}</p>
          <button type="button" onClick={onStartNew} className="btn-secondary text-xs">
            {createWithAiCopy.flow.startNew}
          </button>
        </div>
      )}
    </div>
  );
}
