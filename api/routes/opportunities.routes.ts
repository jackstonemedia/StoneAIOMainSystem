import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import * as oppService from '../services/opportunities.service.js';
import {
  OpportunityCreateSchema,
  OpportunityUpdateSchema,
  OpportunityBulkActionSchema,
  OpportunityImportSchema,
  PipelineCreateSchema,
  PipelineUpdateSchema,
  StageCreateSchema,
  StageUpdateSchema,
  LineItemSchema,
  CustomFieldSchema,
  WonLostReasonSchema,
  SavedViewSchema,
} from '../schemas/opportunities.schema.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const sendErr = (res: Response, e: unknown) => {
  console.error('[Opportunities API]', e);
  if (e instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: e.flatten() });
  }
  const statusCode = (e as any)?.statusCode || 500;
  const missingFields = (e as any)?.missingFields;
  const message = e instanceof Error ? e.message : String(e);
  res.status(statusCode).json({ error: message, missingFields });
};

// ── Opportunities CRUD ─────────────────────────────────────────────────────────

// GET /api/opportunities
router.get('/', async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const params: oppService.ListOpportunitiesParams = {
      pipelineId: q.pipelineId,
      stageId: q.stageId,
      search: q.search,
      status: q.status,
      ownerId: q.ownerId,
      tags: q.tags ? q.tags.split(',') : undefined,
      minValue: q.minValue ? parseFloat(q.minValue) : undefined,
      maxValue: q.maxValue ? parseFloat(q.maxValue) : undefined,
      source: q.source,
      createdStartDate: q.createdStartDate,
      createdEndDate: q.createdEndDate,
      closeStartDate: q.closeStartDate,
      closeEndDate: q.closeEndDate,
      sortBy: q.sortBy,
      sortOrder: (q.sortOrder === 'asc' || q.sortOrder === 'desc') ? q.sortOrder : undefined,
      page: q.page ? parseInt(q.page) : 1,
      limit: q.limit ? parseInt(q.limit) : 50,
    };
    const result = await oppService.listOpportunities(req.workspaceId!, params);
    res.json(result);
  } catch (e) {
    sendErr(res, e);
  }
});

// GET /api/opportunities/export
router.get('/export', async (req: Request, res: Response) => {
  try {
    const csv = await oppService.exportOpportunities(req.workspaceId!, req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="opportunities.csv"');
    res.send(csv);
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/import
router.post('/import', validate({ body: OpportunityImportSchema }), async (req: Request, res: Response) => {
  try {
    const { rows, columnMap, pipelineId, stageId, defaultTags } = req.body;
    const result = await oppService.importOpportunities(
      req.workspaceId!,
      req.userId || 'system',
      rows,
      columnMap,
      pipelineId,
      stageId,
      defaultTags
    );
    res.json(result);
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/bulk
router.post('/bulk', validate({ body: OpportunityBulkActionSchema }), async (req: Request, res: Response) => {
  try {
    const { action, opportunityIds, payload } = req.body;
    const result = await oppService.bulkOpportunities(
      req.workspaceId!,
      req.userId || 'system',
      action,
      opportunityIds,
      payload
    );
    if ('csv' in result && typeof result.csv === 'string') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="opportunities-selected.csv"');
      return res.send(result.csv);
    }
    res.json(result);
  } catch (e) {
    sendErr(res, e);
  }
});

// GET /api/opportunities/pipelines
router.get('/pipelines', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listPipelines(req.workspaceId!));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/pipelines
router.post('/pipelines', validate({ body: PipelineCreateSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createPipeline(req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/pipelines/:id
router.put('/pipelines/:id', validate({ body: PipelineUpdateSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updatePipeline(req.params.id, req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/pipelines/:id
router.delete('/pipelines/:id', async (req: Request, res: Response) => {
  try {
    const reassignmentStageId = req.query.reassignmentStageId as string;
    await oppService.deletePipeline(req.params.id, req.workspaceId!, reassignmentStageId);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/pipelines/:id/stages/reorder
router.put('/pipelines/:id/stages/reorder', async (req: Request, res: Response) => {
  try {
    const { stageIds } = req.body;
    if (!Array.isArray(stageIds)) return res.status(400).json({ error: 'stageIds array is required' });
    res.json(await oppService.reorderStages(req.params.id, stageIds));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/pipelines/:id/stages
router.post('/pipelines/:id/stages', validate({ body: StageCreateSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createStage(req.params.id, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/stages/:stageId
router.put('/stages/:stageId', validate({ body: StageUpdateSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updateStage(req.params.stageId, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/stages/:stageId
router.delete('/stages/:stageId', async (req: Request, res: Response) => {
  try {
    const reassignmentStageId = req.query.reassignmentStageId as string;
    await oppService.deleteStage(req.params.stageId, reassignmentStageId);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Won / Lost Reasons ─────────────────────────────────────────────────────────

// GET /api/opportunities/reasons
router.get('/reasons', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listWonLostReasons(req.workspaceId!, req.query.pipelineId as string));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/reasons
router.post('/reasons', validate({ body: WonLostReasonSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createWonLostReason(req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/reasons/:id
router.put('/reasons/:id', validate({ body: WonLostReasonSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updateWonLostReason(req.params.id, req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/reasons/:id
router.delete('/reasons/:id', async (req: Request, res: Response) => {
  try {
    await oppService.deleteWonLostReason(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Custom Fields ─────────────────────────────────────────────────────────────

// GET /api/opportunities/custom-fields
router.get('/custom-fields', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listCustomFields(req.workspaceId!, req.query.pipelineId as string));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/custom-fields
router.post('/custom-fields', validate({ body: CustomFieldSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createCustomField(req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/custom-fields/reorder
router.put('/custom-fields/reorder', async (req: Request, res: Response) => {
  try {
    const { fieldIds } = req.body;
    if (!Array.isArray(fieldIds)) return res.status(400).json({ error: 'fieldIds array is required' });
    res.json(await oppService.reorderCustomFields(req.workspaceId!, fieldIds));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/custom-fields/:id
router.put('/custom-fields/:id', validate({ body: CustomFieldSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updateCustomField(req.params.id, req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/custom-fields/:id
router.delete('/custom-fields/:id', async (req: Request, res: Response) => {
  try {
    await oppService.deleteCustomField(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Tags ───────────────────────────────────────────────────────────────────────

// GET /api/opportunities/tags
router.get('/tags', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listTags(req.workspaceId!));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/tags
router.post('/tags', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createTag(req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/tags/:id
router.put('/tags/:id', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updateTag(req.params.id, req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/tags/:id
router.delete('/tags/:id', async (req: Request, res: Response) => {
  try {
    await oppService.deleteTag(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/tags/merge
router.post('/tags/merge', async (req: Request, res: Response) => {
  try {
    const { sourceTagId, targetTagId } = req.body;
    if (!sourceTagId || !targetTagId) return res.status(400).json({ error: 'sourceTagId and targetTagId required' });
    res.json(await oppService.mergeTags(req.workspaceId!, sourceTagId, targetTagId));
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Saved Views ────────────────────────────────────────────────────────────────

// GET /api/opportunities/saved-views
router.get('/saved-views', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listSavedViews(req.workspaceId!, req.query.pipelineId as string));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/saved-views
router.post('/saved-views', validate({ body: SavedViewSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.createSavedView(req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/saved-views/:id
router.put('/saved-views/:id', validate({ body: SavedViewSchema }), async (req: Request, res: Response) => {
  try {
    res.json(await oppService.updateSavedView(req.params.id, req.workspaceId!, req.body));
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/saved-views/:id
router.delete('/saved-views/:id', async (req: Request, res: Response) => {
  try {
    await oppService.deleteSavedView(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Single Opportunity Endpoints ───────────────────────────────────────────────

// GET /api/opportunities/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const opp = await oppService.getOpportunity(req.params.id, req.workspaceId!);
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(opp);
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities
router.post('/', validate({ body: OpportunityCreateSchema }), async (req: Request, res: Response) => {
  try {
    const opp = await oppService.createOpportunity(req.workspaceId!, req.userId || 'system', req.body);
    res.status(201).json(opp);
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/:id
router.put('/:id', validate({ body: OpportunityUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const opp = await oppService.updateOpportunity(req.params.id, req.workspaceId!, req.userId || 'system', req.body);
    res.json(opp);
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/:id/duplicate
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const opp = await oppService.duplicateOpportunity(req.params.id, req.workspaceId!, req.userId || 'system');
    res.status(201).json(opp);
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/:id/move-pipeline
router.post('/:id/move-pipeline', async (req: Request, res: Response) => {
  try {
    const { pipelineId, stageId } = req.body;
    if (!pipelineId) return res.status(400).json({ error: 'pipelineId is required' });
    const opp = await oppService.moveOpportunityPipeline(req.params.id, req.workspaceId!, req.userId || 'system', pipelineId, stageId);
    res.json(opp);
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await oppService.deleteOpportunity(req.params.id, req.workspaceId!);
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

// ── Line Items ─────────────────────────────────────────────────────────────────

// GET /api/opportunities/:id/line-items
router.get('/:id/line-items', async (req: Request, res: Response) => {
  try {
    res.json(await oppService.listLineItems(req.params.id));
  } catch (e) {
    sendErr(res, e);
  }
});

// POST /api/opportunities/:id/line-items
router.post('/:id/line-items', validate({ body: LineItemSchema }), async (req: Request, res: Response) => {
  try {
    const item = await oppService.createLineItem(req.params.id, req.workspaceId!, req.userId || 'system', req.body);
    res.status(201).json(item);
  } catch (e) {
    sendErr(res, e);
  }
});

// PUT /api/opportunities/:id/line-items/:itemId
router.put('/:id/line-items/:itemId', validate({ body: LineItemSchema }), async (req: Request, res: Response) => {
  try {
    const item = await oppService.updateLineItem(req.params.itemId, req.params.id, req.workspaceId!, req.userId || 'system', req.body);
    res.json(item);
  } catch (e) {
    sendErr(res, e);
  }
});

// DELETE /api/opportunities/:id/line-items/:itemId
router.delete('/:id/line-items/:itemId', async (req: Request, res: Response) => {
  try {
    await oppService.deleteLineItem(req.params.itemId, req.params.id, req.workspaceId!, req.userId || 'system');
    res.json({ success: true });
  } catch (e) {
    sendErr(res, e);
  }
});

export default router;
