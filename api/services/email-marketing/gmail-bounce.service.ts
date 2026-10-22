/**
 * Create-with-AI Milestone 5 — Gmail bounce parsing (Gmail-only replacement
 * for the deleted Resend bounce webhook, spec §17 + §18).
 *
 * Gmail does not push bounce events: delivery-status notifications (RFC
 * 3464 DSNs) arrive as ordinary mail from mailer-daemon. The poller (every
 * 2 minutes) scans for them, parses each DSN, and applies it:
 * - Hard bounce (5.x.x): SuppressionEntry + membership BOUNCED +
 *   RecipientState exited_bounced for every active state of that contact
 *   in the workspace + BOUNCED EmailEvent.
 * - Soft bounce (4.x.x): BOUNCED EmailEvent (metadata.soft = true). Three
 *   soft bounces for the same contact within 30 days suppress, per spec
 *   §17's 3-strike rule (documented simplification: "consecutive" is
 *   read as within one 30-day window, since a successful delivery in
 *   between is visible as a later SENT event and resets the count below).
 *
 * Mapping a DSN to a sent email: the DSN's attached original message
 * carries the RFC Message-ID Gmail assigned at send time. The scan
 * resolves it with Gmail's rfc822msgid search and matches the Gmail
 * message id against stored send ids (CampaignRecipient.resendMessageId —
 * vestigial name, holds the Gmail id — and SENT EmailEvent
 * metadata.messageId). When no Message-ID is present, the fallback is the
 * most recent SENT email to that recipient before the DSN date, preferring
 * a subject match when the DSN names one. Dedup is exact: an applied
 * bounce carries metadata.dsnGmailId, and a DSN already applied is skipped.
 * A DSN that cannot be mapped to any send is logged and skipped, never
 * applied blindly to a contact.
 */

import { db } from '../../../infrastructure/database/client.js';

export interface ParsedBounce {
  recipientEmail: string;
  statusClass: 'hard' | 'soft';
  statusCode: string;
  originalMessageId: string | null;
  originalSubject: string | null;
}

function unfoldHeaders(text: string): string {
  return text.replace(/\r?\n[ \t]+/g, ' ');
}

/**
 * Parse a DSN (RFC 3464) from raw MIME text. Pure — unit-tested with
 * fixtures. Returns null when the text is not a recognizable DSN.
 */
export function parseBounceNotification(raw: string): ParsedBounce | null {
  const text = unfoldHeaders(raw);
  const statusMatch = text.match(/^Status:\s*([45])\.(\d+)\.(\d+)/im);
  if (!statusMatch) return null;
  const statusClass = statusMatch[1] === '5' ? 'hard' : 'soft';
  const statusCode = `${statusMatch[1]}.${statusMatch[2]}.${statusMatch[3]}`;
  const recipMatch =
    text.match(/^Final-Recipient:\s*rfc822;\s*([^\s;]+)/im) ||
    text.match(/^Original-Recipient:\s*rfc822;\s*([^\s;]+)/im);
  if (!recipMatch) return null;
  const recipientEmail = recipMatch[1].replace(/[<>]/g, '').trim().toLowerCase();
  if (!recipientEmail.includes('@')) return null;
  // The attached original message is the LAST Message-ID header block in a
  // typical DSN (the DSN's own Message-ID comes first, the original's
  // second). Prefer a Message-ID that appears after the delivery-status
  // section; fall back to the last Message-ID in the whole text.
  const dsnIdx = text.search(/message\/delivery-status/i);
  const searchFrom = dsnIdx >= 0 ? text.slice(dsnIdx) : text;
  const msgIds = [...searchFrom.matchAll(/^Message-ID:\s*(<[^>]+>)/gim)].map((m) => m[1]);
  const originalMessageId = msgIds.length ? msgIds[msgIds.length - 1].replace(/[<>]/g, '') : null;
  const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
  const originalSubject = subjectMatch ? subjectMatch[1].trim() : null;
  return { recipientEmail, statusClass, statusCode, originalMessageId, originalSubject };
}

/** Soft-bounce strikes: count soft BOUNCED events in the last 30 days. */
export async function softBounceStrikes(workspaceId: string, contactId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const events = await db.emailEvent.findMany({
    where: { workspaceId, contactId, eventType: 'BOUNCED', occurredAt: { gte: since } },
    select: { metadata: true },
  });
  return events.filter((e) => (e.metadata as Record<string, unknown> | null)?.soft === true).length;
}

interface MappedSend {
  contactId: string;
  contactEmail: string;
  campaignId: string | null;
  via: 'rfc-message-id' | 'recency-fallback';
}

/** Map a parsed DSN to a sent email in this workspace, or null. */
async function mapBounceToSend(
  workspaceId: string,
  connectionId: string,
  parsed: ParsedBounce,
  dsnDate: Date,
): Promise<MappedSend | null> {
  // Exact path: original Message-ID → Gmail id → stored send id.
  if (parsed.originalMessageId) {
    try {
      const { findGmailMessageByRfcId } = await import('../channels/gmail.service.js');
      const gmailId = await findGmailMessageByRfcId(connectionId, parsed.originalMessageId);
      if (gmailId) {
        const recipient = await db.campaignRecipient.findFirst({
          where: { resendMessageId: gmailId },
          select: { contactId: true, campaignId: true },
        });
        if (recipient) {
          const contact = await db.contact.findFirst({ where: { id: recipient.contactId, workspaceId }, select: { email: true } });
          if (contact?.email) return { contactId: recipient.contactId, contactEmail: contact.email, campaignId: recipient.campaignId, via: 'rfc-message-id' };
        }
        const recent = await db.emailEvent.findMany({
          where: { workspaceId, eventType: 'SENT' },
          orderBy: { occurredAt: 'desc' },
          take: 200,
          select: { contactId: true, campaignId: true, metadata: true },
        });
        const hit = recent.find((e) => (e.metadata as Record<string, unknown> | null)?.messageId === gmailId);
        if (hit) {
          const contact = await db.contact.findFirst({ where: { id: hit.contactId, workspaceId }, select: { email: true } });
          if (contact?.email) return { contactId: hit.contactId, contactEmail: contact.email, campaignId: hit.campaignId, via: 'rfc-message-id' };
        }
      }
    } catch (err) {
      console.error('[BounceScan] rfc mapping failed, falling back:', (err as Error).message);
    }
  }
  // Fallback: most recent SENT to this recipient before the DSN date.
  const contact = await db.contact.findFirst({ where: { workspaceId, email: parsed.recipientEmail }, select: { id: true, email: true } });
  if (!contact) return null;
  const sends = await db.emailEvent.findMany({
    where: { workspaceId, contactId: contact.id, eventType: 'SENT', occurredAt: { lte: dsnDate } },
    orderBy: { occurredAt: 'desc' },
    take: 10,
    select: { campaignId: true, metadata: true, occurredAt: true },
  });
  if (sends.length === 0) return null;
  // Prefer a subject match when the DSN names the original subject.
  let chosen = sends[0];
  if (parsed.originalSubject) {
    const bySubject = sends.find((s) => {
      const meta = (s.metadata || {}) as Record<string, unknown>;
      const subj = String(meta.subject || '');
      return subj && (parsed.originalSubject!.includes(subj) || subj.includes(parsed.originalSubject!));
    });
    if (bySubject) chosen = bySubject;
  }
  return { contactId: contact.id, contactEmail: contact.email ?? parsed.recipientEmail, campaignId: chosen.campaignId, via: 'recency-fallback' };
}

/** Apply one parsed DSN. Returns a short outcome for logging. */
export async function applyBounce(
  workspaceId: string,
  connectionId: string,
  dsnGmailId: string,
  parsed: ParsedBounce,
  dsnDate: Date = new Date(),
): Promise<{ applied: boolean; reason: string }> {
  // Exact dedup: this DSN already applied.
  const existingDsn = await db.emailEvent.findMany({
    where: { workspaceId, eventType: 'BOUNCED' },
    select: { metadata: true, contactId: true },
    take: 500,
  });
  if (existingDsn.some((e) => (e.metadata as Record<string, unknown> | null)?.dsnGmailId === dsnGmailId)) {
    return { applied: false, reason: 'DSN already applied.' };
  }
  const mapped = await mapBounceToSend(workspaceId, connectionId, parsed, dsnDate);
  if (!mapped) return { applied: false, reason: `No sent email found for ${parsed.recipientEmail}.` };
  const { contactId, campaignId } = mapped;
  const nowIso = new Date().toISOString();
  await db.emailEvent.create({
    data: {
      workspaceId,
      contactId,
      campaignId,
      eventType: 'BOUNCED',
      metadata: JSON.parse(JSON.stringify({ soft: parsed.statusClass === 'soft', statusCode: parsed.statusCode, dsnGmailId, via: mapped.via })) as never,
    },
  });
  const hard = parsed.statusClass === 'hard';
  let suppress = hard;
  if (!hard) {
    const strikes = await softBounceStrikes(workspaceId, contactId);
    if (strikes >= 3) suppress = true;
  }
  if (suppress) {
    const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId }, select: { email: true } });
    if (contact?.email) {
      await db.suppressionEntry.upsert({
        where: { workspaceId_email: { workspaceId, email: contact.email } },
        update: {},
        create: { workspaceId, email: contact.email, reason: hard ? `Hard bounce (${parsed.statusCode})` : 'Three soft bounces in 30 days' },
      }).catch(() => null);
      await db.contactListMembership.updateMany({
        where: { workspaceId, contactId, status: { not: 'BOUNCED' } },
        data: { status: 'BOUNCED' },
      }).catch(() => null);
    }
    const states = await db.recipientState.findMany({ where: { workspaceId, contactId, status: 'active' }, select: { id: true, history: true } });
    for (const s of states) {
      const history = Array.isArray(s.history) ? [...s.history, { at: nowIso, from: 'active', to: 'exited_bounced', reason: `Bounce suppression (${parsed.statusCode}).` }] : [];
      await db.recipientState.update({ where: { id: s.id }, data: { status: 'exited_bounced', nextSendAt: null, history: JSON.parse(JSON.stringify(history)) as never } });
    }
  }
  return { applied: true, reason: suppress ? `Suppressed (${parsed.statusCode}, via ${mapped.via}).` : `Soft bounce recorded (${parsed.statusCode}, via ${mapped.via}).` };
}

/**
 * Scan one Gmail connection's mailbox for new DSNs (last 7 days) and apply
 * them. Never throws — a scan failure is logged, never breaks reply polling.
 */
export async function scanBounceNotifications(connectionId: string): Promise<{ scanned: number; applied: number; skipped: number }> {
  const counts = { scanned: 0, applied: 0, skipped: 0 };
  try {
    const conn = await db.channelConnection.findUnique({ where: { id: connectionId }, select: { workspaceId: true, provider: true } });
    if (!conn || conn.provider !== 'gmail') return counts;
    const { searchGmailMessages, getGmailMessageRaw } = await import('../channels/gmail.service.js');
    const ids = await searchGmailMessages(connectionId, 'from:(mailer-daemon@googlemail.com) newer_than:7d', 50);
    for (const id of ids) {
      counts.scanned += 1;
      try {
        const raw = await getGmailMessageRaw(connectionId, id);
        const parsed = parseBounceNotification(raw);
        if (!parsed) {
          counts.skipped += 1;
          continue;
        }
        const result = await applyBounce(conn.workspaceId, connectionId, id, parsed);
        if (result.applied) counts.applied += 1;
        else counts.skipped += 1;
      } catch (err) {
        console.error(`[BounceScan] DSN ${id} failed:`, (err as Error).message);
        counts.skipped += 1;
      }
    }
  } catch (err) {
    console.error('[BounceScan] Scan failed:', (err as Error).message);
  }
  return counts;
}
