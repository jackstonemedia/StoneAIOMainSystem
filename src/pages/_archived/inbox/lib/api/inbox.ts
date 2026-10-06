import { apiClient } from '../../../../lib/apiClient';
import type {
  InboxChannel,
  InboxConversation,
  InboxConversationList,
  InboxMessage,
  InboxLabel,
  InboxTeam,
  CannedResponse,
  InboxContact,
  InboxAgent,
  InboxAgentSignature,
  InboxFilters,
  InboxReportOverview,
} from '../../types/inbox';

const BASE = '/inbox';

export const inboxApi = {
  // ── Provision ──────────────────────────────────────────────────────────────
  provision: () =>
    apiClient.post(`${BASE}/provision`).then((r: any) => r.data),

  getProvisionStatus: () =>
    apiClient.get(`${BASE}/provision`).then((r: any) => r.data),

  // ── Channels ───────────────────────────────────────────────────────────────
  listChannels: (): Promise<InboxChannel[]> =>
    apiClient.get(`${BASE}/channels`).then((r: any) => r.data),

  getChannel: (id: string): Promise<InboxChannel> =>
    apiClient.get(`${BASE}/channels/${id}`).then((r: any) => r.data),

  createChannel: (data: Partial<InboxChannel>): Promise<InboxChannel> =>
    apiClient.post(`${BASE}/channels`, data).then((r: any) => r.data),

  updateChannel: (id: string, data: Partial<InboxChannel>): Promise<InboxChannel> =>
    apiClient.patch(`${BASE}/channels/${id}`, data).then((r: any) => r.data),

  deleteChannel: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/channels/${id}`).then(() => undefined),

  getEmbedCode: (id: string): Promise<{ html: string; token: string }> =>
    apiClient.get(`${BASE}/channels/${id}/embed`).then((r: any) => r.data),

  // ── Conversations ──────────────────────────────────────────────────────────
  listConversations: (filters: InboxFilters = {}): Promise<InboxConversationList> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return apiClient.get(`${BASE}/conversations?${params}`).then((r: any) => r.data);
  },

  getConversation: (id: string): Promise<InboxConversation> =>
    apiClient.get(`${BASE}/conversations/${id}`).then((r: any) => r.data),

  createConversation: (data: {
    inboxChannelId: string;
    inboxContactId?: string;
    subject?: string;
  }): Promise<InboxConversation> =>
    apiClient.post(`${BASE}/conversations`, data).then((r: any) => r.data),

  updateConversation: (
    id: string,
    data: {
      status?: string;
      assignedUserId?: string | null;
      teamId?: string | null;
      priority?: string | null;
      snoozedUntil?: string | null;
    }
  ): Promise<InboxConversation> =>
    apiClient.patch(`${BASE}/conversations/${id}`, data).then((r: any) => r.data),

  // ── Messages ───────────────────────────────────────────────────────────────
  listMessages: (
    conversationId: string,
    params: { page?: number } = {}
  ): Promise<{ messages: InboxMessage[]; hasMore: boolean }> => {
    const qs = params.page ? `?page=${params.page}` : '';
    return apiClient.get(`${BASE}/conversations/${conversationId}/messages${qs}`).then((r: any) => r.data);
  },

  sendMessage: (
    conversationId: string,
    data: { content: string; private?: boolean; contentType?: string; contentAttributes?: object }
  ): Promise<InboxMessage> =>
    apiClient.post(`${BASE}/conversations/${conversationId}/messages`, data).then((r: any) => r.data),

  publishTyping: (conversationId: string): Promise<void> =>
    apiClient.post(`${BASE}/conversations/${conversationId}/typing`).then(() => undefined),

  // ── Copilot ────────────────────────────────────────────────────────────────
  generateDraft: (conversationId: string): Promise<{ draft: string }> =>
    apiClient.post(`${BASE}/copilot/draft`, { conversationId }).then((r: any) => r.data),

  summarizeConversation: (conversationId: string): Promise<{ summary: string }> =>
    apiClient.post(`${BASE}/copilot/summarize`, { conversationId }).then((r: any) => r.data),

  // ── Labels ─────────────────────────────────────────────────────────────────
  listLabels: (): Promise<InboxLabel[]> =>
    apiClient.get(`${BASE}/labels`).then((r: any) => r.data),

  createLabel: (data: Partial<InboxLabel>): Promise<InboxLabel> =>
    apiClient.post(`${BASE}/labels`, data).then((r: any) => r.data),

  updateLabel: (id: string, data: Partial<InboxLabel>): Promise<InboxLabel> =>
    apiClient.patch(`${BASE}/labels/${id}`, data).then((r: any) => r.data),

  deleteLabel: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/labels/${id}`).then(() => undefined),

  addConversationLabel: (conversationId: string, labelId: string): Promise<void> =>
    apiClient.post(`${BASE}/conversations/${conversationId}/labels`, { labelId }).then(() => undefined),

  removeConversationLabel: (conversationId: string, labelId: string): Promise<void> =>
    apiClient.delete(`${BASE}/conversations/${conversationId}/labels/${labelId}`).then(() => undefined),

  // ── Teams ──────────────────────────────────────────────────────────────────
  listTeams: (): Promise<InboxTeam[]> =>
    apiClient.get(`${BASE}/teams`).then((r: any) => r.data),

  createTeam: (data: Partial<InboxTeam>): Promise<InboxTeam> =>
    apiClient.post(`${BASE}/teams`, data).then((r: any) => r.data),

  updateTeam: (id: string, data: Partial<InboxTeam>): Promise<InboxTeam> =>
    apiClient.patch(`${BASE}/teams/${id}`, data).then((r: any) => r.data),

  deleteTeam: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/teams/${id}`).then(() => undefined),

  listTeamMembers: (teamId: string): Promise<InboxAgent[]> =>
    apiClient.get(`${BASE}/teams/${teamId}/members`).then((r: any) => r.data),

  addTeamMember: (teamId: string, userId: string): Promise<void> =>
    apiClient.post(`${BASE}/teams/${teamId}/members`, { userId }).then(() => undefined),

  removeTeamMember: (teamId: string, userId: string): Promise<void> =>
    apiClient.delete(`${BASE}/teams/${teamId}/members/${userId}`).then(() => undefined),

  // ── Canned Responses ───────────────────────────────────────────────────────
  listCannedResponses: (q?: string): Promise<CannedResponse[]> =>
    apiClient.get(`${BASE}/canned-responses${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r: any) => r.data),

  createCannedResponse: (data: Partial<CannedResponse>): Promise<CannedResponse> =>
    apiClient.post(`${BASE}/canned-responses`, data).then((r: any) => r.data),

  updateCannedResponse: (id: string, data: Partial<CannedResponse>): Promise<CannedResponse> =>
    apiClient.patch(`${BASE}/canned-responses/${id}`, data).then((r: any) => r.data),

  deleteCannedResponse: (id: string): Promise<void> =>
    apiClient.delete(`${BASE}/canned-responses/${id}`).then(() => undefined),

  // ── Contacts ───────────────────────────────────────────────────────────────
  listContacts: (q?: string): Promise<InboxContact[]> =>
    apiClient.get(`${BASE}/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r: any) => r.data),

  getContact: (id: string): Promise<InboxContact> =>
    apiClient.get(`${BASE}/contacts/${id}`).then((r: any) => r.data),

  createContact: (data: Partial<InboxContact>): Promise<InboxContact> =>
    apiClient.post(`${BASE}/contacts`, data).then((r: any) => r.data),

  updateContact: (id: string, data: Partial<InboxContact>): Promise<InboxContact> =>
    apiClient.patch(`${BASE}/contacts/${id}`, data).then((r: any) => r.data),

  // ── Agents ─────────────────────────────────────────────────────────────────
  listAgents: (): Promise<InboxAgent[]> =>
    apiClient.get(`${BASE}/agents`).then((r: any) => r.data),

  updateMyAvailability: (status: string): Promise<void> =>
    apiClient.patch(`${BASE}/agents/me/availability`, { status }).then(() => undefined),

  getMySignature: (): Promise<InboxAgentSignature | null> =>
    apiClient.get(`${BASE}/agents/me/signature`).then((r: any) => r.data).catch(() => null),

  updateMySignature: (body: string): Promise<InboxAgentSignature> =>
    apiClient.patch(`${BASE}/agents/me/signature`, { body }).then((r: any) => r.data),

  // ── Reports ────────────────────────────────────────────────────────────────
  getReportOverview: (startDate: string, endDate: string): Promise<InboxReportOverview> =>
    apiClient.get(`${BASE}/reports/overview?startDate=${startDate}&endDate=${endDate}`).then((r: any) => r.data),

  getAgentReport: (startDate: string, endDate: string): Promise<any[]> =>
    apiClient.get(`${BASE}/reports/agents?startDate=${startDate}&endDate=${endDate}`).then((r: any) => r.data),

  getLabelReport: (startDate: string, endDate: string): Promise<any[]> =>
    apiClient.get(`${BASE}/reports/labels?startDate=${startDate}&endDate=${endDate}`).then((r: any) => r.data),

  getConversationTrend: (startDate: string, endDate: string): Promise<any[]> =>
    apiClient.get(`${BASE}/reports/conversations?startDate=${startDate}&endDate=${endDate}`).then((r: any) => r.data),
};
