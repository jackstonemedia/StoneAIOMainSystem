/**
 * Create-with-AI M3 — Phase 8 recipient picker (spec §13).
 *
 * Sources: saved segment, smart list, list, or CSV upload (email required;
 * optional first_name, last_name, phone, company; dedupe, validation,
 * rejected rows). No contacts are created at resolve time — CSV contacts are
 * imported only when the campaign is confirmed.
 *
 * Exclusion groups (each excluded contact lands in exactly one group, in
 * priority order): unsubscribed, complained, bounced, suppressed, duplicate,
 * in another active sequence, over the frequency cap (3 emails / 7 days,
 * spec §22 default 10). Phase 2 exclusions are user-stated text, not a
 * computable filter — they are shown as a note, never silently applied.
 *
 * Mismatch check: compare selected contacts to list_hints where the fields
 * exist (location, status, relationship via tags). Warn when >20% do not
 * match. If no hint field maps, the check is skipped and the audience
 * summary is shown instead (spec §13).
 */

import { db } from '../../../infrastructure/database/client.js';
import { parseRecipientCsv, tokenCoverage, type CsvParsedContact } from './fact-validator.js';

export class RecipientError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type RecipientSourceType = 'segment' | 'smartList' | 'list' | 'csv';

export interface ListHints {
  relationship?: string | null;
  recency?: string | null;
  location?: string | null;
  status?: string | null;
  exclusions?: string | null;
}

export interface ExclusionGroup {
  key: string;
  label: string;
  count: number;
  contacts: { email: string; contactId?: string }[];
}

export interface RecipientResolution {
  sourceType: RecipientSourceType;
  sourceId: string | null;
  sourceName: string | null;
  totalCandidates: number;
  /** Contacts that pass every exclusion check. */
  selected: { email: string; contactId?: string; firstName?: string; lastName?: string; phone?: string; company?: string }[];
  excluded: ExclusionGroup[];
  /** Phase 2 user-stated exclusions (note only — not computable). */
  phase2ExclusionsNote: string | null;
  mismatch: { applicable: boolean; mismatchPct: number | null; warned: boolean; detail: string };
  /** CSV contacts to import on confirm (resolve time creates nothing). */
  csvContacts: CsvParsedContact[];
  csvRejected: { row: number; email: string; reason: string }[];
  csvDuplicates: number;
}

interface Candidate {
  email: string;
  contactId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
}

const EXCLUSION_ORDER = ['unsubscribed', 'complained', 'bounced', 'suppressed', 'duplicate', 'conflict', 'cap'] as const;
const EXCLUSION_LABELS: Record<string, string> = {
  unsubscribed: 'Unsubscribed',
  complained: 'Spam complaints',
  bounced: 'Bounced',
  suppressed: 'Suppressed',
  duplicate: 'Duplicates',
  conflict: 'In another active sequence',
  cap: 'Over the frequency cap (3 emails / 7 days)',
};

async function loadCandidates(
  workspaceId: string,
  sourceType: RecipientSourceType,
  sourceId: string | null,
  csvText: string | null,
): Promise<{ candidates: Candidate[]; sourceName: string | null; csvContacts: CsvParsedContact[]; csvRejected: { row: number; email: string; reason: string }[]; csvDuplicates: number }> {
  if (sourceType === 'csv') {
    const parsed = parseRecipientCsv(csvText || '');
    return {
      candidates: parsed.contacts.map((c) => ({ email: c.email, firstName: c.firstName, lastName: c.lastName, phone: c.phone, company: c.company })),
      sourceName: 'CSV upload',
      csvContacts: parsed.contacts,
      csvRejected: parsed.rejected,
      csvDuplicates: parsed.duplicates,
    };
  }
  if (!sourceId) throw new RecipientError(`A ${sourceType} must be selected.`, 400);

  let contactIds: string[] = [];
  let sourceName: string | null = null;
  if (sourceType === 'segment') {
    const segment = await db.segment.findFirst({ where: { id: sourceId, workspaceId } });
    if (!segment) throw new RecipientError('Segment not found', 404);
    sourceName = segment.name;
    const { evaluateSegment } = await import('./audience.service.js');
    contactIds = await evaluateSegment(workspaceId, segment.filterDefinition as any);
  } else if (sourceType === 'smartList') {
    const smartList = await db.smartList.findFirst({ where: { id: sourceId, workspaceId } });
    if (!smartList) throw new RecipientError('Smart list not found', 404);
    sourceName = smartList.name;
    const { getSmartListContacts } = await import('../crm.service.js');
    const res = await getSmartListContacts(sourceId, workspaceId, 1, 100000);
    contactIds = (res?.contacts || []).filter((c: any) => c.email && c.email.includes('@')).map((c: any) => c.id);
  } else if (sourceType === 'list') {
    const list = await db.emailList.findFirst({ where: { id: sourceId, workspaceId } });
    if (!list) throw new RecipientError('List not found', 404);
    sourceName = list.name;
    const memberships = await db.contactListMembership.findMany({
      where: { workspaceId, listId: sourceId },
      select: { contactId: true },
    });
    contactIds = memberships.map((m) => m.contactId);
  } else {
    throw new RecipientError(`Unknown recipient source: ${sourceType}`, 400);
  }

  if (contactIds.length === 0) return { candidates: [], sourceName, csvContacts: [], csvRejected: [], csvDuplicates: 0 };
  const contacts = await db.contact.findMany({
    where: { id: { in: contactIds }, workspaceId },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, companyId: true },
  });
  const companies = new Map<string, string>();
  const companyIds = [...new Set(contacts.map((c) => c.companyId).filter(Boolean) as string[])];
  if (companyIds.length > 0) {
    const rows = await db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } });
    for (const r of rows) companies.set(r.id, r.name);
  }
  return {
    candidates: contacts
      .filter((c) => c.email && c.email.includes('@'))
      .map((c) => ({
        email: (c.email as string).toLowerCase(),
        contactId: c.id,
        firstName: c.firstName || undefined,
        lastName: c.lastName || undefined,
        phone: c.phone || undefined,
        company: c.companyId ? companies.get(c.companyId) : undefined,
      })),
    sourceName,
    csvContacts: [],
    csvRejected: [],
    csvDuplicates: 0,
  };
}

export async function resolveRecipients(
  workspaceId: string,
  sourceType: RecipientSourceType,
  sourceId: string | null,
  csvText: string | null,
  listHints: ListHints,
): Promise<RecipientResolution> {
  const loaded = await loadCandidates(workspaceId, sourceType, sourceId, csvText);

  // Enrich candidates with Contact rows (location/status/tags) for checks.
  const byEmail = new Map<string, Candidate>();
  for (const c of loaded.candidates) {
    if (!byEmail.has(c.email)) byEmail.set(c.email, c);
  }
  const knownIds = [...byEmail.values()].map((c) => c.contactId).filter(Boolean) as string[];
  const contactRows = knownIds.length > 0
    ? await db.contact.findMany({
        where: { id: { in: knownIds }, workspaceId },
        select: { id: true, email: true, location: true, status: true, tagsJson: true },
      })
    : [];
  const rowById = new Map(contactRows.map((r) => [r.id, r]));
  // CSV rows: resolve to existing contacts by email for exclusion checks.
  const csvEmails = loaded.candidates.filter((c) => !c.contactId).map((c) => c.email);
  const emailMatches = csvEmails.length > 0
    ? await db.contact.findMany({
        where: { workspaceId, email: { in: csvEmails } },
        select: { id: true, email: true, location: true, status: true, tagsJson: true },
      })
    : [];
  const rowByEmail = new Map(emailMatches.map((r) => [(r.email || '').toLowerCase(), r]));
  for (const c of byEmail.values()) {
    if (!c.contactId && rowByEmail.has(c.email)) {
      const r = rowByEmail.get(c.email) as { id: string };
      c.contactId = r.id;
    }
  }

  // Suppression + membership + event signals, batched.
  const allEmails = [...byEmail.keys()];
  const suppressions = await db.suppressionEntry.findMany({
    where: { workspaceId, email: { in: allEmails } },
    select: { email: true },
  });
  const suppressedEmails = new Set(suppressions.map((s) => s.email.toLowerCase()));
  const memberships = knownIds.length > 0 || emailMatches.length > 0
    ? await db.contactListMembership.findMany({
        where: { workspaceId, contactId: { in: [...new Set([...knownIds, ...emailMatches.map((r) => r.id)])] } },
        select: { contactId: true, status: true },
      })
    : [];
  const membershipStatus = new Map<string, Set<string>>();
  for (const m of memberships) {
    if (!membershipStatus.has(m.contactId)) membershipStatus.set(m.contactId, new Set());
    membershipStatus.get(m.contactId)?.add(m.status);
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSends = await db.emailEvent.findMany({
    where: {
      workspaceId,
      eventType: 'SENT',
      occurredAt: { gte: sevenDaysAgo },
      contactId: { in: [...new Set([...knownIds, ...emailMatches.map((r) => r.id)])] },
    },
    select: { contactId: true },
  });
  const sendCounts = new Map<string, number>();
  for (const e of recentSends) sendCounts.set(e.contactId, (sendCounts.get(e.contactId) || 0) + 1);
  const activeRecipients = await db.campaignRecipient.findMany({
    where: {
      campaign: { workspaceId, status: { in: ['SCHEDULED', 'SENDING'] } },
      contactId: { in: [...new Set([...knownIds, ...emailMatches.map((r) => r.id)])] },
    },
    select: { contactId: true },
  });
  const conflictIds = new Set(activeRecipients.map((r) => r.contactId));

  const groups = new Map<string, { email: string; contactId?: string }[]>();
  for (const k of EXCLUSION_ORDER) groups.set(k, []);
  const selected: Candidate[] = [];
  const seenEmails = new Set<string>();
  for (const c of byEmail.values()) {
    if (seenEmails.has(c.email)) {
      groups.get('duplicate')?.push({ email: c.email, contactId: c.contactId });
      continue;
    }
    seenEmails.add(c.email);
    const statuses = c.contactId ? membershipStatus.get(c.contactId) : undefined;
    let bucket: string | null = null;
    if (statuses?.has('UNSUBSCRIBED')) bucket = 'unsubscribed';
    else if (statuses?.has('COMPLAINED')) bucket = 'complained';
    else if (statuses?.has('BOUNCED')) bucket = 'bounced';
    else if (suppressedEmails.has(c.email)) bucket = 'suppressed';
    else if (c.contactId && conflictIds.has(c.contactId)) bucket = 'conflict';
    else if (c.contactId && (sendCounts.get(c.contactId) || 0) >= 3) bucket = 'cap';
    if (bucket) {
      groups.get(bucket)?.push({ email: c.email, contactId: c.contactId });
    } else {
      selected.push(c);
    }
  }

  // Mismatch check vs list_hints where fields exist (location, status, tags).
  let mismatch: RecipientResolution['mismatch'];
  const hintChecks: { name: string; match: (row: { location: string | null; status: string | null; tagsJson: string }) => boolean }[] = [];
  if (listHints.location) {
    const loc = listHints.location.toLowerCase();
    hintChecks.push({ name: 'location', match: (row) => (row.location || '').toLowerCase().includes(loc) });
  }
  if (listHints.status) {
    const st = listHints.status.toLowerCase();
    hintChecks.push({ name: 'status', match: (row) => (row.status || '').toLowerCase() === st });
  }
  if (listHints.relationship) {
    const rel = listHints.relationship.toLowerCase();
    hintChecks.push({
      name: 'relationship',
      match: (row) => {
        try {
          const tags = JSON.parse(row.tagsJson || '[]') as unknown[];
          return tags.some((t) => String(t).toLowerCase().includes(rel));
        } catch {
          return false;
        }
      },
    });
  }
  if (hintChecks.length === 0 || selected.length === 0) {
    mismatch = {
      applicable: hintChecks.length > 0,
      mismatchPct: null,
      warned: false,
      detail: hintChecks.length === 0
        ? 'No list_hint field maps to a contact field; showing the audience summary instead.'
        : 'No contacts selected, so the mismatch check does not apply.',
    };
  } else {
    let unmatched = 0;
    for (const c of selected) {
      const row = c.contactId ? rowById.get(c.contactId) : rowByEmail.get(c.email);
      if (!row) continue; // CSV-only contacts cannot be mismatch-checked; not counted
      const ok = hintChecks.every((h) => h.match({ location: row.location, status: row.status, tagsJson: row.tagsJson }));
      if (!ok) unmatched++;
    }
    const pct = Math.round((unmatched / Math.max(selected.length, 1)) * 100);
    mismatch = {
      applicable: true,
      mismatchPct: pct,
      warned: pct > 20,
      detail: pct > 20
        ? `${pct}% of the selected contacts do not match the audience described in Phase 2. Send anyway, or change the list?`
        : `${pct}% of the selected contacts do not match the audience described in Phase 2.`,
    };
  }
  return {
    sourceType,
    sourceId,
    sourceName: loaded.sourceName,
    totalCandidates: byEmail.size,
    selected,
    excluded: EXCLUSION_ORDER.map((k) => ({
      key: k,
      label: EXCLUSION_LABELS[k],
      count: groups.get(k)?.length || 0,
      contacts: groups.get(k) || [],
    })),
    phase2ExclusionsNote: listHints.exclusions || null,
    mismatch,
    csvContacts: loaded.csvContacts,
    csvRejected: loaded.csvRejected,
    csvDuplicates: loaded.csvDuplicates,
  };
}

/** AI-suggested filter from list_hints (spec §13): plain words + field mapping. */
export function suggestFilterFromHints(hints: ListHints): {
  suggestion: string;
  mapped: { hint: string; field: string }[];
  unmapped: string[];
} {
  const mapped: { hint: string; field: string }[] = [];
  const unmapped: string[] = [];
  const parts: string[] = [];
  if (hints.relationship) { mapped.push({ hint: 'relationship', field: 'tags' }); parts.push(`relationship: ${hints.relationship}`); }
  if (hints.location) { mapped.push({ hint: 'location', field: 'contact location' }); parts.push(`in ${hints.location}`); }
  if (hints.status) { mapped.push({ hint: 'status', field: 'contact status' }); parts.push(`status: ${hints.status}`); }
  if (hints.recency) unmapped.push(`recency (${hints.recency}) — no matching contact field; choose the list manually`);
  return {
    suggestion: parts.length > 0 ? `Contacts matching: ${parts.join(', ')}` : 'No list hints to suggest a filter from.',
    mapped,
    unmapped,
  };
}

/** Token coverage for the selected audience (spec §13: fallbacks will apply). */
export function coverageForSelected(
  selected: { firstName?: string; lastName?: string; company?: string; phone?: string }[],
  tokens: string[],
): Record<string, { missing: number; total: number }> {
  return tokenCoverage(
    selected.map((s) => ({ firstName: s.firstName, lastName: s.lastName, businessName: s.company, phone: s.phone })),
    tokens,
  );
}

export async function getRecipientSources(workspaceId: string): Promise<{
  segments: { id: string; name: string }[];
  smartLists: { id: string; name: string }[];
  lists: { id: string; name: string }[];
}> {
  const [segments, smartLists, lists] = await Promise.all([
    db.segment.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.smartList.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.emailList.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return { segments, smartLists, lists };
}
