import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AutomationFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TableField {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'STATIC_DROPDOWN' | 'CHECKBOX';
  order: number;
  options: { label: string; value: string }[];
}

export interface TableRecord {
  id: string;
  cells: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationTable {
  id: string;
  name: string;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  fields: TableField[];
}

export interface AutomationTableDetail extends AutomationTable {
  records: TableRecord[];
  pagination: { page: number; pageSize: number; total: number };
}

// ── Query Keys ─────────────────────────────────────────────────────────────────

const folderKeys = {
  all: ['automation-folders'] as const,
};

const tableKeys = {
  all: ['automation-tables'] as const,
  detail: (id: string) => ['automation-tables', 'detail', id] as const,
};

// ── Folders ───────────────────────────────────────────────────────────────────

export function useFolders() {
  return useQuery({
    queryKey: folderKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<AutomationFolder[]>('/workflows/folders');
      return res.data;
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.post<AutomationFolder>('/workflows/folders', { name });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiClient.patch<AutomationFolder>(`/workflows/folders/${id}`, { name });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workflows/folders/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: folderKeys.all });
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useMoveWorkflowToFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workflowId, folderId }: { workflowId: string; folderId: string | null }) => {
      const res = await apiClient.patch(`/workflows/${workflowId}/folder`, { folderId });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workflowId: string) => {
      const res = await apiClient.patch(`/workflows/${workflowId}/favorite`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

// ── Global Runs ───────────────────────────────────────────────────────────────

export interface GlobalRunEntry {
  id: string;
  localId: string;
  workflowId: string;
  flowName: string;
  status: string;
  startTime: string;
  finishTime?: string;
  duration?: number;
  stepCount: number;
  errorMessage?: string;
}

export function useGlobalRuns(params?: {
  status?: string;
  flowId?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['global-runs', params],
    queryFn: async () => {
      const res = await apiClient.get<{ data: GlobalRunEntry[]; total: number; page: number; pageSize: number }>(
        '/workflows/runs',
        { params },
      );
      return res.data;
    },
    refetchInterval: (query) => {
      const runs = query.state.data?.data ?? [];
      return runs.some((r) => r.status === 'RUNNING') ? 3000 : false;
    },
  });
}

// ── Tables ────────────────────────────────────────────────────────────────────

export function useTables() {
  return useQuery({
    queryKey: tableKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<AutomationTable[]>('/tables');
      return res.data;
    },
  });
}

export function useTableDetail(id: string, params?: { search?: string; page?: number }) {
  return useQuery({
    queryKey: [...tableKeys.detail(id), params],
    queryFn: async () => {
      const res = await apiClient.get<AutomationTableDetail>(`/tables/${id}`, { params });
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiClient.post<AutomationTable>('/tables', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export function useRenameTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiClient.patch<AutomationTable>(`/tables/${id}`, { name });
      return res.data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: tableKeys.all });
      qc.invalidateQueries({ queryKey: tableKeys.detail(id) });
    },
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tables/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all }),
  });
}

export function useAddTableField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, name, type }: { tableId: string; name: string; type: string }) => {
      const res = await apiClient.post<TableField>(`/tables/${tableId}/fields`, { name, type });
      return res.data;
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}

export function useDeleteTableField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, fieldId }: { tableId: string; fieldId: string }) => {
      await apiClient.delete(`/tables/${tableId}/fields/${fieldId}`);
      return { tableId, fieldId };
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}

export function useCreateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, cells }: { tableId: string; cells: Record<string, unknown> }) => {
      const res = await apiClient.post<TableRecord>(`/tables/${tableId}/records`, { cells });
      return res.data;
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}

export function useUpdateRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, recordId, cells }: { tableId: string; recordId: string; cells: Record<string, unknown> }) => {
      const res = await apiClient.patch<TableRecord>(`/tables/${tableId}/records/${recordId}`, { cells });
      return res.data;
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, recordId }: { tableId: string; recordId: string }) => {
      await apiClient.delete(`/tables/${tableId}/records/${recordId}`);
      return { tableId, recordId };
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}

export function useBulkDeleteRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableId, recordIds }: { tableId: string; recordIds: string[] }) => {
      await apiClient.delete(`/tables/${tableId}/records`, { data: { recordIds } });
      return { tableId, recordIds };
    },
    onSuccess: (_data, { tableId }) => qc.invalidateQueries({ queryKey: tableKeys.detail(tableId) }),
  });
}
