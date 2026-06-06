export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface Business extends BaseEntity {
  name: string;
  type: string;
  industry?: string;
  website?: string;
}

export interface Contact extends BaseEntity {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  status: string;
  tags: string[];
  leadScore: number;
  customFields: Record<string, any>;
  ownerId?: string;
  source?: string;
  location?: string;
}

export interface Company extends BaseEntity {
  name: string;
  domain?: string;
  industry?: string;
  revenue?: string;
  employees?: string;
}

export interface Deal extends BaseEntity {
  title: string;
  amount: number;
  contactId?: string;
  companyId?: string;
  pipelineId: string;
  stageId: string;
  status: 'open' | 'won' | 'lost';
  closeDate?: string;
  ownerId?: string;
}

export interface Pipeline extends BaseEntity {
  name: string;
  isDefault?: boolean;
}

export interface PipelineStage extends BaseEntity {
  pipelineId: string;
  name: string;
  order: number;
  color?: string;
  probability?: number;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  assigneeId?: string;
  contactId?: string;
  dealId?: string;
}

export interface SubTask extends BaseEntity {
  taskId: string;
  title: string;
  isCompleted: boolean;
}

export interface Project extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
  status: 'active' | 'completed' | 'on_hold';
  memberIds: string[];
}

export interface ProjectColumn extends BaseEntity {
  projectId: string;
  name: string;
  order: number;
}

export interface CalendarEvent extends BaseEntity {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  contactId?: string;
  location?: string;
}

export interface BookingPage extends BaseEntity {
  title: string;
  slug: string;
  durations: number[];
  availableHours: Record<string, string[]>;
  questions: Array<{ id: string; label: string; required: boolean }>;
  active: boolean;
}

export interface BookingSubmission extends BaseEntity {
  bookingPageId: string;
  name: string;
  email: string;
  phone?: string;
  selectedSlot: string;
  duration: number;
  answers: Record<string, any>;
  status: 'confirmed' | 'cancelled';
}

export interface EmailCampaign extends BaseEntity {
  name: string;
  subject: string;
  segmentId?: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt?: string;
  blocksJson: string;
}

export interface EmailBlock {
  id: string;
  type: string;
  content: any;
}

export interface SMSCampaign extends BaseEntity {
  name: string;
  content: string;
  segmentId?: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt?: string;
}

export interface Form extends BaseEntity {
  name: string;
  fieldsJson: string;
  active: boolean;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
}

export interface FormResponse extends BaseEntity {
  formId: string;
  contactId?: string;
  answersJson: string;
}

export interface LandingPage extends BaseEntity {
  name: string;
  slug: string;
  status: 'draft' | 'published';
  seoTitle?: string;
  seoDesc?: string;
  sectionsJson: string;
}

export interface PageSection {
  id: string;
  type: string;
  config: any;
}

export interface Automation extends BaseEntity {
  name: string;
  triggerType: string;
  nodesJson: string;
  active: boolean;
}

export interface AutomationNode {
  id: string;
  type: string;
  config: any;
  nextNodes: string[];
}

export interface AutomationEnrollment extends BaseEntity {
  automationId: string;
  contactId: string;
  status: 'active' | 'completed' | 'failed';
  currentNodeId: string;
}

export interface SocialPost extends BaseEntity {
  platforms: string[];
  caption: string;
  imageUrl?: string;
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}

export interface Segment extends BaseEntity {
  name: string;
  rulesJson: string;
  conjunction: 'AND' | 'OR';
}

export interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

export interface Notification extends BaseEntity {
  title: string;
  body?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
}

export interface CustomField extends BaseEntity {
  label: string;
  type: string;
  entityType: 'contact' | 'company' | 'deal';
  options?: string[];
}

export interface CannedResponse extends BaseEntity {
  title: string;
  content: string;
}

export interface ActivityLogEntry extends BaseEntity {
  type: string;
  entityId: string;
  entityType: string;
  description: string;
  userId: string;
}
