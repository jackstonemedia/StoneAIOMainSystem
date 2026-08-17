/**
 * Audience Service — Email Marketing Module
 *
 * Manages: EmailLists, ContactListMemberships, dynamic Segments,
 * CSV import/export, and the SuppressionList.
 *
 * Tenant isolation: every query includes workspaceId from the authenticated
 * request context. workspaceId is NEVER accepted from the client payload.
 */

import { db } from '../../../infrastructure/database/client.js';
import {
  SubscriptionStatus,
  ConsentSource,
  type Prisma,
} from '@prisma/client';

// ── Type helpers ──────────────────────────────────────────────────────────────

export interface SegmentFilterRule {
  field: string;       // e.g. "contact.email", "contact.tagsJson", "contact.customFieldsJson.industry"
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_set' | 'is_not_set';
  value?: string | number | boolean | null;
}

export interface SegmentFilterDefinition {
  match: 'ALL' | 'ANY'; // AND / OR
  rules: SegmentFilterRule[];
}

// ── Email List CRUD ───────────────────────────────────────────────────────────

export async function createEmailList(workspaceId: string, name: string, doubleOptIn = false) {
  return db.emailList.create({
    data: { workspaceId, name, doubleOptIn },
  });
}

export async function getEmailLists(workspaceId: string) {
  const { listSmartLists, getSmartListContacts } = await import('../crm.service.js');

  const [staticLists, smartLists] = await Promise.all([
    db.emailList.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: { where: { status: 'SUBSCRIBED' } } } },
      },
    }),
    listSmartLists(workspaceId),
  ]);

  const mappedSmartLists = await Promise.all(
    smartLists.map(async (sl) => {
      let subscriberCount = 0;
      try {
        const res = await getSmartListContacts(sl.id, workspaceId, 1, 10000);
        subscriberCount = res?.contacts?.length || 0;
      } catch {}

      return {
        id: sl.id,
        name: `⚡ ${sl.name} (CRM Smart List)`,
        isSmartList: true,
        smartListId: sl.id,
        doubleOptIn: false,
        createdAt: sl.createdAt,
        updatedAt: sl.updatedAt,
        _count: { memberships: subscriberCount },
      };
    })
  );

  return [...mappedSmartLists, ...staticLists];
}

export async function getEmailList(workspaceId: string, listId: string) {
  return db.emailList.findFirst({ where: { id: listId, workspaceId } });
}

export async function updateEmailList(
  workspaceId: string,
  listId: string,
  data: { name?: string; doubleOptIn?: boolean }
) {
  return db.emailList.updateMany({
    where: { id: listId, workspaceId },
    data,
  });
}

export async function deleteEmailList(workspaceId: string, listId: string) {
  return db.emailList.deleteMany({ where: { id: listId, workspaceId } });
}

// ── Membership management ─────────────────────────────────────────────────────

/**
 * Adds a contact to a list, setting status based on doubleOptIn flag.
 * Records consent source and timestamp for GDPR audit trail.
 */
export async function addContactToList(
  workspaceId: string,
  contactId: string,
  listId: string,
  consentSource: ConsentSource
) {
  const list = await db.emailList.findFirst({ where: { id: listId, workspaceId } });
  if (!list) throw new Error('List not found');

  const status: SubscriptionStatus = list.doubleOptIn
    ? SubscriptionStatus.PENDING_CONFIRMATION
    : SubscriptionStatus.SUBSCRIBED;

  // Upsert: if membership exists, update status only if moving to a "better" state
  const existing = await db.contactListMembership.findFirst({
    where: { contactId, listId },
  });

  if (existing) {
    // Don't downgrade a SUBSCRIBED contact by re-adding them
    if (existing.status === SubscriptionStatus.SUBSCRIBED) return existing;
    return db.contactListMembership.update({
      where: { id: existing.id },
      data: { status, consentSource, consentTimestamp: new Date() },
    });
  }

  return db.contactListMembership.create({
    data: { workspaceId, contactId, listId, status, consentSource },
  });
}

export async function removeContactFromList(
  workspaceId: string,
  contactId: string,
  listId: string
) {
  return db.contactListMembership.updateMany({
    where: { contactId, listId, workspaceId },
    data: { status: SubscriptionStatus.UNSUBSCRIBED },
  });
}

export async function getListMemberships(
  workspaceId: string,
  listId: string,
  page = 1,
  pageSize = 50
) {
  const skip = (page - 1) * pageSize;
  const [memberships, total] = await Promise.all([
    db.contactListMembership.findMany({
      where: { listId, workspaceId },
      include: { contact: true },
      skip,
      take: pageSize,
      orderBy: { consentTimestamp: 'desc' },
    }),
    db.contactListMembership.count({ where: { listId, workspaceId } }),
  ]);
  return { memberships, total, page, pageSize };
}

/**
 * Confirms a PENDING_CONFIRMATION membership (double opt-in flow).
 */
export async function confirmMembership(membershipId: string, workspaceId: string) {
  return db.contactListMembership.updateMany({
    where: {
      id: membershipId,
      workspaceId,
      status: SubscriptionStatus.PENDING_CONFIRMATION,
    },
    data: { status: SubscriptionStatus.SUBSCRIBED },
  });
}

// ── CSV Import ────────────────────────────────────────────────────────────────

export interface CsvContactRow {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  [key: string]: string | undefined; // custom fields
}

/**
 * Imports CSV contacts into the workspace.
 * Deduplication: match on email address — update existing contacts, create new ones.
 * Returns counts of created, updated, and failed rows.
 */
export async function importContactsCsv(
  workspaceId: string,
  listId: string | null,
  rows: CsvContactRow[]
): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      failed++;
      errors.push(`Invalid email: ${row.email}`);
      continue;
    }

    try {
      // Check suppression list
      const suppressed = await db.suppressionEntry.findFirst({
        where: { workspaceId, email: row.email.toLowerCase() },
      });
      if (suppressed) {
        failed++;
        errors.push(`${row.email} is on suppression list`);
        continue;
      }

      const existing = await db.contact.findFirst({
        where: { workspaceId, email: row.email.toLowerCase() },
      });

      let contactId: string;
      if (existing) {
        // Update existing contact fields — only overwrite if the import has a value
        await db.contact.update({
          where: { id: existing.id },
          data: {
            ...(row.firstName ? { firstName: row.firstName } : {}),
            ...(row.lastName ? { lastName: row.lastName } : {}),
            ...(row.phone ? { phone: row.phone } : {}),
          },
        });
        contactId = existing.id;
        updated++;
      } else {
        const newContact = await db.contact.create({
          data: {
            workspaceId,
            email: row.email.toLowerCase(),
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            phone: row.phone,
          },
        });
        contactId = newContact.id;
        created++;
      }

      // Add to list if specified
      if (listId) {
        await addContactToList(workspaceId, contactId, listId, ConsentSource.CSV_IMPORT);
      }
    } catch (err: any) {
      failed++;
      errors.push(`${row.email}: ${err.message}`);
    }
  }

  return { created, updated, failed, errors };
}

/**
 * Returns contacts in a list as an array of CSV-ready rows.
 */
export async function exportListAsCsv(
  workspaceId: string,
  listId: string
): Promise<string> {
  const memberships = await db.contactListMembership.findMany({
    where: { listId, workspaceId },
    include: { contact: true },
  });

  const header = 'email,first_name,last_name,phone,status,consent_source,consent_timestamp\n';
  const rows = memberships.map(m => {
    const c = m.contact;
    return [
      c.email || '',
      c.firstName,
      c.lastName,
      c.phone || '',
      m.status,
      m.consentSource,
      m.consentTimestamp.toISOString(),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  return header + rows.join('\n');
}

// ── Segment evaluation ────────────────────────────────────────────────────────

/**
 * Evaluates a segment's filterDefinition against workspace contacts.
 * Returns an array of contact IDs that match.
 *
 * Segment filters are re-evaluated at send time, not stored as snapshots.
 * Tenant isolation: every query is scoped to workspaceId.
 */
export async function evaluateSegment(
  workspaceId: string,
  filterDefinition: SegmentFilterDefinition
): Promise<string[]> {
  // Build Prisma where clause from filter rules
  const conditions: Prisma.ContactWhereInput[] = filterDefinition.rules.map(rule => {
    return buildFilterCondition(rule);
  });

  const whereClause: Prisma.ContactWhereInput = {
    workspaceId,
    ...(filterDefinition.match === 'ALL'
      ? { AND: conditions }
      : { OR: conditions }),
  };

  const contacts = await db.contact.findMany({
    where: whereClause,
    select: { id: true },
  });

  return contacts.map(c => c.id);
}

function buildFilterCondition(rule: SegmentFilterRule): Prisma.ContactWhereInput {
  const { field, operator, value } = rule;

  // Map common field paths to Prisma field names
  const prismaFieldMap: Record<string, string> = {
    'contact.email': 'email',
    'contact.firstName': 'firstName',
    'contact.lastName': 'lastName',
    'contact.phone': 'phone',
    'contact.status': 'status',
    'contact.leadScore': 'leadScore',
    'contact.lastEmailOpenedAt': 'lastEmailOpenedAt',
    'contact.lastEmailClickedAt': 'lastEmailClickedAt',
  };

  const prismaField = prismaFieldMap[field] || field;

  switch (operator) {
    case 'equals':
      return { [prismaField]: { equals: value } };
    case 'not_equals':
      return { [prismaField]: { not: value } };
    case 'contains':
      return { [prismaField]: { contains: String(value), mode: 'insensitive' } };
    case 'not_contains':
      return { NOT: { [prismaField]: { contains: String(value), mode: 'insensitive' } } };
    case 'greater_than':
      return { [prismaField]: { gt: value } };
    case 'less_than':
      return { [prismaField]: { lt: value } };
    case 'is_set':
      return { [prismaField]: { not: null } };
    case 'is_not_set':
      return { [prismaField]: null };
    default:
      return {};
  }
}

export async function createSegment(
  workspaceId: string,
  name: string,
  filterDefinition: SegmentFilterDefinition
) {
  return db.segment.create({
    data: { workspaceId, name, filterDefinition: filterDefinition as any },
  });
}

export async function getSegments(workspaceId: string) {
  return db.segment.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateSegment(
  workspaceId: string,
  segmentId: string,
  data: { name?: string; filterDefinition?: SegmentFilterDefinition }
) {
  return db.segment.updateMany({
    where: { id: segmentId, workspaceId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.filterDefinition ? { filterDefinition: data.filterDefinition as any } : {}),
    },
  });
}

export async function deleteSegment(workspaceId: string, segmentId: string) {
  return db.segment.deleteMany({ where: { id: segmentId, workspaceId } });
}

// ── Suppression list ──────────────────────────────────────────────────────────

export async function addToSuppressionList(
  workspaceId: string,
  email: string,
  reason: string
) {
  return db.suppressionEntry.upsert({
    where: { workspaceId_email: { workspaceId, email: email.toLowerCase() } },
    create: { workspaceId, email: email.toLowerCase(), reason },
    update: { reason }, // Update reason if already suppressed
  });
}

export async function removeFromSuppressionList(workspaceId: string, email: string) {
  return db.suppressionEntry.deleteMany({
    where: { workspaceId, email: email.toLowerCase() },
  });
}

export async function isEmailSuppressed(workspaceId: string, email: string): Promise<boolean> {
  const entry = await db.suppressionEntry.findFirst({
    where: { workspaceId, email: email.toLowerCase() },
  });
  return entry !== null;
}

export async function getSuppressionList(workspaceId: string, page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;
  const [entries, total] = await Promise.all([
    db.suppressionEntry.findMany({
      where: { workspaceId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    db.suppressionEntry.count({ where: { workspaceId } }),
  ]);
  return { entries, total, page, pageSize };
}

// ── Unsubscribe handling ──────────────────────────────────────────────────────

/**
 * Instantly unsubscribes a contact from all lists in the workspace.
 * Updates all SUBSCRIBED memberships to UNSUBSCRIBED.
 * This handles both link-click unsubscribes and RFC 8058 one-click POST.
 */
export async function unsubscribeContact(workspaceId: string, contactId: string) {
  await db.contactListMembership.updateMany({
    where: {
      workspaceId,
      contactId,
      status: SubscriptionStatus.SUBSCRIBED,
    },
    data: { status: SubscriptionStatus.UNSUBSCRIBED },
  });
}

/**
 * Unsubscribes by email address when contactId is not immediately available
 * (e.g., RFC 8058 one-click from email client — no session context).
 */
export async function unsubscribeByEmail(workspaceId: string, email: string) {
  const contact = await db.contact.findFirst({
    where: { workspaceId, email: email.toLowerCase() },
    select: { id: true },
  });
  if (!contact) return;
  await unsubscribeContact(workspaceId, contact.id);
}
