/**
 * Agents API Router — thin HTTP controller layer.
 * Business logic delegated to api/services/agents.service.ts.
 * Execution transport (SSE) is kept here as it deals directly with the response stream.
 */
import { Router } from 'express';
import * as agentsService from './services/agents.service.js';

const router = Router();
console.log('📦 Loading Agents API Router...');

router.get('/ping', (_req, res) => {
  console.log('🏓 Pong!');
  res.send('pong');
});

// ── Agent CRUD ────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    res.json(await agentsService.createAgent(req.workspaceId, req.body));
  } catch (err) {
    console.error('Failed to create agent:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/', async (req, res) => {
  try {
    res.json(await agentsService.listAgents(req.workspaceId));
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const agent = await agentsService.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    // Parse config from JSON string → object so the frontend receives a typed object
    let parsedConfig: Record<string, unknown> = {};
    try { parsedConfig = JSON.parse(agent.config as string); } catch { /* keep empty */ }
    res.json({ ...agent, config: parsedConfig });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Partial update (status toggle, name rename, etc.) ─────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const agent = await agentsService.updateAgent(req.params.id, req.body);
    res.json(agent);
  } catch (err) {
    console.error('Failed to patch agent:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Delete agent ──────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await agentsService.deleteAgent(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete agent:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Execution run history ─────────────────────────────────────────────────────
router.get('/:id/runs', async (req, res) => {
  try {
    const { db } = await import('../infrastructure/database/client.js');
    const runs = await db.agentRun.findMany({
      where: { agentId: req.params.id },
      include: { steps: { orderBy: { startedAt: 'asc' } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id/workflow', async (req, res) => {
  try {
    res.json(await agentsService.saveWorkflow(req.params.id, req.body));
  } catch (err) {
    res.status(500).json({ error: 'Failed to save workflow' });
  }
});

// ── Workflow Engine (SSE) ─────────────────────────────────────────────────────

router.post('/:id/run', async (req, res) => {
  const agentId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const agent = await agentsService.getAgent(agentId);
    if (!agent || !agent.config) {
      sendEvent({ type: 'error', message: 'Agent or configuration not found' });
      return res.end();
    }

    const config = JSON.parse(agent.config as string);
    const { nodes = [], edges = [] } = config;

    const run = await agentsService.createAgentRun(agentId, JSON.stringify(req.body || {}));

    // Topological Sort
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    const nodeMap: Record<string, any> = {};

    nodes.forEach((n: any) => {
      inDegree[n.id] = 0;
      adjList[n.id] = [];
      nodeMap[n.id] = n;
    });

    edges.forEach((e: any) => {
      if (adjList[e.source]) adjList[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    const queue: string[] = [];
    nodes.forEach((n: any) => {
      if (inDegree[n.id] === 0) queue.push(n.id);
    });

    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      executionOrder.push(currentId);
      adjList[currentId].forEach((neighbor) => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      });
    }

    if (executionOrder.length !== nodes.length) {
      sendEvent({ type: 'error', message: 'Cycle detected in workflow DAG. Cannot execute.' });
      return res.end();
    }

    // Sequential Execution
    const context: Record<string, any> = {};

    for (const nodeId of executionOrder) {
      const node = nodeMap[nodeId];
      const nodeDefId = node.data?.nodeDefId || node.type;
      
      sendEvent({ 
        type: 'log', 
        nodeId, 
        status: 'running', 
        time: new Date().toLocaleTimeString(),
        message: `Executing [${node.data?.label || nodeDefId}]...` 
      });

      const stepStart = Date.now();
      let nodeOutput: any = null;
      let nodeError: string | null = null;
      let isSuccess = true;

      try {
        if (nodeDefId === 'trigger-webhook') {
          nodeOutput = { received: true, payload: req.body };
        } else if (nodeDefId === 'ai-llm' || nodeDefId === 'ai-extract') {
          await new Promise((resolve) => setTimeout(resolve, 800));
          nodeOutput = { status: 'processed', aiOutput: 'Simulated LLM response' };
        } else if (nodeDefId === 'logic-delay') {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          nodeOutput = { delayed: true };
        } else if (nodeDefId === 'comm-discord') {
          const webhookUrl = node.data?.webhook_url;
          const content = node.data?.content;
          
          if (!webhookUrl || !content) {
            throw new Error('Discord Webhook URL and Content are required');
          }

          const payload: any = { content };
          if (node.data?.username) payload.username = node.data.username;
          if (node.data?.avatar_url) payload.avatar_url = node.data.avatar_url;
          if (node.data?.tts) payload.tts = node.data.tts;
          if (node.data?.embeds) {
            try {
              payload.embeds = typeof node.data.embeds === 'string' ? JSON.parse(node.data.embeds) : node.data.embeds;
            } catch (e) {
              console.warn('Invalid embeds JSON for discord webhook', e);
            }
          }

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
          }
          nodeOutput = { status: 'success', delivered: true };
        } else {
          await new Promise((resolve) => setTimeout(resolve, 500));
          nodeOutput = { status: 'success' };
        }
        context[nodeId] = nodeOutput;
      } catch (err: any) {
        isSuccess = false;
        nodeError = err.message || 'Node execution failed';
      }

      const duration = Date.now() - stepStart;
      await agentsService.createAgentRunStep(run.id, nodeId, isSuccess ? 'success' : 'failed', nodeOutput, nodeError, duration);

      if (!isSuccess) {
        sendEvent({ type: 'log', nodeId, status: 'error', time: new Date().toLocaleTimeString(), message: `❌ Failed: ${nodeError}` });
        await agentsService.updateAgentRun(run.id, 'failed');
        return res.end();
      }

      sendEvent({ type: 'log', nodeId, status: 'success', time: new Date().toLocaleTimeString(), message: `✅ Completed [${node.data?.label || nodeDefId}] in ${duration}ms` });
    }

    await agentsService.updateAgentRun(run.id, 'success');
    sendEvent({ type: 'done' });
    res.end();
  } catch (error: any) {
    sendEvent({ type: 'error', message: error.message || 'Execution engine crashed' });
    res.end();
  }
});

export default router;
