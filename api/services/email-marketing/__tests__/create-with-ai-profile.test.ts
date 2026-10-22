/**
 * Create with AI — Milestone 1 unit tests (pure logic, no DB, no network).
 * Covers: profile validation, missing-required computation, style-summary parsing,
 * upload text extraction (.txt + error paths), prefill HTML extraction + SSRF guards.
 * .docx/.pdf parsing and live prefill fetching are verified against the running
 * build (see the M1 evidence log), not here, because they need real files/network.
 */

import { describe, it, expect } from 'vitest';
import {
  validateProfile,
  missingRequiredFields,
  parseStyleSummary,
  extractUploadText,
} from '../business-profile.service.js';
import {
  htmlToText,
  extractFromPage,
  assertFetchable,
} from '../website-prefill.service.js';

const VALID = {
  businessName: 'Sparkling Homes',
  businessType: 'Exterior cleaning company',
  services: 'Pressure washing\nGutter cleaning',
  serviceArea: 'San Jose',
  senderName: 'Jack Stone',
  replyToEmail: 'hello@sparkling.example',
  physicalAddress: '123 Main St, San Jose, CA 95112',
  bookingLink: 'https://sparkling.example/book',
  phone: '',
};

describe('validateProfile', () => {
  it('passes a complete profile', () => {
    expect(validateProfile(VALID)).toEqual({});
  });

  it('passes with phone instead of a booking link', () => {
    expect(validateProfile({ ...VALID, bookingLink: '', phone: '(408) 555-0132' })).toEqual({});
  });

  it('requires every required field plus booking-link-or-phone', () => {
    const errors = validateProfile({});
    for (const key of ['businessName', 'businessType', 'services', 'serviceArea', 'senderName', 'replyToEmail', 'physicalAddress', 'bookingLink']) {
      expect(errors[key]).toBeTruthy();
    }
  });

  it('rejects a bad reply-to email', () => {
    expect(validateProfile({ ...VALID, replyToEmail: 'not-an-email' }).replyToEmail).toBeTruthy();
  });

  it('rejects a non-http booking link', () => {
    expect(validateProfile({ ...VALID, bookingLink: 'ftp://example.com/x' }).bookingLink).toBeTruthy();
  });

  it('rejects over-long fields', () => {
    expect(validateProfile({ ...VALID, businessName: 'x'.repeat(5001) }).businessName).toBeTruthy();
  });
});

describe('missingRequiredFields', () => {
  it('lists everything when there is no profile', () => {
    const missing = missingRequiredFields(null);
    expect(missing).toContain('Business name');
    expect(missing).toContain('Booking link or phone');
  });

  it('is empty for a complete profile', () => {
    expect(missingRequiredFields(VALID as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('names only the gaps', () => {
    const missing = missingRequiredFields({ ...VALID, senderName: '', bookingLink: '', phone: '' } as unknown as Record<string, unknown>);
    expect(missing).toEqual(['Sender name', 'Booking link or phone']);
  });
});

describe('parseStyleSummary', () => {
  it('keeps known fields and drops unknown ones', () => {
    const parsed = parseStyleSummary({
      formality: 'casual',
      greeting: 'Hey there',
      recurringPhrases: ['no worries', 42],
      injected: 'drop me',
    });
    expect(parsed?.formality).toBe('casual');
    expect(parsed?.recurringPhrases).toEqual(['no worries']);
    expect((parsed as Record<string, unknown>).injected).toBeUndefined();
  });

  it('rejects non-objects', () => {
    expect(parseStyleSummary(null)).toBeNull();
    expect(parseStyleSummary('nope')).toBeNull();
    expect(parseStyleSummary([1, 2])).toBeNull();
  });
});

describe('extractUploadText', () => {
  it('reads .txt content', async () => {
    const text = await extractUploadText('note.txt', 'text/plain', Buffer.from('Hello\nWorld\n'));
    expect(text).toBe('Hello\nWorld');
  });

  it('rejects unsupported types', async () => {
    await expect(extractUploadText('evil.exe', 'application/octet-stream', Buffer.from('x'))).rejects.toThrow('Unsupported file type');
  });

  it('rejects empty files', async () => {
    await expect(extractUploadText('empty.txt', 'text/plain', Buffer.from('   \n  '))).rejects.toThrow('No readable text');
  });
});

const FIXTURE_HTML = `
<html><head><title>Sparkling Homes | Exterior Cleaning</title>
<script>var secret = 1;</script>
<style>.x { color: red; }</style></head>
<body>
<h1>Welcome to Sparkling Homes</h1>
<p>Proudly serving San Jose and Santa Clara.</p>
<p>Call us at (408) 555-0132 or visit our office at 123 Main St, San Jose, CA 95112.</p>
<ul><li>Pressure washing</li><li>Gutter cleaning</li><li>Window cleaning</li></ul>
<a href="/book-now">Book now</a>
</body></html>`;

describe('prefill extraction', () => {
  it('strips scripts and styles', () => {
    const text = htmlToText(FIXTURE_HTML);
    expect(text).not.toContain('secret');
    expect(text).not.toContain('color: red');
    expect(text).toContain('Welcome to Sparkling Homes');
  });

  it('extracts home-page fields', () => {
    const { suggestions } = extractFromPage(FIXTURE_HTML, 'https://sparkling.example/', 'home');
    expect(suggestions.businessName).toBe('Sparkling Homes');
    expect(suggestions.phone).toContain('408');
    expect(suggestions.physicalAddress).toContain('123 Main St');
    expect(suggestions.serviceArea).toContain('San Jose');
    expect(suggestions.bookingLink).toBe('https://sparkling.example/book-now');
    expect(suggestions.services).toContain('Pressure washing');
  });

  it('does not invent fields that are absent', () => {
    const { suggestions } = extractFromPage('<html><body><p>Nothing here.</p></body></html>', 'https://example.com/', 'home');
    expect(suggestions.businessName).toBeUndefined();
    expect(suggestions.phone).toBeUndefined();
  });
});

describe('assertFetchable SSRF guards', () => {
  it('rejects non-http schemes', async () => {
    await expect(assertFetchable('ftp://example.com/x')).rejects.toThrow();
  });

  it('rejects localhost', async () => {
    await expect(assertFetchable('http://localhost:4000/x')).rejects.toThrow();
  });

  it('rejects private IP literals', async () => {
    await expect(assertFetchable('http://127.0.0.1/x')).rejects.toThrow();
    await expect(assertFetchable('http://192.168.1.10/x')).rejects.toThrow();
    await expect(assertFetchable('http://10.0.0.5/x')).rejects.toThrow();
  });
});
