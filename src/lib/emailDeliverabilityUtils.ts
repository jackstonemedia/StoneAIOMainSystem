/**
 * Email Deliverability & Anti-Spam Utilities
 *
 * Scans email subject lines and HTML bodies for spam triggers, deliverability risks,
 * formatting red flags, and compliance issues (RFC 8058, CAN-SPAM, GDPR).
 */

export interface SpamCheckResult {
  score: number; // 0 (Worst/High Spam Risk) to 100 (Best/Clean)
  grade: 'Excellent' | 'Good' | 'Moderate' | 'High Risk';
  badgeColor: string;
  issues: DeliverabilityIssue[];
  metrics: {
    wordCount: number;
    capsRatio: number;
    exclamationCount: number;
    spamKeywordCount: number;
    linkCount: number;
    hasUnsubscribe: boolean;
    hasPhysicalAddress: boolean;
  };
}

export interface DeliverabilityIssue {
  id: string;
  type: 'critical' | 'warning' | 'tip';
  title: string;
  description: string;
  penalty: number;
}

// ── Common Spam Trigger Keywords ──────────────────────────────────────────────
export const SPAM_TRIGGER_KEYWORDS: { word: string; category: string; penalty: number }[] = [
  // Aggressive / Financial hype
  { word: '100% free', category: 'Financial Hype', penalty: 15 },
  { word: 'make money fast', category: 'Financial Hype', penalty: 20 },
  { word: 'earn extra cash', category: 'Financial Hype', penalty: 15 },
  { word: 'no hidden fees', category: 'Financial Hype', penalty: 10 },
  { word: 'risk-free', category: 'Financial Hype', penalty: 10 },
  { word: 'risk free', category: 'Financial Hype', penalty: 10 },
  { word: 'get paid', category: 'Financial Hype', penalty: 12 },
  { word: 'million dollars', category: 'Financial Hype', penalty: 15 },
  { word: 'billion dollars', category: 'Financial Hype', penalty: 15 },
  { word: 'guaranteed income', category: 'Financial Hype', penalty: 20 },
  { word: 'crypto profit', category: 'Financial Hype', penalty: 20 },
  { word: 'wire transfer', category: 'Financial Hype', penalty: 15 },

  // Artificial Urgency / Pressure
  { word: 'act now!', category: 'Artificial Urgency', penalty: 15 },
  { word: 'act now', category: 'Artificial Urgency', penalty: 10 },
  { word: 'apply now', category: 'Artificial Urgency', penalty: 8 },
  { word: 'urgent response needed', category: 'Artificial Urgency', penalty: 18 },
  { word: 'immediate action required', category: 'Artificial Urgency', penalty: 18 },
  { word: 'do not delete', category: 'Artificial Urgency', penalty: 20 },
  { word: 'expires tonight', category: 'Artificial Urgency', penalty: 12 },
  { word: 'limited time offer', category: 'Artificial Urgency', penalty: 10 },
  { word: 'once in a lifetime', category: 'Artificial Urgency', penalty: 15 },
  { word: 'order now', category: 'Artificial Urgency', penalty: 8 },
  { word: 'exclusive deal for you', category: 'Artificial Urgency', penalty: 10 },

  // Deceptive Subject Line Prefixes
  { word: 're: invoice', category: 'Deceptive Prefix', penalty: 25 },
  { word: 'fw: payment', category: 'Deceptive Prefix', penalty: 25 },
  { word: 'fwd: confirmation', category: 'Deceptive Prefix', penalty: 25 },

  // Excessive Salesy Buzzwords
  { word: 'miracle', category: 'Spammy Buzzword', penalty: 12 },
  { word: 'winner!', category: 'Spammy Buzzword', penalty: 20 },
  { word: 'you have won', category: 'Spammy Buzzword', penalty: 25 },
  { word: 'claim your prize', category: 'Spammy Buzzword', penalty: 25 },
  { word: 'congratulations!', category: 'Spammy Buzzword', penalty: 15 },
  { word: 'unbelievable deal', category: 'Spammy Buzzword', penalty: 12 },
  { word: 'secret revealed', category: 'Spammy Buzzword', penalty: 10 },
];

/**
 * Strips HTML tags to plain text for linguistic analysis
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+([!?,.:;])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analyzes subject and HTML body for spam deliverability score (0–100)
 */
export function analyzeEmailDeliverability(subject: string = '', bodyHtml: string = ''): SpamCheckResult {
  const issues: DeliverabilityIssue[] = [];
  const textBody = stripHtml(bodyHtml);
  const combinedText = `${subject} ${textBody}`.toLowerCase();

  // Metrics
  const words = textBody.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const linkMatches = bodyHtml.match(/href=["'][^"']+["']/gi) || [];
  const linkCount = linkMatches.length;

  // 1. Check Spam Keywords
  const foundKeywords: { word: string; category: string }[] = [];
  let keywordPenalty = 0;

  for (const item of SPAM_TRIGGER_KEYWORDS) {
    if (combinedText.includes(item.word.toLowerCase())) {
      foundKeywords.push({ word: item.word, category: item.category });
      keywordPenalty += item.penalty;
    }
  }

  if (foundKeywords.length > 0) {
    const penaltyApplied = Math.min(keywordPenalty, 55);
    issues.push({
      id: 'spam-keywords',
      type: foundKeywords.length >= 3 ? 'critical' : 'warning',
      title: `Spam Trigger Keywords Detected (${foundKeywords.length})`,
      description: `Contains high-risk phrases: ${foundKeywords.map(k => `"${k.word}"`).join(', ')}. Replace with natural conversational copy.`,
      penalty: penaltyApplied,
    });
  }

  // 2. Subject Line Checks
  if (!subject.trim()) {
    issues.push({
      id: 'empty-subject',
      type: 'critical',
      title: 'Missing Subject Line',
      description: 'Emails without subject lines are immediately flagged or rejected by mail servers.',
      penalty: 40,
    });
  } else {
    // Check subject ALL-CAPS
    const upperCountSubject = (subject.match(/[A-Z]/g) || []).length;
    const alphaCountSubject = (subject.match(/[a-zA-Z]/g) || []).length;
    const capsRatioSubject = alphaCountSubject > 0 ? upperCountSubject / alphaCountSubject : 0;

    if (capsRatioSubject > 0.45 && subject.length > 6) {
      issues.push({
        id: 'subject-caps',
        type: 'critical',
        title: 'Subject Line in ALL-CAPS',
        description: 'Using excessive capital letters in your subject line severely hurts inbox placement.',
        penalty: 25,
      });
    }

    // Check subject exclamation marks
    const exclamationCountSubject = (subject.match(/!/g) || []).length;
    if (exclamationCountSubject > 1) {
      issues.push({
        id: 'subject-exclamations',
        type: 'warning',
        title: 'Multiple Exclamation Marks in Subject',
        description: 'Multiple exclamation marks trigger mailbox spam filters. Limit to at most one or none.',
        penalty: 12,
      });
    }

    // Subject length check
    if (subject.length > 85) {
      issues.push({
        id: 'subject-length',
        type: 'tip',
        title: 'Subject Line Too Long',
        description: `Subject is ${subject.length} characters. Mobile clients truncate past 50–60 characters.`,
        penalty: 5,
      });
    }
  }

  // 3. Body Content Checks
  if (wordCount < 10 && textBody.length > 0) {
    issues.push({
      id: 'short-body',
      type: 'warning',
      title: 'Body Content Too Sparse',
      description: 'Emails with almost no text are frequently categorized as junk or phishing.',
      penalty: 15,
    });
  }

  // Check Body ALL-CAPS ratio
  const upperCountBody = (textBody.match(/[A-Z]/g) || []).length;
  const alphaCountBody = (textBody.match(/[a-zA-Z]/g) || []).length;
  const capsRatioBody = alphaCountBody > 0 ? upperCountBody / alphaCountBody : 0;

  if (capsRatioBody > 0.35 && textBody.length > 30) {
    issues.push({
      id: 'body-caps',
      type: 'warning',
      title: 'Excessive Capital Letters in Body',
      description: 'Writing in full caps mimics aggressive spam mailers.',
      penalty: 15,
    });
  }

  // Exclamation marks in body
  const exclamationCountBody = (textBody.match(/!/g) || []).length;
  if (exclamationCountBody > 4) {
    issues.push({
      id: 'body-exclamations',
      type: 'tip',
      title: 'High Exclamation Mark Density',
      description: `Found ${exclamationCountBody} exclamation marks in body. Tone down for better sender reputation.`,
      penalty: 8,
    });
  }

  // 4. Compliance & Unsubscribe Check
  const hasUnsubscribe =
    combinedText.includes('unsubscribe') ||
    combinedText.includes('opt out') ||
    combinedText.includes('manage preferences') ||
    bodyHtml.includes('{{unsubscribe_url}}') ||
    bodyHtml.includes('{{unsubscribe}}');

  if (!hasUnsubscribe && (wordCount > 10 || bodyHtml.length > 40)) {
    issues.push({
      id: 'missing-unsubscribe',
      type: 'critical',
      title: 'Missing Unsubscribe Mechanism',
      description: 'CAN-SPAM and Gmail/Yahoo 2024 standards mandate a clear one-click unsubscribe link in marketing emails.',
      penalty: 25,
    });
  }

  const hasPhysicalAddress =
    combinedText.includes('suite') ||
    combinedText.includes('street') ||
    combinedText.includes('ave') ||
    combinedText.includes('road') ||
    combinedText.includes('blvd') ||
    combinedText.includes('po box') ||
    bodyHtml.includes('{{business_address}}') ||
    bodyHtml.includes('{{company_address}}');

  if (!hasPhysicalAddress && wordCount > 30) {
    issues.push({
      id: 'missing-address',
      type: 'tip',
      title: 'Missing Physical Postal Address',
      description: 'CAN-SPAM regulations recommend including a physical mailing address or PO box in the footer.',
      penalty: 5,
    });
  }

  // Calculate final score (start with 100, subtract total penalties)
  const totalPenalties = issues.reduce((acc, issue) => acc + issue.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalties));

  let grade: SpamCheckResult['grade'] = 'Excellent';
  let badgeColor = '#22c55e'; // Green

  if (score < 50) {
    grade = 'High Risk';
    badgeColor = '#ef4444'; // Red
  } else if (score < 75) {
    grade = 'Moderate';
    badgeColor = '#f59e0b'; // Amber
  } else if (score < 90) {
    grade = 'Good';
    badgeColor = '#3b82f6'; // Blue
  }

  return {
    score,
    grade,
    badgeColor,
    issues,
    metrics: {
      wordCount,
      capsRatio: Number(capsRatioBody.toFixed(2)),
      exclamationCount: exclamationCountBody + (subject.match(/!/g) || []).length,
      spamKeywordCount: foundKeywords.length,
      linkCount,
      hasUnsubscribe,
      hasPhysicalAddress,
    },
  };
}

/**
 * Delivery settings helper for rate limits, jitter, and sending window
 */
export interface DeliveryThrottleSettings {
  enabled: boolean;
  sendingWindowEnabled: boolean;
  startHour: number; // 0–23 (e.g. 8 for 8 AM)
  endHour: number;   // 0–23 (e.g. 18 for 6 PM)
  timezone: string;
  humanJitterEnabled: boolean;
  minJitterSeconds: number; // e.g. 30s
  maxJitterSeconds: number; // e.g. 90s
  domainThrottleEnabled: boolean;
  maxPerDomainPerHour: number; // e.g. 50 per domain
  dailyVolumeCap: number; // e.g. 500 per day
}

export const DEFAULT_DELIVERY_SETTINGS: DeliveryThrottleSettings = {
  enabled: true,
  sendingWindowEnabled: true,
  startHour: 8,
  endHour: 18,
  timezone: 'UTC',
  humanJitterEnabled: true,
  minJitterSeconds: 30,
  maxJitterSeconds: 90,
  domainThrottleEnabled: true,
  maxPerDomainPerHour: 40,
  dailyVolumeCap: 1000,
};

/**
 * Computes human jitter delay in milliseconds
 */
export function calculateRandomJitterMs(minSeconds: number = 30, maxSeconds: number = 90): number {
  const min = Math.max(1, minSeconds);
  const max = Math.max(min, maxSeconds);
  const randomSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomSeconds * 1000;
}

/**
 * Checks if current timestamp falls within the configured business sending window
 */
export function isWithinSendingWindow(
  now: Date = new Date(),
  startHour: number = 8,
  endHour: number = 18,
  allowedDays: number[] = [1, 2, 3, 4, 5] // Mon-Fri default
): boolean {
  const day = now.getUTCDay(); // 0 is Sunday, 6 is Saturday
  if (!allowedDays.includes(day)) return false;

  const currentHour = now.getUTCHours();
  return currentHour >= startHour && currentHour < endHour;
}
