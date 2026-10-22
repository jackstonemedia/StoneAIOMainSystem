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
 * Nothing is published, sent, or deployed by this build itself: in dev no
 * Gmail connection exists, so test sends report honestly instead of faking
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
import { checkDomainDns, isReservedDomain } from './sending-domain.service.js';
import { buildAbTestConfig, buildCtaVariantBody, effectiveAbMode, type AbTestPlan } from './ab-test.service.js';
import { validateColdFormat } from './cold-outreach.service.js';
import { resolveRecipients, type ListHints, type RecipientSourceType } from './recipients.service.js';

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
  domainAuth: { domain: string | null; spf: boolean; dkim: boolean; dmarc: boolean; verified: boolean; note: string };
  /** M6: the locked A/B plan + its effective mode at this real count (null when no plan). */
  abTest: {
    planned: 'none' | 'split' | 'test_then_winner' | 'decide_at_send';
    effective: 'none' | 'split' | 'test_then_winner';
    variable: 'subject' | 'cta' | null;
    testEmailOrder: number;
    waitHours: number;
    reason: string;
  } | null;
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
  if (!domain) return { domain, spf: false, dkim: false, dmarc: false, verified: false, note: 'No sender email configured.' };
  const row = await db.sendingDomain.findFirst({ where: { workspaceId, domain } });
  const rowBased = (): SendCheck['domainAuth'] => {
    if ((row as any)?.status === 'VERIFIED') {
      return { domain, spf: true, dkim: true, dmarc: false, verified: true, note: `Sending domain ${domain} is verified (record). DMARC status unknown for this record.` };
    }
    let spf = false;
    let dkim = false;
    let dmarc = false;
    try {
      const records = Array.isArray((row as any)?.dnsRecords) ? ((row as any).dnsRecords as any[]) : [];
      for (const r of records) {
        const rec = String(r.record || '').toUpperCase();
        const st = String(r.status || '').toLowerCase();
        if (st === 'verified' || st === 'valid') {
          if (rec === 'SPF') spf = true;
          if (rec === 'DKIM') dkim = true;
          if (rec === 'DMARC') dmarc = true;
        }
      }
    } catch {
      /* fall through */
    }
    return {
      domain,
      spf,
      dkim,
      dmarc,
      verified: spf && dkim,
      note: spf && dkim
        ? `SPF and DKIM verified for ${domain} (record).`
        : `Sending domain ${domain} is not fully verified (SPF: ${spf}, DKIM: ${dkim}).`,
    };
  };
  // Gmail-only: SPF/DKIM/DMARC come from direct DNS lookups (sending-domain
  // service), never from a provider API. RFC 2606 reserved domains
  // (.example/.test/.localhost/.invalid) have no real DNS by definition, so
  // Phase 8 checks use the sending-domain record for those (dev fixtures).
  // A live DNS lookup that errors inconclusively falls back to the record
  // rather than blocking on a transient DNS failure.
  if (isReservedDomain(domain)) {
    if (!row) {
      return { domain, spf: false, dkim: false, dmarc: false, verified: false, note: `No sending domain registered for ${domain} (test domain — live DNS does not apply).` };
    }
    const r = rowBased();
    return { ...r, note: `${r.note} Test domain — status from the sending-domain record, not live DNS.` };
  }
  const dns = await checkDomainDns(domain);
  if (!dns.inconclusive) {
    return {
      domain,
      spf: dns.spf,
      dkim: dns.dkim,
      dmarc: dns.dmarc,
      verified: dns.spf && dns.dkim,
      note: `Live DNS for ${domain}: ${dns.note}`,
    };
  }
  if (row) {
    const r = rowBased();
    return { ...r, note: `${r.note} Live DNS lookup was inconclusive; using last verification.` };
  }
  return { domain, spf: false, dkim: false, dmarc: false, verified: false, note: `Live DNS lookup inconclusive and no sending domain registered for ${domain}.` };
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
  // M5: a send_reaction rule without a drafted reaction email is a BLOCKING
  // item (spec §13), surfaced here so the Phase 8 UI shows it and both
  // confirm paths refuse via their existing blocking checks.
  try {
    await assertReactionEmailsDrafted(workspaceId, email.draftId);
  } catch (err) {
    blocking.push(err instanceof Error ? err.message : 'A reaction email is missing its draft.');
  }

  // M6: A/B plan checks (spec §11). Only the TEST email carries them — the
  // mode re-check warning applies to the campaign send, and a test naming
  // a later sequence email blocks on that email (Email-1-only in M6).
  let abTest: SendCheck['abTest'] = null;
  const planRaw = (draft.plan || {}) as Record<string, unknown>;
  const abPlan = (planRaw.ab_test || null) as AbTestPlan | null;
  if (abPlan) {
    const plannedMode = abPlan.decision === 'no' ? 'none' : abPlan.mode;
    const eff = effectiveAbMode(abPlan, recipientCount > 0 ? recipientCount : null);
    abTest = {
      planned: plannedMode,
      effective: eff.mode,
      variable: abPlan.variable,
      testEmailOrder: abPlan.testEmailOrder,
      waitHours: abPlan.waitHours,
      reason: eff.reason,
    };
    if (eff.changed) warnings.push(eff.reason);
    if (abPlan.decision === 'yes' && abPlan.testEmailOrder === email.order) {
      if (abPlan.testEmailOrder > 1) {
        blocking.push('A/B testing a later sequence email is not supported in this version — move the test to Email 1 or remove it (reopen Phase 6).');
      } else {
        const subjectsHere = (Array.isArray(email.subjectVariants) ? email.subjectVariants : []).filter((x: unknown): x is string => typeof x === 'string') as string[];
        const picked = subjectsHere[email.subjectSelected ?? 0] || '';
        if (abPlan.variable === 'subject') {
          // Phase 7's picked subject becomes version A; version B comes
          // from the plan. Identical versions cannot be tested.
          if (picked && picked.toLowerCase() === abPlan.variantB.toLowerCase()) {
            blocking.push('The picked subject matches version B of the A/B test — pick a different subject, or change version B in Phase 6.');
          }
        } else if (abPlan.variable === 'cta') {
          const bodyHere = String(email.bodyHtml || '');
          if (!abPlan.variantA || bodyHere.indexOf(abPlan.variantA) === -1) {
            blocking.push(`The planned version-A call-to-action ("${abPlan.variantA}") does not appear in the email body — edit the draft so the call to action matches, or change the test in Phase 6.`);
          }
        }
        if (eff.mode === 'test_then_winner' && sendAt) {
          const seqDeadline = ((draft.sequence || {}) as Record<string, unknown>).deadlineUtc;
          if (seqDeadline) {
            const dl = new Date(String(seqDeadline));
            const waitEnds = new Date(sendAt.getTime() + abPlan.waitHours * 3600_000);
            if (!Number.isNaN(dl.getTime()) && waitEnds > dl) {
              blocking.push(`The A/B wait ends (${waitEnds.toISOString().slice(0, 10)}) after the sequence deadline (${dl.toISOString().slice(0, 10)}) — shorten the wait in Phase 6 or move the deadline.`);
            }
          }
        }
      }
    }
  }

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

  // M7: cold format is plain text, 50–100 words, no images (blocking).
  if (cold) blocking.push(...validateColdFormat(html, text, true));

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
  if (!domainAuth.dmarc && domainAuth.domain) {
    // DMARC missing is a warning (spec §13/§17); SPF/DKIM failure already blocks above.
    warnings.push(`DMARC record missing for ${domainAuth.domain} — warn, do not block.`);
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

  return { blocking, warnings, links: linkResults, domainAuth, abTest };
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
  // M5: per-email tracking identity. Defaults preserve the M3 behavior
  // (order 1, legacy 'email' token id) for single-email sends.
  opts?: { emailOrder?: number; emailId?: string },
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
    emailOrder: opts?.emailOrder ?? 1,
    emailId: opts?.emailId,
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

  // Gmail-only (no Resend): test sends go through the same Gmail channel
  // the campaign worker uses (sendGmailMessage via the workspace Gmail
  // OAuth connection). No provider key, no Resend. Without a Gmail
  // connection the test send fails honestly with a 503 — never faked.
  let gmailConn = await db.channelConnection.findFirst({
    where: { workspaceId, provider: 'gmail', isActive: true },
  }).catch(() => null);
  if (!gmailConn) {
    gmailConn = await db.channelConnection.findFirst({
      where: { provider: 'gmail', isActive: true },
    }).catch(() => null);
  }
  if (!gmailConn) {
    throw new SendError('Gmail is not connected for this workspace. Connect a Gmail account to send test emails.', 503);
  }
  const { sendGmailMessage } = await import('../channels/gmail.service.js');
  try {
    for (const to of clean) {
      await sendGmailMessage(gmailConn.id, to, subject, text, undefined, html, String(snap.senderName));
    }
  } catch (err: unknown) {
    throw new SendError(`Test send failed: ${err instanceof Error ? err.message : String(err)}`, 502);
  }
  return {
    sent: clean.length,
    to: clean,
    subject,
    note: 'Test send delivered via Gmail. The unsubscribe link in a test send is a placeholder (no real contact), and clicks on it are not recorded.',
  };
}

/** Path simulator (spec §13): the 7 scenarios for a single-email campaign. */
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
/**
 * M5 Phase 8 blocking check (spec §13: "reaction rule → missing email"):
 * every send_reaction rule in the draft must have a drafted reaction email
 * row (kind 'reaction', non-empty body). Reaction emails are drafted in
 * Phase 7 (generate-reactions); launching without them would arm rules
 * that can never fire. Throws a 400 naming the first missing rule.
 */
export async function assertReactionEmailsDrafted(workspaceId: string, draftId: string): Promise<void> {
  const rules = await db.reactionRule.findMany({ where: { workspaceId, draftId, action: 'send_reaction' }, orderBy: { priority: 'asc' } });
  if (rules.length === 0) return;
  const reactionRows = await db.campaignEmail.findMany({ where: { workspaceId, draftId, kind: 'reaction' } });
  for (const rule of rules) {
    const params = (rule.actionParams || {}) as Record<string, unknown>;
    const purpose = String(params.emailPurpose || '');
    const row = reactionRows.find((r) => String(r.purpose || '') === purpose && String(r.bodyText || '').trim().length > 0);
    if (!row) {
      throw new SendError(
        `Reaction rule for Email ${rule.sourceOrder} is missing its email: draft the "${purpose || 'reaction'}" email in Phase 7 before confirming.`,
        400,
      );
    }
  }
}

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
  // M6: A/B config for the Email-1 campaign (the existing sendCampaign
  // branch understands it: splitPercentage 100 → 50/50, 20 → 10/10 + HOLD).
  // Phase 7's picked subject becomes version A; version B comes from the
  // plan. For CTA tests both subjects are the picked subject and the
  // bodies differ in the call-to-action wording only.
  let abTestConfig: Record<string, any> | undefined;
  const abDetail = checks.abTest;
  const planForSend = ((draft.plan || {}) as Record<string, unknown>).ab_test as AbTestPlan | null;
  if (planForSend && planForSend.decision === 'yes' && abDetail && abDetail.effective !== 'none' && abDetail.testEmailOrder === email.order && email.order === 1) {
    const pickedSubject = subjects[email.subjectSelected ?? 0] || 'Campaign email';
    const bodyA = String(email.bodyHtml || '');
    const bodyB = planForSend.variable === 'cta' ? buildCtaVariantBody(bodyA, planForSend.variantA, planForSend.variantB) : bodyA;
    const cfg = buildAbTestConfig(
      { ...planForSend, variantA: planForSend.variable === 'subject' ? pickedSubject : planForSend.variantA },
      abDetail.effective,
      bodyA,
      bodyB,
      draft.id,
    );
    // Subject fields: the worker reads subjectA/subjectB for variants.
    cfg.subjectA = pickedSubject;
    cfg.subjectB = planForSend.variable === 'subject' ? planForSend.variantB : pickedSubject;
    abTestConfig = cfg;
  }
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
      ...(abTestConfig ? { abTestConfig } : {}),
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

/**
 * Sequence confirmation (M4, spec §9 + §13): confirms a whole sequence at
 * once. Email 1 goes through the existing confirmSend (campaign + snapshot
 * list + schedulers); emails 2..N are marked 'scheduled' with their planned
 * global times (per-person dues live on RecipientStates, computed at
 * enroll time from each recipient's actual first send). Later emails NEVER
 * get their own campaigns — the sequence runner sends them per contact
 * under the email-1 campaign's id (tracking + UTM), and it re-checks the
 * campaign status (pause/cancel stops all unsent steps, spec §13).
 * All emails are check-gated BEFORE anything launches: a blocking issue in
 * any email aborts the whole confirm with nothing scheduled.
 */
export async function confirmSequenceSend(
  workspaceId: string,
  draftId: string,
  input: ConfirmSendInput,
): Promise<{
  campaignId: string;
  emailIds: string[];
  sendAtUtc: string;
  recipientCount: number;
  idempotentReplay: boolean;
  note: string;
}> {
  if (!input.idempotencyKey || !input.idempotencyKey.trim()) {
    throw new SendError('An idempotency key is required for the final confirmation.', 400);
  }
  const replay = await db.campaign.findFirst({ where: { workspaceId, idempotencyKey: input.idempotencyKey } });
  if (replay) {
    const replayEmails = await db.campaignEmail.findMany({ where: { draftId, workspaceId }, orderBy: { order: 'asc' } });
    return {
      campaignId: replay.id,
      emailIds: replayEmails.map((e) => e.id),
      sendAtUtc: replay.scheduledAtUtc ? replay.scheduledAtUtc.toISOString() : new Date().toISOString(),
      recipientCount: replay.recipientCount || 0,
      idempotentReplay: true,
      note: 'This idempotency key was already used — returning the existing sequence campaign, no duplicate send.',
    };
  }
  const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!draft) throw new SendError('Campaign draft not found', 404);
  const sequence = (draft.sequence || {}) as {
    count?: number;
    emails?: Array<{ order: number; plannedAtUtc: string; purpose: string }>;
  };
  if (!sequence.count || sequence.count <= 1 || !Array.isArray(sequence.emails) || sequence.emails.length === 0) {
    throw new SendError('This draft has no multi-email sequence. Use the single-email confirmation.', 400);
  }
  const emails = await db.campaignEmail.findMany({ where: { draftId, workspaceId, kind: 'scheduled' }, orderBy: { order: 'asc' } });
  if (emails.length !== sequence.count) {
    throw new SendError(`Generate all ${sequence.count} sequence emails before confirming (found ${emails.length}).`, 400);
  }
  const first = emails[0];
  const receives = (first.receivesRule || {}) as Record<string, unknown>;
  if (!receives.sourceType) {
    throw new SendError('Pick recipients in Phase 8 first (saved segment, filter, or CSV).', 400);
  }
  const brief = (draft.brief || {}) as Record<string, unknown>;
  const hints = (brief?.audience as { list_hints?: ListHints } | null)?.list_hints || {};
  const resolution = await resolveRecipients(
    workspaceId,
    String(receives.sourceType) as RecipientSourceType,
    (receives.sourceId as string | null) ?? null,
    receives.sourceType === 'csv' ? (typeof receives.csvText === 'string' ? receives.csvText : null) : null,
    hints,
  );
  const selected = resolution.selected || [];
  if (selected.length === 0) throw new SendError('Zero recipients — pick a list or upload a CSV with at least one valid contact.', 400);
  // Gate every email before launching any of them.
  const plannedByOrder = new Map(sequence.emails.map((e) => [e.order, e.plannedAtUtc]));
  for (const email of emails) {
    const planned = plannedByOrder.get(email.order);
    const sendAt = planned ? new Date(planned) : null;
    const checks = await runSendChecks(workspaceId, email.id, selected.length, sendAt);
    if (checks.blocking.length > 0) {
      throw new SendError(`Sending is blocked for Email ${email.order}: ${checks.blocking.join(' ')}`, 400);
    }
  }
  const firstResult = await confirmSend(workspaceId, first.id, input);
  // Emails 2..N: scheduled rows with planned global times (display). Their
  // per-person dues are set at enroll time (RecipientState), not here.
  for (const email of emails.slice(1)) {
    const planned = plannedByOrder.get(email.order);
    await db.campaignEmail.update({
      where: { id: email.id },
      data: {
        status: 'scheduled',
        scheduledAtUtc: planned ? new Date(planned) : null,
        recipientCount: selected.length,
        coldAck: input.coldAck ?? email.coldAck ?? false,
      },
    });
  }
  return {
    campaignId: firstResult.campaignId,
    emailIds: emails.map((e) => e.id),
    sendAtUtc: firstResult.sendAtUtc,
    recipientCount: firstResult.recipientCount,
    idempotentReplay: false,
    note: `Sequence scheduled: Email 1 via the standard send path; emails 2..${emails.length} follow per recipient from each recipient's first send (sequence runner).`,
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
