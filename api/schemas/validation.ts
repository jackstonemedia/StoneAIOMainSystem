/**
 * Zod validation schemas for the CRM API.
 * Centralised here so both routes and services can import them.
 */
import { z } from 'zod';

export const ContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  emailsJson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  phonesJson: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tagsJson: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  about: z.string().optional().nullable(),
});

export const CompanySchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().optional().nullable(),
  customFieldsJson: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  employees: z.string().optional().nullable(),
  revenue: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const DealSchema = z.object({
  title: z.string().min(1),
  amount: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional().nullable(),
  probability: z.number().min(0).max(100).optional().nullable(),
  closeDate: z.string().optional().nullable(),
  pipelineStageId: z.string().min(1),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  customFieldsJson: z.string().optional().nullable(),
});

export const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  dueDate: z.union([z.string(), z.literal('')]).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed']).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional().nullable(),
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
