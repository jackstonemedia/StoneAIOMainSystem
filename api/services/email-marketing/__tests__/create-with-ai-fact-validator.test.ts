/**
 * Create with AI — Milestone 3 unit tests for the fact validator (pure logic,
 * no DB, no network). Covers the spec §12 hard requirement: the model never
 * invents facts — code extracts numbers, currency, dates and URLs and checks
 * them against the allowed source set (profile + Brief + typed messages).
 * Unmapped numeric/date claims are REMOVED; disallowed URLs become a
 * {{NEEDS: link destination}} placeholder that blocks sending.
 * Samples are NEVER sources: a price that appears only in a writing sample
 * must not leak into a draft.
 *
 * NOTE: this tests the validator in fact-validator.ts (the adopted M3
 * implementation). An earlier duplicate validator (fact-validator.service.ts)
 * was removed to avoid two validators drifting.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAllowedClaimSet,
  buildAllowedHosts,
  validateDraftContent,
  findPlaceholders,
} from '../fact-validator.js';

const BOOKING = 'https://sparkling.example/book';

function allowed(extra: string[] = []) {
  const texts = [
    'Sparkling Homes, driveway and walkway pressure washing, San Jose',
    'Past customers from 2022 and 2023 who have not booked since, flat $149 driveway and walkway pressure wash through Nov 15. They book through my link. We bring our own water, two-person crew, about 600 driveways in San Jose. Do not promise it removes every stain.',
    ...extra,
  ];
  return {
    claims: buildAllowedClaimSet(texts),
    hosts: buildAllowedHosts(BOOKING, null, texts),
  };
}

const BASE_DRAFT = {
  subjects: ['Your driveway deserves a $149 refresh'],
  previewText: 'Past customers save through Nov 15',
  bodyHtml: '<p>Hi there, get your driveway and walkway pressure washed for a flat $149 through Nov 15.</p><p><a href="https://sparkling.example/book">Book now</a></p>',
  bodyText: 'Hi there, get your driveway and walkway pressure washed for a flat $149 through Nov 15. Book now: https://sparkling.example/book',
};

describe('fact validator (M3)', () => {
  it('keeps every claim that traces to the Brief or profile', () => {
    const { claims, hosts } = allowed();
    const out = validateDraftContent(BASE_DRAFT, claims, hosts, []);
    expect(out.removed).toEqual([]);
    expect(out.placeholders).toEqual([]);
    expect(out.bodyText).toContain('$149');
    expect(out.bodyText).toContain('Nov 15');
  });

  it('removes an invented price (spec §21 M3: invented price is removed)', () => {
    const { claims, hosts } = allowed();
    const out = validateDraftContent(
      { ...BASE_DRAFT, bodyText: 'Only $199 this week, down from $299!' },
      claims, hosts, [],
    );
    expect(out.bodyText).not.toContain('$199');
    expect(out.bodyText).not.toContain('$299');
    expect(out.removed.map((r) => r.claim)).toContain('$199');
    expect(out.removed.map((r) => r.claim)).toContain('$299');
  });

  it('removes invented bare numbers and dates, keeps allowed ones', () => {
    const { claims, hosts } = allowed();
    const out = validateDraftContent(
      { ...BASE_DRAFT, bodyText: 'We have done 600 driveways in San Jose and 40 new builds, offer ends Dec 25.' },
      claims, hosts, [],
    );
    expect(out.bodyText).toContain('600 driveways');
    expect(out.bodyText).not.toContain('40 new builds');
    expect(out.bodyText).not.toContain('Dec 25');
  });

  it('never leaks a price that appears only in a writing sample', () => {
    // The sample mentions $89. Sources exclude sample content by construction.
    const { claims, hosts } = allowed();
    const out = validateDraftContent(
      { ...BASE_DRAFT, bodyText: 'This week only: $89 driveway wash!' },
      claims, hosts, [],
    );
    expect(out.bodyText).not.toContain('$89');
    expect(out.removed.map((r) => r.claim)).toContain('$89');
  });

  it('allows the profile booking link and user-typed URLs, blocks invented URLs', () => {
    const { claims, hosts } = allowed(['See our work at https://sparkling.example/gallery for examples.']);
    const out = validateDraftContent(
      {
        ...BASE_DRAFT,
        bodyHtml: '<p><a href="https://sparkling.example/book">Book</a> or see <a href="https://evil.example/claim">our deal page</a>.</p>',
        bodyText: 'Book: https://sparkling.example/book — details: https://evil.example/claim',
      },
      claims, hosts, [],
    );
    expect(out.bodyHtml).toContain('href="https://sparkling.example/book"');
    expect(out.bodyHtml).not.toContain('evil.example');
    expect(out.bodyHtml).toContain('{{NEEDS: link destination}}');
    expect(out.bodyText).toContain('https://sparkling.example/book');
    expect(out.bodyText).not.toContain('evil.example');
    expect(out.placeholders).toContain('{{NEEDS: link destination}}');
  });

  it('allows any URL on the profile website domain', () => {
    const claims = buildAllowedClaimSet(['Our site is https://sparkling.example.']);
    const hosts = buildAllowedHosts(BOOKING, 'https://sparkling.example', []);
    const out = validateDraftContent(
      {
        subjects: ['See our services'],
        previewText: 'Details inside',
        bodyHtml: '<p>See <a href="https://sparkling.example/services">services</a>.</p>',
        bodyText: 'See https://sparkling.example/services for details.',
      },
      claims, hosts, [],
    );
    expect(out.removed).toEqual([]);
  });

  it('does not treat HTML tag attributes as claims', () => {
    const { claims, hosts } = allowed();
    const out = validateDraftContent(
      { ...BASE_DRAFT, bodyHtml: '<table width="600"><tr><td>Flat $149 through Nov 15.</td></tr></table>' },
      claims, hosts, [],
    );
    expect(out.removed).toEqual([]);
  });

  it('findPlaceholders reports placeholders in a text', () => {
    expect(findPlaceholders('A {{NEEDS: link destination}} here.')).toEqual(['{{NEEDS: link destination}}']);
    expect(findPlaceholders('Nothing missing here.')).toEqual([]);
  });

  it('a clean draft has no placeholders', () => {
    const { claims, hosts } = allowed();
    const out = validateDraftContent(BASE_DRAFT, claims, hosts, []);
    expect(out.placeholders).toEqual([]);
  });
});
