/**
 * Live Email Generator Service
 *
 * Builds and refines 1-on-1 direct plain-text email copy (sent via connected mailboxes).
 * Strictly grounded in the Campaign Brief (Goal, Offer, Audience, Tone, CTA).
 *
 * Grounding & Quality Principles:
 * - Plain 1-on-1 direct message feel (looks typed in Gmail/Outlook, not a marketing block newsletter)
 * - Strict grounding: strictly anchored to user facts, zero invented problems or technical jargon
 * - Dynamic merge tags: {{first_name}}, {{company_name}}
 * - Natural low-friction call-to-action
 * - Version-stamped to guarantee older generations never overwrite newer ones
 */

import type { CampaignBrief, LiveEmailDraft } from './campaign-brief.types.js';

export function isLiveEmailStale(candidateVersion: number, currentVersion: number): boolean {
  return candidateVersion < currentVersion;
}

function sanitizeBriefField(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[\[\]]/g, '')
    .trim();
}

/** Builds clean HTML body wrapping plain text lines for 1-on-1 direct email delivery */
export function wrapEmailHtml(paragraphs: string[]): string {
  const bodyParagraphs = paragraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #1e293b;">${p}</p>`
    )
    .join('');

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0; padding: 12px 0; color: #1e293b;">
  ${bodyParagraphs}
</div>`.trim();
}

/** Deterministic high-quality fallback direct email for instant generation or when AI is offline */
export function buildFallbackEmail(
  brief: CampaignBrief,
  version: number
): LiveEmailDraft {
  const offer = sanitizeBriefField(brief.offer || brief.businessDescription || 'our specialized services');
  const ctaText = sanitizeBriefField(brief.cta?.action || 'Mind if I send over a quick preview link to take a look?');
  const audience = sanitizeBriefField(brief.targetCustomer || brief.audience?.whoTheyAre || 'local businesses');
  const isWebsite = /website|mockup|preview|design|web/i.test(`${offer} ${brief.goal || ''}`);

  const cleanCta = ctaText.endsWith('?') ? ctaText : `${ctaText}?`;

  const paragraphs = isWebsite
    ? [
        'Hey {{first_name}},',
        `Noticed {{company_name}} doesn't have a website up when locals search for trade work in the area. Most homeowners just want to see you're credible and tap a button to call you straight from their phone.`,
        `I put together a clean preview designed specifically to turn local searches into direct phone calls for you.`,
        cleanCta,
        'Best,\n[Your Name]',
      ]
    : [
        'Hey {{first_name}},',
        `Quick question for {{company_name}} regarding ${offer}.`,
        `We work directly with ${audience} to help get straightforward results without any runaround.`,
        cleanCta,
        'Best,\n[Your Name]',
      ];

  const bodyText = paragraphs.join('\n\n');
  const bodyHtml = wrapEmailHtml(paragraphs);

  return {
    subject: `quick idea for {{company_name}}`,
    previewText: `Quick question for {{company_name}}`,
    bodyText,
    bodyHtml,
    version,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate or refine the live email draft using the AI engine.
 * Guided by plain 1-on-1 direct email principles and strict factual grounding.
 */
export async function generateLiveEmail(
  brief: CampaignBrief,
  version: number
): Promise<LiveEmailDraft> {
  try {
    const { tryGetAIClient, INTERVIEW_MODEL } = await import('../../../packages/ai/client.js');
    const ai = tryGetAIClient();
    if (!ai) {
      return buildFallbackEmail(brief, version);
    }

    const prompt = [
      'You are an elite direct-response email copywriter who writes authentic 1-on-1 cold outreach emails (sent from an individual mailbox like Gmail, NOT an HTML marketing blast).',
      '',
      'CRITICAL COPYWRITING & GROUNDING RULES:',
      '1. Authentic Human Copy: Write like an actual human writing a personal, 1-on-1 note to a local business owner. NEVER use generic templates or mad-libs phrases like "Reaching out regarding...", "We work with [X] to deliver...", or "without the usual headaches". Those are instant spam flags.',
      '2. Factual Trade Grounding: Ground the email authentically in their business. Speak directly to what their prospects care about (getting local jobs, looking credible when someone searches them, having a simple mobile-friendly page with click-to-call, etc.).',
      '3. Hook: Open directly with a relevant, conversational observation in the first sentence. No throat-clearing openers ("I hope this email finds you well").',
      '4. Salutation: "Hey {{first_name}}," or "Hi {{first_name}},". Never use fake recipient names.',
      '5. Tone: Direct, casual, no-BS, respectful of their time.',
      '6. Call to Action: A clean, conversational question (e.g. "Mind if I send over a quick preview link to take a look?", "Open to taking a look?"). NEVER include marketing meta-commentary like "(low-friction permission ask)".',
      '7. Sign-off: Must end with:\nBest,\n[Your Name]',
      '8. Length: 50–90 words total. 2–3 short, punchy paragraphs.',
      '',
      `Campaign Brief:\n${JSON.stringify(brief, null, 2)}`,
      '',
      'Return a JSON object with: { "subject": string, "previewText": string, "bodyText": string, "callToAction": string }',
    ].join('\n');

    const result = await Promise.race([
      ai.models.generateContent({
        model: INTERVIEW_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      }) as Promise<{ text?: string }>,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
    ]);

    if (!result?.text) {
      return buildFallbackEmail(brief, version);
    }

    const parsed = JSON.parse(result.text.replace(/```json\s*|\s*```/g, '').trim());
    if (!parsed.subject || !parsed.bodyText) {
      return buildFallbackEmail(brief, version);
    }

    // Clean any parenthetical marketing annotations or stray brackets
    const cleanedRawBody = String(parsed.bodyText)
      .replace(/\s*\([^)]*(ask|friction|list|angle|nuance|tactic|cold|lead|prospect|funnel)[^)]*\)/gi, '')
      .trim();

    const paragraphs = cleanedRawBody
      .split('\n\n')
      .map((p) => p.trim())
      .filter(Boolean);

    const bodyHtml = wrapEmailHtml(paragraphs);

    return {
      subject: sanitizeBriefField(parsed.subject),
      previewText: parsed.previewText ? sanitizeBriefField(parsed.previewText) : undefined,
      bodyText: paragraphs.join('\n\n'),
      bodyHtml,
      version,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[LiveEmailGenerator] Error generating email with AI, using fallback:', err);
    return buildFallbackEmail(brief, version);
  }
}
