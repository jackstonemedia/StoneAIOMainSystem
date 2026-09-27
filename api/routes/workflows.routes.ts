import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../../infrastructure/database/client.js';
import { nodeRegistry } from '../services/workflow-engine/node-runner.js';
import { encryptJson } from '../services/channels/encryption.js';

const router = Router();




// ═════════════════════════════════════════════════════════════════════════════
// WORKFLOWS CRUD
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/workflows — List all workflows for workspace
router.get('/', async (req, res) => {
  try {
    const { status, triggerType, search, limit = '20' } = req.query as Record<string, string>;

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
        id: r.id,
        localId: r.id,
        workflowId: r.workflowId,
        flowName: r.workflow.name,
        status: r.status,
        startTime: r.startedAt.toISOString(),
        finishTime: r.finishedAt?.toISOString(),
        duration: r.durationMs,
        stepCount: r.stepCount ?? (r.runData ? Object.keys(JSON.parse(r.runData)).length : 0),
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
    
    const { queueService } = await import('../services/workflow-engine/queue.service.js');
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
      select: { id: true, name: true, type: true, createdAt: true, updatedAt: true } // Exclude dataEncrypted
    }) ?? [];
    res.json(creds);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/workflows/credentials
router.post('/credentials', async (req, res) => {
  try {
    const { name, type, data } = req.body;
    
    if (!process.env.CHANNEL_ENCRYPTION_KEY) {
      return res.status(500).json({ error: 'No encryption key configured. Set CHANNEL_ENCRYPTION_KEY in your environment.' });
    }

    const encryptedData = encryptJson(data || {});
    
    const cred = await db.workflowCredential.create({
      data: {
        workspaceId: req.workspaceId,
        name,
        type,
        dataEncrypted: encryptedData
      }
    });
    res.json({ id: cred?.id, name, type });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/workflows/credentials/:id
router.delete('/credentials/:id', async (req, res) => {
  try {
    await db.workflowCredential.delete({
      where: { id: req.params.id, workspaceId: req.workspaceId }
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/workflows/templates
router.get('/templates', async (req, res) => {
  try {
    const templates = await db.workflowTemplate.findMany({
      where: { OR: [{ isSystem: true, workspaceId: null }, { workspaceId: req.workspaceId }] },
      select: {
        id: true, name: true, description: true, category: true,
        tags: true, thumbnailUrl: true, usageCount: true, isSystem: true,
        workspaceId: true, createdAt: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/templates/:templateId/install
router.post('/templates/:templateId/install', async (req, res) => {
  try {
    const { name } = req.body as { name?: string };

    const template = await db.workflowTemplate.findFirst({
      where: {
        id: req.params.templateId,
        OR: [{ isSystem: true, workspaceId: null }, { workspaceId: req.workspaceId }],
      },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const def = JSON.parse(template.definitionJson as string) as { nodes: any[]; edges: any[] };

    const workflow = await db.$transaction(async (tx) => {
      const wf = await tx.workflow.create({
        data: {
          workspaceId: req.workspaceId!,
          name: name?.trim() || template.name,
          description: template.description,
          engineType: 'native',
          status: 'draft',
        },
      });
      await tx.nativeWorkflowDefinition.create({
        data: {
          workflowId: wf.id,
          nodesJson: JSON.stringify(def.nodes),
          edgesJson: JSON.stringify(def.edges),
        },
      });
      return wf;
    });

    db.workflowTemplate.update({
      where: { id: template.id },
      data: { usageCount: { increment: 1 } },
    }).catch(() => {});

    res.status(201).json(workflow);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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
// GET /api/workflows/:id/runs — Run history for a specific workflow
router.get('/:id/runs', async (req, res) => {
  try {
    const runs = await db.workflowRun.findMany({
      where: { workflowId: req.params.id, workspaceId: req.workspaceId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    // Normalize for frontend: include id + compute stepCount from runData
    const data = runs.map((r) => ({
      ...r,
      stepCount: r.stepCount ?? (r.runData ? Object.keys(JSON.parse(r.runData)).length : 0),
    }));
    res.json({ data, total: runs.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
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

    const { name, description, tags } = req.body;

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

// POST /api/workflows/:id/duplicate — Deep-copy a workflow (canvas + definition)
router.post('/:id/duplicate', async (req, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const source = await db.workflow.findFirstOrThrow({
      where: { id: req.params.id, workspaceId },
      include: { nativeDefinition: true },
    });

    // Create the new workflow record in draft state
    const copy = await db.workflow.create({
      data: {
        workspaceId,
        name: `${source.name} (Copy)`,
        description: source.description,
        status: 'draft',
        engineType: source.engineType,
        triggerType: source.triggerType,
        folderId: source.folderId,
        tags: source.tags,
        variablesJson: source.variablesJson,
        settingsJson: source.settingsJson,
      },
    });

    // Deep-copy the canvas definition if one exists
    if (source.nativeDefinition) {
      await db.nativeWorkflowDefinition.create({
        data: {
          workflowId: copy.id,
          nodesJson: source.nativeDefinition.nodesJson,
          edgesJson: source.nativeDefinition.edgesJson,
        },
      });
    }

    res.status(201).json(copy);
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
    const workflowId = req.params.id;
    const workspaceId = req.workspaceId!;

    // 1. Verify workspace ownership
    await db.workflow.findFirstOrThrow({ where: { id: workflowId, workspaceId } });

    // 2. Save definition
    await db.nativeWorkflowDefinition.upsert({
      where: { workflowId },
      update: { nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) },
      create: { workflowId, nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) },
    });

    // 3. Process triggers
    const triggerNodes = nodes.filter((n: any) => {
      const type = n.data?.node?.type || n.type;
      return type && type.startsWith('trigger.');
    });

    // Clear old subscriptions and schedules
    await db.workflowSchedule.deleteMany({ where: { workflowId } });
    await db.crmTriggerSubscription.deleteMany({ where: { workflowId } });

    // For webhooks, fetch existing to preserve paths
    const existingWebhooks = await db.workflowWebhook.findMany({ where: { workflowId } });
    const existingWebhookMap = new Map(existingWebhooks.map(w => [w.nodeId, w.path]));
    await db.workflowWebhook.deleteMany({ where: { workflowId } });

    const { nanoid } = await import('nanoid');

    for (const node of triggerNodes) {
      const type = node.data?.node?.type || node.type;
      const config = node.data?.node?.config || node.data?.config || {};

      if (type === 'trigger.schedule') {
        const cron = config.cronExpression || '* * * * *';
        await db.workflowSchedule.create({
          data: { workspaceId, workflowId, nodeId: node.id, cronExpr: cron, timezone: 'UTC', active: false } as any,
        });
      } else if (type === 'trigger.webhook') {
        const method = config.method || 'POST';
        const path = existingWebhookMap.get(node.id) || `/hooks/${nanoid(16)}`;
        await db.workflowWebhook.create({
          data: { workspaceId, workflowId, nodeId: node.id, method, path, active: false } as any,
        });
      } else if (type === 'trigger.crm_event') {
        const eventStr = config.eventType || 'contact.created';
        const [entityType, eventType] = eventStr.split('.');
        const filters = config.filters || {};
        await db.crmTriggerSubscription.create({
          data: { workspaceId, workflowId, nodeId: node.id, entityType, eventType, active: false, filtersJson: JSON.stringify(filters) } as any,
        });
      }
    }

    // 4. Sync workflow.triggerType so the list view shows the correct trigger label
    if (triggerNodes.length > 0) {
      const triggerType = triggerNodes[0].data?.node?.type || triggerNodes[0].type;
      const TRIGGER_TYPE_MAP: Record<string, string> = {
        'trigger.webhook':   'webhook',
        'trigger.schedule':  'schedule',
        'trigger.crm_event': 'crm_event',
        'trigger.manual':    'manual',
      };
      const mappedType = TRIGGER_TYPE_MAP[triggerType] ?? null;
      if (mappedType) {
        await db.workflow.update({ where: { id: workflowId }, data: { triggerType: mappedType as any } });
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
    const workflowId = req.params.id;
    const workspaceId = req.workspaceId!;

    // 1. Verify workspace ownership
    await db.workflow.findFirstOrThrow({ where: { id: workflowId, workspaceId } });

    // 2. Set status to published
    await db.workflow.update({
      where: { id: workflowId },
      data: { status: 'published', engineType: 'native' },
    });

    const { schedulerService } = await import('../services/workflow-engine/scheduler.service.js');

    // 3. Activate and schedule WorkflowSchedule records
    const schedules = await db.workflowSchedule.findMany({ where: { workflowId } });
    for (const schedule of schedules) {
      await db.workflowSchedule.update({ where: { id: schedule.id }, data: { active: true } as any });
      schedulerService.scheduleWorkflow({ ...schedule, active: true } as any);
    }

    // 4. Activate WorkflowWebhook records and reload registry
    const webhooks = await db.workflowWebhook.findMany({ where: { workflowId } });
    for (const hook of webhooks) {
      await db.workflowWebhook.update({ where: { id: hook.id }, data: { active: true } as any });
    }
    if (webhooks.length > 0) {
      const { webhookRegistry } = await import('../services/workflow-engine/webhook-registry.js');
      await webhookRegistry.reload();
    }

    // 5. Activate CRM subscriptions
    await db.crmTriggerSubscription.updateMany({
      where: { workflowId },
      data: { active: true } as any,
    });

    res.json({ success: true, status: 'published' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/pause-native
router.post('/:id/pause-native', async (req, res) => {
  try {
    const workflowId = req.params.id;
    const workspaceId = req.workspaceId!;

    // 1. Verify workspace ownership
    await db.workflow.findFirstOrThrow({ where: { id: workflowId, workspaceId } });

    // 2. Set status to paused
    await db.workflow.update({
      where: { id: workflowId },
      data: { status: 'paused' },
    });

    const { schedulerService } = await import('../services/workflow-engine/scheduler.service.js');

    // 3. Deactivate and unschedule WorkflowSchedule records
    const schedules = await db.workflowSchedule.findMany({ where: { workflowId } });
    for (const schedule of schedules) {
      await db.workflowSchedule.update({ where: { id: schedule.id }, data: { active: false } as any });
      schedulerService.unscheduleWorkflow(schedule.id);
    }

    // 4. Deactivate WorkflowWebhook records and reload registry
    const webhooks = await db.workflowWebhook.findMany({ where: { workflowId } });
    for (const hook of webhooks) {
      await db.workflowWebhook.update({ where: { id: hook.id }, data: { active: false } as any });
    }
    if (webhooks.length > 0) {
      const { webhookRegistry } = await import('../services/workflow-engine/webhook-registry.js');
      await webhookRegistry.reload();
    }

    // 5. Deactivate CRM subscriptions
    await db.crmTriggerSubscription.updateMany({
      where: { workflowId },
      data: { active: false } as any,
    });

    res.json({ success: true, status: 'paused' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/test-native
router.post('/:id/test-native', async (req, res) => {
  try {
    const { queueService } = await import('../services/workflow-engine/queue.service.js');
    
    // Auto-generate mock trigger data if none provided
    let triggerData = req.body.triggerData || {};
    if (Object.keys(triggerData).length === 0) {
      const def = await db.nativeWorkflowDefinition.findUnique({ where: { workflowId: req.params.id } });
      if (def) {
        const nodes = JSON.parse(def.nodesJson);
        const triggerNode = nodes.find((n: any) => n.data?.node?.type?.startsWith('trigger.'));
        if (triggerNode && triggerNode.data?.node?.type === 'trigger.crm_event') {
          const eventStr = triggerNode.data.node.config?.eventType || 'contact.created';
          const [entityType, eventType] = eventStr.split('.');
          triggerData = {
            event: eventStr,
            entityType,
            eventType,
            data: {
              id: 'mock-id-123',
              email: 'test@example.com',
              name: 'Test User',
              firstName: 'Test',
              lastName: 'User',
              phone: '+15551234567',
              businessName: 'Mock Inc.'
            }
          };
        }
      }
    }

    const result = await queueService.enqueue({
      workspaceId: req.workspaceId!,
      workflowId: req.params.id,
      triggerData,
      mode: 'test'
    });
    // result is already { runId: string } — return it directly
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/workflows/:id/test-node
router.post('/:id/test-node', async (req, res) => {
  try {
    const { engineService } = await import('../services/workflow-engine/engine.service.js');
    const { nodeId, inputItems } = req.body;
    
    const def = await db.nativeWorkflowDefinition.findUniqueOrThrow({
      where: { workflowId: req.params.id }
    });
    
    const nodes = JSON.parse(def.nodesJson);
    const targetNode = nodes.find((n: any) => n.id === nodeId);
    if (!targetNode) throw new Error('Node not found');
    
    const start = Date.now();
    const output = await engineService.testNode({
      workspaceId: req.workspaceId!,
      workflowId: req.params.id,
      nodeId,
      inputItems: inputItems || [{ json: {} }],
      userId: req.userId ?? 'unknown',
    });
    
    res.json({ output, duration: Date.now() - start });
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
