/**
 * Create-with-AI M3 — Phase 8 checks, test send, confirm/send, pause/resume/
 * cancel, path simulator, recommended start (spec §13, §17, §18).
 *
 * Send path (reuse first): confirming creates a Campaign in SCHEDULED status
 * with a snapshot list of exactly the Phase 8 selection. The existing
 * schedulers (1-minute cron + 30s runner) deliver it through the existing
 * sendCampaign → BullMQ worker path, which already re-checks suppression
 * and subscription status per send. Pause/cancel are enforced by a status
 * guard in the worker (M3 addition): jobs for PAUSED/CANCELLED campaigns
 * are skipped, never sent.
 *
 * Nothing is published, sent, or deployed by this build itself: in dev the
 * provider key is a stub, so test sends report honestly instead of faking
 * delivery. Test sends go only to the owner's address(es) (spec §13).
 */

import { db } from '../../../infrastructure/database/client.js';
import { env } from '../../../infrastructure/config/env.js';
import {
  extractUrls,
  findPlaceholders,
  hasLockedFooter,
  isWithinSendWindow,
  recommendedStart,
  renderLockedFooterHtml,
  renderLockedFooterText,
  spamRiskHeuristic,
  stripDraftFooter,
  wrapLinksForTracking,
  type TokenContact,
} from './fact-validator.js';
import { getEmailOrThrow, assertLoadedEmailEditable } from './draft-generator.service.js';
import { resolveRecipients, type ListHints } from './recipients.service.js';

export class SendError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export interface SendCheck {
  blocking: string[];
  warnings: string[];
  /** Link check results (only for links in the final HTML). */
  links: { url: string; ok: boolean; status?: number }[];
  domainAuth: { domain: string | null; spf: boolean; dkim: boolean; verified: boolean; note: string };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function checkLink(url: string, timeoutMs = 5000): Promise<{ url: string; ok: boolean; status?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    return { url, ok: res.ok, status: res.status };
  } catch {
    return { url, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function domainAuthFor(workspaceId: string, fromEmail: string): Promise<SendCheck['domainAuth']> {
  const domain = fromEmail.includes('@') ? fromEmail.split('@')[1].toLowerCase() : null;
  if (!domain) return { domain, spf: false, dkim: false, verified: false, note: 'No sender email configured.' };
  const row = await db.sendingDomain.findFirst({ where: { workspaceId, domain } });
  if (!row) {
    return { domain, spf: false, dkim: false, verified: false, note: `No sending domain registered for ${domain}.` };
  }
  if ((row as any).status === 'VERIFIED') {
    return { domain, spf: true, dkim: true, verified: true, note: `Sending domain ${domain} is verified.` };
  }
  let spf = false;
  let dkim = false;
  try {
    const records = Array.isArray(row.dnsRecords) ? (row.dnsRecords as any[]) : [];
    for (const r of records) {
      const rec = String(r.record || '').toUpperCase();
      const st = String(r.status || '').toLowerCase();
      if (st === 'verified' || st === 'valid') {
        if (rec === 'SPF') spf = true;
        if (rec === 'DKIM') dkim = true;
      }
    }
  } catch {
    /* fall through */
  }
  return {
    domain,
    spf,
    dkim,
    verified: spf && dkim,
    note: spf && dkim
      ? `SPF and DKIM verified for ${domain}.`
      : `Sending domain ${domain} is not fully verified (SPF: ${spf}, DKIM: ${dkim}).`,
  };
}

/**
 * Automated Phase 8 checks (spec §13). Blocking issues must be empty before
 * confirm-send. Link checks run over every link in the final HTML.
 */
export async function runSendChecks(
  workspaceId: string,
  emailId: string,
  recipientCount: number,
  sendAt: Date | null,
): Promise<SendCheck> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  const draft = await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId } });
  if (!draft) throw new SendError('Campaign draft not found', 404);
  const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
  const blocking: string[] = [];
  const warnings: string[] = [];

  const subjects = (Array.isArray(email.subjectVariants) ? email.subjectVariants : []).filter((s: unknown): s is string => typeof s === 'string') as string[];
  const selectedSubject = subjects[email.subjectSelected ?? 0] || '';
  const html = String(email.bodyHtml || '');
  const text = String(email.bodyText || '');
  const combined = [subjects.join(' '), email.previewText || '', html, text].join('\n');
  const placeholders = findPlaceholders(combined);
  if (placeholders.length > 0) blocking.push(`${placeholders.length} unresolved placeholder(s) block sending: ${placeholders.slice(0, 3).join(', ')}`);
  if (!hasLockedFooter(html, text)) blocking.push('Missing locked footer or unsubscribe link.');
  if (!snap.senderName) blocking.push('Missing sender name on the Business Profile.');
  if (!snap.replyToEmail) blocking.push('Missing reply-to email on the Business Profile.');
  if (!snap.physicalAddress) blocking.push('Missing business address on the Business Profile (required for the locked footer).');
  if (recipientCount <= 0) blocking.push('Zero recipients — pick a list or upload a CSV with at least one valid contact.');

  // Deadline earlier than the scheduled email (Brief CTA deadline, spec §13).
  const brief = (draft.brief || {}) as Record<string, any>;
  const deadlineRaw = brief?.cta?.deadline;
  if (sendAt && deadlineRaw) {
    const deadline = new Date(String(deadlineRaw));
    if (!Number.isNaN(deadline.getTime()) && sendAt > deadline) {
      blocking.push(`The scheduled send (${sendAt.toISOString()}) is after the Brief deadline (${deadline.toISOString().slice(0, 10)}).`);
    }
  }
  // Cold-outreach acknowledgment (spec §13; blocking for cold drafts only).
  const cold = !!(brief?.audience?.cold_contacts);
  if (cold && !email.coldAck) blocking.push('Cold outreach requires the acknowledgment checkbox: "These are business contacts, and I have a legitimate reason to contact them."');

  // Link checks (invalid or unreachable links block). The locked footer's
  // unsubscribe link is system-generated and excluded from the check.
  const links = extractUrls(stripDraftFooter(html, '').bodyHtml);
  const linkResults: SendCheck['links'] = [];
  for (const url of [...new Set(links)]) {
    if (/unsubscribe|track\/click/i.test(url)) continue;
    const result = await checkLink(url);
    linkResults.push(result);
    if (!result.ok) blocking.push(`Link unreachable: ${url}`);
  }

  const domainAuth = await domainAuthFor(workspaceId, String(snap.replyToEmail || ''));
  if (!domainAuth.spf || !domainAuth.dkim) {
    blocking.push(`Sending domain fails SPF/DKIM: ${domainAuth.note}`);
  }
  if (!domainAuth.verified && domainAuth.domain) {
    // DMARC missing is a warning (spec §13); SPF/DKIM failure already blocks.
    warnings.push(`DMARC status for ${domainAuth.domain} is not confirmed — warn, do not block.`);
  }

  // Warnings (non-blocking).
  const spam = spamRiskHeuristic(selectedSubject, text);
  if (spam.high) warnings.push(`High spam-risk score (${spam.score}): ${spam.reasons.join('; ')}`);
  if (selectedSubject.length > 60) warnings.push(`Subject is ${selectedSubject.length} characters (over 60).`);
  if (!email.previewText) warnings.push('Missing preview text.');
  if (cold && snap.websiteUrl && domainAuth.domain) {
    try {
      const siteHost = new URL(String(snap.websiteUrl)).hostname.toLowerCase();
      if (siteHost === domainAuth.domain) {
        warnings.push('Cold outreach from the main business domain — a separate sending domain or mailbox is recommended.');
      }
    } catch {
      /* ignore */
    }
  }

  return { blocking, warnings, links: linkResults, domainAuth };
}

function unsubscribeUrlFor(workspaceId: string, contactId: string): string {
  const baseUrl = (env as any).VITE_APP_URL || 'http://localhost:3000';
  const token = Buffer.from(`${workspaceId}:${contactId}`).toString('base64url');
  return `${baseUrl}/unsubscribe/${token}`;
}

/** Render the final send HTML: body + locked footer, links wrapped for tracking. */
export function renderFinalHtml(
  workspaceId: string,
  campaignId: string,
  email: { bodyHtml: string; bodyText: string },
  profile: { businessName: string; physicalAddress: string },
  contactId: string,
  trackBase: string,
): { html: string; text: string } {
  const unsub = unsubscribeUrlFor(workspaceId, contactId);
  // The draft carries a placeholder footer (spec §17: unremovable); the real
  // per-recipient footer replaces it here, so a sent email has exactly one.
  const stripped = stripDraftFooter(email.bodyHtml, email.bodyText);
  const withFooter = `${stripped.bodyHtml}\n${renderLockedFooterHtml(profile, unsub)}`;
  const html = wrapLinksForTracking(withFooter, {
    trackBase,
    workspaceId,
    contactId,
    campaignId,
    emailOrder: 1,
  });
  const text = `${stripped.bodyText}${renderLockedFooterText(profile, unsub)}`;
  return { html, text };
}

/**
 * Test send (spec §13): delivers the email to the owner's address(es) only,
 * subject prefixed [TEST Email 1]. Returns delivered or an honest error —
 * never a fake success. In dev the provider key is a stub, so this reports
 * "not configured" until a real key is present.
 */
export async function testSendEmail(
  workspaceId: string,
  emailId: string,
  addresses: string[],
): Promise<{ sent: number; to: string[]; subject: string; note: string }> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  const draft = await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId } });
  if (!draft) throw new SendError('Campaign draft not found', 404);
  const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
  const clean = [...new Set((addresses || []).map((a) => a.trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) throw new SendError('Add at least one test-send address (the owner address).', 400);
  if (!snap.senderName || !snap.replyToEmail) {
    throw new SendError('Business Profile needs a sender name and reply-to email before a test send.', 400);
  }
  const subjects = (Array.isArray(email.subjectVariants) ? email.subjectVariants : []).filter((s: unknown): s is string => typeof s === 'string') as string[];
  const subject = `[TEST Email 1] ${subjects[email.subjectSelected ?? 0] || 'Campaign email'}`;
  const trackBase = `${(env as any).VITE_APP_URL || 'http://localhost:3000'}/api/email-marketing/track/click`;
  const { html, text } = renderFinalHtml(workspaceId, 'test', email, {
    businessName: String(snap.businessName || ''),
    physicalAddress: String(snap.physicalAddress || ''),
  }, 'test', trackBase);

  const key = env.RESEND_API_KEY || '';
  if (!key || key.length < 10) {
    throw new SendError('Email sending is not configured on this server (RESEND_API_KEY missing). Test send not delivered.', 503);
  }
  const { Resend } = await import('resend');
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: `${snap.senderName} <${snap.replyToEmail}>`,
    to: clean,
    subject,
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrlFor(workspaceId, 'test')}>` },
  } as any);
  if (error) throw new SendError(`Test send failed: ${String((error as any).message || error)}`, 502);
  return {
    sent: clean.length,
    to: clean,
    subject,
    note: 'Test send delivered. The unsubscribe link in a test send is a placeholder (no real contact), and clicks on it are not recorded.',
  };
}

/** Path simulator (spec §13): the 7 scenarios for a single-email campaign. */
export function simulatePath(scenario: string): {
  scenario: string;
  emails: { name: string; when: string; trigger: string }[];
  note: string;
} {
  const scenarios: Record<string, string> = {
    did_not_open: 'Did not open',
    opened_no_click: 'Opened but did not click',
    clicked: 'Clicked',
    clicked_link: 'Clicked a specific link',
    clicked_not_booked: 'Clicked but did not book',
    replied: 'Replied',
    booked: 'Booked',
  };
  const label = scenarios[scenario] || scenario;
  const emails = [
    { name: 'Email 1', when: 'At the scheduled start', trigger: 'Everyone selected in Phase 8' },
  ];
  let note = 'This is a single-email campaign (M3): every scenario receives Email 1 at the scheduled start.';
  if (scenario === 'replied' || scenario === 'booked') {
    note += ' A reply or booking exits the contact from any further emails (M4 exits).';
  } else {
    note += ' Reaction emails for clickers and non-clickers arrive with Milestone 5 (Reactions); the simulator already matches the live single-email behavior.';
  }
  return { scenario: label, emails, note };
}

/** Recommended start for a draft (spec §13: first slot in the send window). */
export async function recommendedStartFor(workspaceId: string, draftId: string): Promise<{ atUtc: string; reason: string; timeZone: string }> {
  const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!draft) throw new SendError('Campaign draft not found', 404);
  const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
  const timeZone = typeof snap.timezone === 'string' && snap.timezone ? snap.timezone : 'UTC';
  const { atUtc, reason } = recommendedStart(new Date(), timeZone);
  return { atUtc: atUtc.toISOString(), reason, timeZone };
}

export interface ConfirmSendInput {
  idempotencyKey: string;
  campaignName: string;
  sendNow: boolean;
  sendAt?: string | null;
  coldAck?: boolean;
}

/**
 * Final confirmation (spec §13): idempotency key, blocking checks, snapshot
 * list, SCHEDULED campaign for the existing schedulers. A repeat confirm with
 * the same key returns the existing campaign — a double click cannot double
 * send.
 */
export async function confirmSend(
  workspaceId: string,
  emailId: string,
  input: ConfirmSendInput,
): Promise<{ campaignId: string; emailId: string; sendAtUtc: string; recipientCount: number; idempotentReplay: boolean; note: string }> {
  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    throw new SendError('An idempotency key is required for the final confirmation.', 400);
  }
  const existing = await db.campaign.findFirst({ where: { workspaceId, idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return {
      campaignId: existing.id,
      emailId,
      sendAtUtc: existing.scheduledAtUtc ? existing.scheduledAtUtc.toISOString() : new Date().toISOString(),
      recipientCount: existing.recipientCount || 0,
      idempotentReplay: true,
      note: 'This idempotency key was already used — returning the existing campaign, no duplicate send.',
    };
  }

  const email = await getEmailOrThrow(workspaceId, emailId);
  // An already-launched email cannot be confirmed again with a fresh key:
  // that would create a duplicate campaign and re-send it (M3 lifecycle fix).
  // The idempotency replay above already covers the same-key double click.
  // A cancelled email may be re-confirmed (a fresh campaign); the UI offers
  // the confirm form again after cancel, and the email gets a new campaignId.
  try {
    await assertLoadedEmailEditable(workspaceId, email);
  } catch (err: any) {
    throw new SendError(err.message || 'This email can no longer be sent.', 400);
  }
  const draft = await db.campaignDraft.findFirst({ where: { id: email.draftId, workspaceId } });
  if (!draft) throw new SendError('Campaign draft not found', 404);
  const snap = (draft.profileSnapshot || {}) as Record<string, unknown>;
  const timeZone = typeof snap.timezone === 'string' && snap.timezone ? snap.timezone : 'UTC';
  const receives = (email.receivesRule || {}) as Record<string, any>;

  // Resolve the audience fresh at confirm time (spec §18: re-check before send).
  let resolution: Awaited<ReturnType<typeof resolveRecipients>> | null = null;
  if (receives.sourceType) {
    const brief = (draft.brief || {}) as Record<string, any>;
    const hints = (brief?.audience?.list_hints || {}) as ListHints;
    resolution = await resolveRecipients(
      workspaceId,
      receives.sourceType,
      receives.sourceId ?? null,
      receives.sourceType === 'csv' ? (typeof receives.csvText === 'string' ? receives.csvText : null) : null,
      hints,
    );
  }
  const selected = resolution?.selected || [];
  if (selected.length === 0) throw new SendError('Zero recipients — pick a list or upload a CSV with at least one valid contact.', 400);

  // Send time: send-now inside the window goes now; outside it moves to the
  // recommended start (the window is always respected, spec §13).
  let sendAt: Date;
  if (input.sendNow) {
    const now = new Date();
    sendAt = isWithinSendWindow(now, timeZone) ? now : recommendedStart(now, timeZone).atUtc;
  } else {
    if (!input.sendAt) throw new SendError('Choose "send now" or a scheduled time.', 400);
    sendAt = new Date(input.sendAt);
    if (Number.isNaN(sendAt.getTime())) throw new SendError('Invalid scheduled time.', 400);
    if (!isWithinSendWindow(sendAt, timeZone)) {
      const rec = recommendedStart(new Date(), timeZone);
      throw new SendError(`Scheduled time is outside the send window (weekdays 8:00–17:00 ${timeZone}). Recommended start: ${rec.atUtc.toISOString()}.`, 400);
    }
  }

  const checks = await runSendChecks(workspaceId, emailId, selected.length, sendAt);
  if (checks.blocking.length > 0) {
    throw new SendError(`Sending is blocked: ${checks.blocking.join(' ')}`, 400);
  }

  // Snapshot list: exactly the Phase 8 selection, so the send set matches
  // Phase 8 even if the source list changes later. CSV contacts are imported
  // here (source "csv upload", spec §17 consent records) — not at resolve.
  const contactIds: string[] = [];
  for (const s of selected) {
    if (s.contactId) {
      contactIds.push(s.contactId);
      continue;
    }
    const found = await db.contact.findFirst({ where: { workspaceId, email: s.email } });
    if (found) {
      contactIds.push(found.id);
      continue;
    }
    const created = await db.contact.create({
      data: {
        workspaceId,
        email: s.email,
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        phone: s.phone || null,
        source: 'csv upload',
      },
    });
    contactIds.push(created.id);
  }
  const list = await db.emailList.create({
    data: {
      workspaceId,
      name: `Create with AI — ${input.campaignName || 'Campaign'}`,
    },
  });
  for (const contactId of contactIds) {
    await db.contactListMembership.create({
      data: { workspaceId, listId: list.id, contactId, status: 'SUBSCRIBED', consentSource: 'MANUAL_ADD' },
    });
  }

  const subjects = (Array.isArray(email.subjectVariants) ? email.subjectVariants : []).filter((s: unknown): s is string => typeof s === 'string') as string[];
  const brief = (draft.brief || {}) as Record<string, any>;
  const campaign = await db.campaign.create({
    data: {
      workspaceId,
      name: input.campaignName || 'Create with AI campaign',
      subject: subjects[email.subjectSelected ?? 0] || 'Campaign email',
      status: 'SCHEDULED',
      blockJson: {
        html: String(email.bodyHtml || ''),
        text: String(email.bodyText || ''),
        previewText: email.previewText || '',
        campaignEmailId: email.id,
        footerLocked: true,
        sender: { fromName: String(snap.senderName || ''), replyTo: String(snap.replyToEmail || '') },
      },
      listId: list.id,
      scheduledAtUtc: sendAt,
      draftId: draft.id,
      coldContacts: !!(brief?.audience?.cold_contacts),
      audienceSummary: typeof brief?.audience?.description === 'string' ? brief.audience.description : null,
      recipientCount: contactIds.length,
      sendWindow: { timeZone, start: sendAt.toISOString() },
      idempotencyKey: input.idempotencyKey,
    },
  });

  await db.campaignEmail.update({
    where: { id: emailId },
    data: {
      campaignId: campaign.id,
      status: 'scheduled',
      scheduledAtUtc: sendAt,
      recipientCount: contactIds.length,
      coldAck: input.coldAck ?? email.coldAck ?? false,
    },
  });
  await db.campaignDraft.update({ where: { id: draft.id }, data: { status: 'scheduled', currentPhase: 'review_send' } });

  return {
    campaignId: campaign.id,
    emailId,
    sendAtUtc: sendAt.toISOString(),
    recipientCount: contactIds.length,
    idempotentReplay: false,
    note: input.sendNow && sendAt.getTime() > Date.now()
      ? 'Send now was outside the send window, so the campaign is scheduled for the recommended start instead.'
      : 'Campaign scheduled. The existing schedulers deliver it at the scheduled time through the standard send path.',
  };
}

export async function pauseCampaign(workspaceId: string, campaignId: string): Promise<{ status: string }> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new SendError('Campaign not found', 404);
  if (campaign.status !== 'SCHEDULED' && campaign.status !== 'SENDING') {
    throw new SendError(`Only a scheduled or sending campaign can be paused (current: ${campaign.status}).`, 400);
  }
  await db.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
  if (campaign.draftId) {
    await db.campaignEmail.updateMany({ where: { campaignId, workspaceId }, data: { status: 'paused' } });
  }
  return { status: 'PAUSED' };
}

export async function resumeCampaign(workspaceId: string, campaignId: string): Promise<{ status: string; sendAtUtc: string }> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new SendError('Campaign not found', 404);
  if (campaign.status !== 'PAUSED') throw new SendError(`Only a paused campaign can be resumed (current: ${campaign.status}).`, 400);
  const sendAt = campaign.scheduledAtUtc && campaign.scheduledAtUtc > new Date() ? campaign.scheduledAtUtc : new Date();
  await db.campaign.update({ where: { id: campaignId }, data: { status: 'SCHEDULED', scheduledAtUtc: sendAt } });
  if (campaign.draftId) {
    await db.campaignEmail.updateMany({ where: { campaignId, workspaceId }, data: { status: 'scheduled', scheduledAtUtc: sendAt } });
  }
  return { status: 'SCHEDULED', sendAtUtc: sendAt.toISOString() };
}

export async function cancelCampaign(workspaceId: string, campaignId: string): Promise<{ status: string }> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new SendError('Campaign not found', 404);
  if (campaign.status === 'SENT' || campaign.status === 'CANCELLED') {
    throw new SendError(`A ${campaign.status} campaign cannot be cancelled.`, 400);
  }
  await db.campaign.update({ where: { id: campaignId }, data: { status: 'CANCELLED' } });
  if (campaign.draftId) {
    await db.campaignEmail.updateMany({ where: { campaignId, workspaceId }, data: { status: 'cancelled' } });
  }
  return { status: 'CANCELLED' };
}

/** Sent-campaign status + tracked events for the results view (M3 evidence). */
export async function campaignStatus(workspaceId: string, campaignId: string): Promise<Record<string, unknown>> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new SendError('Campaign not found', 404);
  const recipients = await db.campaignRecipient.findMany({ where: { campaignId } });
  const events = await db.emailEvent.findMany({
    where: { campaignId, workspaceId },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });
  const byType = new Map<string, number>();
  for (const e of events) byType.set(e.eventType, (byType.get(e.eventType) || 0) + 1);
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      scheduledAtUtc: campaign.scheduledAtUtc?.toISOString() || null,
      sentAtUtc: campaign.sentAtUtc?.toISOString() || null,
      recipientCount: campaign.recipientCount,
    },
    recipients: recipients.map((r) => ({ id: r.id, contactId: r.contactId, status: r.status, sentAt: r.sentAt?.toISOString() || null })),
    events: events.map((e) => ({
      type: e.eventType,
      contactId: e.contactId,
      linkUrl: e.linkUrl,
      occurredAt: e.occurredAt.toISOString(),
      isBotSuspected: (e as any).isBotSuspected || false,
    })),
    counts: Object.fromEntries(byType),
  };
}

export type { TokenContact };
