/**
 * Validator Service — Lead Studio
 * 5-layer validation pipeline:
 *  1. Schema.org source gets high base score
 *  2. tel: link source gets medium base score
 *  3. Context filter: removes obvious junk (fax lines, footer disclaimers)
 *  4. Phone format validation (E.164 check via regex — no external library needed)
 *  5. Final confidence score calculation (reject if < 60)
 */

import { RawLeadData } from './extractor.service.js';

// US phone regex: (123) 456-7890 | 123-456-7890 | +11234567890
const US_PHONE_REGEX = /^[\+]?1?[-.\s]?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$/;
// Remove non-numeric for normalization
const normalize = (p: string) => p.replace(/\D/g, '');

// Junk context phrases that indicate a non-primary phone
const JUNK_PATTERNS = [/fax/i, /tty/i, /toll.?free.+outside/i, /hearing.?impaired/i];

function isLikelyJunk(phone: string, contextHtml?: string): boolean {
  if (!contextHtml) return false;
  return JUNK_PATTERNS.some(p => p.test(contextHtml));
}

function validatePhoneFormat(phone: string): boolean {
  const digits = normalize(phone);
  // Must be 10 digits (US local) or 11 digits starting with 1 (US with country code)
  if (digits.length === 10) return /^[2-9]/.test(digits);
  if (digits.length === 11) return digits[0] === '1' && /^[2-9]/.test(digits[1]);
  return false;
}

function formatPhone(phone: string): string {
  const digits = normalize(phone);
  const local = digits.length === 11 ? digits.slice(1) : digits;
  if (local.length !== 10) return phone;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export interface ValidatedLead {
  businessName?: string;
  phone?: string;
  phoneSource?: string;
  phoneValidated: boolean;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  confidenceScore: number;
}

export function validateLead(raw: RawLeadData, url: string): ValidatedLead | null {
  let score = 0;
  let phoneValidated = false;

  // Layer 1 + 2: base score from source
  if (raw.phone) {
    if (raw.phoneSource === 'schema.org') score += 40;
    else if (raw.phoneSource === 'tel_link') score += 30;
    else score += 20;
  }

  // Layer 3: context filter
  if (raw.phone && isLikelyJunk(raw.phone, raw.rawHtmlSnippet)) {
    score -= 30;
  }

  // Layer 4: phone format validation
  if (raw.phone) {
    if (validatePhoneFormat(raw.phone)) {
      score += 30;
      phoneValidated = true;
    } else {
      score -= 20; // penalty for invalid format
    }
  }

  // Bonus points for having more data
  if (raw.email) score += 15;
  if (raw.businessName) score += 10;
  if (raw.city) score += 5;
  if (raw.address) score += 5;

  // URL quality bonus (HTTPS, short, no query strings)
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') score += 5;
    if (u.pathname.split('/').filter(Boolean).length <= 2) score += 5;
  } catch { /* ignore */ }

  // Layer 5: minimum confidence gate
  if (score < 60) return null;

  return {
    businessName: raw.businessName?.slice(0, 200),
    phone: raw.phone ? formatPhone(raw.phone) : undefined,
    phoneSource: raw.phoneSource,
    phoneValidated,
    email: raw.email?.toLowerCase(),
    address: raw.address?.slice(0, 300),
    city: raw.city?.trim(),
    state: raw.state?.trim()?.toUpperCase().slice(0, 2),
    postalCode: raw.postalCode?.trim(),
    country: raw.country?.trim() || 'US',
    category: raw.category,
    confidenceScore: Math.min(100, score),
  };
}
