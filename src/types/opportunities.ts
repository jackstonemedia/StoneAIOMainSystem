export interface Stage {
  id: string;
  pipelineId?: string;
  name: string;
  color: string;
  order: number;
  probability: number;
  isWon?: boolean;
  isLost?: boolean;
  requiredFieldsJson?: string | null;
  pipeline?: Pipeline;
  _count?: { deals: number };
}

export interface WonLostReason {
  id: string;
  workspaceId?: string;
  pipelineId?: string | null;
  reason: string;
  type: 'won' | 'lost' | 'both';
  createdAt?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  staleThresholdDays: number;
  allowStageSkip: boolean;
  enableLineItems: boolean;
  visibleTabsJson?: string | null;
  stages: Stage[];
  wonLostReasons?: WonLostReason[];
  opportunityCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LineItem {
  id: string;
  dealId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityActivityLog {
  id: string;
  workspaceId?: string;
  dealId: string;
  type: 'created' | 'stage_change' | 'field_edit' | 'owner_reassigned' | 'tags_changed' | 'won_lost' | 'line_item' | 'file' | string;
  title: string;
  description?: string | null;
  userId?: string | null;
  userName?: string | null;
  metadataJson?: string | null;
  createdAt: string;
}

export interface CustomField {
  id: string;
  workspaceId?: string;
  entityType: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'dropdown' | 'multi-select' | 'checkbox' | 'url' | 'select' | 'boolean';
  optionsJson?: string | null;
  required: boolean;
  order: number;
  pipelineId?: string | null;
  scope: 'all' | 'pipeline';
  createdAt?: string;
}

export interface Tag {
  id: string;
  workspaceId?: string;
  name: string;
  color: string;
  isShared?: boolean;
  entityType?: string;
  usageCount?: number;
  createdAt?: string;
}

export interface SavedView {
  id: string;
  workspaceId?: string;
  pipelineId?: string | null;
  name: string;
  isDefault: boolean;
  viewType: 'board' | 'list' | 'calendar';
  filtersJson: string;
  sortJson?: string | null;
  columnsJson?: string | null;
  cardConfigJson?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpportunityContact {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface OpportunityCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
}

export interface Opportunity {
  id: string;
  title: string;
  amount: number;
  priority: string;
  probability: number;
  closeDate?: string | null;
  pipelineStageId?: string | null;
  pipelineStage?: Stage | null;
  contactId?: string | null;
  contact?: OpportunityContact | null;
  companyId?: string | null;
  company?: OpportunityCompany | null;
  ownerId?: string | null;
  source?: string | null;
  status: 'open' | 'won' | 'lost';
  wonLostReason?: string | null;
  wonLostNotes?: string | null;
  tags: string[];
  tagsJson?: string | null;
  customFields: Record<string, any>;
  customFieldsJson?: string | null;
  description?: string | null;
  daysInStage: number;
  lineItems?: LineItem[];
  opportunityLogs?: OpportunityActivityLog[];
  activities?: any[];
  attachments?: any[];
  automations?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CardConfig {
  showContact: boolean;
  showValue: boolean;
  showTags: boolean;
  showOwner: boolean;
  showDaysInStage: boolean;
  showCustomFields: boolean;
  visibleCustomFieldIds?: string[];
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: number;
  isCustom?: boolean;
}

export interface FilterState {
  stages: string[];
  owners: string[];
  tags: string[];
  minValue?: number | null;
  maxValue?: number | null;
  sources: string[];
  createdStartDate?: string;
  createdEndDate?: string;
  closeStartDate?: string;
  closeEndDate?: string;
  status?: string;
  customFields: Record<string, any>;
}
