import { z } from 'zod';

export const OpportunityCreateSchema = z.object({
  title: z.string().min(1, 'Opportunity name is required'),
  amount: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseFloat(v) || 0 : v)).default(0),
  priority: z.string().default('medium'),
  probability: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseInt(v) || 0 : v)).default(0),
  closeDate: z.string().optional().nullable(),
  pipelineStageId: z.string().min(1, 'Pipeline stage is required'),
  pipelineId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  tagsJson: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional(),
  customFieldsJson: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).default('open'),
});

export const OpportunityUpdateSchema = z.object({
  title: z.string().optional(),
  amount: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseFloat(v) || 0 : v)).optional(),
  priority: z.string().optional(),
  probability: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseInt(v) || 0 : v)).optional(),
  closeDate: z.string().optional().nullable(),
  pipelineStageId: z.string().optional(),
  stageId: z.string().optional(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  tagsJson: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  customFields: z.record(z.string(), z.any()).optional(),
  customFieldsJson: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  wonLostReason: z.string().optional().nullable(),
  wonLostNotes: z.string().optional().nullable(),
});

export const OpportunityBulkActionSchema = z.object({
  action: z.enum(['change_stage', 'change_owner', 'add_tag', 'remove_tag', 'move_pipeline', 'delete', 'export']),
  opportunityIds: z.array(z.string()).min(1, 'At least one opportunity must be selected'),
  payload: z.object({
    stageId: z.string().optional(),
    pipelineId: z.string().optional(),
    ownerId: z.string().optional(),
    tag: z.string().optional(),
  }).optional(),
});

export const OpportunityImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.any())).min(1, 'At least one row required'),
  columnMap: z.record(z.string(), z.string()).optional(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  defaultTags: z.array(z.string()).optional(),
});

export const PipelineCreateSchema = z.object({
  name: z.string().min(1, 'Pipeline name is required'),
  staleThresholdDays: z.number().default(14),
  allowStageSkip: z.boolean().default(true),
  enableLineItems: z.boolean().default(false),
  visibleTabsJson: z.string().optional(),
  stages: z.array(z.object({
    name: z.string(),
    color: z.string().default('#52677D'),
    order: z.number().default(0),
    probability: z.number().default(0),
    isWon: z.boolean().default(false),
    isLost: z.boolean().default(false),
    requiredFieldsJson: z.string().optional(),
  })).optional(),
  wonLostReasons: z.array(z.object({
    reason: z.string(),
    type: z.enum(['won', 'lost', 'both']).default('both'),
  })).optional(),
  templatePreset: z.string().optional(),
  sourcePipelineId: z.string().optional(),
});

export const PipelineUpdateSchema = z.object({
  name: z.string().optional(),
  isDefault: z.boolean().optional(),
  staleThresholdDays: z.number().optional(),
  allowStageSkip: z.boolean().optional(),
  enableLineItems: z.boolean().optional(),
  visibleTabsJson: z.string().optional(),
});

export const StageCreateSchema = z.object({
  name: z.string().min(1, 'Stage name is required'),
  color: z.string().default('#52677D'),
  order: z.number().default(0),
  probability: z.number().default(0),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
  requiredFieldsJson: z.string().optional(),
});

export const StageUpdateSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
  probability: z.number().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  requiredFieldsJson: z.string().optional(),
});

export const LineItemSchema = z.object({
  name: z.string().min(1, 'Line item name is required'),
  description: z.string().optional().nullable(),
  quantity: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseFloat(v) || 1 : v)).default(1),
  unitPrice: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseFloat(v) || 0 : v)).default(0),
});

export const CustomFieldSchema = z.object({
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'number', 'currency', 'date', 'dropdown', 'multi-select', 'checkbox', 'url', 'select', 'boolean']),
  scope: z.enum(['all', 'pipeline']).default('all'),
  pipelineId: z.string().optional().nullable(),
  required: z.boolean().default(false),
  order: z.number().default(0),
  optionsJson: z.string().optional().nullable(),
});

export const WonLostReasonSchema = z.object({
  reason: z.string().min(1, 'Reason text is required'),
  type: z.enum(['won', 'lost', 'both']).default('both'),
  pipelineId: z.string().optional().nullable(),
});

export const SavedViewSchema = z.object({
  name: z.string().min(1, 'View name is required'),
  pipelineId: z.string().optional().nullable(),
  viewType: z.enum(['board', 'list', 'calendar']).default('board'),
  isDefault: z.boolean().default(false),
  filtersJson: z.string().default('[]'),
  sortJson: z.string().optional().nullable(),
  columnsJson: z.string().optional().nullable(),
  cardConfigJson: z.string().optional().nullable(),
});
