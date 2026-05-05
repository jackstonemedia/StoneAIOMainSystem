/**
 * CRM Service — all business logic and DB access for the CRM domain.
 * Routes call these functions and handle HTTP concerns only.
 */
import { db } from '../../infrastructure/database/client.js';

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
    if (field === 'name') return { OR: [{ firstName: { not: null } }, { lastName: { not: null } }] };
    return { [field]: { not: null } };
  }

  const val = String(value || '');
  if (!val) return {}; // skip empty value rules
  
  if (field === 'name') {
    if (operator === 'contains') return { OR: [{ firstName: { contains: val } }, { lastName: { contains: val } }] };
    if (operator === 'equals') return { OR: [{ firstName: { equals: val } }, { lastName: { equals: val } }] };
    if (operator === 'starts_with' || operator === 'starts with') return { OR: [{ firstName: { startsWith: val } }, { lastName: { startsWith: val } }] };
  }

  let pOp = 'equals';
  if (operator === 'contains') pOp = 'contains';
  if (operator === 'starts_with' || operator === 'starts with') pOp = 'startsWith';

  if (field === 'tags') return { tagsJson: { contains: val } };
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
      const parsedFilters = JSON.parse(filters.filtersJson);
      const builtWhere = buildPrismaWhere(parsedFilters);
      if (builtWhere.AND || builtWhere.OR || Object.keys(builtWhere).length > 0) {
        Object.assign(where, builtWhere);
      }
    } catch (e) {
      console.error('Filter parsing error', e);
    }
  }

  const [contacts, total] = await Promise.all([
    db.contact.findMany({
      where,
      include: { company: true },
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
      tagsJson: data.tagsJson ?? '[]',
      color: data.color ?? '#7dd3fc',
      source: data.source ?? null,
      status: data.status ?? 'Lead',
      about: data.about ?? null,
    },
    include: { company: true }
  });
  return formatContact(c);
}

export async function updateContact(id: string, workspaceId: string, raw: any) {
  const { name, tags, businessName, company, ...data } = raw;
  if (data.tagsJson && Array.isArray(data.tagsJson)) {
    data.tagsJson = JSON.stringify(data.tagsJson);
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
  return formatContact(c);
}

export async function deleteContact(id: string, workspaceId: string) {
  await db.contact.delete({ where: { id, workspaceId } });
}

export async function bulkContacts(workspaceId: string, action: string, contactIds: string[], payload: any) {
  if (action === 'delete') {
    await db.contact.deleteMany({ where: { id: { in: contactIds }, workspaceId } });
    return { success: true, affected: contactIds.length };
  }

  if (action === 'tag') {
    const cs = await db.contact.findMany({ where: { id: { in: contactIds }, workspaceId } });
    for (const c of cs) {
      const tags: string[] = JSON.parse((c as any).tagsJson ?? '[]');
      if (!tags.includes(payload.tag)) tags.push(payload.tag);
      await db.contact.update({ where: { id: c.id }, data: { tagsJson: JSON.stringify(tags) } });
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

export async function importContacts(workspaceId: string, rows: any[]) {
  const created: string[] = [];
  for (const row of rows) {
    if (!row.firstName && !row.email && !row.first_name) continue;
    const c = await db.contact
      .create({
        data: {
          workspaceId,
          firstName: row.firstName ?? row.first_name ?? '',
          lastName: row.lastName ?? row.last_name ?? '',
          email: row.email ?? null,
          phone: row.phone ?? null,
          source: 'import',
          status: row.status ?? 'new',
        },
      })
      .catch(() => null);
    if (c) created.push(c.id);
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
  return db.company.create({ data: { ...data, workspaceId } });
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
  return db.deal.create({
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
}

export async function updateDeal(id: string, workspaceId: string, raw: any) {
  const { company, contact, pipelineStage, activities, ...data } = raw;
  if (data.amount !== undefined) data.amount = parseFloat(data.amount);
  if (data.probability !== undefined) data.probability = parseInt(data.probability);
  if (data.closeDate !== undefined) data.closeDate = new Date(data.closeDate);
  return db.deal.update({
    where: { id, workspaceId },
    data,
    include: { company: true, pipelineStage: true },
  });
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
  return db.smartList.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  });
}

export async function createSmartList(workspaceId: string, data: any) {
  // Normalize the filters — can come in as { matchMode, rules } object or plain array
  const filtersPayload = data.filters ?? [];
  const matchMode = data.matchMode || (filtersPayload?.matchMode) || 'all';
  const rules = Array.isArray(filtersPayload) ? filtersPayload : (filtersPayload?.rules ?? []);
  
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

  // Build a group from stored matchMode + filtersJson
  const rules = JSON.parse(list.filtersJson || '[]');
  const group = { matchMode: list.matchMode || 'all', rules };
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
