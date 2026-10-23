/**
 * Campaign Brief Types (Single Source of Truth)
 *
 * Holds everything learned about the campaign so far:
 * business context, target audience, customer pain points, offer,
 * goal, CTA, tone, live email draft, and downstream phases.
 */

export interface LiveEmailDraft {
  subject: string;
  previewText?: string;
  bodyText: string;
  bodyHtml: string;
  version: number;
  generatedAt: string;
}

export interface AudienceBrief {
  description?: string;
  whoTheyAre?: string;
  relationship?: 'cold' | 'warm' | 'past_clients' | 'inquiries';
  isColdOutreach?: boolean;
  sizeEstimate?: number;
  inclusions?: string;
  exclusions?: string;
}

export interface CtaBrief {
  action?: string;
  destination?: string;
  deadline?: string;
  lowFrictionDetails?: string;
}

export interface SequenceBrief {
  count?: number;
  spanDays?: number;
  cadenceDescription?: string;
  emails?: Array<{ order: number; offsetDays: number; purpose: string }>;
}

export interface ReactionsBrief {
  rulesDescription?: string;
  rules?: Array<{ condition: string; action: string; delay?: string }>;
}

export interface AbTestBrief {
  enabled?: boolean;
  testVariable?: 'subject' | 'cta';
  variantA?: string;
  variantB?: string;
  metric?: 'clicks' | 'replies';
}

export interface CampaignBrief {
  version: number;
  // Core Business & Campaign Context (captured first)
  goal?: string;
  campaignType?: string;
  isReadyToDraft?: boolean;
  businessDescription?: string;
  targetCustomer?: string;
  customerPainPoints?: string[];
  differentiators?: string;
  offer?: string;
  tone?: string;
  keyFacts?: string[];
  industryNuance?: string;

  // Downstream Phase Briefs
  audience?: AudienceBrief;
  cta?: CtaBrief;
  sequence?: SequenceBrief;
  reactions?: ReactionsBrief;
  abTest?: AbTestBrief;

  // The Live Generated Email
  liveEmail?: LiveEmailDraft;

  // Synthesis summary (for human readback)
  summaryText?: string;
}
