/**
 * AI Routes — Stone AIO
 *
 * Content generation helpers for email campaigns and contact insights.
 * All calls proxy securely through the backend — API key never leaves the server.
 *
 * Routes:
 *   POST /api/ai/email/generate    — Write a full campaign email from a prompt
 *   POST /api/ai/email/improve     — Improve subject line or body copy
 *   POST /api/ai/email/subject     — Generate subject line ideas
 *   POST /api/ai/contact/insights  — Summarise a contact & suggest next actions
 */

import { Router, Request, Response } from 'express';
import { getAIClient, DEFAULT_MODEL } from '../../packages/ai/client.js';
import { trackLegacyAi } from '../services/legacy-ai-tracker.service.js';

const router = Router();
router.use(trackLegacyAi('legacy_ai_routes'));

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { config: { systemInstruction, temperature: 0.7 } } : { config: { temperature: 0.7 } }),
  });
  return res.text ?? '';
}

// ── POST /api/ai/email/generate — Write a full email from a prompt ────────────
router.post('/email/generate', async (req: Request, res: Response) => {
  const { prompt, campaignName, audienceDescription } = req.body as {
    prompt?: string;
    campaignName?: string;
    audienceDescription?: string;
  };

  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

  try {
    const fullPrompt = [
      campaignName && `Campaign name: ${campaignName}`,
      audienceDescription && `Target audience: ${audienceDescription}`,
      `Task: ${prompt}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = await generateText(
      fullPrompt,
      'You are an expert email copywriter specializing in high-converting marketing emails. ' +
        'Write professional, engaging email body content in clean HTML format. ' +
        'Use personalization tokens like {{first_name}} where appropriate. ' +
        'Include a clear CTA. Return only the HTML body content — no subject line, no explanations.',
    );

    return res.json({ html: text });
  } catch (err: any) {
    console.error('[AI] email/generate error:', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// ── POST /api/ai/email/improve — Improve existing email copy ─────────────────
router.post('/email/improve', async (req: Request, res: Response) => {
  const { html, instruction } = req.body as { html?: string; instruction?: string };

  if (!html?.trim()) return res.status(400).json({ error: 'html is required' });

  try {
    const prompt = instruction
      ? `Instruction: ${instruction}\n\nOriginal email HTML:\n${html}`
      : `Improve this email to be more engaging, clear, and conversion-focused:\n${html}`;

    const text = await generateText(
      prompt,
      'You are an expert email copywriter. Improve the given email HTML. ' +
        'Return only the improved HTML body content — no explanations, no markdown fences.',
    );

    return res.json({ html: text });
  } catch (err: any) {
    console.error('[AI] email/improve error:', err);
    return res.status(500).json({ error: err.message || 'Improve failed' });
  }
});

// ── POST /api/ai/email/subject — Generate subject line ideas ─────────────────
router.post('/email/subject', async (req: Request, res: Response) => {
  const { html, campaignContext } = req.body as { html?: string; campaignContext?: string };

  try {
    const prompt = [
      campaignContext && `Campaign context: ${campaignContext}`,
      html && `Email body preview:\n${html.replace(/<[^>]+>/g, ' ').trim().slice(0, 500)}`,
      'Generate 5 compelling, high-open-rate email subject line options. ' +
        'Vary the style: curiosity, urgency, personalization, benefit-driven, question. ' +
        'Return a JSON array of strings only.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', temperature: 0.9 } as any,
    });

    const raw = (response.text ?? '').trim();
    try {
      const subjects = JSON.parse(raw);
      return res.json({ subjects: Array.isArray(subjects) ? subjects : subjects.subjects ?? [] });
    } catch {
      const lines = raw
        .replace(/```json|```/gi, '')
        .trim()
        .split('\n')
        .map((l: string) => l.replace(/^[-*"\d.]+\s*/, '').replace(/[",]$/, '').trim())
        .filter(Boolean);
      return res.json({ subjects: lines.slice(0, 5) });
    }
  } catch (err: any) {
    console.error('[AI] email/subject error:', err);
    return res.status(500).json({ error: err.message || 'Subject generation failed' });
  }
});

// ── POST /api/ai/contact/insights — Summarise contact & suggest actions ───────
router.post('/contact/insights', async (req: Request, res: Response) => {
  const { contact, activities } = req.body as { contact?: any; activities?: any[] };

  if (!contact) return res.status(400).json({ error: 'contact is required' });

  try {
    const context = [
      `Contact: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email || 'no email'})`,
      contact.phone && `Phone: ${contact.phone}`,
      contact.tags?.length && `Tags: ${contact.tags.join(', ')}`,
      contact.customFields && `Custom fields: ${JSON.stringify(contact.customFields)}`,
      contact.notes && `Notes: ${contact.notes}`,
      activities?.length &&
        `Recent activity:\n${activities
          .slice(0, 10)
          .map((a: any) => `- ${a.type}: ${a.description || ''} (${new Date(a.createdAt).toLocaleDateString()})`)
          .join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = await generateText(
      context,
      'You are a CRM assistant. Analyse the contact data and provide:\n' +
        '1. A brief 2-sentence summary of who this contact is and their engagement level\n' +
        '2. 3 specific next action recommendations (be concrete and actionable)\n' +
        '3. A one-line engagement score description (cold / warm / hot)\n\n' +
        'Format your response as JSON: { "summary": "...", "nextActions": ["...", "...", "..."], "engagementScore": "..." }',
    );

    try {
      const clean = text.replace(/```json|```/gi, '').trim();
      return res.json(JSON.parse(clean));
    } catch {
      return res.json({ summary: text, nextActions: [], engagementScore: 'Unknown' });
    }
  } catch (err: any) {
    console.error('[AI] contact/insights error:', err);
    return res.status(500).json({ error: err.message || 'Insights failed' });
  }
});

export default router;
