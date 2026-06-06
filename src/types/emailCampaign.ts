// ─── Campaign ────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'active'
export type CampaignType = 'one-time' | 'drip'

export type RecipientConfig =
  | { type: 'all' }
  | { type: 'segment'; segmentId: string }
  | { type: 'tag'; tagId: string }
  | { type: 'manual'; contactIds: string[] }

export interface ABTestConfig {
  enabled: boolean
  subjectA: string
  subjectB: string
  testPercentage: number
  winnerMetric: 'open_rate' | 'click_rate'
  autoSelectAfterHours: 1 | 4 | 24 | 48
  winnerId?: 'a' | 'b'
}

export interface RecipientTracking {
  contactId: string
  email: string
  status: 'pending' | 'delivered' | 'opened' | 'clicked' | 'unsubscribed' | 'bounced'
  lastEventAt?: string
}

export interface CampaignStats {
  recipients: number
  delivered: number
  opened: number
  clicked: number
  unsubscribed: number
  bounced: number
  timeline: {
    label: string
    opens: number
    clicks: number
  }[]
}

export interface EmailCampaignRecord {
  id: string
  createdAt: string
  updatedAt: string
  name: string
  type: CampaignType
  fromName: string
  fromEmail: string
  replyTo: string
  subject: string
  previewText: string
  recipientConfig: RecipientConfig
  templateJson: any
  htmlContent: string
  status: CampaignStatus
  scheduledAt?: string
  sentAt?: string
  abTest: ABTestConfig
  stats: CampaignStats
  recipientTracking: RecipientTracking[]
}

export type EmailCampaignDraft = Omit<EmailCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
