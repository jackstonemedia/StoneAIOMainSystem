/**
 * DraftReviewFlow loading-state test (round 2 follow-up, 2026-11-08) —
 * the artifact reveal: while the draft loads, the panel shows a
 * document-style loading state (skeleton shaped like a document), not a
 * bare "Loading…" line. The API is mocked to never resolve, so the flow
 * stays in its loading state.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import DraftReviewFlow from '../DraftReviewFlow';
import type { BusinessProfile, CampaignDraftState } from '../../../lib/createWithAiApi';

vi.mock('../../../lib/createWithAiApi', () => ({
  generateEmail: vi.fn(),
  generateSequence: vi.fn(),
  listDraftEmails: () => new Promise(() => {}),
  getReactionStatus: () => new Promise(() => {}),
}));

const profile: BusinessProfile = {
  id: 'prof-1',
  workspaceId: 'ws-1',
  businessName: 'Stone AIO Demo Co',
  businessType: 'SaaS',
  services: 'All-in-one business platform',
  serviceArea: 'United States',
  senderName: 'Jack',
  replyToEmail: 'jack@example.com',
  physicalAddress: '1 Main St',
  bookingLink: null,
  phone: null,
  customerType: null,
  voiceDescription: null,
  wordsToAvoid: null,
  websiteUrl: null,
  differentiators: null,
  guaranteesProof: null,
  timezone: null,
  createdAt: '2026-11-08T00:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
};

const draft: CampaignDraftState = {
  id: 'draft-1',
  workspaceId: 'ws-1',
  currentPhase: 'draft_refine',
  status: 'drafted',
  profileSnapshot: {},
  conversation: [],
  checklists: {},
  brief: { version: 1, text: 'Brief.' },
  briefVersion: 1,
  sequence: null,
  profileNotedAt: null,
  expiresAt: '2026-11-20T00:00:00.000Z',
};

describe('DraftReviewFlow artifact loading state', () => {
  it('renders a document skeleton while the draft loads', () => {
    const { container } = render(
      <DraftReviewFlow draft={draft} profile={profile} onDraftChange={() => {}} />,
    );
    expect(screen.getByTestId('artifact-loading')).toBeTruthy();
    expect(screen.getByText('Loading your email…')).toBeTruthy();
    // The old bare line is gone — no exact "Loading…" text node.
    expect(screen.queryByText(/^Loading…$/)).toBeNull();
    // Skeleton bars: the pulsing document-shaped placeholder.
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeTruthy();
    expect(skeleton?.querySelectorAll('div').length).toBeGreaterThan(4);
  });
});
