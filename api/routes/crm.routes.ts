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
import * as crm from '../services/crm.service.js';

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
    const { search, status, page, limit } = req.query as Record<string, string>;
    res.json(await crm.listContacts(req.workspaceId, { search, status, page: +page, limit: +limit }));
  } catch (e) { dbErr(res, e); }
});

router.post('/contacts', async (req, res) => {
  try {
    const v = ContactSchema.parse(req.body);
    res.json(await crm.createContact(req.workspaceId, v));
  } catch (e) { dbErr(res, e); }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const c = await crm.getContact(req.params.id, req.workspaceId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { dbErr(res, e); }
});

router.put('/contacts/:id', async (req, res) => {
  try { res.json(await crm.updateContact(req.params.id, req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
});

router.delete('/contacts/:id', async (req, res) => {
  try { await crm.deleteContact(req.params.id, req.workspaceId); res.json({ success: true }); }
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

router.post('/companies', async (req, res) => {
  try {
    const v = CompanySchema.parse(req.body);
    res.json(await crm.createCompany(req.workspaceId, v));
  } catch (e) { dbErr(res, e); }
});

router.get('/companies/:id', async (req, res) => {
  try {
    const c = await crm.getCompany(req.params.id, req.workspaceId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
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

// ── Deals ─────────────────────────────────────────────────────────────────────
router.get('/deals', async (req, res) => {
  try {
    res.json(await crm.listDeals(req.workspaceId, req.query as Record<string, string>));
  } catch (e) { dbErr(res, e); }
});

router.post('/deals', async (req, res) => {
  try {
    const v = DealSchema.parse(req.body);
    res.json(await crm.createDeal(req.workspaceId, req.userId!, v as any));
  } catch (e) { dbErr(res, e); }
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
  try { res.json(await crm.updateDeal(req.params.id, req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
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
    res.json(await db.pipelineStage.create({
      data: { pipelineId: req.params.id, name: req.body.name, color: req.body.color ?? '#cbd5e1', order: req.body.order ?? 0, probability: req.body.probability ?? 0 },
    }));
  } catch (e) { dbErr(res, e); }
});

router.put('/pipelines/:pipelineId/stages/:stageId', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.pipelineStage.update({ where: { id: req.params.stageId }, data: req.body }));
  } catch (e) { dbErr(res, e); }
});

router.delete('/pipelines/:pipelineId/stages/:stageId', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await db.pipelineStage.delete({ where: { id: req.params.stageId } });
    res.json({ success: true });
  } catch (e) { dbErr(res, e); }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    res.json(await crm.listTasks(req.workspaceId, req.query as Record<string, string>));
  } catch (e) { dbErr(res, e); }
});

router.post('/tasks', async (req, res) => {
  try {
    const v = TaskSchema.parse(req.body);
    res.json(await crm.createTask(req.workspaceId, v as any));
  } catch (e) { dbErr(res, e); }
});

router.put('/tasks/:id', async (req, res) => {
  try { res.json(await crm.updateTask(req.params.id, req.workspaceId, req.body)); }
  catch (e) { dbErr(res, e); }
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
    res.json(await db.activity.create({ data: { ...req.body, workspaceId: req.workspaceId } }));
  } catch (e) { dbErr(res, e); }
});

// ── Smart Lists ───────────────────────────────────────────────────────────────
router.get('/smart-lists', async (req, res) => {
  try { res.json(await crm.listSmartLists(req.workspaceId)); }
  catch (e) { dbErr(res, e); }
});

router.post('/smart-lists', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.smartList.create({
      data: { workspaceId: req.workspaceId, name: req.body.name, filtersJson: JSON.stringify(req.body.filters ?? []) },
    }));
  } catch (e) { dbErr(res, e); }
});

router.get('/smart-lists/:id/contacts', async (req, res) => {
  try {
    const result = await crm.getSmartListContacts(req.params.id, req.workspaceId);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e) { dbErr(res, e); }
});

router.put('/smart-lists/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.smartList.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data: { name: req.body.name, filtersJson: JSON.stringify(req.body.filters ?? []) },
    }));
  } catch (e) { dbErr(res, e); }
});

router.delete('/smart-lists/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    await db.smartList.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
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
    res.json(await db.customField.create({ data: { ...req.body, workspaceId: req.workspaceId } }));
  } catch (e) { dbErr(res, e); }
});

router.put('/custom-fields/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.customField.update({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: req.body }));
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
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.tag.findMany({ where: { workspaceId: req.workspaceId }, orderBy: { name: 'asc' } }));
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

// ── Bulk Actions ──────────────────────────────────────────────────────────────
router.post('/bulk', async (req, res) => {
  try {
    const { action, contactIds, payload } = BulkActionSchema.parse(req.body);
    const result = await crm.bulkContacts(req.workspaceId, action, contactIds, payload);
    if ('csv' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
      return res.send(result.csv);
    }
    res.json(result);
  } catch (e) { dbErr(res, e); }
});

// ── Import ────────────────────────────────────────────────────────────────────
router.get('/import/template', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send('first_name,last_name,email,phone,company_name,status\nJohn,Doe,john@example.com,+15551234567,Acme Corp,lead');
});

router.post('/import', async (req, res) => {
  try {
    res.json(await crm.importContacts(req.workspaceId, req.body.contacts ?? []));
  } catch (e) { dbErr(res, e); }
});

// ── Sequences ─────────────────────────────────────────────────────────────────
router.get('/sequences', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.sequence.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    }));
  } catch (e) { dbErr(res, e); }
});

router.put('/sequences/enrollments/:id', async (req, res) => {
  try {
    const { db } = await import('../../infrastructure/database/client.js');
    res.json(await db.sequenceEnrollment.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    }));
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
    const { page, limit } = req.query;
    res.json(await crm.getSmartListContacts(req.params.id, req.workspaceId, Number(page) || 1, Number(limit) || 50)); 
  }
  catch (e) { dbErr(res, e); }
});

export default router;
