/**
 * Agent & AI domain types — mirrors the Prisma Agent schema.
 */

export type AgentType = 'workflow' | 'voice' | 'autonomous';
export type AgentStatus = 'draft' | 'active' | 'paused' | 'error';

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  /** JSON-serialized config object */
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  runs?: AgentRun[];
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  triggerData: string | null;
  steps?: AgentRunStep[];
}

export interface AgentRunStep {
  id: string;
  runId: string;
  nodeId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  error: string | null;
  startedAt: string;
  duration: number | null;
}

export interface AgentMessage {
  id: string;
  agentId: string | null;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateAgentInput = {
  name: string;
  type: AgentType;
  config?: Record<string, unknown>;
};

export type UpdateAgentInput = Partial<CreateAgentInput> & {
  status?: AgentStatus;
};
