// Shared workflow/automation type definitions — used by frontend components and the builder UI.

export type WorkflowStatus = 'draft' | 'published' | 'paused';
export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED' | 'STOPPED';
export type TriggerType = 'webhook' | 'schedule' | 'crm_event' | 'manual';


/** Matches the `workflows` Prisma model exactly. */
export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: TriggerType | null;
  folderName: string | null;
  tags: string;              // JSON string array stored in DB, parse with JSON.parse() at use site
  isFavorite: boolean;
  folderId: string | null;
  lastRunAt: string | null;  // ISO-8601
  lastRunStatus: RunStatus | null;
  engineType: EngineType;
  definitionJson: string;    // JSON, usually "{}" — not the canvas def (that's NativeWorkflowDefinition)
  variablesJson: string;     // JSON object of workflow-level variables
  settingsJson: string;      // JSON: NativeWorkflowSettings
  executionCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;         // ISO-8601
  updatedAt: string;         // ISO-8601
}

/** A single execution record. Matches the `workflow_runs` Prisma model. */
export interface NativeWorkflowRun {
  id: string;
  workspaceId: string;
  workflowId: string;
  status: RunStatus;
  durationMs: number | null;
  stepCount: number;
  triggerData: string | null;  // JSON string
  errorMessage: string | null;
  startedAt: string;           // ISO-8601
  finishedAt: string | null;   // ISO-8601
  engineType: string;
  runData: string;             // JSON string: Record<nodeId, WorkflowItem[]>
  waitingNodeId: string | null;
  resumeAt: string | null;
}

/** Run detail with runData parsed from JSON. */
export interface NativeWorkflowRunDetail extends Omit<NativeWorkflowRun, 'runData' | 'triggerData'> {
  runData: Record<string, WorkflowItem[]> | null;
  triggerData: Record<string, unknown> | null;
}

/** Template record from the `workflow_templates` table. */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string;              // JSON string array
  thumbnailUrl: string | null;
  usageCount: number;
  isSystem: boolean;
  workspaceId: string | null;
  createdAt: string;
  // definitionJson intentionally excluded from list API response
}

/** Template with definition included (only for install flow). */
export interface WorkflowTemplateWithDefinition extends WorkflowTemplate {
  definitionJson: string;    // JSON: { nodes: any[], edges: any[] }
}

// ── Native Workflow Engine Types ──────────────────────────────────────────────

export type NativeNodeCategory =
  | 'trigger'
  | 'logic'
  | 'data'
  | 'crm'
  | 'communication'
  | 'ai'
  | 'integration';

export type EngineType = 'native';

export interface NativeNode {
  id: string;           // unique UUID on the canvas
  type: string;         // e.g. "trigger.webhook", "logic.if_else", "crm.create_contact"
  label: string;        // Display name
  position: { x: number; y: number };
  config: Record<string, unknown>;  // All configuration for this node
  disabled?: boolean;
  continueOnFail?: boolean;
  retryOnFail?: boolean;
  maxRetries?: number;
  retryWaitMs?: number;
  notes?: string;
}

export interface NativeEdge {
  id: string;
  source: string;         // node id
  sourceHandle?: string;  // 'true' | 'false' | 'loop' | 'default' | null
  target: string;
  targetHandle?: string;
  label?: string;
}

export interface NativeWorkflowDefinition {
  id: string;
  workflowId: string;
  nodes: NativeNode[];
  edges: NativeEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface NativeWorkflowSettings {
  timeout?: number;           // ms, default 300000 (5 min)
  errorWorkflowId?: string;   // Linked error-handler workflow id
  timezone?: string;          // IANA timezone string
}

export interface WorkflowItem {
  json: Record<string, unknown>;
  binary?: Record<string, {
    data: string;
    mimeType: string;
    fileName?: string;
  }>;
  pairedItem?: { item: number };
}

export interface ExecutionContext {
  workspaceId: string;
  workflowId: string;
  runId: string;
  triggerData: unknown;
  runData: Record<string, WorkflowItem[]>;  // nodeId → output items
  mode: 'production' | 'test' | 'manual';
  userId?: string;
}

export type NodeConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'json'
  | 'code'
  | 'expression'
  | 'credential'
  | 'color'
  | 'datetime'
  | 'cron'
  | 'keyvalue'
  | 'collection';

export interface NodeConfigField {
  key: string;
  label: string;
  type: NodeConfigFieldType;
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number | boolean }>;
  loadOptionsMethod?: string;   // Dynamic options loader method name
  displayCondition?: { field: string; value: unknown };  // Show when field=value
  rows?: number;                // For textarea
  language?: string;            // For code: 'javascript' | 'json'
  collection?: NodeConfigField[]; // For type='collection' (nested fields)
  advanced?: boolean;             // Hide under "Advanced Settings"
}

export interface WorkflowCredential {
  id: string;
  workspaceId: string;
  name: string;
  type: string;   // e.g. "smtp", "oauth2_google", "api_key_openai"
  createdAt: string;
  updatedAt: string;
}



// ── Native canvas node data (used by @xyflow/react for native nodes) ──────────
export type NativeNodeData = Record<string, unknown> & {
  node: NativeNode;
  isSelected?: boolean;
  hasError?: boolean;
  runStatus?: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'SKIPPED';
  outputHandles?: Array<{ id: string; label?: string; color?: string }>;
};
