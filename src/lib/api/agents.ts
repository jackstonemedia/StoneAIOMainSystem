/**
 * Typed Agent API functions.
 */
import { apiClient } from '../apiClient';
import type { Agent, AgentMessage, CreateAgentInput, UpdateAgentInput } from '../../types/agent';

export const agentsApi = {
  list: () =>
    apiClient.get<Agent[]>('/agents').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Agent>(`/agents/${id}`).then((r) => r.data),

  create: (data: CreateAgentInput) =>
    apiClient.post<Agent>('/agents', data).then((r) => r.data),

  update: (id: string, data: UpdateAgentInput) =>
    apiClient.put<Agent>(`/agents/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/agents/${id}`).then((r) => r.data),

  // ── AI Chat ──────────────────────────────────────────────────────────────────
  chat: (agentId: string | null, message: string, history: AgentMessage[]) =>
    apiClient
      .post<{ response: string }>('/conversations/chat', { agentId, message, history })
      .then((r) => r.data),

  // ── Workflow AI generation ────────────────────────────────────────────────────
  generateWorkflow: (prompt: string, apiKey?: string) =>
    apiClient
      .post<{ nodes: unknown[]; edges: unknown[] }>('/workflow-ai/generate', { prompt, apiKey })
      .then((r) => r.data),
};
