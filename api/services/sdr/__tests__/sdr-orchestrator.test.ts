import { describe, it, expect } from 'vitest';
import { buildLeadDossier } from '../sdr-orchestrator.service.js';
import { classifyInboundReply } from '../reply-classifier.service.js';

describe('Autonomous AI SDR Orchestration & Reply Classification', () => {
  it('builds a structured lead dossier with 3-step sequence and custom hook', async () => {
    const dossier = await buildLeadDossier({
      businessName: 'Austin Pro Plumbing',
      websiteUrl: 'https://austinproplumbing.example.com',
      contactName: 'Sarah Jenkins',
      targetIcp: { niche: 'Residential Plumbing', location: 'Austin, TX' },
      valueProposition: 'AI-driven lead qualification and automated appointment booking',
      primaryOffer: '15 qualified boiler & leak repair jobs per month',
      calendarUrl: 'https://stoneaio.com/book/demo',
    });

    expect(dossier).toBeDefined();
    expect(dossier.businessName).toBe('Austin Pro Plumbing');
    expect(dossier.websiteSummary.length).toBeGreaterThan(10);
    expect(dossier.hookAngle.length).toBeGreaterThan(5);
    expect(dossier.draftedSubject.length).toBeGreaterThan(5);
    expect(dossier.draftedBody.length).toBeGreaterThan(10);
    expect(dossier.sequenceSteps).toHaveLength(3);
    expect(dossier.sequenceSteps[0].stepNumber).toBe(1);
    expect(dossier.sequenceSteps[1].stepNumber).toBe(2);
    expect(dossier.sequenceSteps[2].stepNumber).toBe(3);
  }, 25000);

  it('classifies positive interest reply and suggests meeting booking draft', async () => {
    const reply = await classifyInboundReply({
      prospectName: 'Sarah Jenkins',
      prospectEmail: 'sarah@austinproplumbing.example.com',
      originalOutreachSubject: 'Quick question regarding Austin Pro Plumbing',
      originalOutreachBody: 'Are you open to seeing how this works?',
      replyMessageText: 'Hey, this sounds interesting! Can we do a quick demo Thursday afternoon?',
      calendarUrl: 'https://stoneaio.com/book/demo',
    });

    expect(reply.intent).toBe('POSITIVE_INTEREST');
    expect(reply.suggestedAction).toBe('BOOK_MEETING');
    expect(reply.confidenceScore).toBeGreaterThanOrEqual(70);
    expect(reply.suggestedResponseDraft).toContain('Sarah');
  }, 25000);

  it('classifies unsubscribe request and recommends auto-suppression', async () => {
    const reply = await classifyInboundReply({
      prospectName: 'Bob Miller',
      prospectEmail: 'bob@example.com',
      originalOutreachSubject: 'Quick question',
      originalOutreachBody: 'Hello Bob',
      replyMessageText: 'Please remove me from your mailing list and stop emailing me.',
    });

    expect(reply.intent).toBe('UNSUBSCRIBE');
    expect(reply.suggestedAction).toBe('AUTO_SUPPRESS');
    expect(reply.confidenceScore).toBeGreaterThanOrEqual(90);
  }, 25000);

  it('classifies price/competitor objection and recommends consultative reply', async () => {
    const reply = await classifyInboundReply({
      prospectName: 'David Lee',
      prospectEmail: 'david@example.com',
      originalOutreachSubject: 'Growth strategy',
      originalOutreachBody: 'Outreach body',
      replyMessageText: 'We already use a competitor for this and have no budget for new tools right now.',
    });

    expect(reply.intent).toBe('OBJECTION');
    expect(reply.suggestedAction).toBe('SEND_BATTLECARD_REPLY');
  }, 25000);
});
