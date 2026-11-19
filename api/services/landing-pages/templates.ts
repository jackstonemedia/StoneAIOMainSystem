/**
 * Landing page starter templates (Wave 1 item 1.1 / outline 02-17).
 * Each template is a fixed sectionsJson preset. Section shape follows the
 * PageSection stub in src/types/index.ts: { id, type, config }.
 * Section types in v1: hero | text | image | form | cta.
 */
export interface LandingPageSection {
  id: string;
  type: 'hero' | 'text' | 'image' | 'form' | 'cta';
  config: Record<string, unknown>;
}

export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  sections: LandingPageSection[];
}

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'A simple page that trades something useful for an email address.',
    sections: [
      {
        id: 'sec-hero-1',
        type: 'hero',
        config: {
          heading: 'Get the free guide',
          subheading: 'The five things every business should check before spending on ads.',
          buttonText: 'Download now',
        },
      },
      {
        id: 'sec-form-1',
        type: 'form',
        config: { heading: 'Send it to me', buttonText: 'Get the guide' },
      },
      {
        id: 'sec-text-1',
        type: 'text',
        config: {
          body: 'Join 500+ business owners getting one practical marketing tip a week. No spam, unsubscribe anytime.',
        },
      },
    ],
  },
  {
    id: 'event',
    name: 'Event / Webinar',
    description: 'Announce an event and collect reservations.',
    sections: [
      {
        id: 'sec-hero-1',
        type: 'hero',
        config: {
          heading: 'Live workshop: win more local customers',
          subheading: 'Thursday at 6pm — 45 minutes, live Q&A at the end.',
          buttonText: 'Reserve my seat',
        },
      },
      {
        id: 'sec-text-1',
        type: 'text',
        config: {
          heading: 'What you will learn',
          body: 'How to turn your website into a lead machine, which numbers actually matter, and the three mistakes that waste most small-business marketing budgets.',
        },
      },
      {
        id: 'sec-form-1',
        type: 'form',
        config: { heading: 'Reserve your seat', buttonText: 'Save my seat' },
      },
      {
        id: 'sec-cta-1',
        type: 'cta',
        config: { heading: 'Seats are limited', buttonText: 'Reserve now' },
      },
    ],
  },
  {
    id: 'offer',
    name: 'Product Offer',
    description: 'Present one offer with a clear call to action.',
    sections: [
      {
        id: 'sec-hero-1',
        type: 'hero',
        config: {
          heading: 'The starter package, done for you',
          subheading: 'Everything a new business needs to start getting leads — set up in a week.',
          buttonText: 'Claim the offer',
        },
      },
      {
        id: 'sec-text-1',
        type: 'text',
        config: {
          heading: 'What is included',
          body: 'A landing page, a lead form wired to your CRM, and a follow-up email that goes out automatically.',
        },
      },
      {
        id: 'sec-cta-1',
        type: 'cta',
        config: { heading: 'Ready when you are', buttonText: 'Claim the offer' },
      },
      {
        id: 'sec-form-1',
        type: 'form',
        config: { heading: 'Claim the offer', buttonText: 'Claim the offer' },
      },
    ],
  },
];

export function getLandingPageTemplate(templateId: string): LandingPageTemplate | undefined {
  return LANDING_PAGE_TEMPLATES.find((t) => t.id === templateId);
}
