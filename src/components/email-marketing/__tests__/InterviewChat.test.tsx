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
    // The example is a placeholder attribute, never a prefilled value.
    const input = container.querySelector('textarea');
    expect(input?.getAttribute('placeholder')).toContain("Fill next week's open slots");
    expect((input as HTMLTextAreaElement)?.value).toBe('');
    // Send is disabled until the user types something (spec §3 rule 5).
    const send = screen.getByRole('button', { name: 'Send' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    // Progress bar names all 8 phases.
    expect(container.textContent).toContain('Phase 8: Review and Send');
  });

  it('brief confirmation: typed input only, no approve buttons', () => {
    const draft = goalDraft({
      currentPhase: 'brief_confirm',
      conversation: [
        { role: 'ai', text: 'Here is the campaign as I understand it.\nType "looks good", or tell me what to change.', phase: 'brief_confirm', kind: 'brief', at: '2026-10-21T00:00:00.000Z' },
      ],
      brief: { text: 'Here is the campaign as I understand it.' },
    });
    const { container } = renderChat(draft);
    expect(container.textContent).toContain('Campaign Brief confirmation');
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

  it('profile change: only Regenerate/Keep controls', () => {
    const { container } = renderChat(goalDraft(), { profileChanged: true });
    expect(screen.getByRole('button', { name: 'Regenerate draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep as is' })).toBeTruthy();
  });

  it('profile change still prompts after the Brief is confirmed (snapshot-only choice)', () => {
    const draft = goalDraft({ status: 'brief_confirmed', currentPhase: 'brief_confirm' });
    renderChat(draft, { profileChanged: true });
    expect(screen.getByRole('button', { name: 'Regenerate draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep as is' })).toBeTruthy();
  });
});
