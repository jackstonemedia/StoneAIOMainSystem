import axios, { AxiosInstance } from 'axios';
import { env } from '../../infrastructure/config/env.js';

// ── AP Step / Run / Piece Types ───────────────────────────────────────────────
export type APStepType = 'TRIGGER' | 'PIECE' | 'CODE' | 'LOOP_ON_ITEMS' | 'BRANCH';
export type APRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED' | 'STOPPED' | 'INTERNAL_ERROR';

export interface APStep {
  name: string;
  type: APStepType;
  valid: boolean;
  displayName: string;
  nextActionName?: string;
  settings: {
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
    sourceCode?: {
      code: string;
      packageJson?: string;
    };
    conditions?: any[];
    items?: string;
  };
}

export interface APFlowVersion {
  id: string;
  displayName: string;
  flowId: string;
  trigger: APStep;
  valid: boolean;
  state: 'DRAFT' | 'LOCKED';
  updatedAt?: string;
  createdAt?: string;
}

export interface APFlow {
  id: string;
  projectId: string;
  name: string;
  status: 'ENABLED' | 'DISABLED' | 'DRAFT';
  publishedVersionId?: string;
  version: APFlowVersion;
  createdAt: string;
  updatedAt: string;
}

export interface APFlowRun {
  id: string;
  flowId: string;
  projectId: string;
  status: APRunStatus;
  startTime: string;
  finishTime?: string;
  duration?: number;
  steps: Record<string, APRunStep>;
  logsFileId?: string;
}

export interface APRunStep {
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

export interface APPieceProp {
  type: string;
  displayName: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

export interface APAppConnection {
  id: string;
  name: string;
  pieceName: string;
  projectId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ERROR';
  created: string;
  updated: string;
}

// ── Client & Authentication ───────────────────────────────────────────────────

class ActivepiecesClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${env.ACTIVEPIECES_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(async (config) => {
      // Do not attach token for authentication routes
      if (config.url?.includes('/authentication/sign-in')) return config;
      const token = await this.getToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err.response?.status;
        const data = err.response?.data;
        console.error(`[AP] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status}`, data);
        return Promise.reject(err);
      }
    );
  }

  private async refreshAuth(): Promise<string> {
    try {
      // If we have a platform ID, we should ideally use platform-level keys, 
      // but standard CE/EE sign-in is the most common for self-hosted.
      const response = await this.client.post('/authentication/sign-in', {
        email: env.ACTIVEPIECES_ADMIN_EMAIL,
        password: env.ACTIVEPIECES_ADMIN_PASSWORD,
      });
      
      this.token = response.data.token;
      // Expires in 7 days, refresh after 6 days
      this.tokenExpiry = Date.now() + (6 * 24 * 60 * 60 * 1000);
      return this.token as string;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      throw new Error(`Automation Engine Authentication Failed: ${msg}. Please check your ACTIVEPIECES_URL and credentials.`);
    } finally {
      this.refreshPromise = null;
    }
  }

  public async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.refreshAuth();
    return this.refreshPromise;
  }

  public get axios() {
    return this.client;
  }
}

const ap = new ActivepiecesClient();

// ── No Mock Fallbacks Allowed. Everything is Real. ───────────────────────────

export function isAPConfigured(): boolean {
  return !!env.ACTIVEPIECES_URL && !!env.ACTIVEPIECES_ADMIN_EMAIL;
}

// ── Projects ──────────────────────────────────────────────────────────────────
export async function createAPProject(name: string, externalId?: string) {
  const res = await ap.axios.post('/projects', { displayName: name, externalId });
  return res.data as { id: string; displayName: string };
}

export async function getAPProject(projectId: string) {
  const res = await ap.axios.get(`/projects/${projectId}`);
  return res.data;
}

// ── Flows ─────────────────────────────────────────────────────────────────────
export async function listAPFlows(projectId: string): Promise<APFlow[]> {
  const res = await ap.axios.get('/flows', { params: { projectId, limit: 100 } });
  return res.data.data as APFlow[];
}

export async function getAPFlow(flowId: string): Promise<APFlow> {
  const res = await ap.axios.get(`/flows/${flowId}`);
  return res.data as APFlow;
}

export async function createAPFlow(projectId: string, displayName: string): Promise<APFlow> {
  const res = await ap.axios.post('/flows', { projectId, displayName });
  return res.data as APFlow;
}

export async function updateAPFlow(flowId: string, payload: any): Promise<APFlow> {
  const res = await ap.axios.post(`/flows/${flowId}`, payload);
  return res.data as APFlow;
}

export async function publishAPFlow(flowId: string): Promise<APFlowVersion> {
  const res = await ap.axios.post(`/flows/${flowId}/publish`);
  return res.data as APFlowVersion;
}

export async function disableAPFlow(flowId: string): Promise<void> {
  await ap.axios.post(`/flows/${flowId}/disable`);
}

export async function deleteAPFlow(flowId: string): Promise<void> {
  await ap.axios.delete(`/flows/${flowId}`);
}

export async function duplicateAPFlow(flowId: string): Promise<APFlow> {
  const res = await ap.axios.post(`/flows/${flowId}/duplicate`);
  return res.data as APFlow;
}

// ── Flow Runs ─────────────────────────────────────────────────────────────────
export async function listAPFlowRuns(projectId: string, params: { flowId?: string; limit?: number; status?: string }) {
  const res = await ap.axios.get('/flow-runs', { params: { projectId, ...params } });
  return res.data as { data: APFlowRun[] };
}

export async function getAPFlowRun(runId: string): Promise<APFlowRun> {
  const res = await ap.axios.get(`/flow-runs/${runId}`);
  return res.data as APFlowRun;
}

export async function triggerAPTestRun(flowId: string, payload?: Record<string, unknown>): Promise<APFlowRun> {
  const res = await ap.axios.post('/flow-runs', { flowId, triggerPayload: payload ?? {} });
  return res.data as APFlowRun;
}

// ── Pieces ────────────────────────────────────────────────────────────────────
export async function listAPPieces(params?: {
  includeHidden?: boolean;
  searchQuery?: string;
  tags?: string[];
}): Promise<APPiece[]> {
  const res = await ap.axios.get('/pieces', { params });
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
}

export async function getAPPiece(pieceName: string, version?: string): Promise<APPiece> {
  const res = await ap.axios.get(`/pieces/${encodeURIComponent(pieceName)}`, {
    params: version ? { version } : undefined,
  });
  return res.data as APPiece;
}

export async function getAPDynamicOptions(pieceName: string, payload: any): Promise<any> {
  const res = await ap.axios.post(`/pieces/${encodeURIComponent(pieceName)}/options`, payload);
  return res.data;
}

// ── Connections ───────────────────────────────────────────────────────────────
export async function listAPConnections(projectId: string, pieceName?: string) {
  const res = await ap.axios.get('/app-connections', { params: { projectId, pieceName } });
  return res.data as { data: APAppConnection[] };
}

export async function createAPConnection(projectId: string, data: {
  pieceName: string;
  name: string;
  type: 'API_KEY' | 'OAUTH2' | 'BASIC_AUTH' | 'CUSTOM_AUTH' | 'SECRET_TEXT';
  value: Record<string, unknown>;
}): Promise<APAppConnection> {
  const res = await ap.axios.post('/app-connections', { projectId, ...data });
  return res.data as APAppConnection;
}

export async function deleteAPConnection(connectionId: string): Promise<void> {
  await ap.axios.delete(`/app-connections/${connectionId}`);
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
export async function getAPWebhookUrl(flowId: string): Promise<string> {
  return `${env.ACTIVEPIECES_URL}/api/v1/webhooks/${flowId}`;
}

// ── Files ─────────────────────────────────────────────────────────────────────
export async function uploadAPFile(projectId: string, buffer: Buffer, mimeType: string, fileName: string) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', buffer, { filename: fileName, contentType: mimeType });
  form.append('type', 'UNKNOWN');
  const res = await ap.axios.post('/files', form, {
    params: { projectId },
    headers: form.getHeaders(),
  });
  return res.data as { id: string; url: string };
}
