/**
 * Website prefill — Create with AI (Milestone 1, spec §4).
 *
 * Fetches a business website server-side and extracts profile field suggestions.
 * NOTHING is saved here — the caller shows the suggestions as editable
 * "From your website" values and only saves what the user confirms.
 *
 * Safety (spec §20): http/https only, private IP ranges + localhost blocked
 * (literal check AND a DNS-resolution check), at most 3 redirects, 20-second
 * TOTAL timeout across all pages, 2 MB cap per page, at most 4 linked pages
 * (home + services/about/contact). Fetched content is untrusted data: scripts
 * and styles are stripped and nothing fetched is ever executed or trusted.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

export const PREFILL_TIMEOUT_MS = 20_000;
export const PREFILL_MAX_BYTES = 2 * 1024 * 1024;
export const PREFILL_MAX_PAGES = 5; // home + up to 4 linked pages
export const PREFILL_MAX_REDIRECTS = 3;

export type PrefillSuggestions = {
  businessName?: string;
  services?: string;
  serviceArea?: string;
  phone?: string;
  bookingLink?: string;
  physicalAddress?: string;
  differentiators?: string;
};

export type PrefillResult = {
  suggestions: PrefillSuggestions;
  sources: Partial<Record<keyof PrefillSuggestions, string>>;
  pagesFetched: string[];
};

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local
    if (low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb')) return true; // link-local
    return false;
  }
  return false;
}

/** Throws when a URL is not safe to fetch (wrong scheme, localhost, private IP). */
export async function assertFetchable(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Website link must be a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Website link must start with http:// or https://.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Local addresses cannot be fetched.');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw new Error('Private addresses cannot be fetched.');
  }
  // DNS check: a hostname that resolves to a private address is also blocked.
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.some((r) => isPrivateIp(r.address))) {
      throw new Error('That address resolves to a private network and cannot be fetched.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private network')) throw err;
    throw new Error('Could not resolve that website address.');
  }
  return url;
}

async function fetchCapped(url: string, deadline: number): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= PREFILL_MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Website fetch timed out (20 seconds).');
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(remaining),
      headers: { 'User-Agent': 'StoneAIO-Prefill/1.0', Accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop === PREFILL_MAX_REDIRECTS) throw new Error('Too many redirects.');
      const next = new URL(res.headers.get('location')!, current).toString();
      await assertFetchable(next);
      current = next;
      continue;
    }
    if (!res.ok) throw new Error(`Website returned HTTP ${res.status}.`);
    // Size-capped read.
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Could not read the website response.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > PREFILL_MAX_BYTES) {
          await reader.cancel().catch(() => null);
          throw new Error('Page is too large (max 2 MB).');
        }
        chunks.push(value);
      }
      if (Date.now() > deadline) {
        await reader.cancel().catch(() => null);
        throw new Error('Website fetch timed out (20 seconds).');
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder('utf-8').decode(merged);
  }
  throw new Error('Too many redirects.');
}

/** Strips scripts/styles/tags to plain text (untrusted content stays inert). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function pickTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]?.trim()) return og[1].trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!title?.[1]) return undefined;
  const raw = title[1].trim();
  const cut = raw.split(/\s[|\-–—]\s/)[0].trim();
  return cut || undefined;
}

const PHONE_RE = /(\+?1[\s().-]?)?(\(?\d{3}\)?[\s().-])\d{3}[\s().-]\d{4}/;
const ADDRESS_RE =
  /\d{1,5}\s+[A-Za-z0-9 .'-]+\b(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b[^<>\n]{0,80}?\b\d{5}(?:-\d{4})?/;
const SERVING_RE = /(?:proudly\s+)?serving\s+[^<>\n]{3,80}/i;

function extractHrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const u = new URL(m[1], base);
      if (u.protocol === 'http:' || u.protocol === 'https:') out.push(u.toString());
    } catch {
      // ignore unparseable hrefs
    }
  }
  return [...new Set(out)];
}

/**
 * Pure extraction from one page's HTML. Returns only fields actually found.
 * `kind` hints which page this is ('home' | 'services' | 'about' | 'contact').
 */
export function extractFromPage(
  html: string,
  pageUrl: string,
  kind: 'home' | 'services' | 'about' | 'contact' | 'other',
): { suggestions: PrefillSuggestions; sources: Partial<Record<keyof PrefillSuggestions, string>> } {
  const text = htmlToText(html);
  const suggestions: PrefillSuggestions = {};
  const sources: Partial<Record<keyof PrefillSuggestions, string>> = {};
  const set = (field: keyof PrefillSuggestions, value: string | undefined) => {
    if (value && !suggestions[field]) {
      suggestions[field] = value;
      sources[field] = pageUrl;
    }
  };

  if (kind === 'home') {
    set('businessName', pickTitle(html));
    const serving = text.match(SERVING_RE);
    if (serving) set('serviceArea', serving[0].replace(/\s+/g, ' ').trim().slice(0, 120));
  }
  const phone = text.match(PHONE_RE);
  if (phone) set('phone', phone[0].trim());
  const address = text.match(ADDRESS_RE);
  if (address) set('physicalAddress', address[0].replace(/\s+/g, ' ').trim());
  if (kind === 'services' || kind === 'home') {
    // List items + sub-headings on a services page read as the service list.
    const items: string[] = [];
    const liRe = /<li[^>]*>([\s\S]{0,200}?)<\/li>/gi;
    let m: RegExpExecArray | null;
    while ((m = liRe.exec(html)) !== null && items.length < 12) {
      const t = htmlToText(m[1]).replace(/\s+/g, ' ').trim();
      if (t && t.length > 2 && t.length < 100 && !items.includes(t)) items.push(t);
    }
    if (items.length >= 2) set('services', items.slice(0, 10).join('\n'));
  }
  if (kind === 'about') {
    const paras = text.split('\n').map((p) => p.trim()).filter((p) => p.length > 40 && p.length < 600);
    if (paras[0]) set('differentiators', paras.slice(0, 2).join(' ').slice(0, 500));
  }
  // Booking-ish links on any page (same-origin preferred by caller order).
  const hrefs = extractHrefs(html, pageUrl);
  const booking = hrefs.find((h) => /book|appointment|schedule|quote|order|reserve/i.test(h));
  if (booking) set('bookingLink', booking);
  return { suggestions, sources };
}

function classifyPage(url: string): 'services' | 'about' | 'contact' | 'other' {
  const u = url.toLowerCase();
  if (/services|products|what-we-do|offerings/.test(u)) return 'services';
  if (/about|who-we-are|our-story/.test(u)) return 'about';
  if (/contact|book|appointment|quote/.test(u)) return 'contact';
  return 'other';
}

/** Fetches home + up to 4 linked pages and merges their suggestions. */
export async function prefillFromWebsite(rawUrl: string): Promise<PrefillResult> {
  const start = await assertFetchable(rawUrl);
  const deadline = Date.now() + PREFILL_TIMEOUT_MS;
  const merged: PrefillSuggestions = {};
  const sources: Partial<Record<keyof PrefillSuggestions, string>> = {};
  const pagesFetched: string[] = [];
  const merge = (s: PrefillSuggestions, src: Partial<Record<keyof PrefillSuggestions, string>>) => {
    for (const [k, v] of Object.entries(s)) {
      const key = k as keyof PrefillSuggestions;
      if (v && !merged[key]) {
        merged[key] = v;
        if (src[key]) sources[key] = src[key]!;
      }
    }
  };

  const homeHtml = await fetchCapped(start.toString(), deadline);
  pagesFetched.push(start.toString());
  const home = extractFromPage(homeHtml, start.toString(), 'home');
  merge(home.suggestions, home.sources);

  // Linked pages: same-origin services/about/contact pages first, cap 4.
  const origin = start.origin;
  const hrefs = extractHrefs(homeHtml, start.toString()).filter((h) => {
    try {
      return new URL(h).origin === origin && h !== start.toString();
    } catch {
      return false;
    }
  });
  const ranked = hrefs.sort((a, b) => {
    const score = (u: string) => (/services|about|contact/.test(u.toLowerCase()) ? 0 : 1);
    return score(a) - score(b);
  });
  for (const href of ranked.slice(0, PREFILL_MAX_PAGES - 1)) {
    if (Date.now() > deadline) break;
    try {
      const html = await fetchCapped(href, deadline);
      pagesFetched.push(href);
      const kind = classifyPage(href);
      const part = extractFromPage(html, href, kind);
      merge(part.suggestions, part.sources);
    } catch {
      // One bad linked page must not fail the whole prefill.
    }
  }
  return { suggestions: merged, sources, pagesFetched };
}
