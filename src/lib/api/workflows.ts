/**
 * Typed Workflow API functions.
 * All calls proxy through our backend at /api/workflows, which in turn
 * communicates with the Activepieces CE engine.
 *
 * Interfaces are shaped after the Activepieces v1 REST API response bodies:
 *   GET /v1/flows          → Flow
 *   GET /v1/flow-runs      → Run / RunDetail
 *   GET /v1/pieces         → Node  (Activepieces "pieces" = workflow nodes)
 *   GET /v1/connections    → Connection
 */
import { apiClient } from '../apiClient';

// ── Interfaces ────────────────────────────────────────────────────────────────

/** A single step (trigger or action) inside a flow definition. */
export interface FlowStep {
  name: string;
  type: 'TRIGGER' | 'ACTION';
  /** Piece name as registered in Activepieces (e.g. "@activepieces/piece-gmail") */
  pieceName?: string;
  pieceVersion?: string;
  actionName?: string;
  triggerName?: string;
  /** Key-value settings configured by the user for this step. */
  settings: Record<string, unknown>;
  nextAction?: FlowStep;
  onFailureAction?: FlowStep;
  /** Branches for router/split steps. */
  children?: FlowStep[][];
}

/** The complete flow graph — mirrors Activepieces FlowVersion.trigger structure. */
export interface FlowDefinition {
  trigger: FlowStep;
}

/** A Flow as returned by the Activepieces /v1/flows endpoint. */
export interface Flow {
  id: string;
  created: string;           // ISO-8601
  updated: string;
  name: string;
  projectId: string;
  folderId?: string | null;
  status: 'ENABLED' | 'DISABLED';
  publishedVersionId?: string | null;
  schedule?: {
    type: 'CRON_EXPRESSION';
    cronExpression: string;
    timezone: string;
  } | null;
  /** The latest (possibly unpublished) version of the flow. */
  version: {
    id: string;
    flowId: string;
    displayName: string;
    trigger: FlowStep;
    state: 'DRAFT' | 'LOCKED';
    updatedBy?: string;
    created: string;
    updated: string;
    valid: boolean;
  };
}

/** Summary of a single flow run. */
export interface Run {
  id: string;
  created: string;
  updated: string;
  projectId: string;
  flowId: string;
  flowVersionId: string;
  flowDisplayName: string;
  environment: 'PRODUCTION' | 'TESTING';
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMEOUT' | 'PAUSED' | 'STOPPED';
  startTime: string;
  finishTime?: string | null;
  duration?: number | null;   // milliseconds
  tags?: string[];
}

/** Full detail for a single run, including per-step output. */
export interface RunDetail extends Run {
  steps: Record<string, {
    type: string;
    status: 'SUCCEEDED' | 'FAILED' | 'RUNNING';
    input?: unknown;
    output?: unknown;
    errorMessage?: string | null;
    duration?: number;
  }>;
  logsFileId?: string | null;
}

/** An Activepieces "piece" (integration node) available to build with. */
export interface Node {
  name: string;            // e.g. "@activepieces/piece-gmail"
  displayName: string;
  description?: string;
  logoUrl?: string;
  version: string;
  minimumSupportedRelease?: string;
  maximumSupportedRelease?: string;
  auth?: {
    type: 'OAUTH2' | 'SECRET_TEXT' | 'BASIC_AUTH' | 'CUSTOM_AUTH';
    required: boolean;
  } | null;
  categories?: string[];
  actions: Record<string, {
    displayName: string;
    description?: string;
  }>;
  triggers: Record<string, {
    displayName: string;
    description?: string;
  }>;
}

/** An authenticated external-service connection stored in Activepieces. */
export interface Connection {
  id: string;
  created: string;
  updated: string;
  name: string;
  pieceName: string;       // e.g. "@activepieces/piece-gmail"
  projectId: string;
  type: 'OAUTH2' | 'SECRET_TEXT' | 'BASIC_AUTH' | 'CUSTOM_AUTH';
  status: 'ACTIVE' | 'ERROR' | 'EXPIRED';
}

// ── API object ────────────────────────────────────────────────────────────────

export const workflowsApi = {
  // ── Flows ──────────────────────────────────────────────────────────────────

  listWorkflows: (): Promise<Flow[]> =>
    apiClient.get<Flow[]>('/workflows').then((r) => r.data),

  getWorkflow: (id: string): Promise<Flow> =>
    apiClient.get<Flow>(`/workflows/${id}`).then((r) => r.data),

  createWorkflow: (name: string, definition: FlowDefinition): Promise<Flow> =>
    apiClient.post<Flow>('/workflows', { name, definition }).then((r) => r.data),

  updateWorkflow: (id: string, definition: FlowDefinition): Promise<Flow> =>
    apiClient.patch<Flow>(`/workflows/${id}`, { definition }).then((r) => r.data),

  publishWorkflow: (id: string): Promise<{ status: string }> =>
    apiClient.post<{ status: string }>(`/workflows/${id}/publish`).then((r) => r.data),

  deleteWorkflow: (id: string): Promise<void> =>
    apiClient.delete(`/workflows/${id}`).then(() => undefined),

  // ── Runs ───────────────────────────────────────────────────────────────────

  runWorkflow: (
    id: string,
    payload?: object,
  ): Promise<{ runId: string; status: string }> =>
    apiClient
      .post<{ runId: string; status: string }>(`/workflows/${id}/run`, { payload })
      .then((r) => r.data),

  getWorkflowRuns: (id: string): Promise<Run[]> =>
    apiClient.get<Run[]>(`/workflows/${id}/runs`).then((r) => r.data),

  getRunDetail: (runId: string): Promise<RunDetail> =>
    apiClient.get<RunDetail>(`/workflows/runs/${runId}`).then((r) => r.data),

  // ── Nodes (Pieces) ─────────────────────────────────────────────────────────

  listNodes: (): Promise<Node[]> =>
    apiClient.get<Node[]>('/workflows/nodes').then((r) => r.data),

  // ── Connections ────────────────────────────────────────────────────────────

  listConnections: (): Promise<Connection[]> =>
    apiClient.get<Connection[]>('/workflows/connections').then((r) => r.data),

  deleteConnection: (id: string): Promise<void> =>
    apiClient.delete(`/workflows/connections/${id}`).then(() => undefined),
};

// ── Named exports for consumers that prefer tree-shaking ─────────────────────

export const {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  publishWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowRuns,
  getRunDetail,
  listNodes,
  listConnections,
  deleteConnection,
} = workflowsApi;
