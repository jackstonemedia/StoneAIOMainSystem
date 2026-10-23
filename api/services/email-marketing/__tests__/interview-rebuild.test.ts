import { describe, it, expect } from 'vitest';
import {
  extractBriefFactsFromTurn,
  buildPhasePromptContext,
  applyRebuiltTurn,
  buildOpeningQuestion,
} from '../interview.service.js';
import type { CampaignBrief } from '../campaign-brief.types.js';
import { initCampaignBrief } from '../phase-definitions.js';

describe('AI Interview Engine Rebuild', () => {
  const profileSnapshot = {
    businessName: 'Stone Media',
    businessType: 'B2B Growth Consultancy',
    services: 'Outbound sales systems\nCold email infrastructure',
    senderName: 'Jack Stone',
  };

  it('initializes opening question without "Phase 1 of 8" prefix and asks for campaign details', () => {
    const opening = buildOpeningQuestion('goal');
    expect(opening).not.toMatch(/Phase \d of \d/i);
    expect(opening).toBe('Tell me about the email/campaign you want to send.');
  });

  it('constructs fresh per-phase context containing only the brief and current phase messages', () => {
    const brief: CampaignBrief = {
      version: 2,
      goal: 'Get more clients using cold outreach',
      businessDescription: 'Outbound sales systems',
      customerPainPoints: ['Low reply rates on cold emails'],
    };

    const conversation = [
      // Phase 1 message (should be excluded from Phase 2 prompt)
      { role: 'user' as const, text: 'I want cold outreach', phase: 'goal' as const, kind: 'answer' as const, at: '' },
      { role: 'ai' as const, text: 'Tell me about your business', phase: 'goal' as const, kind: 'question' as const, at: '' },
      // Phase 2 message (should be included)
      { role: 'user' as const, text: 'We target SaaS founders with 10-50 employees', phase: 'audience' as const, kind: 'answer' as const, at: '' },
    ];

    const ctx = buildPhasePromptContext('audience', brief, conversation, profileSnapshot);

    // Only Phase 2 messages should be in the conversation prompt
    expect(ctx.phaseMessages).toHaveLength(1);
    expect(ctx.phaseMessages[0].text).toContain('SaaS founders');

    // Brief is explicitly included as single source of truth
    expect(ctx.brief.goal).toBe('Get more clients using cold outreach');
    expect(ctx.brief.customerPainPoints).toContain('Low reply rates on cold emails');
  });

  it('pushes back intelligently when an answer is vague or generic ("high quality")', () => {
    const brief = initCampaignBrief(profileSnapshot);
    const userMessage = 'We provide high quality service and top quality results';

    const extraction = extractBriefFactsFromTurn(brief, 'goal', userMessage);

    expect(extraction.nextTopicRecommendation).toBe('pushback_on_vague_quality');
    expect(extraction.nextQuestion).toContain('Tell me more about what makes you high quality');
  });

  it('does NOT draft an email and asks the 5 foundational questions in order when input is sparse', () => {
    const brief = initCampaignBrief();
    // Turn 1: User provides goal
    const t1 = extractBriefFactsFromTurn(brief, 'goal', 'I want to get new clients with cold outreach');
    expect(t1.newFacts.isReadyToDraft).toBeFalsy();
    expect(t1.nextQuestion).toBe('What are you offering or announcing? The specifics, the product, the service, price or discount, key details, and any deadline.');

    // Turn 2: User provides offer
    const brief2 = { ...brief, ...t1.newFacts };
    const t2 = extractBriefFactsFromTurn(brief2, 'goal', 'Custom website design and speed optimization');
    expect(t2.newFacts.isReadyToDraft).toBeFalsy();
    expect(t2.nextQuestion).toBe('Who is it going to? The audience, new leads, past customers, VIPs, and how well do they already know you.');

    // Turn 3: User provides audience
    const brief3 = { ...brief2, ...t2.newFacts };
    const t3 = extractBriefFactsFromTurn(brief3, 'goal', 'Local home service contractors who have never heard of us');
    expect(t3.newFacts.isReadyToDraft).toBeFalsy();
    expect(t3.nextQuestion).toBe('How should it sound? Friendly, professional, playful, or urgent.');

    // Turn 4: User provides tone
    const brief4 = { ...brief3, ...t3.newFacts };
    const t4 = extractBriefFactsFromTurn(brief4, 'goal', 'Friendly and professional');
    expect(t4.newFacts.isReadyToDraft).toBeFalsy();
    expect(t4.nextQuestion).toBe('What call to action should be taken? A link to the website, booking an appointment, etc.');

    // Turn 5: User provides CTA
    const brief5 = { ...brief4, ...t4.newFacts };
    const t5 = extractBriefFactsFromTurn(brief5, 'goal', 'Reply with their current website URL for a free audit');
    expect(t5.newFacts.isReadyToDraft).toBe(true);
    expect(t5.nextTopicRecommendation).toBe('ready_to_draft');
  });

  it('generates email only when discovery is ready to draft', async () => {
    const currentBrief = initCampaignBrief();

    const applied = await applyRebuiltTurn({
      currentBrief: {
        version: 1,
        goal: 'Get new clients for my website business',
        offer: 'High-converting custom websites and redesigns',
        targetCustomer: 'Local plumbers and HVAC contractors',
        tone: 'Friendly and direct',
        cta: { action: 'Reply with your website URL for a free mockup' },
      },
      phase: 'goal',
      userMessage: 'Looks great, go ahead and draft it',
    });

    expect(applied.brief.version).toBeGreaterThan(1);
    expect(applied.brief.isReadyToDraft).toBe(true);
    expect(applied.brief.liveEmail).toBeDefined();
    expect(applied.brief.liveEmail?.subject).toBeTruthy();
    expect(applied.brief.liveEmail?.bodyText).not.toContain('Alex Rivera');
    expect(applied.brief.liveEmail?.bodyText).not.toContain('Voice Agent');
    expect(applied.brief.liveEmail?.bodyText).not.toContain("| 'there'");
    expect(applied.aiMessage.text).not.toMatch(/Phase \d of \d/i);
  }, 30_000);
});
