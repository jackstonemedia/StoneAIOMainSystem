/**
 * Campaign & business hub domain types.
 */

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed';
export type CampaignType = 'email' | 'sms' | 'social' | 'mixed';

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  subject: string | null;
  previewText: string | null;
  content: string | null;
  audience: CampaignAudience | null;
  metrics: CampaignMetrics | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignAudience {
  segmentId?: string;
  tags?: string[];
  contactIds?: string[];
  estimatedSize?: number;
}

export interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export type CreateCampaignInput = Omit<Campaign, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>;
export type UpdateCampaignInput = Partial<CreateCampaignInput>;

// ── Appointments ──────────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  type: string;
  location: string | null;
  contactId: string | null;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
  contact?: { id: string; firstName: string; lastName: string } | null;
}

export type CreateAppointmentInput = Omit<Appointment, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'contact'>;
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>;

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  workspaceId: string;
  author: string;
  rating: number;
  text: string | null;
  source: 'google' | 'yelp' | 'facebook' | 'other';
  date: string;
  replied: boolean;
  replyText: string | null;
  createdAt: string;
  updatedAt: string;
}
