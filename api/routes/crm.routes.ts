/**
 * CRM Routes — thin HTTP controller layer.
 * All business logic lives in api/services/crm.service.ts.
 */
import { Router } from 'express';
import { ZodError } from 'zod';
import {
  ContactSchema,
  CompanySchema,
  DealSchema,
  TaskSchema,
  BulkActionSchema,
} from '../schemas/validation.js';
import { validate } from '../middleware/validate.js';
import * as crm from '../services/crm.service.js';
import { emitTrigger } from '../services/trigger-emitter.service.js';
import { scopedFindOrThrow, findScopedStageOrThrow } from '../middleware/tenant-guard.js';

const router = Router();

// ── Error helpers ─────────────────────────────────────────────────────────────
const dbErr = (res: any, e: unknown) => {
  console.error('[CRM]', e);
  if (e instanceof ZodError) return res.status(400).json({ error: 'Validation error', details: e.flatten() });
  res.status(500).json({ error: 'Database error', details: e instanceof Error ? e.stack || e.message : String(e) });
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try { res.json(await crm.getDashboard(req.workspaceId)); }
  catch (e) { dbErr(res, e); }
});

// ── Contacts ──────────────────────────────────────────────────────────────────
router.get('/contacts', async (req, res) => {
  try {
    const { search, status, page, limit, filtersJson } = req.query as Record<string, string>;
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(String(limit)) || 50));
    res.json(await crm.listContacts(req.workspaceId, { search, status, page: parsedPage, limit: parsedLimit, filtersJson }));
  } catch (e) { dbErr(res, e); }
});

router.post('/contacts', validate({ body: ContactSchema }), async (req, res, next) => {
  try {
    const contact = await crm.createContact(req.workspaceId, req.body);
    
    // Log contact creation event
    try {
      const { db } = await import('../../infrastructure/database/client.js');
      await db.contactEvent.create({
        data: {
          contactId: contact.id,
          type: 'contact_created',
          title: 'Contact Created',
          content: `Contact was added to the CRM via ${req.body.source || 'Manual Entry'}`,
        }
      });
    } catch (err) { console.error('Failed to log contact creation event', err); }

    emitTrigger(req.workspaceId, 'contact.created', contact as Record<string, unknown>).catch(console.error);
    res.json(contact);
  } catch (e) { next(e); }
});

// ── Duplicate detection + merge (Tier 2 fix 7) ───────────────────────────────
// NOTE: the scan route MUST stay above '/contacts/:id' or Express reads
// 'duplicates' as a contact id.
router.get('/contacts/duplicates', async (req, res) => {
  try {
    res.json(await crm.findDuplicateGroups(req.workspaceId));
  } catch (e) { dbErr(res, e); }
});

router.post('/contacts/:id/merge', async (req, res) => {
  try {
    const result = await crm.mergeContacts(req.workspaceId, req.params.id, req.body?.duplicateIds);
    res.json(result);
  } catch (e: any) {
    if (e?.statusCode === 400) return res.status(400).json({ error: e.message });
    dbErr(res, e);
  }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const c = await crm.getContact(req.params.id, req.workspaceId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { dbErr(res, e); }
});

router.put('/contacts/:id', async (req, res) => {
  try {
    const updated = await crm.updateContact(req.params.id, req.workspaceId, req.body);
    emitTrigger(req.workspaceId, 'contact.updated', { updated }).catch(console.error);
    res.json(updated);
  } catch (e) { dbErr(res, e); }
});

router.delete('/contacts/:id', async (req, res) => {
  try { 
    await crm.deleteContact(req.params.id, req.workspaceId); 
    emitTrigger(req.workspaceId, 'contact.deleted', { id: req.params.id }).catch(console.error);
    res.json({ success: true }); 
  }
  catch (e) { dbErr(res, e); }
});

router.get('/contacts/:id/events', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const events = await db.contactEvent.findMany({
      where: { contactId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(events);
  } catch (e) { dbErr(res, e); }
});

router.post('/contacts/:id/events', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const event = await db.contactEvent.create({
      data: {
        contactId: req.params.id,
        type: req.body.type,
        title: req.body.title,
        content: req.body.content,
        metadataJson: req.body.metadataJson
      }
    });
    res.json(event);
  } catch (e) { dbErr(res, e); }
});

// ── Companies ──────────────────────────────────────────────────────────────────
router.get('/companies', async (req, res) => {
  try {
    const { search, industry } = req.query as Record<string, string>;
    res.json(await crm.listCompanies(req.workspaceId, search, industry));
  } catch (e) { dbErr(res, e); }
});

router.post('/companies', validate({ body: CompanySchema }), async (req, res, next) => {
  try {
    res.json(await crm.createCompany(req.workspaceId, req.body));
  } catch (e) { next(e); }
});

router.get('/companies/:id', async (req, res) => {
  try {
    const c = await crm.getCompany(req.params.id, req.workspaceId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { dbErr(res, e); }
});

// Company events — mirror of the contacts /:id/events routes. Unlike the
// contacts routes, the company is looked up workspace-scoped first so one
// workspace cannot read or write another's activity log.
router.get('/companies/:id/events', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const company = await db.company.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    if (!company) return res.status(404).json({ error: 'Not found' });
    const events = await db.companyEvent.findMany({
      where: { companyId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(events);
  } catch (e) { dbErr(res, e); }
});

router.post('/companies/:id/events', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const company = await db.company.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    if (!company) return res.status(404).json({ error: 'Not found' });
    if (typeof req.body?.type !== 'string' || !req.body.type.trim() || typeof req.body?.content !== 'string' || !req.body.content.trim()) {
      return res.status(400).json({ error: 'type and content are required' });
    }
    const event = await db.companyEvent.create({
      data: {
        companyId: req.params.id,
        type: req.body.type,
        title: req.body.title,
        content: req.body.content,
        metadataJson: req.body.metadataJson,
      },
    });
    res.json(event);
  } catch (e) { dbErr(res, e); }
});

router.put('/companies/:id', async (req, res) => {
  try { res.json(await crm.updateCompany(req.params.id, req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
});

router.delete('/companies/:id', async (req, res) => {
  try { await crm.deleteCompany(req.params.id, req.workspaceId); res.json({ success: true }); }
  catch (e) { dbErr(res, e); }
});

// ── Documents ───────────────────────────────────────────────────────────────────
// CRM Documents page (src/pages/crm/Documents.tsx) — a Notion-style title +
// content editor with debounced auto-save. Every route is workspace-scoped:
// a document in another workspace reads as 404, never as data. The list
// omits content (the page fetches it per document); the single-doc fetch
// returns it. No file upload exists on this page — documents are text only.
router.get('/documents', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const docs = await db.crmDocument.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json(docs.map((d) => ({ ...d, type: 'document' })));
  } catch (e) { dbErr(res, e); }
});

router.get('/documents/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const doc = await db.crmDocument.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc, type: 'document' });
  } catch (e) { dbErr(res, e); }
});

router.post('/documents', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    if (req.body?.title !== undefined && typeof req.body.title !== 'string') {
      return res.status(400).json({ error: 'title must be a string' });
    }
    if (req.body?.content !== undefined && typeof req.body.content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }
    const doc = await db.crmDocument.create({
      data: {
        workspaceId: req.workspaceId!,
        title: req.body?.title?.trim() ? req.body.title.trim() : 'Untitled Document',
        content: req.body?.content ?? '',
        createdBy: req.userId ?? null,
      },
    });
    res.status(201).json({ ...doc, type: 'document' });
  } catch (e) { dbErr(res, e); }
});

router.put('/documents/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    if (req.body?.title !== undefined && typeof req.body.title !== 'string') {
      return res.status(400).json({ error: 'title must be a string' });
    }
    if (req.body?.content !== undefined && typeof req.body.content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }
    if (req.body?.title === undefined && req.body?.content === undefined) {
      return res.status(400).json({ error: 'title or content is required' });
    }
    const existing = await db.crmDocument.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const data: { title?: string; content?: string } = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.content !== undefined) data.content = req.body.content;
    const doc = await db.crmDocument.update({ where: { id: req.params.id }, data });
    res.json({ ...doc, type: 'document' });
  } catch (e) { dbErr(res, e); }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const existing = await db.crmDocument.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await db.crmDocument.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { dbErr(res, e); }
});

// ── Deals ─────────────────────────────────────────────────────────────────────
router.get('/deals', async (req, res) => {
  try {
    res.json(await crm.listDeals(req.workspaceId, req.query as Record<string, string>));
  } catch (e) { dbErr(res, e); }
});

router.post('/deals', validate({ body: DealSchema }), async (req, res, next) => {
  try {
    const deal = await crm.createDeal(req.workspaceId, req.userId!, req.body as any);
    
    // Log opportunity creation event
    if (deal.contactId) {
      try {
        const { db } = await import('../../infrastructure/database/client.js');
        await db.contactEvent.create({
          data: {
            contactId: deal.contactId,
            type: 'deal_created',
            title: 'Opportunity Created',
            content: `Deal "${deal.title}" was created for $${deal.amount || 0}`,
          }
        });
      } catch (err) { console.error('Failed to log deal creation event', err); }
    }

    emitTrigger(req.workspaceId, 'deal.created', deal as Record<string, unknown>).catch(console.error);
    res.json(deal);
  } catch (e) { next(e); }
});

router.get('/deals/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const d = await db.deal.findUnique({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: { company: true, contact: true, pipelineStage: true, activities: true },
    });
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  } catch (e) { dbErr(res, e); }
});

router.put('/deals/:id', async (req, res) => {
  try { 
    const deal = await crm.updateDeal(req.params.id, req.workspaceId, req.body); 
    if (req.body.stageId) emitTrigger(req.workspaceId, 'deal.stage_changed', { deal, newStage: req.body.stageId }).catch(console.error);
    if (req.body.status === 'won') emitTrigger(req.workspaceId, 'deal.won', deal as Record<string, unknown>).catch(console.error);
    if (req.body.status === 'lost') emitTrigger(req.workspaceId, 'deal.lost', deal as Record<string, unknown>).catch(console.error);
    emitTrigger(req.workspaceId, 'deal.updated', { deal }).catch(console.error);
    res.json(deal);
  } catch (e) { dbErr(res, e); }
});

router.delete('/deals/:id', async (req, res) => {
  try { await crm.deleteDeal(req.params.id, req.workspaceId); res.json({ success: true }); }
  catch (e) { dbErr(res, e); }
});

// ── Pipelines ─────────────────────────────────────────────────────────────────
router.get('/pipelines', async (req, res) => {
  try { res.json(await crm.listPipelines(req.workspaceId)); }
  catch (e) { dbErr(res, e); }
});

router.post('/pipelines', async (req, res) => {
  try {
    const { name, stages = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Pipeline name is required' });
    res.json(await crm.createPipeline(req.workspaceId, name, stages));
  } catch (e) { dbErr(res, e); }
});

router.put('/pipelines/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { stages, ...data } = req.body;
    res.json(await db.pipeline.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data,
      include: { stages: { orderBy: { order: 'asc' } } },
    }));
  } catch (e) { dbErr(res, e); }
});

router.delete('/pipelines/:id', async (req, res) => {
  try { await crm.deletePipeline(req.params.id, req.workspaceId); res.json({ success: true }); }
  catch (e) {
    const msg = e instanceof Error ? e.message : 'Database error';
    if (msg.includes('default')) return res.status(400).json({ error: msg });
    dbErr(res, e);
  }
});

router.post('/pipelines/:id/stages', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await scopedFindOrThrow(db.pipeline, req.params.id, req.workspaceId!);
    const { name, color, order, probability } = req.body;
    res.json(await db.pipelineStage.create({
      data: {
        pipelineId: req.params.id,
        name: name || 'New Stage',
        color: color ?? '#cbd5e1',
        order: typeof order === 'number' ? order : 0,
        probability: typeof probability === 'number' ? probability : 0,
      },
    }));
  } catch (e: any) {
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    dbErr(res, e);
  }
});

router.put('/pipelines/:pipelineId/stages/:stageId', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await findScopedStageOrThrow(req.params.stageId, req.workspaceId!);
    const { name, color, order, probability, isWon, isLost, requiredFieldsJson } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (order !== undefined) updateData.order = order;
    if (probability !== undefined) updateData.probability = probability;
    if (isWon !== undefined) updateData.isWon = Boolean(isWon);
    if (isLost !== undefined) updateData.isLost = Boolean(isLost);
    if (requiredFieldsJson !== undefined) updateData.requiredFieldsJson = requiredFieldsJson;

    res.json(await db.pipelineStage.update({
      where: { id: req.params.stageId },
      data: updateData,
    }));
  } catch (e: any) {
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    dbErr(res, e);
  }
});

router.delete('/pipelines/:pipelineId/stages/:stageId', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await findScopedStageOrThrow(req.params.stageId, req.workspaceId!);
    await db.pipelineStage.delete({ where: { id: req.params.stageId } });
    res.json({ success: true });
  } catch (e: any) {
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    dbErr(res, e);
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    res.json(await crm.listTasks(req.workspaceId, req.query as Record<string, string>));
  } catch (e) { dbErr(res, e); }
});

router.post('/tasks', validate({ body: TaskSchema }), async (req, res, next) => {
  try {
    const task = await crm.createTask(req.workspaceId, req.body as any);
    emitTrigger(req.workspaceId, 'task.created', task as Record<string, unknown>).catch(console.error);
    res.json(task);
  } catch (e) { next(e); }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const task = await crm.updateTask(req.params.id, req.workspaceId, req.body);
    if (req.body.status === 'completed') {
      emitTrigger(req.workspaceId, 'task.completed', task as Record<string, unknown>).catch(console.error);
    }
    res.json(task);
  } catch (e) { dbErr(res, e); }
});

router.delete('/tasks/:id', async (req, res) => {
  try { await crm.deleteTask(req.params.id, req.workspaceId); res.json({ success: true }); }
  catch (e) { dbErr(res, e); }
});

// ── Activities ────────────────────────────────────────────────────────────────
router.get('/activities', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.activity.findMany({ where: { workspaceId: req.workspaceId }, orderBy: { createdAt: 'desc' }, take: 50 }));
  } catch (e) { dbErr(res, e); }
});

router.post('/activities', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { dealId, contactId, companyId, type, title, notes, duration, outcome } = req.body;
    res.json(await db.activity.create({
      data: {
        workspaceId: req.workspaceId!,
        dealId: dealId || null,
        contactId: contactId || null,
        companyId: companyId || null,
        type: type || 'note',
        title: title || 'Activity',
        notes: notes || null,
        duration: typeof duration === 'number' ? duration : null,
        outcome: outcome || null,
      },
    }));
  } catch (e) { dbErr(res, e); }
});

// ── Custom Fields ─────────────────────────────────────────────────────────────
router.get('/custom-fields', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const where: any = { workspaceId: req.workspaceId };
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    res.json(await db.customField.findMany({ where, orderBy: { order: 'asc' } }));
  } catch (e) { dbErr(res, e); }
});

router.post('/custom-fields', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { entityType, label, type, optionsJson, required, order, pipelineId, scope } = req.body;
    res.json(await db.customField.create({
      data: {
        workspaceId: req.workspaceId!,
        entityType: entityType || 'contact',
        label: label || 'Custom Field',
        type: type || 'text',
        optionsJson: typeof optionsJson === 'string' ? optionsJson : JSON.stringify(optionsJson || []),
        required: Boolean(required),
        order: typeof order === 'number' ? order : 0,
        pipelineId: pipelineId || null,
        scope: scope || 'all',
      },
    }));
  } catch (e) { dbErr(res, e); }
});

router.put('/custom-fields/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const { label, type, optionsJson, required, order, pipelineId, scope } = req.body;
    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (type !== undefined) updateData.type = type;
    if (optionsJson !== undefined) updateData.optionsJson = typeof optionsJson === 'string' ? optionsJson : JSON.stringify(optionsJson);
    if (required !== undefined) updateData.required = Boolean(required);
    if (order !== undefined) updateData.order = Number(order);
    if (pipelineId !== undefined) updateData.pipelineId = pipelineId;
    if (scope !== undefined) updateData.scope = scope;

    res.json(await db.customField.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data: updateData,
    }));
  } catch (e) { dbErr(res, e); }
});

router.delete('/custom-fields/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await db.customField.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { dbErr(res, e); }
});

// ── Tags ──────────────────────────────────────────────────────────────────────
router.get('/tags', async (req, res) => {
  try {
    res.json(await crm.getWorkspaceTags(req.workspaceId));
  } catch (e) { dbErr(res, e); }
});

router.post('/tags', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.tag.create({ data: { workspaceId: req.workspaceId, name: req.body.name, color: req.body.color ?? '#cbd5e1' } }));
  } catch (e) { dbErr(res, e); }
});

router.put('/tags/:id', async (req, res) => {
  try {
    res.json(await crm.renameTag(req.params.id, req.workspaceId, req.body.name));
  } catch (e) { dbErr(res, e); }
});

router.delete('/tags/:id', async (req, res) => {
  try {
    res.json(await crm.deleteTag(req.params.id, req.workspaceId));
  } catch (e) { dbErr(res, e); }
});

router.post('/tags/merge', async (req, res) => {
  try {
    res.json(await crm.mergeTags(req.body.sourceTagId, req.body.targetTagId, req.workspaceId));
  } catch (e) { dbErr(res, e); }
});

// ── CRM Settings (Tier 2 fix 8) ─────────────────────────────────────────────
// The Settings page's Save button used to flip local state and nothing else,
// while the inputs showed hardcoded defaults. Settings now persist in a
// CrmSettings row (one per workspace). A workspace with no row gets blanks,
// never invented defaults.
const CRM_SETTINGS_STRING_FIELDS = ['crmName', 'defaultCurrency', 'fiscalYearStart', 'dealStageLabels', 'adminEmail', 'defaultRole'] as const;
const CRM_SETTINGS_BOOL_FIELDS = ['notifyNewLead', 'notifyDealWon', 'notifyDealLost', 'weeklyDigest'] as const;

router.get('/settings', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const row = await db.crmSettings.findUnique({ where: { workspaceId: req.workspaceId } });
    if (row) return res.json(row);
    res.json({
      workspaceId: req.workspaceId,
      crmName: null,
      defaultCurrency: null,
      fiscalYearStart: null,
      dealStageLabels: null,
      adminEmail: null,
      defaultRole: null,
      notifyNewLead: false,
      notifyDealWon: false,
      notifyDealLost: false,
      weeklyDigest: false,
    });
  } catch (e) { dbErr(res, e); }
});

router.put('/settings', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const data: Record<string, unknown> = {};
    for (const f of CRM_SETTINGS_STRING_FIELDS) {
      const v = req.body?.[f];
      if (v !== undefined) {
        if (v !== null && typeof v !== 'string') return res.status(400).json({ error: `${f} must be a string or null` });
        data[f] = v === '' ? null : v;
      }
    }
    for (const f of CRM_SETTINGS_BOOL_FIELDS) {
      const v = req.body?.[f];
      if (v !== undefined) {
        if (typeof v !== 'boolean') return res.status(400).json({ error: `${f} must be a boolean` });
        data[f] = v;
      }
    }
    const row = await db.crmSettings.upsert({
      where: { workspaceId: req.workspaceId },
      create: { workspaceId: req.workspaceId!, ...data },
      update: data,
    });
    res.json(row);
  } catch (e) { dbErr(res, e); }
});

// ── Bulk Actions ──────────────────────────────────────────────────────────────
// Record one history row per completed bulk run. Recording is best-effort:
// it must never fail the bulk response itself, so failures log and move on.
// status is derived from the counts: completed (nothing failed), partial
// (some failed), failed (nothing succeeded).
async function recordBulkAction(db: any, row: {
  workspaceId: string;
  type: string;
  label: string;
  targetCount: number;
  successCount: number;
  failedCount: number;
  createdBy?: string | null;
}) {
  const status = row.failedCount === 0 ? 'completed' : row.successCount === 0 ? 'failed' : 'partial';
  try {
    await db.bulkAction.create({ data: { ...row, status, completedAt: new Date() } });
  } catch (err) {
    console.error('[bulk-actions] failed to record bulk action', err);
  }
}

router.get('/bulk-actions', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.bulkAction.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }));
  } catch (e) { dbErr(res, e); }
});

router.post('/bulk', async (req, res) => {
  try {
    const { action, contactIds, payload } = BulkActionSchema.parse(req.body);
    const result = await crm.bulkContacts(req.workspaceId, action, contactIds, payload);
    const { db } = await import('../../infrastructure/database/client.js');
    if ('csv' in result) {
      const csv = result.csv ?? '';
      const exported = csv.split('\n').length - 1; // header row excluded
      await recordBulkAction(db, {
        workspaceId: req.workspaceId!,
        type: 'export',
        label: `Export ${exported} contact${exported === 1 ? '' : 's'} (CSV)`,
        targetCount: contactIds.length,
        successCount: exported,
        failedCount: contactIds.length - exported,
        createdBy: req.userId ?? null,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      return res.send(csv);
    }
    const affected = typeof result.affected === 'number' ? result.affected : contactIds.length;
    const label =
      action === 'tag' ? `Add tag: ${payload?.tag ?? ''} — ${affected} contact${affected === 1 ? '' : 's'}` :
      action === 'delete' ? `Delete ${affected} contact${affected === 1 ? '' : 's'}` :
      action === 'assign' ? `Assign ${affected} contact${affected === 1 ? '' : 's'}` :
      `Bulk ${action} — ${affected} contact${affected === 1 ? '' : 's'}`;
    await recordBulkAction(db, {
      workspaceId: req.workspaceId!,
      type: action,
      label,
      targetCount: contactIds.length,
      successCount: affected,
      failedCount: contactIds.length - affected,
      createdBy: req.userId ?? null,
    });
    res.json(result);
  } catch (e) { dbErr(res, e); }
});

// Bulk email — creates a REAL email-marketing campaign draft addressed to the
// selected contacts and returns it, so the UI can open the editor. Nothing
// is sent here; the draft waits in Email Marketing until the user finishes
// and sends it. Creating campaigns requires the Complete plan (enforced by
// createCampaign via assertPlan) — a below-Complete workspace gets a 403
// with code PLAN_REQUIRED, never a fake success toast.
router.post('/bulk-email', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const contactIds = req.body?.contactIds;
    if (!Array.isArray(contactIds) || contactIds.length === 0 || contactIds.some((id) => typeof id !== 'string' || !id.trim())) {
      return res.status(400).json({ error: 'contactIds (a non-empty array of contact ids) is required' });
    }
    const contacts = await db.contact.findMany({
      where: { id: { in: contactIds }, workspaceId: req.workspaceId },
      select: { id: true, email: true },
    });
    const withEmail = contacts.filter((c) => typeof c.email === 'string' && c.email.includes('@'));
    if (withEmail.length === 0) {
      return res.status(400).json({ error: 'None of the selected contacts have an email address.' });
    }
    const { createCampaign } = await import('../services/email-marketing/campaigns.service.js');
    const campaign = await createCampaign(req.workspaceId!, {
      name: `Bulk email — ${withEmail.length} contact${withEmail.length === 1 ? '' : 's'}`,
      subject: '',
      blockJson: {},
    });
    await db.campaignRecipient.createMany({
      data: withEmail.map((c) => ({ campaignId: campaign.id, contactId: c.id, status: 'PENDING' })),
    });
    const skippedNoEmail = contacts.length - withEmail.length;
    await recordBulkAction(db, {
      workspaceId: req.workspaceId!,
      type: 'bulk_email',
      label: `Bulk email draft — ${withEmail.length} contact${withEmail.length === 1 ? '' : 's'}${skippedNoEmail > 0 ? `, ${skippedNoEmail} without email` : ''}`,
      targetCount: contacts.length,
      successCount: withEmail.length,
      failedCount: skippedNoEmail,
      createdBy: req.userId ?? null,
    });
    res.status(201).json({
      campaignId: campaign.id,
      name: campaign.name,
      recipientCount: withEmail.length,
      skippedNoEmail,
    });
  } catch (e: any) {
    if (e?.code === 'PLAN_REQUIRED') {
      return res.status(403).json({ error: e.message, code: 'PLAN_REQUIRED', requiredPlan: 'complete' });
    }
    dbErr(res, e);
  }
});

// Bulk SMS — sends a real SMS to each selected contact through the same
// Twilio path the Conversations UI uses (dispatchOutboundMessage). The
// Twilio connection is checked FIRST: with none connected the endpoint
// fails fast and creates zero conversations and zero message rows. Each
// contact gets its own conversation + outbound message row; a contact with
// no phone is skipped (counted, no row). Per-contact send failures are
// counted, never swallowed — the message row is marked failed by dispatch.
router.post('/bulk-sms', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const contactIds = req.body?.contactIds;
    const message = req.body?.message;
    if (!Array.isArray(contactIds) || contactIds.length === 0 || contactIds.some((id) => typeof id !== 'string' || !id.trim())) {
      return res.status(400).json({ error: 'contactIds (a non-empty array of contact ids) is required' });
    }
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    const twilioConn = await db.channelConnection.findFirst({
      where: { workspaceId: req.workspaceId, provider: 'twilio', isActive: true },
    });
    if (!twilioConn) {
      return res.status(400).json({ error: 'No active Twilio connection found. Please connect Twilio in Settings > Integrations to send SMS.' });
    }
    const contacts = await db.contact.findMany({
      where: { id: { in: contactIds }, workspaceId: req.workspaceId },
      select: { id: true, phone: true },
    });
    const { dispatchOutboundMessage } = await import('./business.routes.js');
    const biz = await import('../services/business.service.js');
    const results: { contactId: string; status: 'sent' | 'failed' | 'skipped'; error?: string }[] = [];
    for (const contact of contacts) {
      if (!contact.phone) {
        results.push({ contactId: contact.id, status: 'skipped', error: 'No phone number.' });
        continue;
      }
      const convo = await db.conversation.create({
        data: { workspaceId: req.workspaceId!, contactId: contact.id, channel: 'sms', status: 'open', unreadCount: 0 },
      });
      const msg = await biz.sendConversationMessage(convo.id, message.trim(), req.userId ?? 'agent', 'outbound');
      try {
        await dispatchOutboundMessage({
          workspaceId: req.workspaceId!,
          conversationId: convo.id,
          messageId: msg.id,
          channel: 'sms',
          body: message.trim(),
        });
        results.push({ contactId: contact.id, status: 'sent' });
      } catch (err: any) {
        results.push({ contactId: contact.id, status: 'failed', error: err.message });
      }
    }
    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    await recordBulkAction(db, {
      workspaceId: req.workspaceId!,
      type: 'bulk_sms',
      label: `Bulk SMS — ${sent} sent, ${failed} failed, ${skipped} skipped`,
      targetCount: contacts.length,
      successCount: sent,
      failedCount: failed + skipped,
      createdBy: req.userId ?? null,
    });
    res.json({
      sent,
      failed,
      skipped,
      results,
    });
  } catch (e) { dbErr(res, e); }
});

// ── Import ────────────────────────────────────────────────────────────────────
router.get('/import/template', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send('first_name,last_name,email,phone,company_name,status\nJohn,Doe,john@example.com,+15551234567,Acme Corp,lead');
});

router.post(['/import', '/contacts/import'], async (req, res) => {
  try {
    const contacts = req.body.contacts || req.body.rows || [];
    const tags = req.body.tags || [];
    res.json(await crm.importContacts(req.workspaceId, contacts, tags));
  } catch (e) { dbErr(res, e); }
});

// ── Attachments ───────────────────────────────────────────────────────────────
router.get('/attachments', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    const where: any = { workspaceId: req.workspaceId };
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.entityId) where.entityId = String(req.query.entityId);
    res.json(await db.attachment.findMany({ where, orderBy: { createdAt: 'desc' } }));
  } catch (e) { dbErr(res, e); }
});

router.post('/attachments', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.attachment.create({
      data: { ...req.body, workspaceId: req.workspaceId },
    }));
  } catch (e) { dbErr(res, e); }
});

router.delete('/attachments/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await db.attachment.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { dbErr(res, e); }
});

// ── Smart Lists ───────────────────────────────────────────────────────────────
router.get('/smart-lists', async (req, res) => {
  try { res.json(await crm.listSmartLists(req.workspaceId)); }
  catch (e) { dbErr(res, e); }
});

router.post('/smart-lists', async (req, res) => {
  try { res.json(await crm.createSmartList(req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
});

router.put('/smart-lists/:id', async (req, res) => {
  try { res.json(await crm.updateSmartList(req.params.id, req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
});

router.delete('/smart-lists/:id', async (req, res) => {
  try { res.json(await crm.deleteSmartList(req.params.id, req.workspaceId)); }
  catch (e) { dbErr(res, e); }
});

router.get('/smart-lists/:id/contacts', async (req, res) => {
  try { 
    const { page, limit } = req.query as Record<string, string>;
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(String(limit)) || 50));
    res.json(await crm.getSmartListContacts(req.params.id, req.workspaceId, parsedPage, parsedLimit)); 
  }
  catch (e) { dbErr(res, e); }
});

export default router;
