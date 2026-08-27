/**
 * Zod validation schemas for the CRM API.
 * Centralised here so both routes and services can import them.
 */
import { z } from 'zod';

export const ContactSchema = z.object({
  firstName: z.string().default('Unknown'),
  lastName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  emailsJson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  phonesJson: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  tagsJson: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  color: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  lifecycleStage: z.string().optional().nullable(),
  leadStatus: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  about: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).passthrough();

export const CompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  logoUrl: z.string().optional().nullable(),
  customFieldsJson: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  employees: z.string().optional().nullable(),
  revenue: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const DealSchema = z.object({
  title: z.string().min(1, "Deal title is required"),
  amount: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseFloat(v) || 0 : v)).default(0),
  priority: z.string().default('medium'),
  probability: z.union([z.number(), z.string()]).transform(v => (typeof v === 'string' ? parseInt(v) || 50 : v)).default(50),
  closeDate: z.string().optional().nullable(),
  pipelineStageId: z.string().min(1, "Pipeline stage is required"),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  customFieldsJson: z.string().optional().nullable(),
});

export const TaskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  status: z.string().default('pending'),
  priority: z.string().default('medium'),
  type: z.string().optional().nullable(),
});

export const SmartListSchema = z.object({
  name: z.string().min(1),
  filters: z.array(z.any()).optional().default([]),
});

export const BulkActionSchema = z.object({
  action: z.enum(['delete', 'tag', 'assign', 'export']),
  contactIds: z.array(z.string()).min(1),
  payload: z.any().optional(),
});

export const AgentSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['workflow', 'voice', 'autonomous']).optional(),
  status: z.enum(['draft', 'active', 'paused', 'error']).optional(),
  config: z.any().optional(),
});

export const CampaignSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['email', 'sms', 'social', 'mixed']).optional(),
  status: z.string().optional(),
  subject: z.string().optional().nullable(),
  previewText: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  audienceJson: z.any().optional(),
  scheduledFor: z.string().optional().nullable(),
});

export const AppointmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
  location: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string().optional(),
});
