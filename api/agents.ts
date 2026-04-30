/**
 * Agents API Router — thin HTTP controller layer.
 * Business logic delegated to api/services/agents.service.ts.
 * Execution transport (SSE) is kept here as it deals directly with the response stream.
 */
import { Router } from 'express';
import * as agentsService from './services/agents.service.js';
import { tryGetAIClient, DEFAULT_MODEL } from '../packages/ai/client.js';
import { db } from '../infrastructure/database/client.js';

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
    if (agent) res.json(agent);
    else res.status(404).json({ error: 'Agent not found' });
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
