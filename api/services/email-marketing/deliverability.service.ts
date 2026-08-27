/**
 * Deliverability & Anti-Spam Service — Email Marketing Module
 *
 * Enforces sending windows, human jitter rate pacing, and domain throttling to ensure
 * maximum inbox placement and zero spam/junk folder landings.
 */

import {
  DeliveryThrottleSettings,
  DEFAULT_DELIVERY_SETTINGS,
  calculateRandomJitterMs,
  isWithinSendingWindow,
} from '../../../src/lib/emailDeliverabilityUtils.js';

export interface RecipientScheduleItem {
  contactId: string;
  email: string;
  domain: string;
  scheduledDelayMs: number;
}

/**
 * Extracts normalized domain from an email address
 */
export function extractEmailDomain(email: string): string {
  if (!email || !email.includes('@')) return 'unknown';
  return email.split('@')[1].toLowerCase().trim();
}

/**
 * Calculates staggered send timestamps with domain throttling and human jitter
 */
export function planRecipientSendSchedule(
  recipients: { contactId: string; email: string }[],
  settings: Partial<DeliveryThrottleSettings> = {}
): RecipientScheduleItem[] {
  const config = { ...DEFAULT_DELIVERY_SETTINGS, ...settings };
  if (!config.enabled) {
    return recipients.map(r => ({
      contactId: r.contactId,
      email: r.email,
      domain: extractEmailDomain(r.email),
      scheduledDelayMs: 0,
    }));
  }

  const result: RecipientScheduleItem[] = [];
  const domainLastSendTime = new Map<string, number>();
  let currentBaseDelayMs = 0;

  // Domain throttle interval (e.g., max 40/hr -> min 90 seconds between sends to same domain)
  const minDomainSpacingMs = config.domainThrottleEnabled && config.maxPerDomainPerHour > 0
    ? Math.floor((3600 / config.maxPerDomainPerHour) * 1000)
    : 0;

  for (const r of recipients) {
    const domain = extractEmailDomain(r.email);

    // Calculate jitter for this individual send
    const jitterMs = config.humanJitterEnabled
      ? calculateRandomJitterMs(config.minJitterSeconds, config.maxJitterSeconds)
      : 5000;

    // Check last scheduled time for this specific domain
    const lastDomainTime = domainLastSendTime.get(domain) || 0;
    let scheduledTimeMs = currentBaseDelayMs + jitterMs;

    if (minDomainSpacingMs > 0 && scheduledTimeMs < (lastDomainTime + minDomainSpacingMs)) {
      scheduledTimeMs = lastDomainTime + minDomainSpacingMs + Math.floor(Math.random() * 5000);
    }

    domainLastSendTime.set(domain, scheduledTimeMs);
    currentBaseDelayMs += Math.floor(jitterMs / 2); // advance base timeline smoothly

    result.push({
      contactId: r.contactId,
      email: r.email,
      domain,
      scheduledDelayMs: scheduledTimeMs,
    });
  }

  return result;
}

/**
 * Calculates the next valid sending window timestamp if current time is outside allowed hours
 */
export function getNextSendingWindowDate(
  now: Date = new Date(),
  startHour: number = 8,
  endHour: number = 18,
  allowedDays: number[] = [1, 2, 3, 4, 5]
): Date {
  if (isWithinSendingWindow(now, startHour, endHour, allowedDays)) {
    return now;
  }

  const next = new Date(now.getTime());
  let loops = 0;

  // Search ahead hour by hour until we land in the sending window
  while (!isWithinSendingWindow(next, startHour, endHour, allowedDays) && loops < 168) {
    next.setUTCHours(next.getUTCHours() + 1);
    next.setUTCMinutes(0);
    next.setUTCSeconds(0);
    loops++;
  }

  return next;
}
