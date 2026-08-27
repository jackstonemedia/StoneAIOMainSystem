import { db } from '../../infrastructure/database/client.js';
import { emitTrigger } from './trigger-emitter.service.js';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ListOpportunitiesParams {
  pipelineId?: string;
  stageId?: string;
  search?: string;
  status?: string;
  ownerId?: string;
  tags?: string | string[];
  minValue?: number;
  maxValue?: number;
  source?: string;
  createdStartDate?: string;
  createdEndDate?: string;
  closeStartDate?: string;
  closeEndDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  customFilters?: Record<string, any>;
}

// Default presets for new pipelines
export const PIPELINE_TEMPLATES: Record<string, {
  name: string;
  stages: { name: string; color: string; order: number; probability: number; isWon?: boolean; isLost?: boolean }[];
  reasons: { reason: string; type: 'won' | 'lost' | 'both' }[];
}> = {
  sales: {
    name: 'Sales Pipeline',
    stages: [
      { name: 'New Lead', color: '#818CF8', order: 0, probability: 20 },
      { name: 'Proposal Sent', color: '#FBBF24', order: 1, probability: 60 },
      { name: 'Closed', color: '#34D399', order: 2, probability: 100, isWon: true },
    ],
    reasons: [
      { reason: 'Price / Budget fit', type: 'won' },
      { reason: 'Better feature set', type: 'won' },
      { reason: 'Existing relationship', type: 'won' },
      { reason: 'Competitor chosen', type: 'lost' },
      { reason: 'Budget cut / Project cancelled', type: 'lost' },
      { reason: 'Unresponsive / Ghosted', type: 'lost' },
      { reason: 'Missing feature requirement', type: 'lost' },
    ]
  },
  saas: {
    name: 'SaaS Inbound & Expansion',
    stages: [
      { name: 'Trial / Demo Request', color: '#818CF8', order: 0, probability: 15 },
      { name: 'Product Demo Completed', color: '#38BDF8', order: 1, probability: 35 },
      { name: 'Proof of Concept (POC)', color: '#A78BFA', order: 2, probability: 65 },
      { name: 'Security & Legal Review', color: '#FBBF24', order: 3, probability: 85 },
      { name: 'Active Subscription (Won)', color: '#10B981', order: 4, probability: 100, isWon: true },
      { name: 'Churned / Disqualified', color: '#EF4444', order: 5, probability: 0, isLost: true },
    ],
    reasons: [
      { reason: 'Faster time to value', type: 'won' },
      { reason: 'Superior UI / UX', type: 'won' },
      { reason: 'Budget constraints', type: 'lost' },
      { reason: 'Chose incumbent tool', type: 'lost' },
    ]
  },
  consulting: {
    name: 'Consulting & Services',
    stages: [
      { name: 'Initial Inquiry', color: '#94A3B8', order: 0, probability: 10 },
      { name: 'Scope Definition', color: '#60A5FA', order: 1, probability: 30 },
      { name: 'Statement of Work (SOW)', color: '#F59E0B', order: 2, probability: 60 },
      { name: 'Contract Sent', color: '#EC4899', order: 3, probability: 85 },
      { name: 'Engagement Signed', color: '#10B981', order: 4, probability: 100, isWon: true },
      { name: 'Declined', color: '#EF4444', order: 5, probability: 0, isLost: true },
    ],
    reasons: [
      { reason: 'High domain expertise', type: 'won' },
      { reason: 'Competitive pricing', type: 'won' },
      { reason: 'Timeline mismatch', type: 'lost' },
      { reason: 'Internal resource hired', type: 'lost' },
    ]
  },
  realestate: {
    name: 'Real Estate Deals',
    stages: [
      { name: 'New Prospect', color: '#94A3B8', order: 0, probability: 10 },
      { name: 'Showing / Viewing', color: '#38BDF8', order: 1, probability: 30 },
      { name: 'Offer Submitted', color: '#F59E0B', order: 2, probability: 55 },
      { name: 'Under Contract / Escrow', color: '#8B5CF6', order: 3, probability: 85 },
      { name: 'Deal Closed', color: '#10B981', order: 4, probability: 100, isWon: true },
      { name: 'Terminated', color: '#EF4444', order: 5, probability: 0, isLost: true },
    ],
    reasons: [
      { reason: 'Accepted offer terms', type: 'won' },
      { reason: 'Financing failed', type: 'lost' },
      { reason: 'Inspection contingency failed', type: 'lost' },
      { reason: 'Outbid by cash buyer', type: 'lost' },
    ]
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function parseTags(tagsField: any): string[] {
  if (!tagsField) return [];
  if (Array.isArray(tagsField)) return tagsField.map(String);
  if (typeof tagsField === 'string') {
    try {
      const parsed = JSON.parse(tagsField);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return tagsField.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
}

// ── Opportunities CRUD ─────────────────────────────────────────────────────────

export async function listOpportunities(workspaceId: string, params: ListOpportunitiesParams) {
  // Ensure default pipeline exists
  await ensureDefaultPipeline(workspaceId);

  const where: any = { workspaceId };

  // Filter by pipeline
  if (params.pipelineId) {
    where.pipelineStage = { pipelineId: params.pipelineId };
  }

  // Filter by stage
  if (params.stageId) {
    where.pipelineStageId = params.stageId;
  }

  // Filter by status
  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }

  // Filter by owner
  if (params.ownerId) {
    if (Array.isArray(params.ownerId)) {
      where.ownerId = { in: params.ownerId };
    } else {
      where.ownerId = params.ownerId;
    }
  }

  // Filter by source
  if (params.source) {
    if (Array.isArray(params.source)) {
      where.source = { in: params.source };
    } else {
      where.source = params.source;
    }
  }

  // Value Range
  if (params.minValue !== undefined || params.maxValue !== undefined) {
    where.amount = {};
    if (params.minValue !== undefined && !isNaN(params.minValue)) where.amount.gte = params.minValue;
    if (params.maxValue !== undefined && !isNaN(params.maxValue)) where.amount.lte = params.maxValue;
  }

  // Created Date Range
  if (params.createdStartDate || params.createdEndDate) {
    where.createdAt = {};
    if (params.createdStartDate) where.createdAt.gte = new Date(params.createdStartDate);
    if (params.createdEndDate) where.createdAt.lte = new Date(params.createdEndDate);
  }

  // Close Date Range
  if (params.closeStartDate || params.closeEndDate) {
    where.closeDate = {};
    if (params.closeStartDate) where.closeDate.gte = new Date(params.closeStartDate);
    if (params.closeEndDate) where.closeDate.lte = new Date(params.closeEndDate);
  }

  // Search by name or linked contact name
  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { contact: { firstName: { contains: term, mode: 'insensitive' } } },
      { contact: { lastName: { contains: term, mode: 'insensitive' } } },
      { contact: { email: { contains: term, mode: 'insensitive' } } },
      { company: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }

  // Sorting
  const sortBy = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder || 'desc';
  const orderBy: any = {};
  if (sortBy === 'value' || sortBy === 'amount') orderBy.amount = sortOrder;
  else if (sortBy === 'closeDate') orderBy.closeDate = sortOrder;
  else if (sortBy === 'title' || sortBy === 'name') orderBy.title = sortOrder;
  else if (sortBy === 'updatedAt') orderBy.updatedAt = sortOrder;
  else orderBy.createdAt = sortOrder;

  // Pagination
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const [totalCount, rawDeals, pipelineInfo] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
        company: { select: { id: true, name: true, logoUrl: true } },
        pipelineStage: { select: { id: true, name: true, color: true, order: true, probability: true, isWon: true, isLost: true, pipelineId: true } },
        lineItems: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    params.pipelineId ? db.pipeline.findUnique({
      where: { id: params.pipelineId },
      include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true },
    }) : null,
  ]);

  // Calculate days in stage and format
  const now = new Date();
  const deals = rawDeals.map(d => {
    const updatedAt = new Date(d.updatedAt);
    const diffDays = Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const tags = parseTags(d.tagsJson);
    const customFields = parseJsonSafe<Record<string, any>>(d.customFieldsJson, {});
    return {
      ...d,
      tags,
      customFields,
      daysInStage: diffDays,
    };
  });

  // Calculate aggregate stats
  const totalValue = deals.reduce((acc, d) => acc + (d.amount || 0), 0);
  const wonCount = deals.filter(d => d.status === 'won' || d.pipelineStage?.isWon).length;
  const lostCount = deals.filter(d => d.status === 'lost' || d.pipelineStage?.isLost).length;

  return {
    opportunities: deals,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit) || 1,
    summary: {
      totalValue,
      totalCount,
      wonCount,
      lostCount,
    },
    pipeline: pipelineInfo,
  };
}

export async function getOpportunity(id: string, workspaceId: string) {
  const deal = await db.deal.findUnique({
    where: { id, workspaceId },
    include: {
      contact: true,
      company: true,
      pipelineStage: {
        include: {
          pipeline: {
            include: {
              stages: { orderBy: { order: 'asc' } },
              wonLostReasons: true,
            }
          }
        }
      },
      lineItems: { orderBy: { createdAt: 'asc' } },
      opportunityLogs: { orderBy: { createdAt: 'desc' }, take: 100 },
      activities: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });

  if (!deal) return null;

  const tags = parseTags(deal.tagsJson);
  const customFields = parseJsonSafe<Record<string, any>>(deal.customFieldsJson, {});
  const now = new Date();
  const diffDays = Math.max(0, Math.floor((now.getTime() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)));

  // Attach files (attachments)
  const attachments = await db.attachment.findMany({
    where: { workspaceId, entityType: 'deal', entityId: id },
    orderBy: { createdAt: 'desc' },
  });

  // Attach workflows / automations triggered or watching
  const automations = await db.workflow.findMany({
    where: {
      workspaceId,
      triggerType: { in: ['deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost', 'deal.updated'] },
    },
    select: { id: true, name: true, status: true, triggerType: true, updatedAt: true },
  });

  return {
    ...deal,
    tags,
    customFields,
    daysInStage: diffDays,
    attachments,
    automations,
  };
}

export async function createOpportunity(workspaceId: string, userId: string, data: any) {
  // Validate stage
  const stage = await db.pipelineStage.findUnique({
    where: { id: data.pipelineStageId },
    include: { pipeline: true }
  });

  if (!stage || stage.pipeline.workspaceId !== workspaceId) {
    throw new Error('Invalid pipeline stage');
  }

  // Validate required fields for this stage
  const requiredFields = parseJsonSafe<string[]>(stage.requiredFieldsJson, []);
  if (requiredFields.length > 0) {
    const missing: string[] = [];
    const customFieldsObj = data.customFields || parseJsonSafe(data.customFieldsJson, {});
    for (const rf of requiredFields) {
      if (rf === 'contactId' && !data.contactId) missing.push('Contact');
      else if (rf === 'amount' && (data.amount === undefined || data.amount === null || data.amount === 0)) missing.push('Value');
      else if (rf === 'closeDate' && !data.closeDate) missing.push('Expected Close Date');
      else if (rf === 'source' && !data.source) missing.push('Source');
      else if (rf.startsWith('cf_')) {
        const key = rf.replace('cf_', '');
        if (!customFieldsObj[key] && !customFieldsObj[rf]) missing.push(key);
      }
    }
    if (missing.length > 0) {
      const err: any = new Error(`Required fields missing for stage "${stage.name}": ${missing.join(', ')}`);
      err.missingFields = missing;
      err.statusCode = 400;
      throw err;
    }
  }

  const tagsArray = parseTags(data.tags || data.tagsJson);
  const customFieldsJson = typeof data.customFields === 'object' ? JSON.stringify(data.customFields) : (data.customFieldsJson || '{}');

  const deal = await db.deal.create({
    data: {
      workspaceId,
      title: data.title,
      amount: parseFloat(String(data.amount)) || 0,
      priority: data.priority || 'medium',
      probability: data.probability !== undefined ? parseInt(String(data.probability)) : (stage.probability || 0),
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      pipelineStageId: stage.id,
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      source: data.source || null,
      status: stage.isWon ? 'won' : (stage.isLost ? 'lost' : (data.status || 'open')),
      ownerId: data.ownerId || userId,
      description: data.description || null,
      tagsJson: JSON.stringify(tagsArray),
      customFieldsJson,
    },
    include: {
      contact: true,
      company: true,
      pipelineStage: { include: { pipeline: true } },
    }
  });

  // Record system-generated activity log
  await db.opportunityActivityLog.create({
    data: {
      workspaceId,
      dealId: deal.id,
      type: 'created',
      title: 'Opportunity Created',
      description: `Created in stage "${stage.name}" with value $${deal.amount.toLocaleString()}`,
      userId,
      metadataJson: JSON.stringify({
        pipelineName: stage.pipeline.name,
        stageName: stage.name,
        amount: deal.amount,
      }),
    }
  });

  // Emit event triggers
  emitTrigger(workspaceId, 'deal.created', {
    dealId: deal.id,
    title: deal.title,
    value: deal.amount,
    contactId: deal.contactId,
    stageId: deal.pipelineStageId,
    pipelineId: stage.pipelineId,
  }).catch(err => console.error('[trigger:deal.created]', err));

  return deal;
}

export async function updateOpportunity(id: string, workspaceId: string, userId: string, raw: any) {
  const existing = await db.deal.findUnique({
    where: { id, workspaceId },
    include: {
      pipelineStage: { include: { pipeline: true } },
    }
  });

  if (!existing) {
    throw new Error('Opportunity not found');
  }

  const updateData: any = {};
  const logsToCreate: { type: string; title: string; description?: string; metadataJson?: string }[] = [];

  // Stage change detection & required fields check
  const newStageId = raw.pipelineStageId || raw.stageId;
  let newStage: any = null;

  if (newStageId && newStageId !== existing.pipelineStageId) {
    newStage = await db.pipelineStage.findUnique({
      where: { id: newStageId },
      include: { pipeline: true }
    });

    if (!newStage || newStage.pipeline.workspaceId !== workspaceId) {
      throw new Error('Invalid destination stage');
    }

    // Check required fields for destination stage
    const requiredFields = parseJsonSafe<string[]>(newStage.requiredFieldsJson, []);
    if (requiredFields.length > 0) {
      const missing: string[] = [];
      const mergedCustom = {
        ...parseJsonSafe(existing.customFieldsJson, {}),
        ...(raw.customFields || parseJsonSafe(raw.customFieldsJson, {})),
      };
      const checkAmount = raw.amount !== undefined ? raw.amount : existing.amount;
      const checkContact = raw.contactId !== undefined ? raw.contactId : existing.contactId;
      const checkCloseDate = raw.closeDate !== undefined ? raw.closeDate : existing.closeDate;
      const checkSource = raw.source !== undefined ? raw.source : existing.source;

      for (const rf of requiredFields) {
        if (rf === 'contactId' && !checkContact) missing.push('Contact');
        else if (rf === 'amount' && (checkAmount === undefined || checkAmount === null || checkAmount === 0)) missing.push('Value');
        else if (rf === 'closeDate' && !checkCloseDate) missing.push('Expected Close Date');
        else if (rf === 'source' && !checkSource) missing.push('Source');
        else if (rf.startsWith('cf_')) {
          const key = rf.replace('cf_', '');
          if (!mergedCustom[key] && !mergedCustom[rf]) missing.push(key);
        }
      }

      if (missing.length > 0) {
        const err: any = new Error(`Required fields missing for stage "${newStage.name}": ${missing.join(', ')}`);
        err.missingFields = missing;
        err.statusCode = 400;
        throw err;
      }
    }

    updateData.pipelineStageId = newStage.id;
    updateData.probability = newStage.probability;

    // Status transition
    if (newStage.isWon) {
      updateData.status = 'won';
      if (raw.wonLostReason) updateData.wonLostReason = raw.wonLostReason;
      if (raw.wonLostNotes) updateData.wonLostNotes = raw.wonLostNotes;
    } else if (newStage.isLost) {
      updateData.status = 'lost';
      if (raw.wonLostReason) updateData.wonLostReason = raw.wonLostReason;
      if (raw.wonLostNotes) updateData.wonLostNotes = raw.wonLostNotes;
    } else if (raw.status) {
      updateData.status = raw.status;
    }

    logsToCreate.push({
      type: 'stage_change',
      title: 'Stage Changed',
      description: `Moved from "${existing.pipelineStage?.name || 'Previous Stage'}" to "${newStage.name}"`,
      metadataJson: JSON.stringify({
        fromStage: existing.pipelineStage?.name,
        toStage: newStage.name,
        fromStageId: existing.pipelineStageId,
        toStageId: newStage.id,
      }),
    });
  }

  // Handle explicit status change (e.g. Mark Won / Mark Lost)
  if (raw.status && raw.status !== existing.status) {
    updateData.status = raw.status;
    if (raw.status === 'won') {
      logsToCreate.push({
        type: 'won_lost',
        title: 'Opportunity Won',
        description: raw.wonLostReason ? `Marked as Won — Reason: ${raw.wonLostReason}` : 'Marked as Won',
        metadataJson: JSON.stringify({ status: 'won', reason: raw.wonLostReason, notes: raw.wonLostNotes }),
      });
    } else if (raw.status === 'lost') {
      logsToCreate.push({
        type: 'won_lost',
        title: 'Opportunity Lost',
        description: raw.wonLostReason ? `Marked as Lost — Reason: ${raw.wonLostReason}` : 'Marked as Lost',
        metadataJson: JSON.stringify({ status: 'lost', reason: raw.wonLostReason, notes: raw.wonLostNotes }),
      });
    }
  }

  if (raw.title !== undefined && raw.title !== existing.title) {
    updateData.title = raw.title;
    logsToCreate.push({
      type: 'field_edit',
      title: 'Name Updated',
      description: `Renamed to "${raw.title}"`,
    });
  }

  if (raw.amount !== undefined && parseFloat(raw.amount) !== existing.amount) {
    const newAmt = parseFloat(raw.amount) || 0;
    updateData.amount = newAmt;
    logsToCreate.push({
      type: 'field_edit',
      title: 'Value Updated',
      description: `Value changed from $${existing.amount.toLocaleString()} to $${newAmt.toLocaleString()}`,
    });
  }

  if (raw.ownerId !== undefined && raw.ownerId !== existing.ownerId) {
    updateData.ownerId = raw.ownerId;
    logsToCreate.push({
      type: 'owner_reassigned',
      title: 'Owner Reassigned',
      description: `Opportunity reassigned`,
    });
  }

  if (raw.closeDate !== undefined) {
    updateData.closeDate = raw.closeDate ? new Date(raw.closeDate) : null;
  }
  if (raw.priority !== undefined) updateData.priority = raw.priority;
  if (raw.probability !== undefined) updateData.probability = parseInt(raw.probability);
  if (raw.source !== undefined) updateData.source = raw.source;
  if (raw.contactId !== undefined) updateData.contactId = raw.contactId || null;
  if (raw.companyId !== undefined) updateData.companyId = raw.companyId || null;
  if (raw.description !== undefined) updateData.description = raw.description;
  if (raw.wonLostReason !== undefined) updateData.wonLostReason = raw.wonLostReason;
  if (raw.wonLostNotes !== undefined) updateData.wonLostNotes = raw.wonLostNotes;

  // Tags change
  if (raw.tags !== undefined || raw.tagsJson !== undefined) {
    const newTags = parseTags(raw.tags || raw.tagsJson);
    const oldTags = parseTags(existing.tagsJson);
    updateData.tagsJson = JSON.stringify(newTags);
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
      logsToCreate.push({
        type: 'tags_changed',
        title: 'Tags Updated',
        description: `Tags: ${newTags.join(', ') || 'none'}`,
      });
    }
  }

  // Custom Fields change
  if (raw.customFields !== undefined || raw.customFieldsJson !== undefined) {
    const newCf = typeof raw.customFields === 'object' ? raw.customFields : parseJsonSafe(raw.customFieldsJson, {});
    updateData.customFieldsJson = JSON.stringify(newCf);
  }

  // Perform database update
  const updated = await db.deal.update({
    where: { id, workspaceId },
    data: updateData,
    include: {
      contact: true,
      company: true,
      pipelineStage: { include: { pipeline: true } },
      lineItems: true,
    }
  });

  // Append activity logs
  for (const log of logsToCreate) {
    await db.opportunityActivityLog.create({
      data: {
        workspaceId,
        dealId: id,
        type: log.type,
        title: log.title,
        description: log.description,
        userId,
        metadataJson: log.metadataJson,
      }
    }).catch(err => console.error('[ActivityLog]', err));
  }

  // Trigger emitter calls
  if (newStage) {
    emitTrigger(workspaceId, 'deal.stage_changed', {
      dealId: id,
      title: updated.title,
      previousStageId: existing.pipelineStageId,
      newStageId: newStage.id,
      value: updated.amount,
      contactId: updated.contactId,
    }).catch(console.error);

    if (updated.status === 'won') {
      emitTrigger(workspaceId, 'deal.won', { dealId: id, title: updated.title, value: updated.amount, contactId: updated.contactId }).catch(console.error);
    } else if (updated.status === 'lost') {
      emitTrigger(workspaceId, 'deal.lost', { dealId: id, title: updated.title, reason: updated.wonLostReason, contactId: updated.contactId }).catch(console.error);
    }
  }

  emitTrigger(workspaceId, 'deal.updated', { deal: updated }).catch(console.error);

  return {
    ...updated,
    tags: parseTags(updated.tagsJson),
    customFields: parseJsonSafe(updated.customFieldsJson, {}),
  };
}

export async function duplicateOpportunity(id: string, workspaceId: string, userId: string) {
  const existing = await db.deal.findUnique({
    where: { id, workspaceId },
    include: { lineItems: true }
  });

  if (!existing) throw new Error('Opportunity not found');

  const duplicated = await db.deal.create({
    data: {
      workspaceId,
      title: `${existing.title} (Copy)`,
      amount: existing.amount,
      priority: existing.priority,
      probability: existing.probability,
      closeDate: existing.closeDate,
      pipelineStageId: existing.pipelineStageId,
      companyId: existing.companyId,
      contactId: existing.contactId,
      source: existing.source,
      status: 'open',
      ownerId: userId,
      description: existing.description,
      tagsJson: existing.tagsJson,
      customFieldsJson: existing.customFieldsJson,
      lineItems: {
        create: existing.lineItems.map(item => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        }))
      }
    },
    include: {
      contact: true,
      company: true,
      pipelineStage: true,
      lineItems: true,
    }
  });

  await db.opportunityActivityLog.create({
    data: {
      workspaceId,
      dealId: duplicated.id,
      type: 'created',
      title: 'Opportunity Duplicated',
      description: `Duplicated from "${existing.title}"`,
      userId,
    }
  });

  return duplicated;
}

export async function moveOpportunityPipeline(id: string, workspaceId: string, userId: string, pipelineId: string, stageId?: string) {
  const pipeline = await db.pipeline.findUnique({
    where: { id: pipelineId, workspaceId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });

  if (!pipeline || pipeline.stages.length === 0) throw new Error('Target pipeline has no stages');

  const targetStageId = stageId || pipeline.stages[0].id;
  const targetStage = pipeline.stages.find(s => s.id === targetStageId) || pipeline.stages[0];

  const updated = await db.deal.update({
    where: { id, workspaceId },
    data: {
      pipelineStageId: targetStage.id,
      probability: targetStage.probability,
    },
    include: { pipelineStage: { include: { pipeline: true } } }
  });

  await db.opportunityActivityLog.create({
    data: {
      workspaceId,
      dealId: id,
      type: 'stage_change',
      title: 'Pipeline Changed',
      description: `Moved to pipeline "${pipeline.name}" in stage "${targetStage.name}"`,
      userId,
    }
  });

  return updated;
}

export async function deleteOpportunity(id: string, workspaceId: string) {
  await db.opportunityActivityLog.deleteMany({ where: { dealId: id } });
  await db.opportunityLineItem.deleteMany({ where: { dealId: id } });
  await db.deal.delete({ where: { id, workspaceId } });
}

// ── Bulk Actions ───────────────────────────────────────────────────────────────

export async function bulkOpportunities(workspaceId: string, userId: string, action: string, opportunityIds: string[], payload: any = {}) {
  if (!opportunityIds || opportunityIds.length === 0) return { affected: 0 };

  if (action === 'delete') {
    await db.opportunityActivityLog.deleteMany({ where: { dealId: { in: opportunityIds } } });
    await db.opportunityLineItem.deleteMany({ where: { dealId: { in: opportunityIds } } });
    const res = await db.deal.deleteMany({ where: { id: { in: opportunityIds }, workspaceId } });
    return { affected: res.count };
  }

  if (action === 'change_stage' && payload.stageId) {
    const stage = await db.pipelineStage.findUnique({ where: { id: payload.stageId } });
    if (!stage) throw new Error('Stage not found');

    const deals = await db.deal.findMany({ where: { id: { in: opportunityIds }, workspaceId } });
    for (const d of deals) {
      await updateOpportunity(d.id, workspaceId, userId, { pipelineStageId: payload.stageId });
    }
    return { affected: deals.length };
  }

  if (action === 'change_owner' && payload.ownerId) {
    const res = await db.deal.updateMany({
      where: { id: { in: opportunityIds }, workspaceId },
      data: { ownerId: payload.ownerId }
    });
    return { affected: res.count };
  }

  if (action === 'add_tag' && payload.tag) {
    const deals = await db.deal.findMany({ where: { id: { in: opportunityIds }, workspaceId } });
    for (const d of deals) {
      const currentTags = parseTags(d.tagsJson);
      if (!currentTags.includes(payload.tag)) {
        currentTags.push(payload.tag);
        await db.deal.update({
          where: { id: d.id },
          data: { tagsJson: JSON.stringify(currentTags) }
        });
      }
    }
    return { affected: deals.length };
  }

  if (action === 'remove_tag' && payload.tag) {
    const deals = await db.deal.findMany({ where: { id: { in: opportunityIds }, workspaceId } });
    for (const d of deals) {
      const currentTags = parseTags(d.tagsJson).filter(t => t !== payload.tag);
      await db.deal.update({
        where: { id: d.id },
        data: { tagsJson: JSON.stringify(currentTags) }
      });
    }
    return { affected: deals.length };
  }

  if (action === 'move_pipeline' && payload.pipelineId) {
    for (const id of opportunityIds) {
      await moveOpportunityPipeline(id, workspaceId, userId, payload.pipelineId, payload.stageId);
    }
    return { affected: opportunityIds.length };
  }

  if (action === 'export') {
    const csv = await exportOpportunities(workspaceId, { opportunityIds });
    return { csv };
  }

  return { affected: 0 };
}

// ── CSV Import & Export ────────────────────────────────────────────────────────

export async function importOpportunities(workspaceId: string, userId: string, rows: any[], columnMap: Record<string, string> = {}, defaultPipelineId?: string, defaultStageId?: string, defaultTags: string[] = []) {
  let pipeline = defaultPipelineId ? await db.pipeline.findUnique({
    where: { id: defaultPipelineId, workspaceId },
    include: { stages: { orderBy: { order: 'asc' } } }
  }) : null;

  if (!pipeline) {
    pipeline = await ensureDefaultPipeline(workspaceId);
  }

  const stage = (defaultStageId && pipeline.stages.find(s => s.id === defaultStageId)) || pipeline.stages[0];

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const title = row[columnMap['title'] || 'Name'] || row['title'] || row['Opportunity Name'] || row['Deal Name'];
      if (!title) {
        skipped++;
        continue;
      }

      const amountRaw = row[columnMap['amount'] || 'Value'] || row['amount'] || row['Amount'] || 0;
      const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]/g, '')) || 0;

      // Contact matching / resolution
      const contactEmail = row[columnMap['contactEmail'] || 'Email'] || row['email'] || row['Contact Email'];
      const contactName = row[columnMap['contactName'] || 'Contact'] || row['contact'] || row['Contact Name'] || '';
      let contactId: string | null = null;

      if (contactEmail || contactName) {
        let contact = contactEmail ? await db.contact.findFirst({
          where: { workspaceId, email: { equals: contactEmail, mode: 'insensitive' } }
        }) : null;

        if (!contact && contactName) {
          const parts = contactName.trim().split(' ');
          const firstName = parts[0] || 'Unknown';
          const lastName = parts.slice(1).join(' ') || '';
          contact = await db.contact.create({
            data: {
              workspaceId,
              firstName,
              lastName,
              email: contactEmail || null,
            }
          });
        }
        if (contact) contactId = contact.id;
      }

      // Collect custom fields
      const customFields: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        if (!['title', 'amount', 'email', 'contact', 'tags', 'source', 'closeDate'].includes(key)) {
          customFields[key] = val;
        }
      }

      const rowTags = parseTags(row[columnMap['tags'] || 'Tags'] || row['tags']);
      const finalTags = Array.from(new Set([...defaultTags, ...rowTags]));

      await db.deal.create({
        data: {
          workspaceId,
          title,
          amount,
          pipelineStageId: stage.id,
          contactId,
          source: row['source'] || row['Source'] || 'Import',
          ownerId: userId,
          tagsJson: JSON.stringify(finalTags),
          customFieldsJson: JSON.stringify(customFields),
          status: 'open',
        }
      });
      imported++;
    } catch (err: any) {
      skipped++;
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  return { imported, skipped, errors };
}

export async function exportOpportunities(workspaceId: string, filters: any = {}) {
  const where: any = { workspaceId };
  if (filters.opportunityIds && filters.opportunityIds.length > 0) {
    where.id = { in: filters.opportunityIds };
  } else if (filters.pipelineId) {
    where.pipelineStage = { pipelineId: filters.pipelineId };
  }

  const deals = await db.deal.findMany({
    where,
    include: {
      contact: true,
      company: true,
      pipelineStage: { include: { pipeline: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    'Opportunity ID', 'Name', 'Value', 'Pipeline', 'Stage',
    'Contact Name', 'Contact Email', 'Contact Phone', 'Company',
    'Status', 'Probability', 'Source', 'Owner ID', 'Tags',
    'Created At', 'Expected Close Date', 'Last Updated'
  ];

  const csvRows = [headers.join(',')];

  for (const d of deals) {
    const contactName = d.contact ? `${d.contact.firstName} ${d.contact.lastName || ''}`.trim() : '';
    const contactEmail = d.contact?.email || '';
    const contactPhone = d.contact?.phone || '';
    const companyName = d.company?.name || '';
    const pipelineName = d.pipelineStage?.pipeline?.name || '';
    const stageName = d.pipelineStage?.name || '';
    const tags = parseTags(d.tagsJson).join(';');

    const row = [
      d.id,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      d.amount,
      `"${pipelineName.replace(/"/g, '""')}"`,
      `"${stageName.replace(/"/g, '""')}"`,
      `"${contactName.replace(/"/g, '""')}"`,
      `"${contactEmail.replace(/"/g, '""')}"`,
      `"${contactPhone.replace(/"/g, '""')}"`,
      `"${companyName.replace(/"/g, '""')}"`,
      d.status,
      d.probability,
      `"${(d.source || '').replace(/"/g, '""')}"`,
      d.ownerId || '',
      `"${tags.replace(/"/g, '""')}"`,
      d.createdAt.toISOString(),
      d.closeDate ? d.closeDate.toISOString() : '',
      d.updatedAt.toISOString(),
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

// ── Line Items ─────────────────────────────────────────────────────────────────

export async function listLineItems(dealId: string) {
  return db.opportunityLineItem.findMany({
    where: { dealId },
    orderBy: { createdAt: 'asc' }
  });
}

export async function createLineItem(dealId: string, workspaceId: string, userId: string, data: any) {
  const qty = parseFloat(String(data.quantity)) || 1;
  const unitPrice = parseFloat(String(data.unitPrice)) || 0;
  const subtotal = qty * unitPrice;

  const item = await db.opportunityLineItem.create({
    data: {
      dealId,
      name: data.name,
      description: data.description || null,
      quantity: qty,
      unitPrice,
      subtotal,
    }
  });

  // Rollup subtotal into deal.amount
  await recalculateDealAmount(dealId, workspaceId, userId);

  return item;
}

export async function updateLineItem(itemId: string, dealId: string, workspaceId: string, userId: string, data: any) {
  const existing = await db.opportunityLineItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.dealId !== dealId) throw new Error('Line item not found');

  const qty = data.quantity !== undefined ? parseFloat(String(data.quantity)) : existing.quantity;
  const unitPrice = data.unitPrice !== undefined ? parseFloat(String(data.unitPrice)) : existing.unitPrice;
  const subtotal = qty * unitPrice;

  const updated = await db.opportunityLineItem.update({
    where: { id: itemId },
    data: {
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      quantity: qty,
      unitPrice,
      subtotal,
    }
  });

  await recalculateDealAmount(dealId, workspaceId, userId);

  return updated;
}

export async function deleteLineItem(itemId: string, dealId: string, workspaceId: string, userId: string) {
  await db.opportunityLineItem.delete({ where: { id: itemId } });
  await recalculateDealAmount(dealId, workspaceId, userId);
}

async function recalculateDealAmount(dealId: string, workspaceId: string, userId: string) {
  const items = await db.opportunityLineItem.findMany({ where: { dealId } });
  const total = items.reduce((s, i) => s + (i.subtotal || 0), 0);

  await db.deal.update({
    where: { id: dealId },
    data: { amount: total }
  });

  await db.opportunityActivityLog.create({
    data: {
      workspaceId,
      dealId,
      type: 'line_item',
      title: 'Line Items Updated',
      description: `Total amount updated to $${total.toLocaleString()}`,
      userId,
    }
  });
}

// ── Pipelines & Stages ─────────────────────────────────────────────────────────

export async function ensureDefaultPipeline(workspaceId: string) {
  let pipeline = await db.pipeline.findFirst({
    where: { workspaceId, isDefault: true },
    include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true },
  });

  if (!pipeline) {
    pipeline = await db.pipeline.findFirst({
      where: { workspaceId },
      include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true },
    });
  }

  if (!pipeline) {
    const template = PIPELINE_TEMPLATES.sales;
    pipeline = await db.pipeline.create({
      data: {
        workspaceId,
        name: template.name,
        isDefault: true,
        staleThresholdDays: 14,
        allowStageSkip: true,
        enableLineItems: true,
        stages: {
          create: template.stages.map(s => ({
            name: s.name,
            color: s.color,
            order: s.order,
            probability: s.probability,
            isWon: s.isWon || false,
            isLost: s.isLost || false,
          }))
        },
        wonLostReasons: {
          create: template.reasons.map(r => ({
            workspaceId,
            reason: r.reason,
            type: r.type,
          }))
        }
      },
      include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true },
    });
  }

  return pipeline;
}

export async function listPipelines(workspaceId: string) {
  await ensureDefaultPipeline(workspaceId);
  const pipelines = await db.pipeline.findMany({
    where: { workspaceId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { deals: true } },
        }
      },
      wonLostReasons: true,
      _count: { select: { savedViews: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Calculate total deals per pipeline
  return pipelines.map(p => {
    const totalDeals = p.stages.reduce((acc, s) => acc + (s._count?.deals || 0), 0);
    return {
      ...p,
      opportunityCount: totalDeals,
    };
  });
}

export async function createPipeline(workspaceId: string, data: any) {
  let stagesData: any[] = [];
  let reasonsData: any[] = [];

  if (data.sourcePipelineId) {
    // Copy stages and reasons from source pipeline
    const src = await db.pipeline.findUnique({
      where: { id: data.sourcePipelineId, workspaceId },
      include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true }
    });
    if (src) {
      stagesData = src.stages.map(s => ({
        name: s.name,
        color: s.color,
        order: s.order,
        probability: s.probability,
        isWon: s.isWon,
        isLost: s.isLost,
        requiredFieldsJson: s.requiredFieldsJson,
      }));
      reasonsData = src.wonLostReasons.map(r => ({
        workspaceId,
        reason: r.reason,
        type: r.type,
      }));
    }
  } else if (data.templatePreset && PIPELINE_TEMPLATES[data.templatePreset]) {
    const tpl = PIPELINE_TEMPLATES[data.templatePreset];
    stagesData = tpl.stages;
    reasonsData = tpl.reasons.map(r => ({ workspaceId, reason: r.reason, type: r.type }));
  } else if (Array.isArray(data.stages) && data.stages.length > 0) {
    stagesData = data.stages.map((s: any, i: number) => ({
      name: s.name || `Stage ${i + 1}`,
      color: s.color || '#52677D',
      order: s.order !== undefined ? s.order : i,
      probability: s.probability !== undefined ? s.probability : (i * 20),
      isWon: Boolean(s.isWon),
      isLost: Boolean(s.isLost),
      requiredFieldsJson: s.requiredFieldsJson || '[]',
    }));
  } else {
    // Default initial 3 stages
    stagesData = [
      { name: 'New Lead', color: '#818CF8', order: 0, probability: 20 },
      { name: 'Proposal Sent', color: '#FBBF24', order: 1, probability: 60 },
      { name: 'Closed', color: '#34D399', order: 2, probability: 100, isWon: true },
    ];
  }

  return db.pipeline.create({
    data: {
      workspaceId,
      name: data.name,
      isDefault: false,
      staleThresholdDays: data.staleThresholdDays || 14,
      allowStageSkip: data.allowStageSkip !== undefined ? data.allowStageSkip : true,
      enableLineItems: data.enableLineItems !== undefined ? data.enableLineItems : false,
      visibleTabsJson: data.visibleTabsJson || '["overview","activity","line_items","files","automations"]',
      stages: { create: stagesData },
      wonLostReasons: reasonsData.length > 0 ? { create: reasonsData } : undefined,
    },
    include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true }
  });
}

export async function updatePipeline(id: string, workspaceId: string, data: any) {
  if (data.isDefault) {
    // Unset current default
    await db.pipeline.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false }
    });
  }

  return db.pipeline.update({
    where: { id, workspaceId },
    data: {
      name: data.name,
      isDefault: data.isDefault,
      staleThresholdDays: data.staleThresholdDays,
      allowStageSkip: data.allowStageSkip,
      enableLineItems: data.enableLineItems,
      visibleTabsJson: data.visibleTabsJson,
    },
    include: { stages: { orderBy: { order: 'asc' } }, wonLostReasons: true }
  });
}

export async function deletePipeline(id: string, workspaceId: string, reassignmentStageId?: string) {
  const p = await db.pipeline.findUnique({
    where: { id, workspaceId },
    include: { stages: true }
  });
  if (!p) throw new Error('Pipeline not found');

  const totalPipelines = await db.pipeline.count({ where: { workspaceId } });
  if (totalPipelines <= 1) throw new Error('Cannot delete the only remaining pipeline');

  const stageIds = p.stages.map(s => s.id);
  const dealsCount = await db.deal.count({ where: { pipelineStageId: { in: stageIds } } });

  if (dealsCount > 0) {
    if (!reassignmentStageId) {
      throw new Error(`Pipeline contains ${dealsCount} opportunities. Please choose a reassignment stage.`);
    }
    await db.deal.updateMany({
      where: { pipelineStageId: { in: stageIds } },
      data: { pipelineStageId: reassignmentStageId }
    });
  }

  // If this was default, make another one default
  if (p.isDefault) {
    const nextPipeline = await db.pipeline.findFirst({ where: { workspaceId, id: { not: id } } });
    if (nextPipeline) {
      await db.pipeline.update({ where: { id: nextPipeline.id }, data: { isDefault: true } });
    }
  }

  await db.pipelineStage.deleteMany({ where: { pipelineId: id } });
  await db.wonLostReason.deleteMany({ where: { pipelineId: id } });
  await db.opportunitySavedView.deleteMany({ where: { pipelineId: id } });
  await db.pipeline.delete({ where: { id } });
}

export async function reorderStages(pipelineId: string, stageIds: string[]) {
  for (let i = 0; i < stageIds.length; i++) {
    await db.pipelineStage.update({
      where: { id: stageIds[i] },
      data: { order: i }
    });
  }
  return db.pipelineStage.findMany({ where: { pipelineId }, orderBy: { order: 'asc' } });
}

export async function createStage(pipelineId: string, data: any) {
  const count = await db.pipelineStage.count({ where: { pipelineId } });
  return db.pipelineStage.create({
    data: {
      pipelineId,
      name: data.name,
      color: data.color || '#52677D',
      order: data.order !== undefined ? data.order : count,
      probability: data.probability !== undefined ? data.probability : 50,
      isWon: Boolean(data.isWon),
      isLost: Boolean(data.isLost),
      requiredFieldsJson: data.requiredFieldsJson || '[]',
    }
  });
}

export async function updateStage(stageId: string, data: any) {
  return db.pipelineStage.update({
    where: { id: stageId },
    data: {
      name: data.name,
      color: data.color,
      order: data.order,
      probability: data.probability,
      isWon: data.isWon,
      isLost: data.isLost,
      requiredFieldsJson: data.requiredFieldsJson,
    }
  });
}

export async function deleteStage(stageId: string, reassignmentStageId?: string) {
  const stage = await db.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) return;

  const dealsCount = await db.deal.count({ where: { pipelineStageId: stageId } });
  if (dealsCount > 0) {
    let targetStageId = reassignmentStageId;
    if (!targetStageId) {
      const fallbackStage = await db.pipelineStage.findFirst({
        where: { pipelineId: stage.pipelineId, id: { not: stageId } },
        orderBy: { order: 'asc' },
      });
      targetStageId = fallbackStage?.id;
    }

    if (targetStageId) {
      await db.deal.updateMany({
        where: { pipelineStageId: stageId },
        data: { pipelineStageId: targetStageId }
      });
    } else {
      await db.deal.deleteMany({ where: { pipelineStageId: stageId } });
    }
  }
  await db.pipelineStage.delete({ where: { id: stageId } });
}

// ── Won/Lost Reasons ──────────────────────────────────────────────────────────

export async function listWonLostReasons(workspaceId: string, pipelineId?: string) {
  const where: any = { workspaceId };
  if (pipelineId) where.OR = [{ pipelineId }, { pipelineId: null }];
  return db.wonLostReason.findMany({ where, orderBy: { createdAt: 'asc' } });
}

export async function createWonLostReason(workspaceId: string, data: any) {
  return db.wonLostReason.create({
    data: {
      workspaceId,
      pipelineId: data.pipelineId || null,
      reason: data.reason,
      type: data.type || 'both',
    }
  });
}

export async function updateWonLostReason(id: string, workspaceId: string, data: any) {
  return db.wonLostReason.update({
    where: { id, workspaceId },
    data: {
      reason: data.reason,
      type: data.type,
      pipelineId: data.pipelineId,
    }
  });
}

export async function deleteWonLostReason(id: string, workspaceId: string) {
  await db.wonLostReason.delete({ where: { id, workspaceId } });
}

// ── Custom Fields ─────────────────────────────────────────────────────────────

export async function listCustomFields(workspaceId: string, pipelineId?: string) {
  const where: any = { workspaceId, entityType: 'deal' };
  if (pipelineId) {
    where.OR = [{ scope: 'all' }, { pipelineId }];
  }
  return db.customField.findMany({
    where,
    orderBy: { order: 'asc' }
  });
}

export async function createCustomField(workspaceId: string, data: any) {
  const count = await db.customField.count({ where: { workspaceId, entityType: 'deal' } });
  return db.customField.create({
    data: {
      workspaceId,
      entityType: 'deal',
      label: data.label,
      type: data.type,
      scope: data.scope || 'all',
      pipelineId: data.pipelineId || null,
      required: Boolean(data.required),
      order: data.order !== undefined ? data.order : count,
      optionsJson: data.optionsJson || null,
    }
  });
}

export async function updateCustomField(id: string, workspaceId: string, data: any) {
  return db.customField.update({
    where: { id, workspaceId },
    data: {
      label: data.label,
      type: data.type,
      scope: data.scope,
      pipelineId: data.pipelineId,
      required: data.required,
      order: data.order,
      optionsJson: data.optionsJson,
    }
  });
}

export async function reorderCustomFields(workspaceId: string, fieldIds: string[]) {
  for (let i = 0; i < fieldIds.length; i++) {
    await db.customField.update({
      where: { id: fieldIds[i], workspaceId },
      data: { order: i }
    });
  }
  return listCustomFields(workspaceId);
}

export async function deleteCustomField(id: string, workspaceId: string) {
  const field = await db.customField.findUnique({ where: { id, workspaceId } });
  if (!field) throw new Error('Field not found');
  await db.customField.delete({ where: { id } });
}

// ── Tags ───────────────────────────────────────────────────────────────────────

export async function listTags(workspaceId: string) {
  const tags = await db.tag.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' }
  });

  const deals = await db.deal.findMany({
    where: { workspaceId },
    select: { tagsJson: true }
  });

  const usageCounts: Record<string, number> = {};
  for (const d of deals) {
    for (const t of parseTags(d.tagsJson)) {
      usageCounts[t] = (usageCounts[t] || 0) + 1;
    }
  }

  return tags.map(t => ({
    ...t,
    usageCount: usageCounts[t.name] || 0,
  }));
}

export async function createTag(workspaceId: string, data: any) {
  return db.tag.create({
    data: {
      workspaceId,
      name: data.name.trim(),
      color: data.color || '#52677D',
      isShared: data.isShared !== undefined ? data.isShared : true,
      entityType: data.entityType || 'all',
    }
  });
}

export async function updateTag(id: string, workspaceId: string, data: any) {
  const tag = await db.tag.findUnique({ where: { id, workspaceId } });
  if (!tag) throw new Error('Tag not found');

  const oldName = tag.name;
  const newName = data.name ? data.name.trim() : oldName;

  const updated = await db.tag.update({
    where: { id },
    data: {
      name: newName,
      color: data.color || tag.color,
      isShared: data.isShared !== undefined ? data.isShared : tag.isShared,
      entityType: data.entityType || tag.entityType,
    }
  });

  if (oldName !== newName) {
    // Rename across all deals
    const deals = await db.deal.findMany({ where: { workspaceId } });
    for (const d of deals) {
      const tags = parseTags(d.tagsJson);
      if (tags.includes(oldName)) {
        const renamed = tags.map(t => (t === oldName ? newName : t));
        await db.deal.update({ where: { id: d.id }, data: { tagsJson: JSON.stringify(renamed) } });
      }
    }
  }

  return updated;
}

export async function deleteTag(id: string, workspaceId: string) {
  const tag = await db.tag.findUnique({ where: { id, workspaceId } });
  if (!tag) return;

  // Remove tag from deals
  const deals = await db.deal.findMany({ where: { workspaceId } });
  for (const d of deals) {
    const tags = parseTags(d.tagsJson);
    if (tags.includes(tag.name)) {
      const stripped = tags.filter(t => t !== tag.name);
      await db.deal.update({ where: { id: d.id }, data: { tagsJson: JSON.stringify(stripped) } });
    }
  }

  await db.tag.delete({ where: { id } });
}

export async function mergeTags(workspaceId: string, sourceTagId: string, targetTagId: string) {
  const [src, tgt] = await Promise.all([
    db.tag.findUnique({ where: { id: sourceTagId, workspaceId } }),
    db.tag.findUnique({ where: { id: targetTagId, workspaceId } }),
  ]);

  if (!src || !tgt) throw new Error('Tags not found');

  const deals = await db.deal.findMany({ where: { workspaceId } });
  for (const d of deals) {
    const tags = parseTags(d.tagsJson);
    if (tags.includes(src.name)) {
      const merged = Array.from(new Set(tags.map(t => (t === src.name ? tgt.name : t))));
      await db.deal.update({ where: { id: d.id }, data: { tagsJson: JSON.stringify(merged) } });
    }
  }

  await db.tag.delete({ where: { id: sourceTagId } });
  return { success: true };
}

// ── Saved Views ────────────────────────────────────────────────────────────────

export async function listSavedViews(workspaceId: string, pipelineId?: string) {
  const where: any = { workspaceId };
  if (pipelineId) where.OR = [{ pipelineId }, { pipelineId: null }];
  return db.opportunitySavedView.findMany({
    where,
    orderBy: { createdAt: 'asc' }
  });
}

export async function createSavedView(workspaceId: string, data: any) {
  if (data.isDefault) {
    await db.opportunitySavedView.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false }
    });
  }
  return db.opportunitySavedView.create({
    data: {
      workspaceId,
      pipelineId: data.pipelineId || null,
      name: data.name,
      isDefault: Boolean(data.isDefault),
      viewType: data.viewType || 'board',
      filtersJson: data.filtersJson || '[]',
      sortJson: data.sortJson || null,
      columnsJson: data.columnsJson || null,
      cardConfigJson: data.cardConfigJson || null,
    }
  });
}

export async function updateSavedView(id: string, workspaceId: string, data: any) {
  if (data.isDefault) {
    await db.opportunitySavedView.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false }
    });
  }
  return db.opportunitySavedView.update({
    where: { id, workspaceId },
    data: {
      name: data.name,
      isDefault: data.isDefault,
      viewType: data.viewType,
      filtersJson: data.filtersJson,
      sortJson: data.sortJson,
      columnsJson: data.columnsJson,
      cardConfigJson: data.cardConfigJson,
    }
  });
}

export async function deleteSavedView(id: string, workspaceId: string) {
  await db.opportunitySavedView.delete({ where: { id, workspaceId } });
}
