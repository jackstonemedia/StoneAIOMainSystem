import { describe, it, expect } from 'vitest';
import {
  generateLiveEmail,
  isLiveEmailStale,
  buildFallbackEmail,
} from '../live-email-generator.service.js';
import type { CampaignBrief } from '../campaign-brief.types.js';

describe('Live Email Generator Service', () => {
  it('generates a complete, natural email draft from campaign brief', async () => {
    const brief: CampaignBrief = {
      version: 1,
      goal: 'Get new clients for my website business',
      offer: 'Custom high-speed website design',
      targetCustomer: 'Local contractors',
      tone: 'Friendly and professional',
      cta: { action: 'Reply with your website URL for a free audit' },
    };

    const email = await generateLiveEmail(brief, 1);

    expect(email).toBeDefined();
    expect(email.version).toBe(1);
    expect(email.subject).toBeTruthy();
    expect(email.bodyText).toBeTruthy();
    expect(email.bodyHtml).toBeTruthy();

    // No bracketed placeholders (other than [Your Name]), template pipe hacks, or voice agent leakage
    const bodyWithoutSignoff = email.bodyText.replace(/\[Your Name\]/g, '');
    expect(bodyWithoutSignoff).not.toMatch(/\[.*?\]/);
    expect(email.bodyText).not.toContain("| 'there'");
    expect(email.bodyText).not.toContain('Voice Agent');

    // Clean merge tag and sign-off
    expect(email.bodyText).toMatch(/\{\{first_name\}\}/);
    expect(email.bodyText).toMatch(/Best,\n(\[Your Name\]|Your Name)/);
  }, 30_000);

  it('incorporates specific offer and single CTA accurately', async () => {
    const brief: CampaignBrief = {
      version: 2,
      goal: 'Get 5 new commercial roofing clients',
      offer: 'Free 15-point roof health inspection with thermal imaging',
      cta: { action: 'Reply with your property address for the inspection' },
      targetCustomer: 'Commercial property managers',
      tone: 'Direct and professional',
    };

    const email = await generateLiveEmail(brief, 2);

    expect(email.version).toBe(2);
    const textLower = email.bodyText.toLowerCase();
    expect(textLower.includes('roof') || textLower.includes('inspection')).toBe(true);
    expect(textLower).toContain('reply');
    expect(email.bodyText).not.toContain('Voice Agent');
  }, 15_000);

  it('discards stale generations when newer version is already present', () => {
    const currentVersion = 4;
    expect(isLiveEmailStale(3, currentVersion)).toBe(true);
    expect(isLiveEmailStale(4, currentVersion)).toBe(false);
    expect(isLiveEmailStale(5, currentVersion)).toBe(false);
  });

  it('produces reliable deterministic fallback email when AI is unavailable', () => {
    const brief: CampaignBrief = {
      version: 1,
      goal: 'Get more clients for my website business',
      offer: 'Modern responsive websites',
      targetCustomer: 'Local businesses',
      cta: { action: 'Reply to see examples' },
    };

    const fallback = buildFallbackEmail(brief, 1);

    expect(fallback.version).toBe(1);
    expect(fallback.subject).toBeTruthy();
    expect(fallback.bodyText).toMatch(/\{\{first_name\}\}/);
    expect(fallback.bodyText).toContain('Best,\n[Your Name]');
    expect(fallback.bodyText).not.toContain("| 'there'");
    expect(fallback.bodyText).not.toContain('Voice Agent');
  });
});
