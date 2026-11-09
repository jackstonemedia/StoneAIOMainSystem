/**
 * Draft summary helpers (flow improvements, 2026-11-08) — shared by the
 * Create-with-AI pick-list and the overview's resume-draft next step, so a
 * draft reads the same in both places.
 *
 * The summary is the user's own first answer in the interview (their goal, in
 * their words) — the brief has no plain goal string to read, and the first
 * answer exists for every draft that got past the opening question.
 */
import type { CampaignDraftState } from '../../lib/createWithAiApi';

const SUMMARY_LEN = 90;

export function draftSummary(draft: CampaignDraftState): string {
  const firstAnswer = draft.conversation.find((m) => m.role === 'user')?.text?.trim();
  if (firstAnswer) {
    return firstAnswer.length > SUMMARY_LEN ? `${firstAnswer.slice(0, SUMMARY_LEN - 1)}…` : firstAnswer;
  }
  return 'New campaign';
}

export function relativeEdited(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Edited just now';
  if (mins < 60) return `Edited ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Edited ${days}d ago`;
}
