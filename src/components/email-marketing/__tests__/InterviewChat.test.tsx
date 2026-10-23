/**
 * Create with AI — Milestone 2 UI test (spec §3 rule 3 + §21 M2 criteria).
 * Proves the interview UI has NO clickable answer options: no selects,
 * radios, checkboxes, option lists, or chips — only controls (Send, Back,
 * Edit profile, "Write it with what I have", Retry, recap corrections,
 * profile-change choices, Dictate).
 * Renders InterviewChat from props only — no network, no providers.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import InterviewChat from '../InterviewChat';
import type { CampaignDraftState } from '../../../lib/createWithAiApi';

const ALLOWED_BUTTONS = new Set([
  'Send',
  'Back',
  'Edit profile',
  'Write it with what I have',
  'Retry',
  'Correct this recap',
  'Regenerate draft',
  'Keep as is',
  'Dictate',
  'Listening…',
  'Sending…',
]);

function goalDraft(overrides: Partial<CampaignDraftState> = {}): CampaignDraftState {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    currentPhase: 'goal',
    status: 'interviewing',
    profileSnapshot: {},
    conversation: [
      { role: 'ai', text: 'Phase 1 of 8: Goal. What do you want to send?', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
      { role: 'user', text: 'Outreach', phase: 'goal', kind: 'answer', at: '2026-10-21T00:01:00.000Z' },
    ],
    checklists: {
      goal: {
        items: [
          { id: 'campaign', label: 'The campaign, specifically', kind: 'base', status: 'vague', userWords: 'Outreach', fact: 'Outreach', attempts: 0, blocksSending: true },
        ],
        needsReview: false,
      },
    },
    brief: null,
    briefVersion: 0,
    sequence: null,
    profileNotedAt: null,
    expiresAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

function renderChat(draft: CampaignDraftState, extra: Record<string, unknown> = {}) {
  const noop = () => undefined;
  return render(
    <InterviewChat
      draft={draft}
      input=""
      onInputChange={noop}
      sending={false}
      aiError={null}
      examplePlaceholder="Fill next week's open slots with past customers."
      micSupported={false}
      listening={false}
      onMic={noop}
      onSend={noop}
      onRetry={noop}
      onBack={noop}
      onEditProfile={noop}
      onEscapeHatch={noop}
      onCorrectRecap={noop}
      onConfirmBrief={noop}
      onConfirmReactions={noop}
      onConfirmPlan={noop}
      profileChanged={false}
      onRegenerateProfile={noop}
      onKeepProfile={noop}
      onStartNew={noop}
      {...extra}
    />,
  );
}

describe('InterviewChat has no clickable answer options', () => {
  it('goal phase: only control buttons, no selects/radios/checkboxes/options', () => {
    const { container } = renderChat(goalDraft());
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
    expect(buttons.length).toBeGreaterThan(0);
    for (const label of buttons) {
      expect(ALLOWED_BUTTONS.has(label)).toBe(true);
    }
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    // The input textarea is present with clean guidance placeholder
    const input = container.querySelector('textarea');
    expect(input?.getAttribute('placeholder')).toContain('Tell me about the campaign');
    expect((input as HTMLTextAreaElement)?.value).toBe('');
    // Send is disabled until the user types something
    const send = screen.getByRole('button', { name: 'Send' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    // Studio header shows AI Campaign Studio without artificial phase numbering
    expect(container.textContent).toContain('AI Campaign Studio');
    expect(container.textContent).not.toContain('Phase 1: Goal');
    expect(container.textContent).not.toContain('Phase 8: Review and Send');
  });

  it('brief confirmation: typed input only, no approve buttons', () => {
    const draft = goalDraft({
      currentPhase: 'goal',
      conversation: [
        { role: 'ai', text: 'Here is the campaign as I understand it.\nType "looks good", or tell me what to change.', phase: 'goal', kind: 'question', at: '2026-10-21T00:00:00.000Z' },
      ],
      brief: { version: 1, text: 'Here is the campaign as I understand it.' },
    });
    const { container } = renderChat(draft);
    expect(container.textContent).toContain('AI Campaign Studio');
    expect(container.textContent).not.toMatch(/Approve/);
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
    for (const label of buttons) {
      expect(ALLOWED_BUTTONS.has(label)).toBe(true);
    }
  });

  it('error state: only Retry as an extra control', () => {
    const { container } = renderChat(goalDraft(), { aiError: 'Something went wrong. Your answers are saved.' });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => (b.textContent || '').trim());
    for (const label of buttons) {
      expect(ALLOWED_BUTTONS.has(label)).toBe(true);
    }
  });

  it('profile decoupling: business profile changes do not inject intrusive modal prompts', () => {
    const { container } = renderChat(goalDraft(), { profileChanged: true });
    expect(screen.queryByRole('button', { name: 'Regenerate draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep as is' })).toBeNull();
  });
});
