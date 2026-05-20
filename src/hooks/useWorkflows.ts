import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { Workflow, WorkflowRun, APPiece, APConnection, APStep } from '../types/automation';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...workflowKeys.lists(), filters] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  runs: (workflowId: string) => [...workflowKeys.detail(workflowId), 'runs'] as const,
  run: (workflowId: string, runId: string) => [...workflowKeys.runs(workflowId), runId] as const,
};

// ── Workflows ─────────────────────────────────────────────────────────────────
export function useWorkflows(filters?: {
  status?: string;
  triggerType?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: workflowKeys.list(filters ?? {}),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Workflow[] }>('/workflows', { params: filters });
      return res.data.data;
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<Workflow>(`/workflows/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name?: string; description?: string }) => {
      const res = await apiClient.post<Workflow>('/workflows', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.lists() }),
  });
}

export function useUpdateWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name?: string;
      description?: string;
      trigger?: APStep;
      actions?: APStep[];
      tags?: string[];
    }) => {
      const res = await apiClient.put<Workflow>(`/workflows/${workflowId}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) });
      qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workflows/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.lists() }),
  });
}



// ── Runs ──────────────────────────────────────────────────────────────────────
export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: workflowKeys.runs(workflowId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: WorkflowRun[] }>(`/workflows/${workflowId}/runs`);
      return res.data.data;
    },
    enabled: !!workflowId,
    refetchInterval: (query) => {
      // Poll every 3s if any run is RUNNING
      const runs = query.state.data;
      return runs?.some((r) => r.status === 'RUNNING') ? 3000 : false;
    },
  });
}



// ── Native Engine Hooks ───────────────────────────────────────────────────────
export function useNativeWorkflowDefinition(id: string) {
  return useQuery({
    queryKey: ['native-workflow-def', id],
    queryFn: async () => {
      const res = await apiClient.get<{ nodes: any[], edges: any[] }>(`/workflows/${id}/definition`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useSaveNativeDefinition(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nodes: any[], edges: any[] }) => {
      const res = await apiClient.post(`/workflows/${workflowId}/definition`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['native-workflow-def', workflowId] });
    },
  });
}

export function usePublishNativeWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/workflows/${workflowId}/publish-native`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) });
      qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function usePauseNativeWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/workflows/${workflowId}/pause-native`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) });
      qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function useTestNativeWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (triggerData?: any) => {
      const res = await apiClient.post(`/workflows/${workflowId}/test-native`, { triggerData });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.runs(workflowId) });
    },
  });
}

export function useTestNativeNode(workflowId: string) {
  return useMutation({
    mutationFn: async (data: { nodeId: string, inputItems?: any[] }) => {
      const res = await apiClient.post(`/workflows/${workflowId}/test-node`, data);
      return res.data;
    }
  });
}

export function useNativeWorkflowRunDetail(runId: string) {
  return useQuery({
    queryKey: ['native-workflow-run-detail', runId],
    queryFn: async () => {
      const res = await apiClient.get(`/workflows/runs/${runId}/detail`);
      return res.data;
    },
    enabled: !!runId,
  });
}
