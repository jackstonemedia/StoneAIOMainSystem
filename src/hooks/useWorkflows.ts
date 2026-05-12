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
  pieces: () => ['pieces'] as const,
  piece: (name: string) => ['pieces', name] as const,
  connections: (pieceName?: string) => ['ap-connections', pieceName] as const,
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

export function usePublishWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Workflow>(`/workflows/${workflowId}/publish`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) }),
  });
}

export function useDisableWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Workflow>(`/workflows/${workflowId}/disable`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.detail(workflowId) }),
  });
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<Workflow>(`/workflows/${id}/duplicate`);
      return res.data;
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

export function useWorkflowRun(workflowId: string, runId: string) {
  return useQuery({
    queryKey: workflowKeys.run(workflowId, runId),
    queryFn: async () => {
      const res = await apiClient.get<WorkflowRun>(`/workflows/${workflowId}/runs/${runId}`);
      return res.data;
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      return query.state.data?.status === 'RUNNING' ? 2000 : false;
    },
  });
}

export function useTestWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: Record<string, unknown>) => {
      const res = await apiClient.post<WorkflowRun>(`/workflows/${workflowId}/test`, { payload });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.runs(workflowId) }),
  });
}

// ── Pieces ────────────────────────────────────────────────────────────────────
export function usePieces(search?: string) {
  return useQuery({
    queryKey: workflowKeys.pieces(),
    queryFn: async () => {
      const res = await apiClient.get<APPiece[]>('/workflows/pieces', {
        params: search ? { search } : undefined,
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // Pieces don't change often — cache 5 min
  });
}

export function usePiece(pieceName: string) {
  return useQuery({
    queryKey: workflowKeys.piece(pieceName),
    queryFn: async () => {
      const res = await apiClient.get<APPiece>(`/workflows/pieces/${encodeURIComponent(pieceName)}`);
      return res.data;
    },
    enabled: !!pieceName,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Connections ───────────────────────────────────────────────────────────────
export function useAPConnections(pieceName?: string) {
  return useQuery({
    queryKey: workflowKeys.connections(pieceName),
    queryFn: async () => {
      const res = await apiClient.get<APConnection[]>('/workflows/connections', {
        params: pieceName ? { pieceName } : undefined,
      });
      return res.data;
    },
  });
}

export function useCreateAPConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      pieceName: string;
      name: string;
      type: string;
      value: Record<string, unknown>;
    }) => {
      const res = await apiClient.post<APConnection>('/workflows/connections', data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: workflowKeys.connections(variables.pieceName) });
    },
  });
}

export function useAPDynamicOptions(pieceName: string, pieceVersion: string, stepName: string, propertyName: string, input: Record<string, any>, enabled: boolean) {
  return useQuery({
    queryKey: ['ap', 'options', pieceName, propertyName, input],
    queryFn: async () => {
      const res = await apiClient.post(`/workflows/pieces/${encodeURIComponent(pieceName)}/options`, {
        pieceVersion,
        stepName,
        propertyName,
        input,
      });
      return res.data?.options ?? [];
    },
    enabled: enabled && !!pieceName && !!propertyName,
    staleTime: 60000,
  });
}
