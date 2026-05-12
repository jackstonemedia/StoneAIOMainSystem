import { Router } from 'express';
import { db } from '../infrastructure/database/client.js';
import { ensureAPProject } from './services/ap-workspace-sync.service.js';
import {
  getAPFlow, createAPFlow, updateAPFlow,
  publishAPFlow, disableAPFlow, deleteAPFlow, duplicateAPFlow,
  listAPFlowRuns, getAPFlowRun, triggerAPTestRun,
  listAPPieces, getAPPiece, getAPWebhookUrl, getAPDynamicOptions,
  listAPConnections, createAPConnection, deleteAPConnection,
} from './services/activepieces.service.js';

const router = Router();


function deriveTriggerType(trigger?: any): string | null {
  if (!trigger) return null;
  const piece = trigger.settings?.pieceName ?? '';
  if (piece.includes('schedule')) return 'schedule';
  if (piece.includes('webhook')) return 'webhook';
  if (trigger.type === 'PIECE') return 'app_event';
  return 'manual';
}

// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOWS CRUD
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows — List all workflows for workspace
router.get('/', async (req, res) => {
  try {
    const { status, triggerType, search, cursor, limit = '20' } = req.query as Record<string, string>;

    const where: any = { workspaceId: req.workspaceId };
    if (status) where.status = status;
    if (triggerType) where.triggerType = triggerType;
    if (search) where.name = { contains: search };

    const workflows = await db.workflow.findMany({
      where,
      take: parseInt(limit),
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ data: workflows, total: workflows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// FOLDERS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/folders
router.get('/folders', async (req, res) => {
  try {
    const folders = await db.automationFolder.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(folders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/folders
router.post('/folders', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Folder name required' });
    const folder = await db.automationFolder.create({
      data: { workspaceId: req.workspaceId, name: name.trim() },
    });
    res.status(201).json(folder);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/workflows/folders/:id
router.patch('/folders/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const folder = await db.automationFolder.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    const updated = await db.automationFolder.update({
      where: { id: folder.id },
      data: { name },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/workflows/folders/:id
router.delete('/folders/:id', async (req, res) => {
  try {
    const folder = await db.automationFolder.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    // Move all flows in this folder to no folder
    await db.workflow.updateMany({
      where: { folderId: folder.id },
      data: { folderId: null },
    });
    await db.automationFolder.delete({ where: { id: folder.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL RUNS (across all workflows)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/runs — all runs across all workflows for workspace
router.get('/runs', async (req, res) => {
  try {
    const { flowId, status, limit = '50', page = '1' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { workspaceId: req.workspaceId };
    if (status && status !== 'ALL') where.status = status;
    if (flowId) where.workflowId = flowId;

    const [runs, total] = await Promise.all([
      db.workflowRun.findMany({
        where,
        include: { workflow: { select: { name: true, apFlowId: true } } },
        orderBy: { startedAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      db.workflowRun.count({ where }),
    ]);

    res.json({
      data: runs.map((r) => ({
        id: r.apRunId,
        localId: r.id,
        flowId: r.workflow.apFlowId,
        workflowId: r.workflowId,
        flowName: r.workflow.name,
        status: r.status,
        startTime: r.startedAt.toISOString(),
        finishTime: r.finishedAt?.toISOString(),
        duration: r.durationMs,
        stepCount: r.stepCount,
        errorMessage: r.errorMessage,
      })),
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PIECE CATALOG
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/pieces — All available pieces
router.get('/pieces', async (req, res) => {
  try {
    const { search, tags } = req.query as Record<string, string>;
    const pieces = await listAPPieces({
      searchQuery: search,
      tags: tags ? tags.split(',') : undefined,
    });
    res.json(pieces);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows/pieces/:pieceName — Single piece with full props schema
router.get('/pieces/:pieceName', async (req, res) => {
  try {
    const piece = await getAPPiece(decodeURIComponent(req.params.pieceName));
    res.json(piece);
  } catch (e: any) {
    res.status(404).json({ error: 'Piece not found' });
  }
});

// POST /api/workflows/pieces/:pieceName/options — Dynamic options
router.post('/pieces/:pieceName/options', async (req, res) => {
  try {
    const options = await getAPDynamicOptions(decodeURIComponent(req.params.pieceName), req.body);
    res.json(options);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// CONNECTIONS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/connections — List connections for workspace
router.get('/connections', async (req, res) => {
  try {
    const apProjectId = await ensureAPProject(req.workspaceId);
    const { pieceName } = req.query as Record<string, string>;
    const { data: connections } = await listAPConnections(apProjectId, pieceName);
    res.json(connections);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/connections — Create connection
router.post('/connections', async (req, res) => {
  try {
    const apProjectId = await ensureAPProject(req.workspaceId);
    const { pieceName, name, type, value } = req.body;

    const connection = await createAPConnection(apProjectId, { pieceName, name, type, value });

    // Mirror in local DB
    await db.aPConnection.upsert({
      where: { apConnectionId: connection.id } as any,
      update: { status: 'active', displayName: name },
      create: {
        workspaceId: req.workspaceId,
        apConnectionId: connection.id,
        pieceName,
        displayName: name,
        status: 'active',
      },
    });

    res.status(201).json(connection);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/workflows/connections/:connectionId
router.delete('/connections/:connectionId', async (req, res) => {
  try {
    await deleteAPConnection(req.params.connectionId);
    await db.aPConnection.deleteMany({ where: { apConnectionId: req.params.connectionId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows/:id — Get single workflow with full AP flow data
router.get('/:id', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    // Fetch live AP flow data (includes full step config)
    const apFlow = await getAPFlow(workflow.apFlowId);

    res.json({ ...workflow, apFlow });
  } catch (e: any) {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

// POST /api/workflows — Create new workflow
router.post('/', async (req, res) => {
  try {
    const { name = 'Untitled Workflow', description } = req.body;

    // 1. Ensure AP project exists for this workspace
    const apProjectId = await ensureAPProject(req.workspaceId);

    // 2. Create flow in AP
    const apFlow = await createAPFlow(apProjectId, name);

    // 3. Save reference in our DB
    const workflow = await db.workflow.create({
      data: {
        workspaceId: req.workspaceId,
        apFlowId: apFlow.id,
        apProjectId,
        apVersionId: apFlow.version?.id,
        name,
        description,
        status: 'draft',
      },
    });

    res.status(201).json({ ...workflow, apFlow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/workflows/:id — Update workflow (name, flow definition, trigger, etc.)
router.put('/:id', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const { name, description, trigger, tags } = req.body;

    // Update AP flow (displayName, trigger)
    const updatePayload: any = {};
    if (name) updatePayload.displayName = name;
    if (trigger) updatePayload.trigger = trigger;

    let apFlow;
    if (Object.keys(updatePayload).length > 0) {
      apFlow = await updateAPFlow(workflow.apFlowId, updatePayload);
    }

    // Update local record
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: {
        name: name ?? workflow.name,
        description: description ?? workflow.description,
        tags: tags ? JSON.stringify(tags) : workflow.tags,
        apVersionId: apFlow?.version?.id ?? workflow.apVersionId,
        triggerType: trigger ? deriveTriggerType(trigger) : workflow.triggerType,
        triggerPieceName: trigger?.settings?.pieceName ?? workflow.triggerPieceName,
        webhookUrl: trigger?.settings?.pieceName?.includes('webhook')
          ? await getAPWebhookUrl(workflow.apFlowId)
          : workflow.webhookUrl,
      },
    });

    res.json({ ...updated, apFlow });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    await deleteAPFlow(workflow.apFlowId);
    await db.workflow.delete({ where: { id: workflow.id } });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/publish — Go live
router.post('/:id/publish', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const apFlow = await publishAPFlow(workflow.apFlowId);
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: { status: 'published', apVersionId: apFlow.version?.id },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/disable — Pause/disable
router.post('/:id/disable', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    await disableAPFlow(workflow.apFlowId);
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: { status: 'paused' },
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const apFlow = await duplicateAPFlow(workflow.apFlowId);

    const newWorkflow = await db.workflow.create({
      data: {
        workspaceId: req.workspaceId,
        apFlowId: apFlow.id,
        apProjectId: workflow.apProjectId,
        apVersionId: apFlow.version?.id,
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        status: 'draft',
        triggerType: workflow.triggerType,
        triggerPieceName: workflow.triggerPieceName,
      },
    });

    res.status(201).json(newWorkflow);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// FLOW RUNS
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/workflows/:id/test — Trigger a test run
router.post('/:id/test', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const run = await triggerAPTestRun(workflow.apFlowId, req.body.payload ?? {});
    res.json(run);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows/:id/runs
router.get('/:id/runs', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const apProjectId = await ensureAPProject(req.workspaceId);
    const { data: runs } = await listAPFlowRuns(apProjectId, {
      flowId: workflow.apFlowId,
      limit: parseInt((req.query.limit as string) ?? '20'),
    });

    // Upsert runs to local DB for persistence + search
    for (const run of runs) {
      await db.workflowRun.upsert({
        where: { apRunId: run.id } as any,
        update: {
          status: run.status,
          durationMs: run.duration ?? null,
          finishedAt: run.finishTime ? new Date(run.finishTime) : null,
          errorMessage: run.status === 'FAILED'
            ? Object.values(run.steps ?? {}).find((s: any) => s.errorMessage)?.errorMessage ?? null
            : null,
        },
        create: {
          workspaceId: req.workspaceId,
          workflowId: workflow.id,
          apRunId: run.id,
          status: run.status,
          durationMs: run.duration ?? null,
          stepCount: Object.keys(run.steps ?? {}).length,
          startedAt: new Date(run.startTime),
          finishedAt: run.finishTime ? new Date(run.finishTime) : null,
        },
      });
    }

    // Fetch all runs from DB to ensure mock runs are included
    const dbRuns = await db.workflowRun.findMany({
      where: { workflowId: workflow.id },
      orderBy: { startedAt: 'desc' },
      take: parseInt((req.query.limit as string) ?? '20'),
    });

    // Format them to match the APFlowRun interface expected by the frontend
    const formattedRuns = dbRuns.map(run => ({
      id: run.apRunId,
      flowId: workflow.apFlowId,
      projectId: apProjectId,
      status: run.status,
      startTime: run.startedAt.toISOString(),
      finishTime: run.finishedAt?.toISOString(),
      duration: run.durationMs,
      steps: {}, // Full steps are fetched individually
    }));

    res.json({ data: formattedRuns });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows/:id/runs/:runId — Full step details
router.get('/:id/runs/:runId', async (req, res) => {
  try {
    const run = await getAPFlowRun(req.params.runId);
    res.json(run);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/test — Trigger a test run
router.post('/:id/test', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const run = await triggerAPTestRun(workflow.apFlowId, req.body.payload ?? {});
    
    // Save the test run immediately so it appears in history
    await db.workflowRun.upsert({
      where: { apRunId: run.id } as any,
      update: {
        status: run.status,
        durationMs: run.duration ?? null,
        finishedAt: run.finishTime ? new Date(run.finishTime) : null,
        errorMessage: run.status === 'FAILED'
          ? Object.values(run.steps ?? {}).find((s: any) => s.errorMessage)?.errorMessage ?? null
          : null,
      },
      create: {
        workspaceId: req.workspaceId,
        workflowId: workflow.id,
        apRunId: run.id,
        status: run.status,
        durationMs: run.duration ?? null,
        stepCount: Object.keys(run.steps ?? {}).length,
        startedAt: new Date(run.startTime),
        finishedAt: run.finishTime ? new Date(run.finishTime) : null,
      },
    });

    res.json(run);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/workflows/:id/favorite — toggle star/favorite
router.patch('/:id/favorite', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: { isFavorite: !workflow.isFavorite },
    });
    res.json({ id: updated.id, isFavorite: updated.isFavorite });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/workflows/:id/folder — move to folder (or remove from folder)
router.patch('/:id/folder', async (req, res) => {
  try {
    const { folderId } = req.body as { folderId: string | null };
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    // Validate folder belongs to workspace if provided
    if (folderId) {
      await db.automationFolder.findFirstOrThrow({
        where: { id: folderId, workspaceId: req.workspaceId },
      });
    }
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: { folderId: folderId ?? null },
    });
    res.json({ id: updated.id, folderId: updated.folderId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

