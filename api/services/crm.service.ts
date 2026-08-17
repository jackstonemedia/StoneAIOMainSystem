/**
 * CRM Service — all business logic and DB access for the CRM domain.
 * Routes call these functions and handle HTTP concerns only.
 */
import { db } from '../../infrastructure/database/client.js';
import { emitTrigger } from './trigger-emitter.service.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  filtersJson?: string;
}

export function buildPrismaWhere(group: any): any {
  if (!group) return {};
  if (Array.isArray(group)) {
    if (group.length === 0) return {};
    return { AND: group.map(buildRule) };
  }
  if (group.matchMode) {
    if (!group.rules || group.rules.length === 0) return {};
    const arr = group.rules.filter((r: any) => r.value || r.operator === 'not_empty' || r.operator === 'is not empty').map(buildPrismaWhere);
    if (arr.length === 0) return {};
    return group.matchMode === 'any' ? { OR: arr } : { AND: arr };
  }
  return buildRule(group);
}

function buildRule(f: any): any {
  const { field, operator, value } = f;
  
  // Support both 'not_empty' and 'is not empty' operator naming
  if (operator === 'not_empty' || operator === 'is not empty') {
    if (field === 'tags' || field === 'tagsJson' || field === 'tag') {
      return { AND: [{ tagsJson: { not: null } }, { tagsJson: { not: '[]' } }, { tagsJson: { not: '' } }] };
    }
    if (field === 'name') return { OR: [{ firstName: { not: null } }, { lastName: { not: null } }] };
    return { [field]: { not: null } };
  }

  const val = String(value || '').trim();
  if (!val) return {}; // skip empty value rules
  
  if (field === 'tags' || field === 'tagsJson' || field === 'tag') {
    return {
      OR: [
        { tagsJson: { contains: val, mode: 'insensitive' } },
        { tagsJson: { contains: val.replace(/-/g, ' '), mode: 'insensitive' } },
        { tagsJson: { contains: val.replace(/\s+/g, '-'), mode: 'insensitive' } },
      ],
    };
  }

  if (field === 'name') {
    if (operator === 'contains') return { OR: [{ firstName: { contains: val } }, { lastName: { contains: val } }] };
    if (operator === 'equals') return { OR: [{ firstName: { equals: val } }, { lastName: { equals: val } }] };
    if (operator === 'starts_with' || operator === 'starts with') return { OR: [{ firstName: { startsWith: val } }, { lastName: { startsWith: val } }] };
  }

  let pOp = 'equals';
  if (operator === 'contains') pOp = 'contains';
  if (operator === 'starts_with' || operator === 'starts with') pOp = 'startsWith';

  if (field === 'businessName') return { company: { name: { [pOp]: val } } };

  return { [field]: { [pOp]: val } };
}

export interface ContactCreateInput {
  firstName: string;
  lastName?: string | null;
  middleName?: string | null;
  suffix?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  emailsJson?: string | null;
  phone?: string | null;
  phonesJson?: string | null;
  companyId?: string | null;
  title?: string | null;
  tagsJson?: string | null;
  color?: string | null;
  source?: string | null;
  status?: string | null;
  about?: string | null;
}

export interface DealCreateInput {
  title: string;
  amount?: number | null;
  priority?: 'low' | 'medium' | 'high' | null;
  probability?: number | null;
  closeDate?: string | null;
  pipelineStageId: string;
  companyId?: string | null;
  contactId?: string | null;
  description?: string | null;
}

export interface TaskCreateInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  status?: 'pending' | 'completed' | null;
  priority?: 'low' | 'medium' | 'high' | null;
  type?: string | null;
}

// ── Contact helpers ───────────────────────────────────────────────────────────

function formatContact(c: any) {
  return {
    ...c,
    name: `${c.firstName} ${c.lastName ?? ''}`.trim(),
    businessName: c.company?.name ?? '',
    tags: JSON.parse(c.tagsJson ?? '[]'),
    color: '#FFFFFF',
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(workspaceId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalContacts,
    newContactsThisMonth,
    allDeals,
    wonDealsLast30,
    activitiesToday,
    tasksOverdue,
    recentActivities,
    topContacts,
    pipelines,
  ] = await Promise.all([
    db.contact.count({ where: { workspaceId } }),
    db.contact.count({ where: { workspaceId, createdAt: { gte: firstOfMonth } } }),
    db.deal.findMany({ where: { workspaceId }, include: { pipelineStage: true } }),
    db.deal.findMany({ where: { workspaceId, pipelineStage: { name: 'Won' }, updatedAt: { gte: thirtyDaysAgo } } }),
    db.activity.count({ where: { workspaceId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    db.task.count({ where: { workspaceId, status: 'pending', dueDate: { lt: new Date() } } }),
    db.activity.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 8 }),
    db.contact.findMany({ where: { workspaceId }, orderBy: { leadScore: 'desc' }, take: 5, include: { company: true } }),
    db.pipeline.findMany({ where: { workspaceId }, include: { stages: { orderBy: { order: 'asc' } } } }),
  ]);

  const openDeals = allDeals.filter(
    (d) => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost',
  );
  const wonDealsValue = wonDealsLast30.reduce((s, d) => s + d.amount, 0);
  const openDealsValue = openDeals.reduce((s, d) => s + d.amount, 0);

  const formatCur = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n.toLocaleString()}`;
  };

  const pipeline = pipelines[0];
  const dealsByStage = pipeline
    ? pipeline.stages.map((stage) => {
        const stageDeals = allDeals.filter((d) => d.pipelineStageId === stage.id);
        return {
          stageName: stage.name,
          count: stageDeals.length,
          value: stageDeals.reduce((s, d) => s + d.amount, 0),
        };
      })
    : [];

  const totalWon = allDeals.filter((d) => d.pipelineStage?.name === 'Won').length;
  const totalLost = allDeals.filter((d) => d.pipelineStage?.name === 'Lost').length;
  const conversionRate = totalWon + totalLost > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0;

  return {
    stats: {
      totalContacts,
      newContactsThisMonth,
      openDeals: openDeals.length,
      openDealsValue: formatCur(openDealsValue),
      wonDeals: wonDealsLast30.length,
      wonDealsValue: formatCur(wonDealsValue),
      activitiesToday,
      tasksOverdue,
    },
    recentActivities,
    topContacts: topContacts.map(formatContact),
    dealsByStage,
    conversionRate: Math.round(conversionRate * 10) / 10,
  };
}

export function matchesRule(contact: any, rule: any): boolean {
  if (!rule || typeof rule !== 'object') return true;
  const { field, operator, value } = rule;
  const val = String(value || '').toLowerCase().trim();

  if (operator === 'not_empty' || operator === 'is not empty') {
    if (field === 'tags' || field === 'tagsJson' || field === 'tag') {
      const tags = Array.isArray(contact.tags) ? contact.tags : JSON.parse(contact.tagsJson || '[]');
      return Array.isArray(tags) && tags.length > 0;
    }
    if (field === 'name') return Boolean((contact.firstName || contact.lastName || '').trim());
    return Boolean(contact[field]);
  }

  if (field === 'tags' || field === 'tagsJson' || field === 'tag') {
    let tags: string[] = [];
    try {
      tags = Array.isArray(contact.tags)
        ? contact.tags
        : JSON.parse(contact.tagsJson || '[]');
    } catch {
      tags = [];
    }

    if (operator === 'is_empty' || operator === 'is empty') {
      return !Array.isArray(tags) || tags.length === 0;
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return operator === 'not_contains' || operator === 'does not contain' || operator === 'not_equals';
    }

    if (!val && operator !== 'is_empty' && operator !== 'is empty') return true;

    const matchesAnyTag = tags.some((t: string) => {
      const tagStr = String(t || '').toLowerCase().trim();
      const cleanVal = val.toLowerCase().trim();
      const tagWithSpaces = tagStr.replace(/-/g, ' ');
      const valWithSpaces = cleanVal.replace(/-/g, ' ');

      if (operator === 'equals' || operator === 'is') return tagStr === cleanVal || tagWithSpaces === valWithSpaces;
      if (operator === 'starts_with' || operator === 'starts with') return tagStr.startsWith(cleanVal);
      if (operator === 'in') {
        const set = Array.isArray(value) ? value.map((v: any) => String(v).toLowerCase().trim()) : val.split(',').map(v => v.trim());
        return set.includes(tagStr);
      }
      // 'contains' / default:
      return (
        tagStr.includes(cleanVal) ||
        cleanVal.includes(tagStr) ||
        tagWithSpaces.includes(valWithSpaces)
      );
    });

    if (operator === 'not_contains' || operator === 'does not contain' || operator === 'not_equals' || operator === 'is not') {
      return !matchesAnyTag;
    }

    return matchesAnyTag;
  }

  if (!val) return true;

  if (field === 'name') {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    if (operator === 'equals') return fullName === val;
    if (operator === 'starts_with' || operator === 'starts with') return fullName.startsWith(val);
    return fullName.includes(val);
  }

  if (field === 'businessName') {
    const bName = String(contact.businessName || contact.company?.name || '').toLowerCase();
    if (operator === 'equals') return bName === val;
    if (operator === 'starts_with' || operator === 'starts with') return bName.startsWith(val);
    return bName.includes(val);
  }

  const fieldValue = String(contact[field] || '').toLowerCase();
  if (operator === 'equals') return fieldValue === val;
  if (operator === 'starts_with' || operator === 'starts with') return fieldValue.startsWith(val);
  return fieldValue.includes(val);
}

export function extractRulesAndMatchMode(input: any): { rules: any[]; matchMode: string } {
  if (!input) return { rules: [], matchMode: 'all' };

  let current = input;
  if (typeof current === 'string') {
    try { current = JSON.parse(current); } catch { return { rules: [], matchMode: 'all' }; }
  }

  let matchMode = 'all';

  for (let i = 0; i < 3; i++) {
    if (Array.isArray(current)) {
      return { rules: current, matchMode };
    }
    if (current && typeof current === 'object') {
      if (current.matchMode) matchMode = current.matchMode;
      if (Array.isArray(current.rules)) {
        return { rules: current.rules, matchMode };
      }
      if (current.rules && typeof current.rules === 'object') {
        current = current.rules;
      } else if (current.filters && (Array.isArray(current.filters) || typeof current.filters === 'object')) {
        current = current.filters;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return { rules: Array.isArray(current) ? current : [], matchMode };
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function listContacts(workspaceId: string, filters: ContactFilters) {
  const { search, status, page = 1, limit = 50 } = filters;
  const where: any = { workspaceId };

  if (search) {
    where.OR = [
      { firstName: { contains: String(search) } },
      { lastName: { contains: String(search) } },
      { email: { contains: String(search) } },
    ];
  }
  if (status) where.status = status;

  const parsedPage = Math.max(1, parseInt(String(page)) || 1);
  const parsedLimit = Math.max(1, parseInt(String(limit)) || 50);
  const skip = (parsedPage - 1) * parsedLimit;
  
  if (filters.filtersJson) {
    try {
      const { rules, matchMode } = extractRulesAndMatchMode(filters.filtersJson);

      const validRules = rules.filter((r: any) =>
        r && (
          (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') ||
          r.operator === 'not_empty' ||
          r.operator === 'is not empty'
        )
      );

      if (validRules.length > 0) {
        const allContacts = await db.contact.findMany({
          where: { workspaceId },
          select: {
            id: true,
            workspaceId: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            leadScore: true,
            source: true,
            color: true,
            tagsJson: true,
            createdAt: true,
            updatedAt: true,
            company: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const formatted = allContacts.map(formatContact);

        const filtered = formatted.filter(c => {
          if (search) {
            const q = String(search).toLowerCase();
            const matchesSearch =
              c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
            if (!matchesSearch) return false;
          }
          if (status && c.status !== status) return false;

          if (matchMode === 'any') {
            return validRules.some((r: any) => matchesRule(c, r));
          }
          return validRules.every((r: any) => matchesRule(c, r));
        });

        const total = filtered.length;
        const paged = filtered.slice(skip, skip + parsedLimit);

        return {
          contacts: paged,
          total,
          page: parsedPage,
          limit: parsedLimit,
        };
      }
    } catch (e) {
      console.error('[listContacts] Filter processing error:', e);
    }
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        leadScore: true,
        source: true,
        color: true,
        tagsJson: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsedLimit,
    }),
    db.contact.count({ where }),
  ]);

  return {
    contacts: contacts.map(formatContact),
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getContact(id: string, workspaceId: string) {
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      company: true,
      events: { orderBy: { createdAt: 'desc' } },
      deals: { include: { pipelineStage: true } },
      tasks: true,
      appointments: true,
    },
  });
  if (!contact || contact.workspaceId !== workspaceId) return null;
  return formatContact(contact);
}

export async function createContact(workspaceId: string, data: any) {
  let finalCompanyId = data.companyId ?? null;

  if (data.businessName) {
    const bName = String(data.businessName).trim();
    if (bName) {
      let comp = await db.company.findFirst({
        where: { name: bName, workspaceId }
      });
      if (!comp) {
        comp = await db.company.create({
          data: { name: bName, workspaceId }
        });
      }
      finalCompanyId = comp.id;
    }
  }

  // Normalize tags
  let tagsArray: string[] = [];
  if (Array.isArray(data.tags)) {
    tagsArray = data.tags.map((t: any) => String(t).trim()).filter(Boolean);
  } else if (typeof data.tagsJson === 'string' && data.tagsJson.trim()) {
    try {
      const parsed = JSON.parse(data.tagsJson);
      if (Array.isArray(parsed)) tagsArray = parsed.map((t: any) => String(t).trim()).filter(Boolean);
      else tagsArray = data.tagsJson.split(',').map((t: any) => t.trim()).filter(Boolean);
    } catch {
      tagsArray = data.tagsJson.split(',').map((t: any) => t.trim()).filter(Boolean);
    }
  } else if (Array.isArray(data.tagsJson)) {
    tagsArray = data.tagsJson.map((t: any) => String(t).trim()).filter(Boolean);
  }
  const finalTagsJson = JSON.stringify(Array.from(new Set(tagsArray)));

  const c = await db.contact.create({
    data: {
      workspaceId,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      middleName: data.middleName ?? null,
      suffix: data.suffix ?? null,
      avatarUrl: data.avatarUrl ?? null,
      email: data.email ?? null,
      emailsJson: data.emailsJson ?? null,
      phone: data.phone ?? null,
      phonesJson: data.phonesJson ?? null,
      companyId: finalCompanyId,
      title: data.title ?? null,
      location: data.location ?? null,
      tagsJson: finalTagsJson,
      color: data.color ?? '#7dd3fc',
      source: data.source ?? null,
      status: data.status ?? 'Lead',
      about: data.about ?? data.notes ?? null,
    },
    include: { company: true }
  });

  if (c.tagsJson) {
    syncContactTagsToWorkspace(workspaceId, c.tagsJson).catch(() => {});
  }

  emitTrigger(workspaceId, 'contact.created', {
    contactId: c.id,
    name: `${c.firstName} ${c.lastName ?? ''}`.trim(),
    email: c.email,
    phone: c.phone,
    source: c.source,
    tags: JSON.parse(c.tagsJson ?? '[]'),
  }).catch(err => console.error('[trigger]', err));

  try {
    const name = `${c.firstName} ${c.lastName ?? ''}`.trim() || 'New contact';
    const summaryParts: string[] = [];
    if (c.email) summaryParts.push(`Email: ${c.email}`);
    if (c.phone) summaryParts.push(`Phone: ${c.phone}`);
    if (c.company?.name) summaryParts.push(`Company: ${c.company.name}`);

    await db.activity.create({
      data: {
        workspaceId,
        contactId: c.id,
        type: 'contact.created',
        title: name,
        notes: summaryParts.length ? summaryParts.join(' • ') : null,
      },
    });
  } catch (e) {
    console.error('[crm.activity] Failed to log contact.created', e);
  }

  return formatContact(c);
}

export async function updateContact(id: string, workspaceId: string, raw: any) {
  const { name, tags, businessName, company, ...data } = raw;

  if (tags !== undefined) {
    data.tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : String(tags || '[]');
  } else if (data.tagsJson !== undefined) {
    if (Array.isArray(data.tagsJson)) {
      data.tagsJson = JSON.stringify(data.tagsJson);
    }
  }

  if (businessName !== undefined) {
    const bName = String(businessName).trim();
    if (!bName) {
      data.companyId = null;
    } else {
      let comp = await db.company.findFirst({
        where: { name: bName, workspaceId }
      });
      if (!comp) {
        comp = await db.company.create({
          data: { name: bName, workspaceId }
        });
      }
      data.companyId = comp.id;
    }
  }

  const c = await db.contact.update({ 
    where: { id, workspaceId }, 
    data,
    include: { company: true } 
  });

  if (c.tagsJson) {
    syncContactTagsToWorkspace(workspaceId, c.tagsJson).catch(() => {});
  }

  const formatted = formatContact(c);
  emitTrigger(workspaceId, 'contact.updated', {
    contactId: formatted.id,
    updatedFields: Object.keys(data),
    contact: formatted,
  }).catch(err => console.error('[trigger]', err));

  try {
    const name = `${formatted.firstName} ${formatted.lastName ?? ''}`.trim() || 'Contact updated';
    const changed = Object.keys(data || {});
    await db.activity.create({
      data: {
        workspaceId,
        contactId: formatted.id,
        type: 'contact.updated',
        title: name,
        notes: changed.length ? `Updated: ${changed.join(', ')}` : null,
      },
    });
  } catch (e) {
    console.error('[crm.activity] Failed to log contact.updated', e);
  }

  return formatted;
}

export async function deleteContact(id: string, workspaceId: string) {
  const deletedContact = await db.contact.delete({ where: { id, workspaceId } });

  emitTrigger(workspaceId, 'contact.deleted', {
    contactId: deletedContact.id,
    name: `${deletedContact.firstName} ${deletedContact.lastName ?? ''}`.trim(),
  }).catch(err => console.error('[trigger]', err));
}

export async function bulkContacts(workspaceId: string, action: string, contactIds: string[], payload: any) {
  if (action === 'delete') {
    const cs = await db.contact.findMany({ where: { id: { in: contactIds }, workspaceId } });
    await db.contact.deleteMany({ where: { id: { in: contactIds }, workspaceId } });
    for (const c of cs) {
      emitTrigger(workspaceId, 'contact.deleted', {
        contactId: c.id,
        name: `${c.firstName} ${(c as any).lastName ?? ''}`.trim(),
      }).catch(err => console.error('[trigger]', err));
    }
    return { success: true, affected: contactIds.length };
  }

  if (action === 'tag') {
    const cs = await db.contact.findMany({ where: { id: { in: contactIds }, workspaceId } });
    for (const c of cs) {
      const tags: string[] = JSON.parse((c as any).tagsJson ?? '[]');
      if (!tags.includes(payload.tag)) {
        tags.push(payload.tag);
        await db.contact.update({ where: { id: c.id }, data: { tagsJson: JSON.stringify(tags) } });
        
        emitTrigger(workspaceId, 'contact.tag_added', {
          contactId: c.id,
          tag: payload.tag,
          allTags: tags,
        }).catch(err => console.error('[trigger]', err));
      }
    }
    return { success: true, affected: cs.length };
  }

  if (action === 'assign') {
    await db.contact.updateMany({
      where: { id: { in: contactIds }, workspaceId },
      data: { assignedUserId: payload.userId },
    });
    return { success: true, affected: contactIds.length };
  }

  if (action === 'export') {
    const cs = await db.contact.findMany({ where: { id: { in: contactIds }, workspaceId } });
    const csv = [
      'First Name,Last Name,Email,Phone,Status,Lead Score',
      ...cs.map(
        (c) =>
          `${c.firstName},${c.lastName},${c.email ?? ''},${c.phone ?? ''},${(c as any).status ?? ''},${(c as any).leadScore ?? 0}`,
      ),
    ].join('\n');
    return { csv };
  }

  return { success: true, affected: contactIds.length };
}

export async function importContacts(workspaceId: string, rows: any[], globalTags: string[] = []) {
  const created: string[] = [];
  const baseTags = (Array.isArray(globalTags) ? globalTags : []).map(t => String(t).trim()).filter(Boolean);

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    let firstName = row.firstName ?? row.first_name ?? '';
    let lastName = row.lastName ?? row.last_name ?? '';

    // Handle full name string
    if (!firstName && row.name) {
      const parts = String(row.name).trim().split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ');
    } else if (!firstName && row.contactName) {
      const parts = String(row.contactName).trim().split(/\s+/);
      firstName = parts[0] || 'Unknown';
      lastName = parts.slice(1).join(' ');
    }

    // If no name is provided but we have business name or email/phone, use business or "Unknown"
    const businessName = (
      row.businessName ?? row.business_name ?? row.company ??
      row.company_name ?? row.business ?? row.organization ?? ''
    ).trim();

    if (!firstName && !row.email && !row.phone && !businessName) {
      continue;
    }
    if (!firstName) {
      firstName = businessName || 'Unknown';
    }

    // Handle company auto-link/creation
    let companyId = row.companyId ?? null;
    if (!companyId && businessName) {
      try {
        let comp = await db.company.findFirst({
          where: { name: businessName, workspaceId }
        });
        if (!comp) {
          comp = await db.company.create({
            data: {
              name: businessName,
              workspaceId,
              website: row.website ? String(row.website).trim() : null,
              location: [row.city, row.state].filter(Boolean).join(', ') || null,
            }
          });
        }
        companyId = comp.id;
      } catch (err) {
        console.error('[importContacts] Company link failed:', err);
      }
    }

    // Merge row tags + global import tags
    let rowTags: string[] = [];
    if (Array.isArray(row.tags)) {
      rowTags = row.tags.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof row.tags === 'string' && row.tags.trim()) {
      try {
        const parsed = JSON.parse(row.tags);
        if (Array.isArray(parsed)) rowTags = parsed.map((t: any) => String(t).trim()).filter(Boolean);
        else rowTags = row.tags.split(/[,;|]/).map((t: any) => t.trim()).filter(Boolean);
      } catch {
        rowTags = row.tags.split(/[,;|]/).map((t: any) => t.trim()).filter(Boolean);
      }
    } else if (typeof row.tagsJson === 'string' && row.tagsJson.trim()) {
      try {
        const parsed = JSON.parse(row.tagsJson);
        if (Array.isArray(parsed)) rowTags = parsed.map((t: any) => String(t).trim()).filter(Boolean);
        else rowTags = row.tagsJson.split(/[,;|]/).map((t: any) => t.trim()).filter(Boolean);
      } catch {
        rowTags = row.tagsJson.split(/[,;|]/).map((t: any) => t.trim()).filter(Boolean);
      }
    }

    // Category from Lead Studio or external scrapers
    if (row.category && typeof row.category === 'string') {
      rowTags.push(row.category.trim());
    }

    const combinedTags = Array.from(new Set([...baseTags, ...rowTags])).filter(Boolean);

    const location = row.location ?? ([row.address, row.city, row.state, row.postalCode || row.zip].filter(Boolean).join(', ') || null);

    const c = await db.contact
      .create({
        data: {
          workspaceId,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: row.email ? String(row.email).trim() : null,
          phone: row.phone ? String(row.phone).trim() : null,
          companyId,
          title: row.title ? String(row.title).trim() : (row.category ? String(row.category).trim() : null),
          location,
          tagsJson: JSON.stringify(combinedTags),
          source: row.source ? String(row.source).trim() : 'import',
          status: row.status ? String(row.status).trim() : 'Lead',
          about: row.about ?? row.notes ?? (row.website ? `Website: ${row.website}` : null),
          color: row.color ?? '#7dd3fc',
        },
      })
      .catch((err) => {
        console.error('[importContacts] Error creating contact row:', err);
        return null;
      });

    if (c) {
      created.push(c.id);
      if (combinedTags.length > 0) {
        syncContactTagsToWorkspace(workspaceId, JSON.stringify(combinedTags)).catch(() => {});
      }
    }
  }

  // Log activity for import
  if (created.length > 0) {
    try {
      await db.activity.create({
        data: {
          workspaceId,
          type: 'contacts.imported',
          title: `Imported ${created.length} Contacts`,
          notes: JSON.stringify({ count: created.length, tags: baseTags }),
        }
      });
    } catch { /* ignore */ }
  }

  return { success: true, imported: created.length };
}

// ── Companies ─────────────────────────────────────────────────────────────────

export async function listCompanies(workspaceId: string, search?: string, industry?: string) {
  const where: any = { workspaceId };
  if (search) where.name = { contains: String(search) };
  if (industry) where.industry = String(industry);
  return db.company.findMany({
    where,
    include: { _count: { select: { contacts: true, deals: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getCompany(id: string, workspaceId: string) {
  return db.company.findUnique({
    where: { id, workspaceId },
    include: { contacts: true, deals: true },
  });
}

export async function createCompany(workspaceId: string, data: any) {
  const { domain, ...rest } = data;
  return db.company.create({ data: { ...rest, website: domain ?? rest.website, workspaceId } });
}

export async function updateCompany(id: string, workspaceId: string, data: any) {
  const { _count, contacts, deals, ...rest } = data;
  return db.company.update({ where: { id, workspaceId }, data: rest });
}

export async function deleteCompany(id: string, workspaceId: string) {
  await db.company.delete({ where: { id, workspaceId } });
}

// ── Deals ─────────────────────────────────────────────────────────────────────

export async function listDeals(workspaceId: string, filters: Record<string, string>) {
  const where: any = { workspaceId };
  if (filters.pipelineId) where.pipelineStage = { pipelineId: filters.pipelineId };
  if (filters.stageId) where.pipelineStageId = filters.stageId;
  if (filters.contactId) where.contactId = filters.contactId;
  return db.deal.findMany({
    where,
    include: { company: true, contact: true, pipelineStage: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createDeal(workspaceId: string, userId: string, data: DealCreateInput) {
  const deal = await db.deal.create({
    data: {
      workspaceId,
      title: data.title,
      amount: parseFloat(String(data.amount)) || 0,
      priority: data.priority ?? 'medium',
      probability: parseInt(String(data.probability)) || 0,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      pipelineStageId: data.pipelineStageId,
      companyId: data.companyId ?? null,
      contactId: data.contactId ?? null,
      description: data.description ?? null,
      ownerId: userId,
    },
    include: { company: true, pipelineStage: true },
  });

  emitTrigger(workspaceId, 'deal.created', {
    dealId: deal.id,
    title: deal.title,
    value: deal.amount,
    contactId: deal.contactId,
    stageId: deal.pipelineStageId,
    pipelineId: deal.pipelineStage?.pipelineId,
  }).catch(err => console.error('[trigger]', err));

  return deal;
}

export async function updateDeal(id: string, workspaceId: string, raw: any) {
  const { company, contact, pipelineStage, activities, ...data } = raw;
  if (data.amount !== undefined) data.amount = parseFloat(data.amount);
  if (data.probability !== undefined) data.probability = parseInt(data.probability);
  if (data.closeDate !== undefined) data.closeDate = new Date(data.closeDate);

  const previousDeal = await db.deal.findUnique({ where: { id, workspaceId } });

  const deal = await db.deal.update({
    where: { id, workspaceId },
    data,
    include: { company: true, pipelineStage: true },
  });

  if (previousDeal && previousDeal.pipelineStageId !== deal.pipelineStageId) {
    emitTrigger(workspaceId, 'deal.stage_changed', {
      dealId: deal.id,
      title: deal.title,
      previousStageId: previousDeal.pipelineStageId,
      newStageId: deal.pipelineStageId,
      value: deal.amount,
      contactId: deal.contactId,
    }).catch(err => console.error('[trigger]', err));

    if (deal.pipelineStage?.name === 'Won') {
      emitTrigger(workspaceId, 'deal.won', {
        dealId: deal.id,
        title: deal.title,
        value: deal.amount,
        contactId: deal.contactId,
      }).catch(err => console.error('[trigger]', err));
    } else if (deal.pipelineStage?.name === 'Lost') {
      emitTrigger(workspaceId, 'deal.lost', {
        dealId: deal.id,
        title: deal.title,
        reason: (deal as any).lostReason,
        contactId: deal.contactId,
      }).catch(err => console.error('[trigger]', err));
    }
  }

  return deal;
}

export async function deleteDeal(id: string, workspaceId: string) {
  await db.deal.delete({ where: { id, workspaceId } });
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function listPipelines(workspaceId: string) {
  return db.pipeline.findMany({
    where: { workspaceId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

export async function createPipeline(workspaceId: string, name: string, stages: any[]) {
  return db.pipeline.create({
    data: {
      workspaceId,
      name,
      isDefault: false,
      stages: {
        create: stages.map((s: any, i: number) => ({
          name: s.name ?? `Stage ${i + 1}`,
          color: s.color ?? '#64748b',
          order: s.order ?? i,
          probability: s.probability ?? 30,
        })),
      },
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

export async function deletePipeline(id: string, workspaceId: string) {
  const p = await db.pipeline.findUnique({ where: { id, workspaceId } });
  if (!p || p.isDefault) throw new Error('Cannot delete default pipeline');
  await db.pipelineStage.deleteMany({ where: { pipelineId: id } });
  await db.pipeline.delete({ where: { id } });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function listTasks(workspaceId: string, filters: Record<string, string>) {
  const where: any = { workspaceId };
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  return db.task.findMany({ where, include: { contact: true }, orderBy: { dueDate: 'asc' } });
}

export async function createTask(workspaceId: string, data: TaskCreateInput) {
  return db.task.create({
    data: {
      workspaceId,
      title: data.title,
      type: data.type ?? 'follow_up',
      priority: data.priority ?? 'medium',
      status: data.status ?? 'pending',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      contactId: data.contactId ?? null,
      companyId: data.companyId ?? null,
      dealId: data.dealId ?? null,
      description: data.description ?? null,
      assigneeId: data.assigneeId ?? null,
    },
    include: { contact: true },
  });
}

export async function updateTask(id: string, workspaceId: string, raw: any) {
  const { contact, ...data } = raw;
  if (data.dueDate) data.dueDate = new Date(data.dueDate);
  return db.task.update({ where: { id, workspaceId }, data, include: { contact: true } });
}

export async function deleteTask(id: string, workspaceId: string) {
  await db.task.delete({ where: { id, workspaceId } });
}

// ── Smart Lists ───────────────────────────────────────────────────────────────

export async function listSmartLists(workspaceId: string) {
  let lists = await db.smartList.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  });

  if (lists.length === 0) {
    try {
      await Promise.all([
        db.smartList.create({
          data: {
            workspaceId,
            name: 'Hot Leads',
            description: 'Contacts with hot lead status',
            filtersJson: JSON.stringify([{ field: 'status', operator: 'equals', value: 'hot' }]),
            matchMode: 'all',
            author: 'System',
          },
        }),
        db.smartList.create({
          data: {
            workspaceId,
            name: 'Enterprise Contacts',
            description: 'Contacts tagged with enterprise',
            filtersJson: JSON.stringify([{ field: 'tags', operator: 'contains', value: 'enterprise' }]),
            matchMode: 'all',
            author: 'System',
          },
        }),
        db.smartList.create({
          data: {
            workspaceId,
            name: 'All Active Contacts',
            description: 'All workspace contacts',
            filtersJson: JSON.stringify([]),
            matchMode: 'all',
            author: 'System',
          },
        }),
      ]);

      lists = await db.smartList.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true } } },
      });
    } catch (e) {
      console.warn('[listSmartLists] Failed to auto-provision default smart lists:', e);
    }
  }

  // Calculate live dynamic contact count for each smart list
  const allContacts = await db.contact.findMany({
    where: { workspaceId },
    select: {
      id: true,
      workspaceId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      leadScore: true,
      source: true,
      color: true,
      tagsJson: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, name: true } },
    }
  });
  const formattedContacts = allContacts.map(formatContact);

  return lists.map(list => {
    let { rules, matchMode } = extractRulesAndMatchMode(list.filtersJson);
    const validRules = rules.filter((r: any) => r && (
      (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') ||
      r.operator === 'not_empty' ||
      r.operator === 'is not empty'
    ));

    let matchingCount = 0;
    if (validRules.length === 0) {
      if (list.name && list.name.toLowerCase() !== 'all active contacts' && list.name.toLowerCase() !== 'all contacts' && list.name.toLowerCase() !== 'all') {
        const autoRule = { field: 'tags', operator: 'contains', value: list.name.trim() };
        matchingCount = formattedContacts.filter(c => matchesRule(c, autoRule)).length;
      } else {
        matchingCount = formattedContacts.length;
      }
    } else {
      matchingCount = formattedContacts.filter(c => {
        if (matchMode === 'any') return validRules.some((r: any) => matchesRule(c, r));
        return validRules.every((r: any) => matchesRule(c, r));
      }).length;
    }

    return {
      ...list,
      contactCount: matchingCount,
      _count: {
        items: matchingCount,
      }
    };
  });
}

export async function createSmartList(workspaceId: string, data: any) {
  // Normalize the filters — can come in as { matchMode, rules } object or plain array
  const filtersPayload = data.filters ?? [];
  const matchMode = data.matchMode || (filtersPayload?.matchMode) || 'all';
  let rules: any[] = Array.isArray(filtersPayload) ? filtersPayload : (filtersPayload?.rules ?? []);

  // Filter out empty invalid rules
  rules = rules.filter((r: any) => r && (
    (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') ||
    r.operator === 'not_empty' ||
    r.operator === 'is not empty'
  ));

  // If no explicit valid rules were provided OR if explicit tag was passed, check for existing tag match
  if (rules.length === 0 && data.name) {
    const trimmedName = String(data.name).trim();
    const explicitTag = data.tag ? String(data.tag).trim() : null;

    // Check workspace tags in db.tag
    const existingTags = await db.tag.findMany({ where: { workspaceId } });
    const matchedTag = existingTags.find(t => 
      t.name.toLowerCase().trim() === (explicitTag || trimmedName).toLowerCase() ||
      t.name.toLowerCase().replace(/[-_]/g, ' ') === (explicitTag || trimmedName).toLowerCase().replace(/[-_]/g, ' ')
    );

    let targetTagName = explicitTag || matchedTag?.name;

    // If not found in db.tag, check if any contact in workspace has this tag in tagsJson
    if (!targetTagName) {
      const contacts = await db.contact.findMany({
        where: { workspaceId },
        select: { tagsJson: true },
        take: 1000,
      });
      for (const c of contacts) {
        try {
          const tags: string[] = JSON.parse(c.tagsJson || '[]');
          const found = tags.find(t => 
            t.toLowerCase().trim() === trimmedName.toLowerCase() ||
            t.toLowerCase().replace(/[-_]/g, ' ') === trimmedName.toLowerCase().replace(/[-_]/g, ' ')
          );
          if (found) {
            targetTagName = found;
            break;
          }
        } catch {}
      }
    }

    // Auto-create a tag filter rule if tag matches or name was provided
    if (targetTagName || explicitTag) {
      rules = [
        {
          id: `rule-tag-${Date.now()}`,
          field: 'tags',
          operator: 'contains',
          value: targetTagName || explicitTag || trimmedName,
        }
      ];
    }
  }
  
  return db.smartList.create({
    data: {
      workspaceId,
      name: data.name,
      description: data.description || '',
      filtersJson: JSON.stringify(rules),
      matchMode,
      viewMode: data.viewMode || 'table',
      columnsJson: JSON.stringify(data.columns || []),
      author: data.author || 'Jack Stone',
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function updateSmartList(id: string, workspaceId: string, data: any) {
  const filtersPayload = data.filters ?? undefined;
  const matchMode = data.matchMode || (filtersPayload?.matchMode) || undefined;
  const rules = filtersPayload ? (Array.isArray(filtersPayload) ? filtersPayload : (filtersPayload?.rules ?? [])) : undefined;

  return db.smartList.update({
    where: { id, workspaceId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(rules !== undefined && { filtersJson: JSON.stringify(rules) }),
      ...(matchMode !== undefined && { matchMode }),
      ...(data.viewMode !== undefined && { viewMode: data.viewMode }),
      ...(data.columns !== undefined && { columnsJson: JSON.stringify(data.columns) }),
    },
    include: { _count: { select: { items: true } } },
  });
}

export async function deleteSmartList(id: string, workspaceId: string) {
  return db.smartList.delete({ where: { id, workspaceId } });
}

export async function getSmartListContacts(id: string, workspaceId: string, page = 1, limit = 50) {
  const list = await db.smartList.findUnique({ where: { id, workspaceId } });
  if (!list) return null;

  let { rules, matchMode } = extractRulesAndMatchMode(list.filtersJson);

  const hasValidRules = rules.some((r: any) => r && (
    (r.value !== undefined && r.value !== null && String(r.value).trim() !== '') ||
    r.operator === 'not_empty' ||
    r.operator === 'is not empty'
  ));

  // If the smart list has no valid rules stored, check if the list name corresponds to an existing tag in the workspace
  if (!hasValidRules && list.name && list.name.toLowerCase() !== 'all contacts' && list.name.toLowerCase() !== 'all') {
    rules = [
      {
        id: `rule-tag-auto`,
        field: 'tags',
        operator: 'contains',
        value: list.name.trim()
      }
    ];
  }

  const group = { matchMode: list.matchMode || matchMode || 'all', rules };
  const filtersJson = JSON.stringify(group);
  return listContacts(workspaceId, { filtersJson, page, limit });
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function renameTag(id: string, workspaceId: string, newName: string) {
  const tag = await db.tag.findUnique({ where: { id, workspaceId } });
  if (!tag) throw new Error('Tag not found');
  const oldName = tag.name;

  await db.tag.update({ where: { id }, data: { name: newName } });

  const contacts = await db.contact.findMany({ where: { workspaceId } });
  for (const c of contacts) {
    const tags = JSON.parse(c.tagsJson ?? '[]');
    if (tags.includes(oldName)) {
      const newTags = tags.map((t: string) => t === oldName ? newName : t);
      await db.contact.update({ where: { id: c.id }, data: { tagsJson: JSON.stringify(newTags) } });
    }
  }
  return { success: true };
}

export async function deleteTag(id: string, workspaceId: string) {
  const tag = await db.tag.findUnique({ where: { id, workspaceId } });
  if (!tag) return { success: false };

  await db.tag.delete({ where: { id } });

  const contacts = await db.contact.findMany({ where: { workspaceId } });
  for (const c of contacts) {
    const tags = JSON.parse(c.tagsJson ?? '[]');
    if (tags.includes(tag.name)) {
      const newTags = tags.filter((t: string) => t !== tag.name);
      await db.contact.update({ where: { id: c.id }, data: { tagsJson: JSON.stringify(newTags) } });
    }
  }
  return { success: true };
}

export async function mergeTags(sourceTagId: string, targetTagId: string, workspaceId: string) {
  const sourceTag = await db.tag.findUnique({ where: { id: sourceTagId, workspaceId } });
  const targetTag = await db.tag.findUnique({ where: { id: targetTagId, workspaceId } });
  if (!sourceTag || !targetTag) throw new Error('Tag not found');

  const contacts = await db.contact.findMany({ where: { workspaceId } });
  for (const c of contacts) {
    const tags = JSON.parse(c.tagsJson ?? '[]');
    if (tags.includes(sourceTag.name)) {
      const newTags = tags.filter((t: string) => t !== sourceTag.name);
      if (!newTags.includes(targetTag.name)) newTags.push(targetTag.name);
      await db.contact.update({ where: { id: c.id }, data: { tagsJson: JSON.stringify(newTags) } });
    }
  }

  await db.tag.delete({ where: { id: sourceTagId } });
  return { success: true };
}

export async function syncContactTagsToWorkspace(workspaceId: string, tagsInput: any) {
  if (!tagsInput) return;
  let tags: string[] = [];
  try {
    if (Array.isArray(tagsInput)) {
      tags = tagsInput;
    } else if (typeof tagsInput === 'string') {
      tags = JSON.parse(tagsInput);
    }
  } catch {
    if (typeof tagsInput === 'string') tags = [tagsInput];
  }

  if (!Array.isArray(tags)) return;

  for (const t of tags) {
    if (t && typeof t === 'string' && t.trim()) {
      const cleanName = t.trim();
      try {
        const existing = await db.tag.findFirst({
          where: { workspaceId, name: { equals: cleanName, mode: 'insensitive' } },
        });
        if (!existing) {
          await db.tag.create({
            data: { workspaceId, name: cleanName, color: '#cbd5e1' },
          });
        }
      } catch {}
    }
  }
}

export async function getWorkspaceTags(workspaceId: string): Promise<Array<{ id: string; name: string; color: string }>> {
  const dbTags = await db.tag.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
  });

  const tagMap = new Map<string, { id: string; name: string; color: string }>();

  for (const t of dbTags) {
    if (t?.name) {
      tagMap.set(t.name.toLowerCase().trim(), { id: t.id, name: t.name, color: t.color || '#cbd5e1' });
    }
  }

  const contacts = await db.contact.findMany({
    where: { workspaceId },
    select: { tagsJson: true },
  });

  for (const c of contacts) {
    try {
      const tags: string[] = JSON.parse(c.tagsJson || '[]');
      for (const t of tags) {
        if (t && typeof t === 'string' && t.trim()) {
          const clean = t.trim();
          const lower = clean.toLowerCase();
          if (!tagMap.has(lower)) {
            const newObj = { id: `tag_${lower}`, name: clean, color: '#cbd5e1' };
            tagMap.set(lower, newObj);
            db.tag.create({ data: { workspaceId, name: clean, color: '#cbd5e1' } }).catch(() => {});
          }
        }
      }
    } catch {}
  }

  return Array.from(tagMap.values());
}
