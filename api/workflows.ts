import { Router } from 'express';
import { db } from '../infrastructure/database/client.js';

const router = Router();




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
        include: { workflow: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      db.workflowRun.count({ where }),
    ]);

    res.json({
      data: runs.map((r) => ({
        localId: r.id,
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
// NATIVE: CREDENTIALS & WEBHOOKS & TEMPLATES (Must be before /:id)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows/webhooks
router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await db.workflowWebhook.findMany({
      where: { workspaceId: req.workspaceId },
      include: { workflow: { select: { name: true } } }
    });
    res.json(webhooks);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows/webhooks/:webhookId/test
router.post('/webhooks/:webhookId/test', async (req, res) => {
  try {
    const hook = await db.workflowWebhook.findUnique({
      where: { id: req.params.webhookId, workspaceId: req.workspaceId }
    });
    if (!hook) return res.status(404).json({ error: 'Not found' });
    
    const { queueService } = await import('./services/workflow-engine/queue.service.js');
    await queueService.enqueue({
      workspaceId: req.workspaceId!,
      workflowId: hook.workflowId,
      triggerData: req.body,
      mode: 'test'
    });
    
    res.json({ success: true, message: 'Test payload queued' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/credentials
router.get('/credentials', async (req, res) => {
  try {
    const creds = await (db as any).workflowCredential?.findMany({
      where: { workspaceId: req.workspaceId },
      select: { id: true, name: true, type: true, createdAt: true, updatedAt: true } // Exclude encryptedData
    }) ?? [];
    res.json(creds);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows/credentials
router.post('/credentials', async (req, res) => {
  try {
    const { name, type, data } = req.body;
    
    // Encrypt data
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from((process.env.ENCRYPTION_KEY || '12345678901234567890123456789012').substring(0, 32));
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedData = `${iv.toString('hex')}:${encrypted}`;
    
    const cred = await (db as any).workflowCredential?.create({
      data: {
        workspaceId: req.workspaceId,
        name,
        type,
        encryptedData
      }
    });
    res.json({ id: cred?.id, name, type });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflows/credentials/:id
router.delete('/credentials/:id', async (req, res) => {
  try {
    await (db as any).workflowCredential?.delete({
      where: { id: req.params.id, workspaceId: req.workspaceId }
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await db.workflow.findMany({
      where: { isSystem: true, status: 'published' }
    });
    res.json(templates);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows/from-template/:templateId
router.post('/from-template/:templateId', async (req, res) => {
  try {
    const template = await db.workflow.findUnique({
      where: { id: req.params.templateId }
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    
    const tplDef = await db.nativeWorkflowDefinition.findUnique({
      where: { workflowId: template.id }
    });
    
    const workflow = await db.workflow.create({
      data: {
        workspaceId: req.workspaceId!,
        name: `${template.name} (Copy)`,
        description: template.description,
        engineType: template.engineType,
        status: 'draft'
      }
    });
    
    if (tplDef) {
      await db.nativeWorkflowDefinition.create({
        data: {
          workflowId: workflow.id,
          nodesJson: tplDef.nodesJson,
          edgesJson: tplDef.edgesJson
        }
      });
    }
    
    res.json(workflow);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/:id — Get single workflow
router.get('/:id', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    res.json(workflow);
  } catch (e: any) {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

// POST /api/workflows — Create new workflow
router.post('/', async (req, res) => {
  try {
    const { name = 'Untitled Workflow', description } = req.body;

    const workflow = await db.workflow.create({
      data: {
        workspaceId: req.workspaceId!,
        name,
        description,
        status: 'draft',
      },
    });

    res.status(201).json(workflow);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/workflows/:id — Update workflow
router.put('/:id', async (req, res) => {
  try {
    const workflow = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const { name, description, trigger, tags } = req.body;

    // Update local record
    const updated = await db.workflow.update({
      where: { id: workflow.id },
      data: {
        name: name ?? workflow.name,
        description: description ?? workflow.description,
        tags: tags ? JSON.stringify(tags) : workflow.tags,
      },
    });

    res.json(updated);
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

    await db.workflow.delete({ where: { id: workflow.id } });

    res.json({ success: true });
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

// ═════════════════════════════════════════════════════════════════════════════
// NATIVE ENGINE ROUTES
// ═════════════════════════════════════════════════════════════════════════════

import { nodeRegistry } from './services/workflow-engine/node-runner.js';
import crypto from 'crypto';

// GET /api/workflows/:id/definition — Native workflow definition
router.get('/:id/definition', async (req, res) => {
  try {
    let def = await db.nativeWorkflowDefinition.findUnique({
      where: { workflowId: req.params.id }
    });
    
    if (!def) {
      def = await db.nativeWorkflowDefinition.create({
        data: {
          workflowId: req.params.id,
          nodesJson: JSON.stringify([{ id: 'trigger_1', type: 'manual', data: { config: {} }, position: { x: 250, y: 150 } }]),
          edgesJson: JSON.stringify([])
        }
      });
    }
    
    res.json({
      nodes: JSON.parse(def.nodesJson),
      edges: JSON.parse(def.edgesJson)
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/definition — Save native definition
router.post('/:id/definition', async (req, res) => {
  try {
    const { nodes, edges } = req.body;
    
    // Save definition
    await db.nativeWorkflowDefinition.upsert({
      where: { workflowId: req.params.id },
      update: { nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) },
      create: { workflowId: req.params.id, nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) }
    });
    
    // Process triggers to create subscriptions, webhooks, schedules
    const triggers = nodes.filter((n: any) => n.type.startsWith('trigger.'));
    
    // First, clear old triggers for this workflow
    await (db as any).workflowSchedule?.deleteMany({ where: { workflowId: req.params.id } });
    await (db as any).workflowWebhook?.deleteMany({ where: { workflowId: req.params.id } });
    await (db as any).crmTriggerSubscription?.deleteMany({ where: { workflowId: req.params.id } });
    
    for (const node of triggers) {
      if (node.type === 'trigger.schedule') {
        const cron = node.data.config?.cronExpression || '* * * * *';
        await (db as any).workflowSchedule?.create({
          data: { workspaceId: req.workspaceId!, workflowId: req.params.id, nodeId: node.id, cronExpr: cron, timezone: 'UTC', active: true }
        });
      } else if (node.type === 'trigger.webhook') {
        const method = node.data.config?.method || 'POST';
        const path = `/hook/${req.params.id}/${node.id}`; // Needs to be globally unique
        await (db as any).workflowWebhook?.create({
          data: { workspaceId: req.workspaceId!, workflowId: req.params.id, nodeId: node.id, method, path, active: true }
        });
      } else if (node.type === 'trigger.crm_event') {
        const eventStr = node.data.config?.event || 'contact.created';
        const [entityType, eventType] = eventStr.split('.');
        const filters = node.data.config?.filters || {};
        
        await (db as any).crmTriggerSubscription?.create({
          data: { workspaceId: req.workspaceId!, workflowId: req.params.id, nodeId: node.id, entityType, eventType, active: true, filtersJson: JSON.stringify(filters) }
        });
      }
    }
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/publish-native
router.post('/:id/publish-native', async (req, res) => {
  try {
    await db.workflow.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data: { status: 'published', engineType: 'native' }
    });
    
    // Reload schedules
    const { schedulerService } = await import('./services/workflow-engine/scheduler.service.js');
    await schedulerService.initialize();
    
    res.json({ success: true, status: 'published' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/pause-native
router.post('/:id/pause-native', async (req, res) => {
  try {
    await db.workflow.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data: { status: 'paused' }
    });
    
    // Reload schedules
    const { schedulerService } = await import('./services/workflow-engine/scheduler.service.js');
    await schedulerService.initialize();
    
    res.json({ success: true, status: 'paused' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/test-native
router.post('/:id/test-native', async (req, res) => {
  try {
    const { queueService } = await import('./services/workflow-engine/queue.service.js');
    const runId = await queueService.enqueue({
      workspaceId: req.workspaceId!,
      workflowId: req.params.id,
      triggerData: req.body.triggerData || {},
      mode: 'test'
    });
    
    res.json({ runId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/test-node
router.post('/:id/test-node', async (req, res) => {
  try {
    const { engineService } = await import('./services/workflow-engine/engine.service.js');
    const { nodeId, inputItems } = req.body;
    
    const def = await db.nativeWorkflowDefinition.findUniqueOrThrow({
      where: { workflowId: req.params.id }
    });
    
    const nodes = JSON.parse(def.nodesJson);
    const targetNode = nodes.find((n: any) => n.id === nodeId);
    if (!targetNode) throw new Error('Node not found');
    
    const start = Date.now();
    const result = await engineService.testNode(targetNode, inputItems || [{}], {
      workspaceId: req.workspaceId!,
      workflowId: req.params.id,
      runId: 'test_node_run',
      triggerData: {},
      variables: {},
      mode: 'test'
    });
    
    res.json({ output: result.output, duration: Date.now() - start });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/workflows/runs/:runId/detail — Full native run details
router.get('/runs/:runId/detail', async (req, res) => {
  try {
    const run = await db.workflowRun.findUnique({
      where: { id: req.params.runId, workspaceId: req.workspaceId }
    });
    if (!run) return res.status(404).json({ error: 'Run not found' });
    
    res.json({
      ...run,
      runData: run.runData ? JSON.parse(run.runData) : null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/nodes/catalog — List all registered native nodes
router.get('/nodes/catalog', (_req, res) => {
  try {
    const allNodes = nodeRegistry.getAll();
    const grouped = allNodes.reduce((acc: any, node) => {
      acc[node.category] = acc[node.category] || [];
      acc[node.category].push({
        type: node.type,
        displayName: node.displayName,
        description: node.description,
        iconName: node.iconName,
        color: node.color,
        configSchema: node.configSchema,
        outputHandles: node.outputHandles
      });
      return acc;
    }, {});
    
    res.json(Object.keys(grouped).map(k => ({ category: k, nodes: grouped[k] })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
