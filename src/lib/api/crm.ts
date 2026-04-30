/**
 * Typed CRM API functions.
 * Replaces the untyped functions in src/lib/api.ts for the /crm namespace.
 */
import { apiClient } from '../apiClient';
import type {
  Contact,
  Company,
  Deal,
  Task,
  Activity,
  Pipeline,
  SmartList,
  CreateContactInput,
  UpdateContactInput,
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateDealInput,
  UpdateDealInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../types/crm';

export const crmApi = {
  // ── Contacts ────────────────────────────────────────────────────────────────
  getContacts: () =>
    apiClient.get<Contact[]>('/crm/contacts').then((r) => r.data),

  getContact: (id: string) =>
    apiClient.get<Contact>(`/crm/contacts/${id}`).then((r) => r.data),

  createContact: (data: CreateContactInput) =>
    apiClient.post<Contact>('/crm/contacts', data).then((r) => r.data),

  updateContact: (id: string, data: UpdateContactInput) =>
    apiClient.put<Contact>(`/crm/contacts/${id}`, data).then((r) => r.data),

  deleteContact: (id: string) =>
    apiClient.delete(`/crm/contacts/${id}`).then((r) => r.data),

  bulkDeleteContacts: (ids: string[]) =>
    apiClient.post('/crm/contacts/bulk-delete', { ids }).then((r) => r.data),

  // ── Companies ───────────────────────────────────────────────────────────────
  getCompanies: () =>
    apiClient.get<Company[]>('/crm/companies').then((r) => r.data),

  getCompany: (id: string) =>
    apiClient.get<Company>(`/crm/companies/${id}`).then((r) => r.data),

  createCompany: (data: CreateCompanyInput) =>
    apiClient.post<Company>('/crm/companies', data).then((r) => r.data),

  updateCompany: (id: string, data: UpdateCompanyInput) =>
    apiClient.put<Company>(`/crm/companies/${id}`, data).then((r) => r.data),

  deleteCompany: (id: string) =>
    apiClient.delete(`/crm/companies/${id}`).then((r) => r.data),

  // ── Deals ────────────────────────────────────────────────────────────────────
  getDeals: () =>
    apiClient.get<Deal[]>('/crm/deals').then((r) => r.data),

  createDeal: (data: CreateDealInput) =>
    apiClient.post<Deal>('/crm/deals', data).then((r) => r.data),

  updateDeal: (id: string, data: UpdateDealInput) =>
    apiClient.put<Deal>(`/crm/deals/${id}`, data).then((r) => r.data),

  deleteDeal: (id: string) =>
    apiClient.delete(`/crm/deals/${id}`).then((r) => r.data),

  // ── Tasks ────────────────────────────────────────────────────────────────────
  getTasks: () =>
    apiClient.get<Task[]>('/crm/tasks').then((r) => r.data),

  createTask: (data: CreateTaskInput) =>
    apiClient.post<Task>('/crm/tasks', data).then((r) => r.data),

  updateTask: (id: string, data: UpdateTaskInput) =>
    apiClient.put<Task>(`/crm/tasks/${id}`, data).then((r) => r.data),

  deleteTask: (id: string) =>
    apiClient.delete(`/crm/tasks/${id}`).then((r) => r.data),

  // ── Activities ───────────────────────────────────────────────────────────────
  getActivities: () =>
    apiClient.get<Activity[]>('/crm/activities').then((r) => r.data),

  // ── Pipelines ────────────────────────────────────────────────────────────────
  getPipelines: () =>
    apiClient.get<Pipeline[]>('/crm/pipelines').then((r) => r.data),

  // ── Smart Lists ──────────────────────────────────────────────────────────────
  getSmartLists: () =>
    apiClient.get<SmartList[]>('/crm/smart-lists').then((r) => r.data),

  createSmartList: (data: Omit<SmartList, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<SmartList>('/crm/smart-lists', data).then((r) => r.data),

  deleteSmartList: (id: string) =>
    apiClient.delete(`/crm/smart-lists/${id}`).then((r) => r.data),

  // ── Dashboard ────────────────────────────────────────────────────────────────
  getDashboard: () =>
    apiClient.get<Record<string, unknown>>('/crm/dashboard').then((r) => r.data),
};
