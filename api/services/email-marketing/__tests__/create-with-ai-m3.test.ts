/**
 * Create with AI — Milestone 3 unit tests (pure logic, no DB, no network).
 * Covers: fact validation (invented price removed, URL allowlist, placeholder
 * blocking), locked footer, tokens + coverage, tracking links, bot filtering,
 * spam heuristic, send window + recommended start, CSV parsing, and the path
 * simulator. Live API + screenshot verification is in the M3 evidence log.
 */

import { describe, it, expect } from 'vitest';

// Fixed test secret so HMAC tokens are deterministic in this process. The
// secret is read lazily by trackingToken/verifyTrackingToken, so setting it
// here (after imports) takes effect for every tracking test below.
process.env.TRACKING_SECRET = 'test-tracking-secret-for-unit-tests-only';

import {
  buildAllowedClaimSet,
  buildAllowedHosts,
  extractClaims,
  extractUrls,
  fillTokens,
  findPlaceholders,
  hasLockedFooter,
  isBotClick,
  isScannerUserAgent,
  isWithinSendWindow,
  parseRecipientCsv,
  recommendedStart,
  renderLockedFooterHtml,
  renderLockedFooterText,
  spamRiskHeuristic,
  tokenCoverage,
  trackingToken,
  usedTokens,
  validateDraftContent,
  verifyTrackingToken,
  wrapLinksForTracking,
} from '../fact-validator.js';
import {
  assertEmailEditable,
  SEND_LOCKED_EMAIL_STATUSES,
} from '../draft-generator.service.js';
import { simulatePath, buildScenarioEvents } from '../reaction-engine.service.js';
import { emailToState } from '../draft-generator.service.js';

const PROFILE = {
  businessName: 'Sparkling Homes',
  senderName: 'Jack Stone',
  replyToEmail: 'hello@sparklinghomes.com',
  physicalAddress: '123 Main St, San Jose, CA 95110',
  bookingLink: 'https://sparklinghomes.com/book',
  websiteUrl: 'https://sparklinghomes.com',
  services: 'Pressure washing from $49',
  guaranteesProof: 'Rated 4.9 stars from 200 reviews',
};

function allowedFor(extraUserTexts: string[] = []) {
  const texts = [
    PROFILE.services,
    PROFILE.guaranteesProof,
    'Fill next week with past customers. Save 20% before Friday, December 12, 2026.',
    ...extraUserTexts,
  ];
  return {
    claims: buildAllowedClaimSet(texts),
    hosts: buildAllowedHosts(PROFILE.bookingLink, PROFILE.websiteUrl, extraUserTexts),
  };
}

describe('extractClaims', () => {
  it('finds currency, percentages, dates and numbers', () => {
    const claims = extractClaims('Only $499 today, save 20% before December 12, 2026. 200 reviews, call 4085550132.');
    expect(claims).toContain('$499');
    expect(claims).toContain('20%');
    expect(claims).toContain('December 12, 2026');
    expect(claims).toContain('200');
  });
});

describe('validateDraftContent (spec §12, §21 M3)', () => {
  it('removes an invented price from the model output', () => {
    const { claims, hosts } = allowedFor();
    const v = validateDraftContent(
      {
        subjects: ['Book today for only $499'],
        previewText: 'Pressure washing from $49',
        bodyHtml: '<p>Our special price is $499 for the whole house.</p>',
        bodyText: 'Our special price is $499 for the whole house.',
      },
      claims,
      hosts,
      [{ claim: '$499', source: 'model' }],
    );
    expect(v.bodyText).not.toContain('$499');
    expect(v.bodyHtml).not.toContain('$499');
    expect(v.subjects[0]).not.toContain('$499');
    expect(v.removed.some((r) => r.claim === '$499')).toBe(true);
    // A sourced price survives untouched.
    expect(v.previewText).toContain('$49');
  });

  it('keeps sourced numbers, dates and percentages', () => {
    const { claims, hosts } = allowedFor();
    const v = validateDraftContent(
      {
        subjects: ['Save 20% before Friday'],
        previewText: 'Rated 4.9 stars from 200 reviews',
        bodyHtml: '<p>Save 20% before December 12, 2026. Rated 4.9 stars from 200 reviews.</p>',
        bodyText: 'Save 20% before December 12, 2026.',
      },
      claims,
      hosts,
      [],
    );
    expect(v.removed).toEqual([]);
    expect(v.bodyText).toContain('20%');
    expect(v.bodyText).toContain('December 12, 2026');
  });

  it('replaces a disallowed URL with a blocking placeholder, keeps allowlisted URLs', () => {
    const { claims, hosts } = allowedFor(['See https://example.com/menu for details']);
    const v = validateDraftContent(
      {
        subjects: ['Book now'],
        previewText: 'Book now',
        bodyHtml: '<p><a href="https://evil.example/x">Claim your prize</a> <a href="https://sparklinghomes.com/book">Book</a> <a href="https://example.com/menu">Menu</a></p>',
        bodyText: 'See https://evil.example/x and https://sparklinghomes.com/book',
      },
      claims,
      hosts,
      [],
    );
    expect(v.bodyHtml).toContain('{{NEEDS: link destination}}');
    expect(v.bodyHtml).toContain('https://sparklinghomes.com/book');
    expect(v.bodyHtml).toContain('https://example.com/menu');
    expect(v.unmappedUrls).toContain('https://evil.example/x');
    expect(v.placeholders.length).toBeGreaterThan(0);
  });

  it('preserves existing placeholders (never silently resolves them)', () => {
    const { claims, hosts } = allowedFor();
    const v = validateDraftContent(
      {
        subjects: ['Book now'],
        previewText: 'Book now',
        bodyHtml: '<p>Your price is {{NEEDS: price}}.</p>',
        bodyText: 'Your price is {{NEEDS: price}}.',
      },
      claims,
      hosts,
      [],
    );
    expect(v.placeholders).toContain('{{NEEDS: price}}');
  });

  it('caps preview text at 90 characters', () => {
    const { claims, hosts } = allowedFor();
    const v = validateDraftContent(
      { subjects: ['Hi'], previewText: 'x'.repeat(200), bodyHtml: '<p>Hi</p>', bodyText: 'Hi' },
      claims,
      hosts,
      [],
    );
    expect(v.previewText.length).toBeLessThanOrEqual(90);
  });
});

describe('findPlaceholders', () => {
  it('finds all placeholders', () => {
    expect(findPlaceholders('a {{NEEDS: price}} b {{NEEDS: date}}')).toEqual(['{{NEEDS: price}}', '{{NEEDS: date}}']);
    expect(findPlaceholders('nothing here')).toEqual([]);
  });
});

describe('locked footer (spec §17)', () => {
  it('renders business name, address and unsubscribe, and detects presence', () => {
    const unsub = 'https://app.example.com/unsubscribe/abc';
    const html = renderLockedFooterHtml(PROFILE, unsub);
    const text = renderLockedFooterText(PROFILE, unsub);
    expect(html).toContain('Sparkling Homes');
    expect(html).toContain('123 Main St');
    expect(html).toContain(unsub);
    expect(html).toContain('data-locked-footer="true"');
    expect(hasLockedFooter(html, text)).toBe(true);
    expect(hasLockedFooter('<p>No footer</p>', 'No footer')).toBe(false);
  });
});

describe('tokens (spec §12)', () => {
  it('fills tokens with fallbacks and leaves unknown tokens alone', () => {
    const out = fillTokens('Hi {{first_name|there}}, book at {{booking_link}} or call {{phone|us}}.', {
      firstName: 'Alex',
      bookingLink: 'https://sparklinghomes.com/book',
    });
    expect(out).toBe('Hi Alex, book at https://sparklinghomes.com/book or call us.');
    expect(fillTokens('Hello {{unknown_token}}', {})).toBe('Hello {{unknown_token}}');
  });

  it('reports used tokens and per-token missing counts', () => {
    const text = 'Hi {{first_name|there}} from {{business_name|us}} — {{phone}}';
    expect(usedTokens(text)).toEqual(['first_name', 'business_name', 'phone']);
    const cov = tokenCoverage(
      [
        { firstName: 'A', businessName: 'B', phone: '1' },
        { firstName: null, businessName: null, phone: null },
      ],
      ['first_name', 'business_name', 'phone'],
    );
    expect(cov.first_name).toEqual({ missing: 1, total: 2 });
    expect(cov.phone).toEqual({ missing: 1, total: 2 });
  });
});

describe('tracking links (spec §18)', () => {
  it('wraps http links with UTM params and a per-recipient token, skips the rest', () => {
    const wrapped = wrapLinksForTracking(
      '<p><a href="https://sparklinghomes.com/book">Book</a> <a href="/unsubscribe/abc">Unsub</a> <a href="mailto:a@b.com">Mail</a></p>',
      { trackBase: 'https://app.example.com/api/email-marketing/track/click', workspaceId: 'w1', contactId: 'c1', campaignId: 'cmp1', emailOrder: 1 },
    );
    expect(wrapped).toContain('track/click?');
    expect(wrapped).toContain('utm_source%3Demail');
    expect(wrapped).toContain('utm_campaign%3Dcmp1');
    expect(wrapped).toContain('/unsubscribe/abc');
    expect(wrapped).toContain('mailto:a@b.com');
  });

  it('signs the wrapped link: the token verifies for its destination and nothing else (spec §20)', () => {
    const wrapped = wrapLinksForTracking(
      '<p><a href="https://sparklinghomes.com/book">Book</a></p>',
      { trackBase: 'https://app.example.com/api/email-marketing/track/click', workspaceId: 'w1', contactId: 'c1', campaignId: 'cmp1', emailOrder: 1 },
    );
    const href = wrapped.match(/href="([^"]+)"/)?.[1] || '';
    const q = new URL(href).searchParams;
    const token = q.get('t') || '';
    const dest = q.get('url') || '';
    expect(token).toContain('.');
    expect(verifyTrackingToken(token, 'cmp1', 'c1', dest)).toBe(true);
    // Tampered destination, campaign or contact must all fail.
    expect(verifyTrackingToken(token, 'cmp1', 'c1', 'https://evil.example.com/steal')).toBe(false);
    expect(verifyTrackingToken(token, 'cmp2', 'c1', dest)).toBe(false);
    expect(verifyTrackingToken(token, 'cmp1', 'c2', dest)).toBe(false);
    expect(verifyTrackingToken('not-a-token', 'cmp1', 'c1', dest)).toBe(false);
    expect(verifyTrackingToken('', 'cmp1', 'c1', dest)).toBe(false);
  });

  it('a token signed for one destination does not verify for another (no open redirect)', () => {
    const token = trackingToken('cmp1', 'c1', 'email', 'https://sparklinghomes.com/book?utm_source=email&utm_medium=stone&utm_campaign=cmp1&utm_content=1');
    expect(verifyTrackingToken(token, 'cmp1', 'c1', 'https://sparklinghomes.com/book?utm_source=email&utm_medium=stone&utm_campaign=cmp1&utm_content=1')).toBe(true);
    expect(verifyTrackingToken(token, 'cmp1', 'c1', 'https://sparklinghomes.com/book')).toBe(false);
  });
});

describe('email send-state guard (M3 status anomaly repair)', () => {
  it('blocks content changes for scheduled, sending, sent and paused emails', () => {
    for (const status of ['scheduled', 'sending', 'sent', 'paused']) {
      expect(SEND_LOCKED_EMAIL_STATUSES.has(status)).toBe(true);
      expect(() => assertEmailEditable(status, null)).toThrow();
    }
  });

  it('allows content changes for draft, ready and cancelled emails with no live campaign', () => {
    for (const status of ['draft', 'ready', 'cancelled']) {
      expect(() => assertEmailEditable(status, null)).not.toThrow();
      expect(() => assertEmailEditable(status, 'CANCELLED')).not.toThrow();
    }
  });

  it('blocks a change when the linked campaign is live even if the email row disagrees (the anomaly shape)', () => {
    // The anomalous row: email 'draft' but its campaign already SENT.
    expect(() => assertEmailEditable('draft', 'SENT')).toThrow();
    expect(() => assertEmailEditable('draft', 'SCHEDULED')).toThrow();
    expect(() => assertEmailEditable('draft', 'PAUSED')).toThrow();
    // A cancelled campaign does not lock the email (re-confirm is allowed).
    expect(() => assertEmailEditable('draft', 'CANCELLED')).not.toThrow();
  });
});

describe('bot filtering (spec §18)', () => {
  it('flags clicks within 10 seconds of delivery', () => {
    const delivered = new Date('2026-10-21T12:00:00Z');
    expect(isBotClick(delivered, new Date('2026-10-21T12:00:05Z'), 'Mozilla/5.0')).toBe(true);
    expect(isBotClick(delivered, new Date('2026-10-21T12:05:00Z'), 'Mozilla/5.0')).toBe(false);
  });

  it('flags scanner user agents regardless of timing', () => {
    const delivered = new Date('2026-10-21T12:00:00Z');
    expect(isBotClick(delivered, new Date('2026-10-21T13:00:00Z'), 'Googlebot/2.1')).toBe(true);
    expect(isScannerUserAgent('AppleMail/16.0')).toBe(true);
    expect(isScannerUserAgent('Mozilla/5.0 (Macintosh)')).toBe(false);
  });
});

describe('spam heuristic (spec §13 warning)', () => {
  it('scores trigger phrases and all-caps words high', () => {
    const high = spamRiskHeuristic('ACT NOW FREE MONEY!!!', 'Act now! Guaranteed FREE MONEY with no risk!!!');
    expect(high.high).toBe(true);
    expect(high.reasons.length).toBeGreaterThan(0);
    const low = spamRiskHeuristic('Your driveway cleaning is due', 'Hi Alex, just a friendly note that your annual cleaning is due this month.');
    expect(low.high).toBe(false);
  });
});

describe('send window (spec §13)', () => {
  it('accepts weekday daytime, rejects nights and weekends', () => {
    // 2026-10-21 is a Wednesday; 2026-10-24 is a Saturday (verified by date).
    expect(isWithinSendWindow(new Date('2026-10-21T17:00:00Z'), 'America/Los_Angeles')).toBe(true); // 10:00 PDT
    expect(isWithinSendWindow(new Date('2026-10-21T04:00:00Z'), 'America/Los_Angeles')).toBe(false); // 21:00 PDT prior day
    expect(isWithinSendWindow(new Date('2026-10-24T17:00:00Z'), 'America/Los_Angeles')).toBe(false); // Saturday
  });

  it('recommended start lands inside the window with a reason', () => {
    const { atUtc, reason } = recommendedStart(new Date('2026-10-24T17:00:00Z'), 'America/Los_Angeles'); // Saturday
    expect(isWithinSendWindow(atUtc, 'America/Los_Angeles')).toBe(true);
    expect(reason).toContain('America/Los_Angeles');
  });
});

describe('CSV parsing (spec §13)', () => {
  it('parses valid rows, rejects bad emails, dedupes', () => {
    const parsed = parseRecipientCsv(
      'email,first_name,last_name,phone,company\njane@example.com,Jane,Rivera,,Acme\nbad-email,Bob,,,\nJANE@example.com,Jane2,Rivera2,,\n,NoEmail,,,\n',
    );
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.contacts[0]).toEqual({ email: 'jane@example.com', firstName: 'Jane', lastName: 'Rivera', phone: undefined, company: 'Acme' });
    expect(parsed.duplicates).toBe(1);
    expect(parsed.rejected).toHaveLength(2);
  });

  it('requires an email column', () => {
    const parsed = parseRecipientCsv('name\nJane\n');
    expect(parsed.contacts).toHaveLength(0);
    expect(parsed.rejected[0].reason).toBe('Missing email column');
  });
});

describe('path simulator (spec §13)', () => {
  it('returns the single email send step for every scenario (no rules)', () => {
    for (const s of ['did_not_open', 'opened_no_click', 'clicked', 'clicked_link', 'clicked_not_replied', 'replied', 'bounced']) {
      const { events, horizon } = buildScenarioEvents(s);
      const sim = simulatePath({ rules: [], sequenceCount: 1, events, horizon });
      expect(sim.steps[0].what).toBe('Email 1 sent.');
    }
  });
});

describe('emailToState', () => {
  it('maps a row to state and surfaces placeholders', () => {
    const state = emailToState({
      id: 'e1',
      draftId: 'd1',
      campaignId: null,
      kind: 'scheduled',
      order: 1,
      name: 'Email 1',
      purpose: 'Test',
      subjectVariants: ['A', 'B', 'C'],
      subjectSelected: 1,
      previewText: 'Preview',
      bodyHtml: '<p>Price {{NEEDS: price}}</p>',
      bodyText: 'Price {{NEEDS: price}}',
      cta: null,
      factMap: [],
      versions: [],
      status: 'draft',
      scheduledAtUtc: null,
      coldAck: false,
      recipientCount: null,
    });
    expect(state.subjectSelected).toBe(1);
    expect(state.placeholders).toEqual(['{{NEEDS: price}}']);
  });
});

describe('extractUrls', () => {
  it('finds http(s) URLs and trims trailing punctuation', () => {
    expect(extractUrls('See https://example.com/menu, and http://a.com/x.')).toEqual([
      'https://example.com/menu',
      'http://a.com/x',
    ]);
  });
});

describe('removeClaim (boundary-aware)', () => {
  it('does not eat a claim glued inside a larger number', async () => {
    const { removeClaim } = await import('../fact-validator.js');
    expect(removeClaim('Sale ends December 2026, only 20 spots', '20')).toBe('Sale ends December 2026, only  spots');
    expect(removeClaim('Price $499 today', '$499')).toBe('Price  today');
    expect(removeClaim('Price $4990 today', '$499')).toBe('Price $4990 today');
    expect(removeClaim('Save 20% now, 200 left', '200')).toBe('Save 20% now,  left');
  });
});

describe('allowedSourcesFor (spec §12: samples are style-only, never fact sources)', () => {
  it('excludes sample content from the allowed claim set', async () => {
    const { allowedSourcesFor } = await import('../draft-generator.service.js');
    const { buildAllowedClaimSet } = await import('../fact-validator.js');
    const draft = {
      profileSnapshot: {
        businessName: 'Sparkling Homes',
        services: 'Pressure washing',
        samples: [{ content: 'Our special price is $999, book today!' }],
        styleSummaries: [{ summary: 'Friendly tone, mentions $999 deals' }],
      },
      brief: { must_include_facts: ['Pressure washing from $49'] },
      conversation: [{ role: 'user', text: 'We serve San Jose' }],
    };
    const { texts } = allowedSourcesFor(draft);
    const allowed = buildAllowedClaimSet(texts);
    expect(allowed.has('49')).toBe(true); // from the Brief
    expect(allowed.has('999')).toBe(false); // sample price must not validate
  });
});

describe('validateDraftContent keepClaims (direct-edit new facts)', () => {
  it('keeps user-typed claims instead of removing them, and reports them', async () => {
    const { validateDraftContent, buildAllowedClaimSet, buildAllowedHosts, normalizeClaim } = await import('../fact-validator.js');
    const allowed = buildAllowedClaimSet(['Pressure washing from $49']);
    const hosts = buildAllowedHosts('https://sparklinghomes.com/book', 'https://sparklinghomes.com', []);
    const keep = new Set(['799'].map(normalizeClaim));
    const v = validateDraftContent(
      { subjects: ['Deal'], previewText: 'Deal', bodyHtml: '<p>New price $799 for driveways.</p>', bodyText: 'New price $799 for driveways.' },
      allowed,
      hosts,
      [],
      keep,
    );
    expect(v.bodyText).toContain('$799');
    expect(v.removed).toEqual([]);
    expect(v.kept).toContain('$799');
  });
});

describe('validateDraftContent placeholders in href attributes', () => {
  it('counts a disallowed-URL placeholder inside an href as blocking', async () => {
    const { validateDraftContent, buildAllowedClaimSet, buildAllowedHosts } = await import('../fact-validator.js');
    const allowed = buildAllowedClaimSet([]);
    const hosts = buildAllowedHosts(null, null, []);
    const v = validateDraftContent(
      { subjects: ['Hi'], previewText: 'Hi', bodyHtml: '<p><a href="https://evil.example/x">Prize</a></p>', bodyText: 'Prize' },
      allowed,
      hosts,
      [],
    );
    expect(v.placeholders).toContain('{{NEEDS: link destination}}');
    expect(v.unmappedUrls).toContain('https://evil.example/x');
  });
});

describe('locked footer protection in the validator (spec §17)', () => {
  it('never rewrites the footer unsubscribe link, and repairs a broken footer on save', async () => {
    const { validateDraftContent, buildAllowedClaimSet, buildAllowedHosts, ensureDraftFooter, hasLockedFooter, renderLockedFooterHtml } = await import('../fact-validator.js');
    const footer = renderLockedFooterHtml({ businessName: 'Sparkling Homes', physicalAddress: '123 Main St' }, 'https://example.invalid/unsubscribe/draft');
    const v = validateDraftContent(
      { subjects: ['Hi'], previewText: 'Hi', bodyHtml: `<p><a href="https://evil.example/x">Prize</a></p>${footer}`, bodyText: 'Prize\n\n---\nSparkling Homes · 123 Main St\nUnsubscribe: https://example.invalid/unsubscribe/draft' },
      buildAllowedClaimSet([]),
      buildAllowedHosts(null, null, []),
      [],
    );
    expect(v.bodyHtml).toContain('https://example.invalid/unsubscribe/draft');
    expect(v.bodyHtml).toContain('{{NEEDS: link destination}}');
    expect(hasLockedFooter(v.bodyHtml, v.bodyText)).toBe(true);

    // A footer whose unsubscribe link was damaged is repaired, not left broken.
    const broken = '<div data-locked-footer="true"><p>Sparkling Homes · 123 Main St</p><p></p></div>';
    const fixed = ensureDraftFooter(`<p>Hi</p>${broken}`, 'Hi\n\n---\nSparkling Homes · 123 Main St\nUnsubscribe: {{NEEDS: link destination}}', { businessName: 'Sparkling Homes', physicalAddress: '123 Main St' }, 'https://example.invalid/unsubscribe/draft');
    expect(fixed.bodyHtml).toContain('https://example.invalid/unsubscribe/draft');
    expect(hasLockedFooter(fixed.bodyHtml, fixed.bodyText)).toBe(true);
    expect(fixed.bodyHtml.match(/data-locked-footer="true"/g)?.length).toBe(1);
  });
});

describe('extractClaims ranges', () => {
  it('does not split a matched date into bare numbers', async () => {
    const { extractClaims } = await import('../fact-validator.js');
    expect(extractClaims('Offer ends Friday, December 18, 2026.')).toEqual(['December 18, 2026']);
    expect(extractClaims('200 reviews, save 20%')).toEqual(['200', '20%']);
  });
});
