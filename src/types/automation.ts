// Mirrors backend AP types but shaped for frontend consumption

export type WorkflowStatus = 'draft' | 'published' | 'paused';
export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED' | 'STOPPED' | 'INTERNAL_ERROR';
export type TriggerType = 'webhook' | 'schedule' | 'app_event' | 'manual';

export interface Workflow {
  id: string;
  workspaceId: string;
  apFlowId: string;
  apProjectId: string;
  apVersionId: string | null;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: TriggerType | null;
  triggerPieceName: string | null;
  webhookUrl: string | null;
  folderName: string | null;
  tags: string[];   // parsed from JSON string
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  createdAt: string;
  updatedAt: string;
  // Populated by GET /api/workflows/:id
  apFlow?: APFlow;
}

export interface APFlow {
  id: string;
  projectId: string;
  name: string;
  status: 'ENABLED' | 'DISABLED' | 'DRAFT';
  version: APFlowVersion;
  createdAt: string;
  updatedAt: string;
}

export interface APFlowVersion {
  id: string;
  displayName: string;
  flowId: string;
  trigger: APStep;
  valid: boolean;
  state: 'DRAFT' | 'LOCKED';
}

export type APStepType = 'TRIGGER' | 'PIECE' | 'CODE' | 'LOOP_ON_ITEMS' | 'BRANCH';

export interface APStep {
  name: string;
  type: APStepType;
  valid: boolean;
  displayName: string;
  nextActionName?: string;
  onSuccessActionName?: string;  // BRANCH only
  onFailureActionName?: string;  // BRANCH only
  firstLoopActionName?: string;  // LOOP_ON_ITEMS only
  settings: APStepSettings;
}

export interface APStepSettings {
  packageType?: 'REGISTRY' | 'ARCHIVE';
  pieceName?: string;
  pieceType?: 'OFFICIAL' | 'COMMUNITY' | 'CUSTOM';
  pieceVersion?: string;
  actionName?: string;
  triggerName?: string;
  input: Record<string, unknown>;
  inputUiInfo?: {
    currentSelectedData?: unknown;
    customizedInputs?: Record<string, boolean>;
  };
  // BRANCH
  conditions?: Array<Array<{
    firstValue: string;
    secondValue: string;
    operator: BranchOperator;
    caseSensitive?: boolean;
  }>>;
  // LOOP
  items?: string;
  // CODE
  sourceCode?: { code: string; packageJson: string };
}

export type BranchOperator =
  | 'TEXT_CONTAINS' | 'TEXT_DOES_NOT_CONTAIN'
  | 'TEXT_EXACTLY_MATCHES' | 'TEXT_DOES_NOT_EXACTLY_MATCH'
  | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH'
  | 'NUMBER_IS_GREATER_THAN' | 'NUMBER_IS_LESS_THAN'
  | 'NUMBER_IS_EQUAL_TO' | 'BOOLEAN_IS_TRUE' | 'BOOLEAN_IS_FALSE'
  | 'EXISTS' | 'DOES_NOT_EXIST';

export interface WorkflowRun {
  id: string;
  flowId: string;
  projectId: string;
  status: RunStatus;
  startTime: string;
  finishTime?: string;
  duration?: number;  // milliseconds
  steps: Record<string, RunStep>;
}

export interface RunStep {
  name: string;
  status: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'SKIPPED';
  duration?: number;
  input?: unknown;
  output?: unknown;
  errorMessage?: string;
}

export interface APPiece {
  name: string;
  displayName: string;
  description: string;
  logoUrl: string;
  version: string;
  categories: string[];
  actions: APPieceAction[];
  triggers: APPieceTrigger[];
}

export interface APPieceAction {
  name: string;
  displayName: string;
  description: string;
  props: Record<string, APPieceProp>;
  requireAuth: boolean;
}

export interface APPieceTrigger extends APPieceAction {
  type: 'POLLING' | 'WEBHOOK' | 'APP_WEBHOOK' | 'EMPTY';
}

export type APPropType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER' | 'CHECKBOX'
  | 'DROPDOWN' | 'STATIC_DROPDOWN' | 'MULTI_SELECT_DROPDOWN'
  | 'ARRAY' | 'OBJECT' | 'JSON' | 'FILE' | 'DATE_TIME'
  | 'MARKDOWN' | 'CUSTOM_AUTH' | 'OAUTH2' | 'SECRET_TEXT'
  | 'BASIC_AUTH' | 'DYNAMIC';

export interface APPieceProp {
  type: APPropType;
  displayName: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

export interface APConnection {
  id: string;
  name: string;
  pieceName: string;
  projectId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  created: string;
  updated: string;
}

// ── Canvas types for @xyflow/react ────────────────────────────────────────────
export type WorkflowNodeData = Record<string, unknown> & {
  stepName: string;           // AP step name (unique ID)
  step: APStep;               // Full AP step object
  pieceMetadata?: APPiece;    // Loaded piece definition
  isSelected?: boolean;
  hasError?: boolean;
  runStatus?: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'RUNNING';
};

// ── Native Workflow Engine Types ──────────────────────────────────────────────

export type NativeNodeCategory =
  | 'trigger'
  | 'logic'
  | 'data'
  | 'crm'
  | 'communication'
  | 'ai'
  | 'integration';

export type EngineType = 'native' | 'activepieces';

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
}

export interface WorkflowCredential {
  id: string;
  workspaceId: string;
  name: string;
  type: string;   // e.g. "smtp", "oauth2_google", "api_key_openai"
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  definitionJson: NativeWorkflowDefinition;
  thumbnailUrl?: string;
  usageCount: number;
  isSystem: boolean;
  workspaceId?: string;
  createdAt: string;
}

// ── Native canvas node data (used by @xyflow/react for native nodes) ──────────
export type NativeNodeData = Record<string, unknown> & {
  node: NativeNode;
  isSelected?: boolean;
  hasError?: boolean;
  runStatus?: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'SKIPPED';
  outputHandles?: Array<{ id: string; label?: string; color?: string }>;
};
