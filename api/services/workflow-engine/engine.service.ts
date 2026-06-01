import { db } from '../../../infrastructure/database/client.js';
import { 
  NativeNode, 
  NativeEdge,
  NativeWorkflowSettings,
  ExecutionContext, 
  WorkflowItem 
} from '../../../src/types/automation.js';
import { nodeRegistry } from './node-runner';
import { expressionService } from './expression.service';

export class WorkflowEngine {
  
  async executeWorkflow(params: {
    workspaceId: string;
    workflowId: string;
    triggerData: unknown;
    mode?: 'production' | 'test' | 'manual';
    userId?: string;
  }): Promise<{ runId: string; status: string }> {
    const { workspaceId, workflowId, triggerData, mode = 'production', userId } = params;

    // 1. Load Workflow from DB
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId, workspaceId },
      include: { nativeDefinition: true }
    });

    if (!workflow || !workflow.nativeDefinition) {
      throw new Error(`Workflow not found or missing native definition: ${workflowId}`);
    }

    // 2. Verify workflow status
    if (workflow.status !== 'published' && mode === 'production') {
      throw new Error(`Workflow is not published: ${workflow.status}`);
    }

    // Parse definition and settings
    let rawNodes: any[] = [];
    let edges: NativeEdge[] = [];
    let settings: NativeWorkflowSettings = {};

    try {
      rawNodes = JSON.parse(workflow.nativeDefinition.nodesJson) as any[];
      edges = JSON.parse(workflow.nativeDefinition.edgesJson) as NativeEdge[];
      settings = JSON.parse(workflow.settingsJson) as NativeWorkflowSettings;
    } catch (e) {
      throw new Error('Failed to parse workflow definition JSON');
    }

    const nodes: NativeNode[] = this.normalizeNodes(rawNodes);

    // 3. Create WorkflowRun record
    const run = await db.workflowRun.create({
      data: {
        workspaceId,
        workflowId,
        status: 'RUNNING',
        engineType: 'native',
        triggerData: JSON.stringify(triggerData),
        runData: '{}'
      }
    });

    // 4. Build adjacency list
    const graph = this.buildGraph(edges);

    // 5. Find the trigger node
    const triggerNode = nodes.find(n => n.type.startsWith('trigger.'));
    if (!triggerNode) {
      await this.failRun(run.id, 'No trigger node found in workflow');
      return { runId: run.id, status: 'FAILED' };
    }

    // 6. Build ExecutionContext
    const context: ExecutionContext = {
      workspaceId,
      workflowId,
      runId: run.id,
      triggerData,
      runData: { trigger: [{ json: triggerData as Record<string, unknown> }] },
      mode,
      userId
    };

    try {
      // 7 & 8. Call executeNode recursively starting from trigger
      await this.executeNodeRecursive(triggerNode, [{ json: triggerData as Record<string, unknown> }], context, nodes, graph);
      
      // 10. On completion update run
      await db.workflowRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCEEDED',
          runData: JSON.stringify(context.runData),
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime()
        }
      });
      
      return { runId: run.id, status: 'SUCCEEDED' };
    } catch (error: any) {
      // 11. On unhandled error
      await this.failRun(run.id, error.message || 'Unknown error');
      
      // 12. If settings.errorWorkflowId is set, fire it (fire-and-forget)
      if (settings.errorWorkflowId) {
        this.executeWorkflow({
          workspaceId,
          workflowId: settings.errorWorkflowId,
          triggerData: { originalWorkflowId: workflowId, runId: run.id, error: error.message },
          mode: 'production'
        }).catch(err => console.error('Failed to run error workflow:', err));
      }

      return { runId: run.id, status: 'FAILED' };
    }
  }

  private buildGraph(edges: NativeEdge[]): Map<string, NativeEdge[]> {
    const graph = new Map<string, NativeEdge[]>();
    for (const edge of edges) {
      if (!graph.has(edge.source)) {
        graph.set(edge.source, []);
      }
      graph.get(edge.source)!.push(edge);
    }
    return graph;
  }

  /**
   * Normalize raw stored nodes (which may be React Flow-style with data.config or data.node.config)
   * into NativeNode objects expected by the engine.
   */
  private normalizeNodes(rawNodes: any[]): NativeNode[] {
    return (rawNodes || []).map((n: any) => {
      const config = (n.config ?? n.data?.config ?? n.data?.node?.config) || {};
      const label = n.label ?? n.data?.label ?? n.data?.node?.label ?? n.type;

      const native: NativeNode = {
        id: n.id,
        type: n.type,
        label,
        position: n.position || { x: 0, y: 0 },
        config,
        disabled: n.disabled ?? n.data?.disabled ?? n.data?.node?.disabled ?? false,
        continueOnFail: n.continueOnFail ?? n.data?.node?.continueOnFail,
        retryOnFail: n.retryOnFail ?? n.data?.node?.retryOnFail,
        maxRetries: n.maxRetries ?? n.data?.node?.maxRetries,
        retryWaitMs: n.retryWaitMs ?? n.data?.node?.retryWaitMs,
        notes: n.notes ?? n.data?.node?.notes,
      };

      return native;
    });
  }

  private async failRun(runId: string, errorMessage: string) {
    await db.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        errorMessage,
        finishedAt: new Date()
      }
    });
  }

  private async executeNodeRecursive(
    node: NativeNode,
    inputItems: WorkflowItem[],
    context: ExecutionContext,
    allNodes: NativeNode[],
    graph: Map<string, NativeEdge[]>,
    visited: Set<string> = new Set()
  ): Promise<void> {

    // Cycle detection: if we've already executed this node in the current path,
    // stop recursion. Prevents stack overflows from cyclic workflow graphs.
    if (visited.has(node.id)) {
      console.warn(`[WorkflowEngine] Cycle detected at node ${node.id} in run ${context.runId}. Stopping branch.`);
      return;
    }
    visited.add(node.id);

    // Process the node
    const result = await this.executeNode(node, inputItems, context);
    
    // Check if the run was paused (logic.wait node)
    const currentRun = await db.workflowRun.findUnique({ where: { id: context.runId } });
    if (currentRun?.status === 'PAUSED') {
      await db.workflowRun.update({
        where: { id: context.runId },
        data: { waitingNodeId: node.id },
      });
      return; // Stop execution here. It will resume later.
    }

    // Find outgoing edges
    const outgoingEdges = graph.get(node.id) || [];
    
    // Group target nodes by handle
    // For branching, we only proceed on edges that match the handles returned in branches
    // If branches are provided, we route based on them. Otherwise we route all output to all edges.
    if (result.branches) {
      for (const edge of outgoingEdges) {
        const handleId = edge.sourceHandle || 'default';
        const branchItems = result.branches[handleId];
        
        if (branchItems && branchItems.length > 0) {
          const targetNode = allNodes.find(n => n.id === edge.target);
          if (targetNode) {
            await this.executeNodeRecursive(targetNode, branchItems, context, allNodes, graph, new Set(visited));
          }
        }
      }
    } else if (result.output && result.output.length > 0) {
      // Default routing: send all output to all targets
      for (const edge of outgoingEdges) {
        const targetNode = allNodes.find(n => n.id === edge.target);
        if (targetNode) {
          await this.executeNodeRecursive(targetNode, result.output, context, allNodes, graph, new Set(visited));
        }
      }
    }
  }

  async executeNode(
    node: NativeNode,
    inputItems: WorkflowItem[],
    context: ExecutionContext
  ): Promise<{ output: WorkflowItem[]; branches?: Record<string, WorkflowItem[]> }> {
    
    // 1. If disabled, pass-through
    if (node.disabled) {
      return { output: inputItems };
    }

    // 3. Look up implementation
    const nodeImpl = nodeRegistry.get(node.type);
    if (!nodeImpl) {
      throw new Error(`Node implementation not found for type: ${node.type}`);
    }

    let retries = 0;
    const maxRetries = node.retryOnFail ? (node.maxRetries || 1) : 0;
    const retryWaitMs = node.retryWaitMs || 1000;

    while (true) {
      try {
        // 4. Resolve expressions in config
        let resolvedConfig = node.config || {};
        if (inputItems.length > 0) {
          // If we have items, we resolve against the first item for node-level config
          // For nodes that process items individually (like HTTP request), they will resolve per-item inside their execute method
          resolvedConfig = expressionService.resolveConfig(node.config, context, inputItems[0]);
        } else {
          resolvedConfig = expressionService.resolveConfig(node.config, context);
        }

        // 5. Execute
        const result = await nodeImpl.execute(resolvedConfig, inputItems, context);
        
        // 6. On success:
        context.runData[node.id] = result.output;
        
        return result;

      } catch (error: any) {
        // 7. On error
        if (retries < maxRetries) {
          retries++;
          await new Promise(res => setTimeout(res, retryWaitMs));
          continue;
        }

        if (node.continueOnFail) {
          const errorOutput = inputItems.map(item => ({
            ...item,
            json: { ...item.json, _error: error.message }
          }));
          context.runData[node.id] = errorOutput;
          return { output: errorOutput };
        }

        throw new Error(`Node ${node.label} failed: ${error.message}`);
      }
    }
  }

  async testNode(params: {
    workspaceId: string;
    workflowId: string;
    nodeId: string;
    inputItems: WorkflowItem[];
    userId: string;
  }): Promise<WorkflowItem[]> {
    const { workspaceId, workflowId, nodeId, inputItems, userId } = params;
    
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId, workspaceId },
      include: { nativeDefinition: true }
    });

    if (!workflow || !workflow.nativeDefinition) {
      throw new Error('Workflow not found');
    }

    const rawNodes = JSON.parse(workflow.nativeDefinition.nodesJson) as any[];
    const nodes = this.normalizeNodes(rawNodes);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) throw new Error('Node not found');

    const context: ExecutionContext = {
      workspaceId,
      workflowId,
      runId: 'test-run',
      triggerData: {},
      runData: {},
      mode: 'test',
      userId
    };

    const result = await this.executeNode(node, inputItems, context);
    return result.output;
  }

  /** Resume a PAUSED workflow run from the node recorded in waitingNodeId. */
  async resumeRun(runId: string): Promise<void> {
    const run = await db.workflowRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'PAUSED') return;

    const workflow = await db.workflow.findUnique({
      where: { id: run.workflowId },
      include: { nativeDefinition: true },
    });
    if (!workflow?.nativeDefinition) {
      await this.failRun(runId, 'Workflow definition not found during resume');
      return;
    }

    let nodes: NativeNode[] = [];
    let edges: NativeEdge[] = [];
    try {
      nodes = JSON.parse(workflow.nativeDefinition.nodesJson) as NativeNode[];
      edges = JSON.parse(workflow.nativeDefinition.edgesJson) as NativeEdge[];
    } catch {
      await this.failRun(runId, 'Failed to parse workflow definition during resume');
      return;
    }

    const graph = this.buildGraph(edges);
    const savedRunData = run.runData ? JSON.parse(run.runData) : {};
    const triggerData = run.triggerData ? JSON.parse(run.triggerData) : {};

    const context: ExecutionContext = {
      workspaceId: run.workspaceId,
      workflowId: run.workflowId,
      runId: run.id,
      triggerData,
      runData: savedRunData,
      mode: 'production',
    };

    await db.workflowRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', resumeAt: null, waitingNodeId: null },
    });

    try {
      // Resume from the node that was waiting, or fall back to the trigger node
      const resumeNodeId = run.waitingNodeId;
      const startNode = resumeNodeId
        ? nodes.find(n => n.id === resumeNodeId)
        : nodes.find(n => n.type.startsWith('trigger.'));

      if (!startNode) {
        await this.failRun(runId, 'Could not find node to resume from');
        return;
      }

      const previousOutput: WorkflowItem[] = savedRunData[startNode.id] ?? [{ json: triggerData }];
      await this.executeNodeRecursive(startNode, previousOutput, context, nodes, graph);

      await db.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCEEDED',
          runData: JSON.stringify(context.runData),
          finishedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime(),
        },
      });
    } catch (error: any) {
      await this.failRun(runId, error.message || 'Unknown error during resume');
    }
  }
}

export const engineService = new WorkflowEngine();
