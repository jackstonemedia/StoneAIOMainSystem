/**
 * Extractor Service — Lead Studio
 * Given a URL, fetches the HTML and extracts:
 *   - business name
 *   - phone (schema.org JSON-LD > tel: links > contextual text)
 *   - email
 *   - address fields
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';

const FETCH_TIMEOUT = 10_000;

const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
];

function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

export interface RawLeadData {
  businessName?: string;
  phone?: string;
  phoneSource?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  rawHtmlSnippet?: string;
}

async function fetchPage(url: string): Promise<string> {
  const resp = await axios.get(url, {
    timeout: FETCH_TIMEOUT,
    headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    maxRedirects: 4,
    validateStatus: (s) => s < 400,
  });
  if (typeof resp.data !== 'string') return '';
  return resp.data.slice(0, 200_000); // cap at 200KB
}

/**
 * Parse schema.org JSON-LD blocks for telephone, name, address.
 */
function extractSchemaOrg(html: string, $: cheerio.CheerioAPI): Partial<RawLeadData> {
  const result: Partial<RawLeadData> = {};

  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    try {
      const text = $(el).html() || '';
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (!result.phone && item.telephone) {
          result.phone = item.telephone;
          result.phoneSource = 'schema.org';
        }
        if (!result.businessName && item.name) result.businessName = item.name;
        if (!result.email && item.email) result.email = item.email;
        if (!result.category && item['@type']) result.category = String(item['@type']);

        const addr = item.address;
        if (addr && typeof addr === 'object') {
          if (!result.address && addr.streetAddress) result.address = addr.streetAddress;
          if (!result.city && addr.addressLocality) result.city = addr.addressLocality;
          if (!result.state && addr.addressRegion) result.state = addr.addressRegion;
          if (!result.postalCode && addr.postalCode) result.postalCode = addr.postalCode;
          if (!result.country && addr.addressCountry) result.country = addr.addressCountry;
        }
      }
    } catch { /* malformed JSON — skip */ }
  });

  return result;
}

/**
 * Extract phone from tel: href links.
 */
function extractTelLinks(html: string, $: cheerio.CheerioAPI): Partial<RawLeadData> {
  let phone: string | undefined;
  $('a[href^="tel:"]').each((_: any, el: any) => {
    if (!phone) {
      const raw = $(el).attr('href')?.replace('tel:', '').trim() || '';
      if (raw.length >= 7) { phone = raw; }
    }
  });
  return phone ? { phone, phoneSource: 'tel_link' } : {};
}

/**
 * Extract email from mailto: links.
 */
function extractEmail(html: string, $: cheerio.CheerioAPI): string | undefined {
  let email: string | undefined;
  $('a[href^="mailto:"]').each((_: any, el: any) => {
    if (!email) {
      const raw = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim() || '';
      if (raw.includes('@') && !raw.includes('example')) email = raw.toLowerCase();
    }
  });
  // Also try regex on raw HTML for obfuscated emails
  if (!email) {
    const match = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (match && !match[1].includes('example') && !match[1].includes('sentry')) {
      email = match[1].toLowerCase();
    }
  }
  return email;
}

/**
 * Extract business name from common meta tags / title.
 */
function extractBusinessName(html: string, $: cheerio.CheerioAPI): string | undefined {
  return (
    $('meta[property="og:site_name"]').attr('content') ||
    $('meta[name="application-name"]').attr('content') ||
    $('h1').first().text().trim().slice(0, 120) ||
    $('title').text().trim().split('|')[0].trim().slice(0, 120) ||
    undefined
  );
}

/**
 * Main extraction function.
 * Returns null if the page is unreachable or returns no useful data.
 */
export async function extractLead(url: string): Promise<RawLeadData | null> {
  let html: string;

  try {
    html = await fetchPage(url);
  } catch (err: any) {
    logger.debug('[Extractor] Fetch failed', { url, error: err.message });
    return null;
  }

  if (!html || html.length < 200) return null;

  const $ = cheerio.load(html);

  // Merge in priority order: schema.org > tel_link
  const schemaData = extractSchemaOrg(html, $);
  const telData = extractTelLinks(html, $);
  const email = extractEmail(html, $);
  const businessName = schemaData.businessName || extractBusinessName(html, $);

  const result: RawLeadData = {
    ...schemaData,
    ...(!schemaData.phone && telData.phone ? telData : {}),
    email,
    businessName,
  };

  // Must have at least a phone or email to be a useful lead
  if (!result.phone && !result.email) return null;

  return result;
}
