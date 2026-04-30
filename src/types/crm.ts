/**
 * CRM domain types — mirrors the Prisma schema.
 * All dates are ISO 8601 strings (JSON serialized from DateTime).
 */

export interface Contact {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  leadScore: number;
  healthScore: number;
  ownerId: string | null;
  dndEnabled: boolean;
  preferredChannel: string;
  about: string | null;
  /** Parsed from tagsJson — the API should return this as a real array */
  tags: string[];
  source: string | null;
  status: string | null;
  color: string;
  companyId: string | null;
  assignedUserId: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Populated when fetched with relations */
  company?: Pick<Company, 'id' | 'name'> | null;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  employees: string | null;
  revenue: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Populated when fetched with relations */
  contacts?: Pick<Contact, 'id' | 'firstName' | 'lastName' | 'email'>[];
  deals?: Pick<Deal, 'id' | 'title' | 'amount'>[];
}

export interface Deal {
  id: string;
  workspaceId: string;
  title: string;
  amount: number;
  probability: number;
  priority: 'high' | 'medium' | 'low';
  pipelineStageId: string | null;
  contactId: string | null;
  companyId: string | null;
  ownerId: string | null;
  description: string | null;
  wonLostReason: string | null;
  daysInStage: number;
  lastActivity: string | null;
  closeDate: string | null;
  createdAt: string;
  updatedAt: string;
  /** Populated when fetched with relations */
  contact?: Pick<Contact, 'id' | 'firstName' | 'lastName'> | null;
  pipelineStage?: Pick<PipelineStage, 'id' | 'name' | 'color'> | null;
}

export interface Task {
  id: string;
  workspaceId: string;
  contactId: string | null;
  title: string;
  description: string | null;
  type: string;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Pick<Contact, 'id' | 'firstName' | 'lastName'> | null;
}

export interface Activity {
  id: string;
  workspaceId: string | null;
  dealId: string | null;
  contactId: string | null;
  type: string;
  title: string;
  notes: string | null;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  order: number;
  probability: number;
  createdAt: string;
  updatedAt: string;
}

export interface SmartList {
  id: string;
  workspaceId: string;
  name: string;
  filters: SmartListFilter[];
  createdAt: string;
  updatedAt: string;
}

export interface SmartListFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
  value: string | number | boolean | null;
}

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateContactInput = Omit<
  Contact,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'company'
>;

export type UpdateContactInput = Partial<CreateContactInput>;

export type CreateCompanyInput = Omit<
  Company,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'contacts' | 'deals'
>;

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export type CreateDealInput = Omit<
  Deal,
  'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'contact' | 'pipelineStage'
>;

export type UpdateDealInput = Partial<CreateDealInput>;

export type CreateTaskInput = Omit<Task, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'contact'>;
export type UpdateTaskInput = Partial<CreateTaskInput>;
