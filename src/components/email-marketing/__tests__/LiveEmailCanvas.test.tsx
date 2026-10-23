import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import LiveEmailCanvas from '../LiveEmailCanvas';
import type { BusinessProfile, CampaignDraftState } from '../../../lib/createWithAiApi';

const mockProfile: BusinessProfile = {
  id: 'prof-1',
  workspaceId: 'ws-1',
  businessName: 'Acorn Growth Consulting',
  businessType: 'B2B Sales Consulting',
  services: 'Outbound pipeline generation and lead conversion',
  serviceArea: 'United States',
  senderName: 'Sarah Jenkins',
  replyToEmail: 'sarah@acorngrowth.com',
  physicalAddress: '100 Market St, Suite 400, San Francisco, CA 94105',
  bookingLink: 'https://cal.com/acorn/growth-audit',
  phone: '555-0199',
  customerType: 'B2B SaaS',
  voiceDescription: 'Direct, consultative, concise',
  wordsToAvoid: 'synergy, game-changer',
  websiteUrl: 'https://acorngrowth.com',
  differentiators: 'Dedicated pipeline specialists',
  guaranteesProof: '100% money back guarantee',
  timezone: 'America/Los_Angeles',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const initialDraft: CampaignDraftState = {
  id: 'draft-1',
  workspaceId: 'ws-1',
  currentPhase: 'goal',
  status: 'interviewing',
  profileSnapshot: {},
  conversation: [],
  checklists: {},
  brief: null,
  briefVersion: 0,
  sequence: null,
  profileNotedAt: null,
  expiresAt: '2026-11-20T00:00:00Z',
};

describe('LiveEmailCanvas Component', () => {
  it('starts as a plain 1-on-1 direct email with NO marketing blocks or fake names', () => {
    const { container } = render(<LiveEmailCanvas draft={initialDraft} profile={mockProfile} />);

    // Renders the preview frame with direct email headers
    expect(screen.getByText('Email Preview')).toBeDefined();
    expect(container.textContent).toContain('You <you@yourdomain.com>');
    expect(container.textContent).toContain('prospect@company.com');

    // Forbidden marketing newsletter blocks & fake names MUST NOT exist
    expect(container.textContent).not.toContain('Alex Rivera');
    expect(container.textContent).not.toContain('You received this email because you are a client');
    expect(container.textContent).not.toContain('Unsubscribe');
    expect(container.textContent).not.toContain("| 'there'");
    expect(container.textContent).not.toContain('Email copy will be generated once campaign strategy is confirmed');
    expect(container.textContent).not.toContain('Strategy Inputs Assembled');
  });

  it('renders live email subject and paragraphs when brief has liveEmail', () => {
    const draftWithEmail: CampaignDraftState = {
      ...initialDraft,
      brief: {
        version: 1,
        liveEmail: {
          version: 1,
          subject: 'Quick question regarding your pipeline',
          previewText: 'Quick question about your pipeline bottleneck',
          bodyText:
            'Most teams handling outreach right now run into inconsistent response rates.\n\nWe design targeted sequences that engage qualified accounts with direct relevance.\n\nAre you open to checking out a quick 2-minute mockup next week?',
          bodyHtml: '<p>Test html</p>',
          ctaText: 'Check out mockup',
          generatedAt: '2026-10-22T00:00:00Z',
        },
      },
    };

    const { container } = render(<LiveEmailCanvas draft={draftWithEmail} profile={mockProfile} />);

    expect(screen.getByText('Quick question regarding your pipeline')).toBeDefined();
    expect(container.textContent).toContain('Most teams handling outreach right now run into inconsistent response rates.');
    expect(container.textContent).toContain('We design targeted sequences that engage qualified accounts with direct relevance.');
    expect(container.textContent).toContain('Are you open to checking out a quick 2-minute mockup next week?');
  });

  it('displays subtle loading badge during active generation without unmounting the email', () => {
    const draftWithEmail: CampaignDraftState = {
      ...initialDraft,
      brief: {
        version: 1,
        liveEmail: {
          version: 1,
          subject: 'Current subject line',
          bodyText: 'Existing paragraph body text.',
          bodyHtml: '<p>Existing</p>',
          generatedAt: '2026-10-22T00:00:00Z',
        },
      },
    };

    const { container } = render(
      <LiveEmailCanvas draft={draftWithEmail} profile={mockProfile} isGenerating={true} />
    );

    // Subtle loading indicator is visible
    expect(screen.getByText('Updating draft…')).toBeDefined();

    // Previous email text remains rendered with zero blank flash
    expect(container.textContent).toContain('Current subject line');
    expect(container.textContent).toContain('Existing paragraph body text.');
  });
});
