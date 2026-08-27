import { apiFetch } from '../apiClient';
import type {
  Opportunity,
  Pipeline,
  Stage,
  CustomField,
  Tag,
  WonLostReason,
  SavedView,
  LineItem,
} from '../../types/opportunities';

export interface ListOpportunitiesResponse {
  opportunities: Opportunity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    totalValue: number;
    totalCount: number;
    wonCount: number;
    lostCount: number;
  };
  pipeline?: Pipeline | null;
}

export const opportunitiesApi = {
  // ── Opportunities CRUD ───────────────────────────────────────────────────────
  list: async (params: Record<string, any> = {}): Promise<ListOpportunitiesResponse> => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        if (Array.isArray(v)) {
          if (v.length > 0) qs.append(k, v.join(','));
        } else {
          qs.append(k, String(v));
        }
      }
    }
    const res = await apiFetch(`/api/opportunities?${qs.toString()}`);
    return res.json();
  },

  get: async (id: string): Promise<Opportunity> => {
    const res = await apiFetch(`/api/opportunities/${id}`);
    return res.json();
  },

  create: async (data: Partial<Opportunity> & { pipelineStageId: string }): Promise<Opportunity> => {
    const res = await apiFetch('/api/opportunities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  update: async (id: string, data: Partial<Opportunity>): Promise<Opportunity> => {
    const res = await apiFetch(`/api/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  duplicate: async (id: string): Promise<Opportunity> => {
    const res = await apiFetch(`/api/opportunities/${id}/duplicate`, {
      method: 'POST',
    });
    return res.json();
  },

  movePipeline: async (id: string, pipelineId: string, stageId?: string): Promise<Opportunity> => {
    const res = await apiFetch(`/api/opportunities/${id}/move-pipeline`, {
      method: 'POST',
      body: JSON.stringify({ pipelineId, stageId }),
    });
    return res.json();
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  bulk: async (action: string, opportunityIds: string[], payload?: any): Promise<any> => {
    const res = await apiFetch('/api/opportunities/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, opportunityIds, payload }),
    });
    return res.json();
  },

  import: async (data: { rows: any[]; columnMap?: Record<string, string>; pipelineId?: string; stageId?: string; defaultTags?: string[] }) => {
    const res = await apiFetch('/api/opportunities/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  export: async (filters: Record<string, any> = {}): Promise<string> => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.append(k, String(v));
      }
    }
    const res = await apiFetch(`/api/opportunities/export?${qs.toString()}`);
    return res.text();
  },

  // ── Line Items ───────────────────────────────────────────────────────────────
  listLineItems: async (dealId: string): Promise<LineItem[]> => {
    const res = await apiFetch(`/api/opportunities/${dealId}/line-items`);
    return res.json();
  },

  createLineItem: async (dealId: string, data: Partial<LineItem>): Promise<LineItem> => {
    const res = await apiFetch(`/api/opportunities/${dealId}/line-items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateLineItem: async (dealId: string, itemId: string, data: Partial<LineItem>): Promise<LineItem> => {
    const res = await apiFetch(`/api/opportunities/${dealId}/line-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteLineItem: async (dealId: string, itemId: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/${dealId}/line-items/${itemId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // ── Pipelines & Stages ───────────────────────────────────────────────────────
  listPipelines: async (): Promise<Pipeline[]> => {
    const res = await apiFetch('/api/opportunities/pipelines');
    return res.json();
  },

  createPipeline: async (data: Partial<Pipeline> & { templatePreset?: string; sourcePipelineId?: string }): Promise<Pipeline> => {
    const res = await apiFetch('/api/opportunities/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updatePipeline: async (id: string, data: Partial<Pipeline>): Promise<Pipeline> => {
    const res = await apiFetch(`/api/opportunities/pipelines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deletePipeline: async (id: string, reassignmentStageId?: string): Promise<{ success: boolean }> => {
    const qs = reassignmentStageId ? `?reassignmentStageId=${reassignmentStageId}` : '';
    const res = await apiFetch(`/api/opportunities/pipelines/${id}${qs}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  reorderStages: async (pipelineId: string, stageIds: string[]): Promise<Stage[]> => {
    const res = await apiFetch(`/api/opportunities/pipelines/${pipelineId}/stages/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ stageIds }),
    });
    return res.json();
  },

  createStage: async (pipelineId: string, data: Partial<Stage>): Promise<Stage> => {
    const res = await apiFetch(`/api/opportunities/pipelines/${pipelineId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateStage: async (stageId: string, data: Partial<Stage>): Promise<Stage> => {
    const res = await apiFetch(`/api/opportunities/stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteStage: async (stageId: string, reassignmentStageId?: string): Promise<{ success: boolean }> => {
    const qs = reassignmentStageId ? `?reassignmentStageId=${reassignmentStageId}` : '';
    const res = await apiFetch(`/api/opportunities/stages/${stageId}${qs}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // ── Reasons ──────────────────────────────────────────────────────────────────
  listReasons: async (pipelineId?: string): Promise<WonLostReason[]> => {
    const qs = pipelineId ? `?pipelineId=${pipelineId}` : '';
    const res = await apiFetch(`/api/opportunities/reasons${qs}`);
    return res.json();
  },

  createReason: async (data: Partial<WonLostReason>): Promise<WonLostReason> => {
    const res = await apiFetch('/api/opportunities/reasons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateReason: async (id: string, data: Partial<WonLostReason>): Promise<WonLostReason> => {
    const res = await apiFetch(`/api/opportunities/reasons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteReason: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/reasons/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // ── Custom Fields ────────────────────────────────────────────────────────────
  listCustomFields: async (pipelineId?: string): Promise<CustomField[]> => {
    const qs = pipelineId ? `?pipelineId=${pipelineId}` : '';
    const res = await apiFetch(`/api/opportunities/custom-fields${qs}`);
    return res.json();
  },

  createCustomField: async (data: Partial<CustomField>): Promise<CustomField> => {
    const res = await apiFetch('/api/opportunities/custom-fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  reorderCustomFields: async (fieldIds: string[]): Promise<CustomField[]> => {
    const res = await apiFetch('/api/opportunities/custom-fields/reorder', {
      method: 'PUT',
      body: JSON.stringify({ fieldIds }),
    });
    return res.json();
  },

  updateCustomField: async (id: string, data: Partial<CustomField>): Promise<CustomField> => {
    const res = await apiFetch(`/api/opportunities/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteCustomField: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/custom-fields/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────
  listTags: async (): Promise<Tag[]> => {
    const res = await apiFetch('/api/opportunities/tags');
    return res.json();
  },

  createTag: async (data: Partial<Tag>): Promise<Tag> => {
    const res = await apiFetch('/api/opportunities/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateTag: async (id: string, data: Partial<Tag>): Promise<Tag> => {
    const res = await apiFetch(`/api/opportunities/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteTag: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/tags/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  mergeTags: async (sourceTagId: string, targetTagId: string): Promise<{ success: boolean }> => {
    const res = await apiFetch('/api/opportunities/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagId, targetTagId }),
    });
    return res.json();
  },

  // ── Saved Views ──────────────────────────────────────────────────────────────
  listSavedViews: async (pipelineId?: string): Promise<SavedView[]> => {
    const qs = pipelineId ? `?pipelineId=${pipelineId}` : '';
    const res = await apiFetch(`/api/opportunities/saved-views${qs}`);
    return res.json();
  },

  createSavedView: async (data: Partial<SavedView>): Promise<SavedView> => {
    const res = await apiFetch('/api/opportunities/saved-views', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateSavedView: async (id: string, data: Partial<SavedView>): Promise<SavedView> => {
    const res = await apiFetch(`/api/opportunities/saved-views/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteSavedView: async (id: string): Promise<{ success: boolean }> => {
    const res = await apiFetch(`/api/opportunities/saved-views/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};
