/**
 * Agents Service — DB access and workflow execution logic for the agents domain.
 * The SSE-based workflow runner stays in the route file (it's transport-level code).
 * This service handles pure data operations.
 */
import { db } from '../../infrastructure/database/client.js';

// ── Agent CRUD ─────────────────────────────────────────────────────────────────

export async function listAgents(workspaceId: string) {
  return db.agent.findMany({ where: { workspaceId } });
}

export async function getAgent(id: string) {
  return db.agent.findUnique({ where: { id } });
}

export async function createAgent(workspaceId: string, data: {
  name?: string;
  type?: string;
  status?: string;
  config?: Record<string, unknown>;
}) {
  return db.agent.create({
    data: {
      workspaceId,
      name: data.name ?? 'Unnamed Agent',
      type: data.type ?? 'workflow',
      status: data.status ?? 'draft',
      config: data.config ? JSON.stringify(data.config) : '{}',
    },
  });
}

export async function updateAgent(id: string, data: Record<string, unknown>) {
  if (data.config && typeof data.config === 'object') {
    data.config = JSON.stringify(data.config);
  }
  return db.agent.update({ where: { id }, data });
}

export async function saveWorkflow(id: string, config: Record<string, unknown>) {
  return db.agent.update({ where: { id }, data: { config: JSON.stringify(config) } });
}

export async function deleteAgent(id: string) {
  await db.agent.delete({ where: { id } });
}

// ── Agent Runs ────────────────────────────────────────────────────────────────

export async function createAgentRun(agentId: string, triggerData: string) {
  return db.agentRun.create({
    data: { agentId, status: 'running', triggerData },
  });
}

export async function updateAgentRun(id: string, status: string) {
  return db.agentRun.update({
    where: { id },
    data: { status, completedAt: new Date() },
  });
}

export async function createAgentRunStep(
  runId: string,
  nodeId: string,
  status: string,
  output: unknown,
  error: string | null,
  duration: number,
) {
  return db.agentRunStep.create({
    data: {
      runId,
      nodeId,
      status,
      output: output ? JSON.stringify(output) : null,
      error,
      duration,
    },
  });
}
