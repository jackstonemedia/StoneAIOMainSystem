/**
 * SDR Inbound Reply Intent Classifier & Smart Scheduler Service
 *
 * Ingests prospect email replies, classifies their intent via Gemini,
 * and generates auto-draft responses / meeting booking proposals.
 */

import { tryGetAIClient, DEFAULT_MODEL } from '../../../packages/ai/client.js';
import { logger } from '../../utils/logger.js';

export type ReplyIntent =
  | 'POSITIVE_INTEREST'
  | 'OBJECTION'
  | 'INFORMATION_REQUEST'
  | 'UNSUBSCRIBE'
  | 'NEUTRAL_OUT_OF_OFFICE';

export interface ClassifiedReplyResult {
  intent: ReplyIntent;
  confidenceScore: number;
  reasoning: string;
  suggestedAction: 'BOOK_MEETING' | 'SEND_BATTLECARD_REPLY' | 'ANSWER_QUESTION' | 'AUTO_SUPPRESS' | 'WAIT';
  suggestedResponseDraft: string;
  proposedMeetingTimes?: string[];
}

export async function classifyInboundReply(params: {
  prospectName: string;
  prospectEmail: string;
  originalOutreachSubject: string;
  originalOutreachBody: string;
  replyMessageText: string;
  calendarUrl?: string;
}): Promise<ClassifiedReplyResult> {
  const { prospectName, originalOutreachSubject, originalOutreachBody, replyMessageText, calendarUrl } = params;

  const ai = tryGetAIClient();

  if (ai) {
    try {
      const prompt = `You are an AI Inbound Deal & Meeting Booking Assistant.
Analyze this email reply from a prospective customer and determine their intent.

ORIGINAL OUTREACH:
Subject: ${originalOutreachSubject}
Body: ${originalOutreachBody}

PROSPECT REPLY:
From: ${prospectName}
Content: "${replyMessageText}"

CALENDAR URL: ${calendarUrl || 'https://stoneaio.com/book'}

TASK:
1. Classify the intent into ONE of:
   - POSITIVE_INTEREST (asking for a call, demo, pricing, or interested)
   - OBJECTION (too expensive, using competitor, bad timing)
   - INFORMATION_REQUEST (asking how it works, technical questions)
   - UNSUBSCRIBE (wants to be removed, stop emailing)
   - NEUTRAL_OUT_OF_OFFICE (auto-responder, on vacation)
2. Generate a suggested response draft. If POSITIVE_INTEREST, propose 2 realistic meeting times (e.g., Thursday 2:00 PM or Friday 11:00 AM) and include the calendar link.
3. Return ONLY a valid JSON object with this exact structure:
{
  "intent": "POSITIVE_INTEREST",
  "confidenceScore": 95,
  "reasoning": "Prospect expressed direct interest in seeing a demo.",
  "suggestedAction": "BOOK_MEETING",
  "suggestedResponseDraft": "Hi [Name], great to connect! ...",
  "proposedMeetingTimes": ["Thursday at 2:00 PM EDT", "Friday at 11:00 AM EDT"]
}`;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);
      if (parsed.intent && parsed.suggestedResponseDraft) {
        let action = parsed.suggestedAction || 'BOOK_MEETING';
        if (parsed.intent === 'UNSUBSCRIBE' || action === 'UNSUBSCRIBE') {
          action = 'AUTO_SUPPRESS';
        } else if (parsed.intent === 'OBJECTION' || action === 'ADDRESS_OBJECTION') {
          action = 'SEND_BATTLECARD_REPLY';
        }
        return {
          intent: parsed.intent as ReplyIntent,
          confidenceScore: Number(parsed.confidenceScore) || 85,
          reasoning: parsed.reasoning || 'AI intent classification.',
          suggestedAction: action,
          suggestedResponseDraft: parsed.suggestedResponseDraft,
          proposedMeetingTimes: parsed.proposedMeetingTimes || [],
        };
      }
    } catch (e: any) {
      logger.error('[Reply Classifier] AI classification error:', e.message);
    }
  }

  // Heuristic rule-based fallback
  const lower = replyMessageText.toLowerCase();

  if (lower.includes('unsubscribe') || lower.includes('remove') || lower.includes('stop emailing') || lower.includes('not interested')) {
    return {
      intent: 'UNSUBSCRIBE',
      confidenceScore: 95,
      reasoning: 'Explicit unsubscribe or disinterest keywords detected.',
      suggestedAction: 'AUTO_SUPPRESS',
      suggestedResponseDraft: `Hi ${prospectName},\n\nYou've been unsubscribed and will not receive any further emails from us. Wishing you all the best!`,
    };
  }

  if (lower.includes('out of office') || lower.includes('on vacation') || lower.includes('auto-reply') || lower.includes('returning on')) {
    return {
      intent: 'NEUTRAL_OUT_OF_OFFICE',
      confidenceScore: 90,
      reasoning: 'Out of office automatic responder detected.',
      suggestedAction: 'WAIT',
      suggestedResponseDraft: '',
    };
  }

  if (lower.includes('too expensive') || lower.includes('already have') || lower.includes('already use') || lower.includes('no budget')) {
    return {
      intent: 'OBJECTION',
      confidenceScore: 85,
      reasoning: 'Pricing or existing provider objection detected.',
      suggestedAction: 'SEND_BATTLECARD_REPLY',
      suggestedResponseDraft: `Hi ${prospectName},\n\nCompletely understand. Many teams we partner with were initially exploring other solutions before discovering our automated ROI model.\n\nHappy to share a 1-page comparison if helpful, or we can reconnect next quarter.`,
    };
  }

  // Default positive / curious
  return {
    intent: 'POSITIVE_INTEREST',
    confidenceScore: 80,
    reasoning: 'Prospect engaged with inquiry.',
    suggestedAction: 'BOOK_MEETING',
    suggestedResponseDraft: `Hi ${prospectName},\n\nGlad to connect! I'd love to show you a quick walkthrough.\n\nDo either of these times work for a 15-minute sync?\n• Thursday at 2:00 PM EDT\n• Friday at 11:00 AM EDT\n\nOr feel free to pick whatever slot fits best directly on my calendar: ${calendarUrl || 'https://stoneaio.com/book'}\n\nLooking forward to speaking!`,
    proposedMeetingTimes: ['Thursday at 2:00 PM EDT', 'Friday at 11:00 AM EDT'],
  };
}
