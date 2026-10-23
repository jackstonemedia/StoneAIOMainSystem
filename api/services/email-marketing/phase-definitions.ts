/**
 * Phase Definitions & Campaign Brief Manager
 *
 * Defines the 8 phases of campaign creation, their lean objectives,
 * completion criteria, and functions to initialize and merge facts
 * into the single-source-of-truth CampaignBrief.
 */

import type { CampaignBrief, LiveEmailDraft } from './campaign-brief.types.js';

export type PhaseId =
  | 'goal'
  | 'audience'
  | 'cta'
  | 'sequence'
  | 'reactions'
  | 'ab_testing'
  | 'draft_refine'
  | 'review_send';

export interface PhaseDefinition {
  id: PhaseId;
  title: string;
  number: number;
  objective: string;
  definitionOfDone: string;
  requiredFields: string[];
  niceToHaveFields: string[];
  systemGuidance: string;
}

export const PHASE_DEFINITIONS: Record<PhaseId, PhaseDefinition> = {
  goal: {
    id: 'goal',
    title: 'Goal & Discovery',
    number: 1,
    objective:
      'Understand what the user wants to achieve, their offer or service, and who they want to reach.',
    definitionOfDone:
      'We know the campaign goal, the business/offer being presented, and the target audience.',
    requiredFields: ['goal'],
    niceToHaveFields: ['differentiators', 'offer', 'targetCustomer', 'customerPainPoints'],
    systemGuidance:
      'Focus on discovery. If an answer is vague (like "we are high quality"), push back to get a concrete differentiator or specific benefit.',
  },
  audience: {
    id: 'audience',
    title: 'Target Audience',
    number: 2,
    objective:
      'Define who specifically will receive this email, their relationship to the business (e.g. cold prospects vs past buyers), and any list criteria.',
    definitionOfDone:
      'The target recipient group and relationship (cold vs warm/existing) are identified.',
    requiredFields: ['audience.whoTheyAre'],
    niceToHaveFields: ['audience.sizeEstimate', 'audience.inclusions', 'audience.exclusions'],
    systemGuidance:
      'Clarify whether these prospects know the sender or if this is cold outreach, and what segment or industry they belong to.',
  },
  cta: {
    id: 'cta',
    title: 'Call to Action',
    number: 3,
    objective:
      'Define exactly ONE clear, low-friction action for the reader to take next (e.g., reply with a brief thought, pick a time on a calendar, claim a resource).',
    definitionOfDone:
      'A single concrete next step is specified.',
    requiredFields: ['cta.action'],
    niceToHaveFields: ['cta.destination', 'cta.deadline', 'cta.lowFrictionDetails'],
    systemGuidance:
      'Keep cold outreach CTAs low friction (e.g. asking for interest or a quick reply, not high-commitment demands).',
  },
  sequence: {
    id: 'sequence',
    title: 'Sequence and Timing',
    number: 4,
    objective:
      'Decide whether a single high-impact email or a spaced follow-up sequence is best, including email count and cadence.',
    definitionOfDone:
      'Sequence structure (1 email vs multiple) and timing are established.',
    requiredFields: ['sequence.count'],
    niceToHaveFields: ['sequence.spanDays', 'sequence.cadenceDescription'],
    systemGuidance:
      'Recommend the simplest sequence that achieves the goal. Suggest 2-3 emails for cold campaigns if appropriate.',
  },
  reactions: {
    id: 'reactions',
    title: 'Reactions',
    number: 5,
    objective:
      'Define what happens when prospects interact (clicked, replied, or unopened after N days).',
    definitionOfDone:
      'Key reaction triggers (e.g. alert owner on reply, follow-up if not clicked) are decided or acknowledged.',
    requiredFields: ['reactions.rulesDescription'],
    niceToHaveFields: ['reactions.rules'],
    systemGuidance:
      'Focus on clicks and replies. Recommend owner alerts and simple non-intrusive follow-ups.',
  },
  ab_testing: {
    id: 'ab_testing',
    title: 'A/B Testing',
    number: 6,
    objective:
      'Decide whether to split-test the subject line or CTA to optimize conversion before sending to the full list.',
    definitionOfDone:
      'A/B test decision is recorded (yes with variations, or skip for direct send).',
    requiredFields: ['abTest.enabled'],
    niceToHaveFields: ['abTest.testVariable', 'abTest.variantA', 'abTest.variantB'],
    systemGuidance:
      'If list size is small (<500), recommend skipping testing to avoid statistical noise.',
  },
  draft_refine: {
    id: 'draft_refine',
    title: 'Draft and Refine',
    number: 7,
    objective:
      'Review and polish the generated copy, refine the hook, subject line, or tone.',
    definitionOfDone:
      'User is satisfied with the draft email copy.',
    requiredFields: ['liveEmail.bodyText'],
    niceToHaveFields: ['tone'],
    systemGuidance:
      'Make targeted refinements based on user feedback without rewriting what works.',
  },
  review_send: {
    id: 'review_send',
    title: 'Review and Send',
    number: 8,
    objective:
      'Final review of compliance elements, sender identity, schedule window, and dispatch readiness.',
    definitionOfDone:
      'Campaign is approved for scheduling or sending.',
    requiredFields: ['liveEmail.subject'],
    niceToHaveFields: [],
    systemGuidance:
      'Verify physical address, unsubscribe presence, and valid sender credentials.',
  },
};

export function getPhaseDefinition(phaseId: PhaseId): PhaseDefinition {
  const def = PHASE_DEFINITIONS[phaseId];
  if (!def) {
    throw new Error(`Unknown phase ID: ${phaseId}`);
  }
  return def;
}

/** Check whether a nested property on CampaignBrief exists and is non-empty */
function getNestedValue(obj: any, path: string): unknown {
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr == null) return undefined;
    curr = curr[part];
  }
  return curr;
}

export function isPhaseComplete(phaseId: PhaseId, brief: CampaignBrief): boolean {
  const def = getPhaseDefinition(phaseId);
  for (const field of def.requiredFields) {
    const val = getNestedValue(brief, field);
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
  }
  return true;
}

/** Initialize a fresh, clean CampaignBrief with zero ghost assumptions */
export function initCampaignBrief(_profileSnapshot?: Record<string, unknown>): CampaignBrief {
  return {
    version: 1,
  };
}

/** Merges new facts into CampaignBrief, incrementing version */
export function mergeBriefFacts(
  current: CampaignBrief,
  incoming: Partial<CampaignBrief>
): CampaignBrief {
  const updated: CampaignBrief = {
    ...current,
    ...incoming,
    version: (current.version || 0) + 1,
  };

  // Merge customer pain points deeply if provided
  if (incoming.customerPainPoints) {
    const existing = new Set(current.customerPainPoints || []);
    for (const p of incoming.customerPainPoints) {
      if (p && typeof p === 'string' && p.trim()) existing.add(p.trim());
    }
    updated.customerPainPoints = Array.from(existing);
  }

  // Merge key facts deeply
  if (incoming.keyFacts) {
    const existing = new Set(current.keyFacts || []);
    for (const f of incoming.keyFacts) {
      if (f && typeof f === 'string' && f.trim()) existing.add(f.trim());
    }
    updated.keyFacts = Array.from(existing);
  }

  // Merge sub-briefs
  if (incoming.audience) {
    updated.audience = { ...(current.audience || {}), ...incoming.audience };
  }
  if (incoming.cta) {
    updated.cta = { ...(current.cta || {}), ...incoming.cta };
  }
  if (incoming.sequence) {
    updated.sequence = { ...(current.sequence || {}), ...incoming.sequence };
  }
  if (incoming.reactions) {
    updated.reactions = { ...(current.reactions || {}), ...incoming.reactions };
  }
  if (incoming.abTest) {
    updated.abTest = { ...(current.abTest || {}), ...incoming.abTest };
  }
  if (incoming.liveEmail) {
    updated.liveEmail = incoming.liveEmail;
  }

  return updated;
}
