/**
 * Assistant API Client — Stone AIO
 */

import { apiClient, apiFetch } from '../apiClient';

export interface AssistantProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageUrl?: string;
  extractedText?: string;
  status: 'processing' | 'ready' | 'failed' | string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantProjectLink {
  id: string;
  projectId: string;
  entityType: 'contact' | 'company' | 'deal' | 'campaign' | 'workflow' | 'smart_list' | string;
  entityId: string;
  label?: string;
  createdAt: string;
}

export interface AssistantProject {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  instructions?: string;
  visibility: 'private' | 'workspace' | string;
  archivedAt?: string | null;
  files?: AssistantProjectFile[];
  links?: AssistantProjectLink[];
  chatCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversation {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  projectId?: string | null;
  pinnedAt?: string | null;
  mode: 'unset' | 'read_only' | 'draft' | 'full' | string;
  thinking: 'auto' | 'extended' | string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  parts: AssistantMessagePart[];
  status: 'complete' | 'stopped' | string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  searchableText?: string;
  feedback?: { rating?: 'up' | 'down'; comment?: string };
  createdAt: string;
  updatedAt: string;
}

export interface AssistantSettings {
  defaultMode: 'ask' | 'read_only' | 'draft' | 'full';
  thinking: 'auto' | 'extended';
  voice: string;
  speed: number;
  memoryEnabled: boolean;
  pastChatSearch: boolean;
  notify: Record<string, unknown>;
}

export interface AssistantWorkspaceSettings {
  id: string;
  workspaceId: string;
  maxMode: 'full' | 'draft' | 'read_only' | string;
  fullAutonomyRoles: string[];
  requireApprovalFor: Record<string, boolean>;
  bulkThreshold: number;
  dailyLimits: Record<string, number>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMemory {
  id: string;
  workspaceId: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantTaskRun {
  id: string;
  workspaceId: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed' | string;
  resultText?: string | null;
  error?: string | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  completedAt?: string | null;
}

export interface AssistantScheduledTask {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  prompt: string;
  cron: string;
  mode: string;
  status: 'active' | 'paused' | string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  runs?: AssistantTaskRun[];
}

export interface AssistantToolCall {
  id: string;
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  messageId?: string | null;
  source: string;
  toolName: string;
  risk: 'read' | 'write' | 'send' | 'destructive' | 'hardstop' | string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'done' | 'failed' | 'blocked';
  result?: unknown;
  error?: string | null;
  decidedAt?: string | null;
  executedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StreamEventCallback = (event: {
  type: string;
  data: Record<string, any>;
}) => void;

export const assistantApi = {
  listConversations: async (params: { cursor?: string; q?: string; projectId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.cursor) qs.set('cursor', params.cursor);
    if (params.q) qs.set('q', params.q);
    if (params.projectId) qs.set('projectId', params.projectId);
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const res = await apiClient.get<{ items: AssistantConversation[]; nextCursor: string | null }>(
      `/assistant/conversations${query}`
    );
    return res.data;
  },

  getConversation: async (id: string) => {
    const res = await apiClient.get<AssistantConversation & { messages: AssistantMessage[] }>(
      `/assistant/conversations/${id}`
    );
    return res.data;
  },

  createConversation: async (data: { title?: string; projectId?: string; mode?: string; thinking?: string } = {}) => {
    const res = await apiClient.post<AssistantConversation>('/assistant/conversations', data);
    return res.data;
  },

  updateConversation: async (
    id: string,
    data: { title?: string; projectId?: string | null; pinnedAt?: string | null; mode?: string; thinking?: string }
  ) => {
    const res = await apiClient.patch<AssistantConversation>(`/assistant/conversations/${id}`, data);
    return res.data;
  },

  deleteConversation: async (id: string) => {
    const res = await apiClient.delete<{ success: boolean }>(`/assistant/conversations/${id}`);
    return res.data;
  },

  sendFeedback: async (messageId: string, rating: 'up' | 'down', comment?: string) => {
    const res = await apiClient.post<{ success: boolean }>(`/assistant/messages/${messageId}/feedback`, {
      rating,
      comment,
    });
    return res.data;
  },

  getSettings: async () => {
    const res = await apiClient.get<AssistantSettings>('/assistant/settings');
    return res.data;
  },

  updateSettings: async (data: Partial<AssistantSettings>) => {
    const res = await apiClient.put<AssistantSettings>('/assistant/settings', data);
    return res.data;
  },

  getWorkspaceSettings: async () => {
    const res = await apiClient.get<AssistantWorkspaceSettings>('/assistant/workspace-settings');
    return res.data;
  },

  updateWorkspaceSettings: async (data: Partial<AssistantWorkspaceSettings>) => {
    const res = await apiClient.put<AssistantWorkspaceSettings>('/assistant/workspace-settings', data);
    return res.data;
  },

  listToolCalls: async (params: { status?: string; conversationId?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.conversationId) qs.set('conversationId', params.conversationId);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const res = await apiClient.get<AssistantToolCall[]>(`/assistant/tool-calls${query}`);
    return res.data;
  },

  approveToolCall: async (id: string, args?: Record<string, unknown>) => {
    const res = await apiClient.post<{ success: boolean; toolCall: AssistantToolCall }>(
      `/assistant/tool-calls/${id}/approve`,
      { args }
    );
    return res.data;
  },

  rejectToolCall: async (id: string) => {
    const res = await apiClient.post<{ success: boolean; toolCall: AssistantToolCall }>(
      `/assistant/tool-calls/${id}/reject`
    );
    return res.data;
  },

  listMemories: async (scope?: 'personal' | 'business' | 'all') => {
    const query = scope ? `?scope=${scope}` : '';
    const res = await apiClient.get<AssistantMemory[]>(`/assistant/memories${query}`);
    return res.data;
  },

  saveMemory: async (data: { key: string; value: string; category?: string }) => {
    const res = await apiClient.post<AssistantMemory>('/assistant/memories', data);
    return res.data;
  },

  updateMemory: async (id: string, data: { key?: string; value?: string; category?: string }) => {
    const res = await apiClient.patch<AssistantMemory>(`/assistant/memories/${id}`, data);
    return res.data;
  },

  deleteMemory: async (id: string) => {
    const res = await apiClient.delete<{ success: boolean }>(`/assistant/memories/${id}`);
    return res.data;
  },

  clearAllMemories: async (scope: 'personal' | 'business' = 'personal') => {
    const res = await apiClient.delete<{ success: boolean; count: number }>(`/assistant/memories?scope=${scope}`);
    return res.data;
  },

  listScheduledTasks: async () => {
    const res = await apiClient.get<AssistantScheduledTask[]>('/assistant/scheduled-tasks');
    return res.data;
  },

  getScheduledTask: async (id: string) => {
    const res = await apiClient.get<AssistantScheduledTask & { runs: AssistantTaskRun[] }>(
      `/assistant/scheduled-tasks/${id}`
    );
    return res.data;
  },

  createScheduledTask: async (data: { title: string; prompt: string; cron?: string; mode?: string }) => {
    const res = await apiClient.post<AssistantScheduledTask>('/assistant/scheduled-tasks', data);
    return res.data;
  },

  updateScheduledTask: async (
    id: string,
    data: Partial<{ title: string; prompt: string; cron: string; mode: string; status: string }>
  ) => {
    const res = await apiClient.patch<AssistantScheduledTask>(`/assistant/scheduled-tasks/${id}`, data);
    return res.data;
  },

  deleteScheduledTask: async (id: string) => {
    const res = await apiClient.delete<{ success: boolean }>(`/assistant/scheduled-tasks/${id}`);
    return res.data;
  },

  runScheduledTask: async (id: string) => {
    const res = await apiClient.post<AssistantTaskRun>(`/assistant/scheduled-tasks/${id}/run`, {});
    return res.data;
  },

  listTaskRuns: async (id: string) => {
    const res = await apiClient.get<AssistantTaskRun[]>(`/assistant/scheduled-tasks/${id}/runs`);
    return res.data;
  },

  searchPastChats: async (query: string, limit = 10) => {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await apiClient.get<Array<{ conversationId: string; messageId: string; text: string; createdAt: string }>>(
      `/assistant/search?${qs.toString()}`
    );
    return res.data;
  },

  /**
   * Streams a message using SSE over POST.
   */
  sendMessageStream: async (
    conversationId: string,
    content: string,
    options: {
      mode?: string;
      thinking?: string;
      attachments?: Array<{ type: 'image' | 'file'; name: string; mimeType: string; data: string }>;
      surface?: string;
      entity?: { type: string; id: string; name?: string };
      signal?: AbortSignal;
    } = {},
    onEvent: StreamEventCallback
  ): Promise<void> => {
    const res = await apiFetch(`/api/assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        mode: options.mode,
        thinking: options.thinking,
        attachments: options.attachments,
        surface: options.surface,
        entity: options.entity,
      }),
      signal: options.signal,
    });

    if (!res.body) throw new Error('ReadableStream not supported by browser/environment');
    await readSSEStream(res.body, onEvent);
  },

  /**
   * Regenerates the last assistant response.
   */
  regenerateStream: async (
    conversationId: string,
    signal: AbortSignal | undefined,
    onEvent: StreamEventCallback
  ): Promise<void> => {
    const res = await apiFetch(`/api/assistant/conversations/${conversationId}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({}),
      signal,
    });

    if (!res.body) throw new Error('ReadableStream not supported');
    await readSSEStream(res.body, onEvent);
  },

  /**
   * Edits a prior message and streams a new branch.
   */
  editMessageStream: async (
    conversationId: string,
    messageId: string,
    content: string,
    signal: AbortSignal | undefined,
    onEvent: StreamEventCallback
  ): Promise<void> => {
    const res = await apiFetch(`/api/assistant/conversations/${conversationId}/messages/${messageId}/edit`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      signal,
    });

    if (!res.body) throw new Error('ReadableStream not supported');
    await readSSEStream(res.body, onEvent);
  },

  /**
   * Stateless temporary chat stream.
   */
  sendTemporaryMessageStream: async (
    messages: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string }> }>,
    thinking: string | undefined,
    signal: AbortSignal | undefined,
    onEvent: StreamEventCallback
  ): Promise<void> => {
    const res = await apiFetch('/api/assistant/temporary/messages', {
      method: 'POST',
      body: JSON.stringify({ messages, thinking }),
      signal,
    });

    if (!res.body) throw new Error('ReadableStream not supported');
    await readSSEStream(res.body, onEvent);
  },

  /**
   * Projects API
   */
  listProjects: async (options?: { filter?: string; search?: string }): Promise<AssistantProject[]> => {
    const params = new URLSearchParams();
    if (options?.filter) params.set('filter', options.filter);
    if (options?.search) params.set('search', options.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/api/assistant/projects${qs}`);
    return res.json();
  },

  getProject: async (id: string): Promise<AssistantProject> => {
    const res = await apiFetch(`/api/assistant/projects/${id}`);
    return res.json();
  },

  createProject: async (data: Partial<AssistantProject>): Promise<AssistantProject> => {
    const res = await apiFetch('/api/assistant/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateProject: async (
    id: string,
    data: Partial<AssistantProject> & { archived?: boolean }
  ): Promise<AssistantProject> => {
    const res = await apiFetch(`/api/assistant/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteProject: async (id: string): Promise<void> => {
    await apiFetch(`/api/assistant/projects/${id}`, { method: 'DELETE' });
  },

  addProjectFile: async (
    projectId: string,
    data: Partial<AssistantProjectFile>
  ): Promise<AssistantProjectFile> => {
    const res = await apiFetch(`/api/assistant/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteProjectFile: async (projectId: string, fileId: string): Promise<void> => {
    await apiFetch(`/api/assistant/projects/${projectId}/files/${fileId}`, { method: 'DELETE' });
  },

  addProjectLink: async (
    projectId: string,
    data: Partial<AssistantProjectLink>
  ): Promise<AssistantProjectLink> => {
    const res = await apiFetch(`/api/assistant/projects/${projectId}/links`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteProjectLink: async (projectId: string, linkId: string): Promise<void> => {
    await apiFetch(`/api/assistant/projects/${projectId}/links/${linkId}`, { method: 'DELETE' });
  },
};

/**
 * Parses Server-Sent Events from a ReadableStream.
 */
async function readSSEStream(stream: ReadableStream<Uint8Array>, onEvent: StreamEventCallback): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventType = 'message';
        let dataStr = '';

        const lines = block.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (dataStr) {
          try {
            const data = JSON.parse(dataStr);
            onEvent({ type: eventType, data });
          } catch {
            // Non-JSON SSE payload
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
