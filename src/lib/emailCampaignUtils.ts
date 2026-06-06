import {
  EmailCampaignRecord, EmailCampaignDraft,
  RecipientConfig, CampaignStats, CampaignStatus
} from '../types/emailCampaign'
import { db, StorageKey } from './storage'
import { Contact, Segment, SegmentRule } from '../types'

// ─── Block factories removed ─────────────────────────────────────────────────────────────

// ─── Recipient resolution ─────────────────────────────────────────────────────────

export async function resolveRecipients(config: RecipientConfig): Promise<Contact[]> {
  const allContacts = await db.get<Contact>(StorageKey.CONTACTS)

  switch (config.type) {
    case 'all':
      return allContacts.filter(c => c.email)

    case 'segment': {
      const segments = await db.get<Segment>(StorageKey.SEGMENTS)
      const segment = segments.find(s => s.id === config.segmentId)
      if (!segment) return []
      const { evaluateSegment } = await import('./segmentEngine')
      const rules: SegmentRule[] = JSON.parse(segment.rulesJson || '[]')
      return evaluateSegment(rules, segment.conjunction, allContacts).filter((c: Contact) => c.email)
    }

    case 'tag':
      return allContacts.filter(c => c.email && c.tags?.includes(config.tagId))

    case 'manual':
      return allContacts.filter(c => c.email && config.contactIds.includes(c.id))
  }
}

export async function getRecipientCount(config: RecipientConfig): Promise<number> {
  const contacts = await resolveRecipients(config)
  return contacts.length
}

// ─── Personalization token replacement ───────────────────────────────────────────

export function replaceTokens(html: string, contact: Contact, unsubscribeUrl = '#'): string {
  return html
    .replace(/\{\{first_name\}\}/g, contact.firstName || '')
    .replace(/\{\{last_name\}\}/g, contact.lastName || '')
    .replace(/\{\{company\}\}/g, '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{unsubscribe_link\}\}/g, unsubscribeUrl)
}

// ─── HTML renderer removed ───────────────────────────────────────────────────────────────

// ─── Empty campaign factory ───────────────────────────────────────────────────────

export function createEmptyCampaign(defaults?: { fromName?: string; fromEmail?: string }): EmailCampaignDraft {
  return {
    name: '',
    type: 'one-time',
    fromName: defaults?.fromName || '',
    fromEmail: defaults?.fromEmail || '',
    replyTo: '',
    subject: '',
    previewText: '',
    recipientConfig: { type: 'all' },
    templateJson: null,
    htmlContent: '',
    status: 'draft' as const,
    abTest: {
      enabled: false,
      subjectA: '',
      subjectB: '',
      testPercentage: 20,
      winnerMetric: 'open_rate',
      autoSelectAfterHours: 24,
    },
    stats: {
      recipients: 0, delivered: 0, opened: 0, clicked: 0,
      unsubscribed: 0, bounced: 0, timeline: [],
    },
    recipientTracking: [],
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function calcRate(numerator: number, denominator: number): string {
  if (!denominator) return '—'
  return ((numerator / denominator) * 100).toFixed(1) + '%'
}
