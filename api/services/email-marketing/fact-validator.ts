/**
 * Create-with-AI M3 — Fact validator + send-time helpers (pure functions).
 *
 * Spec §12: code, not the model, validates the draft. Every number, price,
 * date, percentage and URL in a draft must trace to an allowed source set
 * (profile, Brief, Plan, or the user's typed messages). Anything not found is
 * removed, and a disallowed URL becomes a {{NEEDS: …}} placeholder that
 * blocks sending while any remain. URL allowlist: profile booking link,
 * profile website domain, and URLs the user typed.
 *
 * Spec §17: locked footer (business name, physical address, unsubscribe link)
 * that the user cannot edit or remove — rendered as a marked block and
 * injected again at send time.
 *
 * Spec §18: per-recipient tracking links with UTM params; bot filtering
 * (clicks ≤10s after delivery, or matching known scanner user agents).
 *
 * Spec §13: send window (weekdays 08:00–17:00 business time zone) and the
 * recommended start (the first slot in the send window).
 */

export interface DraftContent {
  subjects: string[];
  previewText: string;
  bodyHtml: string;
  bodyText: string;
}

export interface FactMapEntry {
  claim: string;
  source: string;
}

export interface RemovedClaim {
  claim: string;
  where: string;
}

export interface ValidationResult {
  subjects: string[];
  previewText: string;
  bodyHtml: string;
  bodyText: string;
  /** Claims the validator removed because they were not in the source set. */
  removed: RemovedClaim[];
  /** URLs replaced with a {{NEEDS: …}} placeholder (block sending). */
  unmappedUrls: string[];
  /** Every {{NEEDS: …}} placeholder still present after validation. */
  placeholders: string[];
  factMap: FactMapEntry[];
}

export const PLACEHOLDER_RE = /\{\{NEEDS:[^}]+\}\}/g;

export function findPlaceholders(text: string): string[] {
  return text.match(PLACEHOLDER_RE) || [];
}

// ── Number / currency / date / percentage extraction ─────────────────────────

/** Currency like $1,299, $49.99, $1,299.00 — kept whole so "$499" ≠ "499". */
const CURRENCY_RE = /\$[\d,]+(?:\.\d{1,2})?/g;
/** Percentages like 25% or 12.5%. */
const PERCENT_RE = /\b\d+(?:\.\d+)?%/g;
/** Dates: "January 15, 2026", "Jan 15 2026", "01/15/2026", "2026-01-15". */
const DATE_RE =
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\b\d{1,2}\/\d{1,2}\/\d{2,4}|\b\d{4}-\d{2}-\d{2}\b/g;
/** Bare numbers (2+ digits, or decimals) — single digits are ordinary prose. */
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;

export function normalizeClaim(claim: string): string {
  return claim
    .replace(/[$,%]/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** All numeric/date claims found in a text, in order of appearance. */
export function extractClaims(text: string): string[] {
  const found: string[] = [];
  const push = (re: RegExp) => {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) found.push(m[0]);
  };
  push(CURRENCY_RE);
  push(PERCENT_RE);
  push(DATE_RE);
  // Bare numbers last, skipping ones already covered by a currency/percent/date.
  const covered = new Set(found.map(normalizeClaim));
  for (const m of text.matchAll(NUMBER_RE)) {
    if (!covered.has(normalizeClaim(m[0]))) found.push(m[0]);
  }
  return found;
}

/** Every URL in a text (http/https). */
export function extractUrls(text: string): string[] {
  const urls: string[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    urls.push(m[0].replace(/[.,;:!?)]+$/, ''));
  }
  return urls;
}

/**
 * Build the allowed claim set from the source texts: profile fields, the
 * locked Brief, and the user's typed messages. Numbers, currency, dates and
 * percentages only — named people/credentials stay in the model fact map
 * (the validator's code check covers numeric/date/URL claims, per the
 * Blueprint's validator scope).
 */
export function buildAllowedClaimSet(sourceTexts: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of sourceTexts) {
    for (const c of extractClaims(t || '')) set.add(normalizeClaim(c));
  }
  return set;
}

/** Host allowlist: profile booking link host, profile website host, user-typed URL hosts. */
export function buildAllowedHosts(bookingLink: string | null | undefined, websiteUrl: string | null | undefined, userTypedTexts: string[]): Set<string> {
  const hosts = new Set<string>();
  const add = (u: string) => {
    try {
      hosts.add(new URL(u).hostname.toLowerCase());
    } catch {
      /* not a URL */
    }
  };
  if (bookingLink) add(bookingLink);
  if (websiteUrl) add(websiteUrl);
  for (const t of userTypedTexts) for (const u of extractUrls(t || '')) add(u);
  return hosts;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validate one draft. Unmapped numeric/date claims are REMOVED (spec §21 M3:
 * "an invented price in model output is removed by the validator"); disallowed
 * URLs become {{NEEDS: link destination}} placeholders, which block sending.
 * Existing placeholders are preserved, never silently resolved.
 */
export function validateDraftContent(
  content: DraftContent,
  allowedClaims: Set<string>,
  allowedHosts: Set<string>,
  factMap: FactMapEntry[],
): ValidationResult {
  const removed: RemovedClaim[] = [];
  const unmappedUrls: string[] = [];

  const cleanText = (text: string, where: string): string => {
    let out = text;
    for (const claim of extractClaims(out)) {
      if (!allowedClaims.has(normalizeClaim(claim))) {
        out = out.split(claim).join('');
        removed.push({ claim, where });
      }
    }
    for (const url of extractUrls(out)) {
      let host = '';
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (!allowedHosts.has(host)) {
        out = out.split(url).join('{{NEEDS: link destination}}');
        if (!unmappedUrls.includes(url)) unmappedUrls.push(url);
      }
    }
    return out.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
  };

  const cleanHtml = (html: string, where: string): string => {
    // Rewrite hrefs first (URLs inside attributes), then clean visible text.
    let out = html.replace(/href="([^"]+)"/g, (m, href: string) => {
      let host = '';
      try {
        host = new URL(href).hostname.toLowerCase();
      } catch {
        return m;
      }
      if (allowedHosts.has(host)) return m;
      if (!unmappedUrls.includes(href)) unmappedUrls.push(href);
      return 'href="{{NEEDS: link destination}}"';
    });
    // Clean claims in the visible text without breaking tags: split on tags.
    const parts = out.split(/(<[^>]+>)/g);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('<')) continue;
      const before = parts[i];
      const cleaned = cleanText(parts[i], where);
      if (cleaned !== before) {
        // Re-derive removals from this part for accurate `where` reporting.
        for (const claim of extractClaims(before)) {
          if (!allowedClaims.has(normalizeClaim(claim)) && !removed.some((r) => r.claim === claim && r.where === where)) {
            removed.push({ claim, where });
          }
        }
      }
      parts[i] = cleaned;
    }
    out = parts.join('');
    // A disallowed href rewritten above leaves a placeholder in the attribute;
    // that placeholder also blocks sending and is reported by findPlaceholders.
    return out;
  };

  const subjects = content.subjects.map((s) => cleanText(s, 'subject'));
  const bodyHtml = cleanHtml(content.bodyHtml, 'body');
  const bodyText = cleanText(content.bodyText, 'body');
  const previewText = cleanText(content.previewText, 'preview').slice(0, 90);

  const allText = [subjects.join(' '), previewText, stripHtml(bodyHtml), bodyText].join('\n');
  return {
    subjects,
    previewText,
    bodyHtml,
    bodyText,
    removed,
    unmappedUrls,
    placeholders: findPlaceholders(allText),
    factMap: factMap.filter((f) => f && f.claim),
  };
}

// ── Locked footer (spec §17) ──────────────────────────────────────────────────

export interface ProfileFooterData {
  businessName: string;
  physicalAddress: string;
}

export function renderLockedFooterHtml(profile: ProfileFooterData, unsubscribeUrl: string): string {
  return (
    `<div data-locked-footer="true" style="margin-top:24px;border-top:1px solid #ddd;padding-top:12px;font-size:12px;color:#666;">` +
    `<p>${escapeHtml(profile.businessName)} · ${escapeHtml(profile.physicalAddress)}</p>` +
    `<p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p></div>`
  );
}

export function renderLockedFooterText(profile: ProfileFooterData, unsubscribeUrl: string): string {
  return `\n\n---\n${profile.businessName} · ${profile.physicalAddress}\nUnsubscribe: ${unsubscribeUrl}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** True when the final HTML still contains the locked footer + unsubscribe link. */
export function hasLockedFooter(html: string, text: string): boolean {
  const combined = `${html}\n${text}`;
  return combined.includes('data-locked-footer="true"') && /unsubscribe/i.test(combined);
}

// ── Personalization tokens (spec §12) ────────────────────────────────────────

export interface TokenContact {
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  phone?: string | null;
}

export interface TokenValues extends TokenContact {
  senderName?: string | null;
  bookingLink?: string | null;
}

/** Fill {{token|fallback}} tokens. Unknown tokens are left untouched. */
export function fillTokens(text: string, values: TokenValues): string {
  return text.replace(/\{\{\s*([a-z_]+)(?:\|([^}]*))?\s*\}\}/g, (m, name: string, fallback: string | undefined) => {
    const v: Record<string, string | null | undefined> = {
      first_name: values.firstName,
      last_name: values.lastName,
      business_name: values.businessName,
      sender_name: values.senderName,
      booking_link: values.bookingLink,
      phone: values.phone,
    };
    const val = v[name];
    if (val) return val;
    if (fallback !== undefined) return fallback;
    return m;
  });
}

/** Every {{token}} used in a text (names only, no fallbacks). */
export function usedTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([a-z_]+)(?:\|[^}]*)?\s*\}\}/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** Per token: how many contacts lack a value (so the fallback applies). */
export function tokenCoverage(contacts: TokenContact[], tokens: string[]): Record<string, { missing: number; total: number }> {
  const fieldOf: Record<string, keyof TokenContact> = {
    first_name: 'firstName',
    last_name: 'lastName',
    business_name: 'businessName',
    phone: 'phone',
  };
  const result: Record<string, { missing: number; total: number }> = {};
  for (const token of tokens) {
    const field = fieldOf[token];
    if (!field) continue; // sender_name / booking_link come from the profile, not contacts
    result[token] = {
      missing: contacts.filter((c) => !c[field]).length,
      total: contacts.length,
    };
  }
  return result;
}

// ── Tracking links (spec §18) ────────────────────────────────────────────────

export interface TrackWrapOptions {
  trackBase: string; // e.g. https://app.example.com/api/email-marketing/track/click
  workspaceId: string;
  contactId: string;
  campaignId: string;
  emailOrder: number;
}

/** Per-recipient token, same style as the existing unsubscribe token. */
export function trackingToken(campaignId: string, contactId: string, emailId: string): string {
  return Buffer.from(`${campaignId}:${contactId}:${emailId}`).toString('base64url');
}

function withUtm(dest: string, campaignId: string, emailOrder: number): string {
  try {
    const u = new URL(dest);
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', 'stone');
    u.searchParams.set('utm_campaign', campaignId);
    u.searchParams.set('utm_content', String(emailOrder));
    return u.toString();
  } catch {
    return dest;
  }
}

/**
 * Wrap every http(s) link in the HTML with the per-recipient tracking
 * redirect, appending UTM params to the destination. Unsubscribe links,
 * existing tracking links, mailto: and anchors are left alone.
 */
export function wrapLinksForTracking(html: string, opts: TrackWrapOptions): string {
  return html.replace(/href="([^"]+)"/g, (m, href: string) => {
    if (!/^https?:\/\//i.test(href)) return m;
    if (/unsubscribe|track\/click/i.test(href)) return m;
    const dest = withUtm(href, opts.campaignId, opts.emailOrder);
    const token = trackingToken(opts.campaignId, opts.contactId, 'email');
    const q = new URLSearchParams({
      w: opts.workspaceId,
      c: opts.contactId,
      cmp: opts.campaignId,
      t: token,
      url: dest,
    });
    return `href="${opts.trackBase}?${q.toString()}"`;
  });
}

// ── Bot filtering (spec §18) ─────────────────────────────────────────────────

const SCANNER_UA = /(bot|spider|crawler|scanner|preview|applemail|gmailimageproxy|proxy|monitor|uptime|pingdom|datadog)/i;

export function isScannerUserAgent(ua: string | null | undefined): boolean {
  return !!ua && SCANNER_UA.test(ua);
}

/** Bot-suspected when the click lands ≤10s after delivery, or the UA scans. */
export function isBotClick(deliveredAt: Date | null, clickedAt: Date, ua: string | null | undefined): boolean {
  if (isScannerUserAgent(ua)) return true;
  if (deliveredAt && clickedAt.getTime() - deliveredAt.getTime() <= 10_000) return true;
  return false;
}

// ── Spam-risk heuristic (spec §13 warning; labeled as a heuristic, no vendor) ─

const SPAM_PHRASES = [
  'act now', 'limited time', 'free money', 'make money fast', 'no risk',
  'guaranteed', '100% free', 'click here now', 'urgent', 'once in a lifetime',
  'risk free', 'double your', 'earn cash',
];

export function spamRiskHeuristic(subject: string, bodyText: string): { score: number; reasons: string[]; high: boolean } {
  const reasons: string[] = [];
  let score = 0;
  const text = `${subject}\n${bodyText}`;
  const lower = text.toLowerCase();
  for (const phrase of SPAM_PHRASES) {
    if (lower.includes(phrase)) {
      score += 12;
      reasons.push(`spam-trigger phrase: "${phrase}"`);
    }
  }
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (capsWords >= 3) {
    score += 15;
    reasons.push(`${capsWords} all-caps words`);
  }
  const bangs = (text.match(/!{2,}/g) || []).length;
  if (bangs >= 2) {
    score += 10;
    reasons.push('repeated exclamation marks');
  }
  if (subject.length > 60) {
    score += 5;
    reasons.push('subject over 60 characters');
  }
  score = Math.min(100, score);
  return { score, reasons, high: score >= 70 };
}

// ── Send window + recommended start (spec §13) ───────────────────────────────

/** Weekday + 08:00–17:00 in the business time zone. */
export function isWithinSendWindow(date: Date, timeZone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const weekday = get('weekday');
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    const mins = hour * 60 + minute;
    return mins >= 8 * 60 && mins < 17 * 60;
  } catch {
    return false;
  }
}

/**
 * The first slot in the send window at or after `now`: the next 15-minute
 * slot if already inside the window, otherwise the next weekday 08:00.
 * Returns the UTC instant plus a one-sentence reason (spec §13: no past
 * campaign results are used).
 */
export function recommendedStart(now: Date, timeZone: string): { atUtc: Date; reason: string } {
  if (isWithinSendWindow(now, timeZone)) {
    const at = new Date(now.getTime());
    at.setSeconds(0, 0);
    const mins = at.getMinutes();
    const rounded = Math.ceil((mins + 1) / 15) * 15;
    if (rounded >= 60) {
      at.setHours(at.getHours() + 1, 0, 0, 0);
    } else {
      at.setMinutes(rounded);
    }
    if (isWithinSendWindow(at, timeZone)) {
      return { atUtc: at, reason: `The next open slot in your send window (weekdays 8:00–17:00 ${timeZone}).` };
    }
  }
  // Step forward in 15-minute increments until inside the window (≤ 10 days).
  const at = new Date(now.getTime());
  at.setSeconds(0, 0);
  for (let i = 0; i < 10 * 24 * 4; i++) {
    at.setMinutes(at.getMinutes() + 15);
    if (isWithinSendWindow(at, timeZone)) {
      return { atUtc: at, reason: `The first open slot in your send window (weekdays 8:00–17:00 ${timeZone}).` };
    }
  }
  return { atUtc: at, reason: `The first open slot in your send window (weekdays 8:00–17:00 ${timeZone}).` };
}

// ── CSV parsing (spec §13) ────────────────────────────────────────────────────

export interface CsvParsedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
}

export interface CsvParseResult {
  contacts: CsvParsedContact[];
  rejected: { row: number; email: string; reason: string }[];
  duplicates: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Parse a recipient CSV: email required; optional first_name, last_name,
 * phone, company. Dedupes by lowercased email and reports rejected rows
 * with reasons. No contacts are created here — import happens on confirm.
 */
export function parseRecipientCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const contacts: CsvParsedContact[] = [];
  const rejected: CsvParseResult['rejected'] = [];
  let duplicates = 0;
  if (lines.length === 0) return { contacts, rejected, duplicates };
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^\uFEFF/, ''));
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'email_address');
  if (emailIdx === -1) {
    return { contacts, rejected: [{ row: 1, email: '', reason: 'Missing email column' }], duplicates };
  }
  const col = (name: string) => header.findIndex((h) => h === name);
  const seen = new Set<string>();
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const email = (cells[emailIdx] || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      rejected.push({ row: r + 1, email, reason: !email ? 'Missing email' : 'Invalid email' });
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    const pick = (idx: number) => (idx >= 0 ? (cells[idx] || '').trim() || undefined : undefined);
    contacts.push({
      email,
      firstName: pick(col('first_name')),
      lastName: pick(col('last_name')),
      phone: pick(col('phone')),
      company: pick(col('company')),
    });
  }
  return { contacts, rejected, duplicates };
}
