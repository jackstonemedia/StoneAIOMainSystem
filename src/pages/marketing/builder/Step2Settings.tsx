import { useState, useEffect } from 'react'
import { EmailCampaignDraft, RecipientConfig } from '../../../types/emailCampaign'
import { db, StorageKey } from '../../../lib/storage'
import { getRecipientCount } from '../../../lib/emailCampaignUtils'
import { Segment, Tag } from '../../../types'

const inputCls = [
  'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2',
  'transition-colors',
  'bg-[var(--bg)] border-[var(--border)] text-[var(--text-main)]',
  'focus:border-[var(--primary)] focus:ring-[var(--glow-color)]',
  'placeholder:text-[var(--text-muted)]',
].join(' ')

interface Props {
  campaign: EmailCampaignDraft
  onUpdate: <K extends keyof EmailCampaignDraft>(key: K, value: EmailCampaignDraft[K]) => void
}

export function Step2Settings({ campaign, onUpdate }: Props) {
  const [segments, setSegments] = useState<Segment[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [recipientCount, setRecipientCount] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const [segData, tagData] = await Promise.all([
        db.get<Segment>(StorageKey.SEGMENTS),
        db.get<Tag>(StorageKey.TAGS)
      ])
      setSegments(segData)
      setTags(tagData)
    }
    load()
  }, [])

  useEffect(() => {
    getRecipientCount(campaign.recipientConfig).then(setRecipientCount)
  }, [campaign.recipientConfig])

  function updateRecipientType(type: RecipientConfig['type']) {
    switch (type) {
      case 'all': onUpdate('recipientConfig', { type: 'all' }); break;
      case 'segment': onUpdate('recipientConfig', { type: 'segment', segmentId: segments[0]?.id || '' }); break;
      case 'tag': onUpdate('recipientConfig', { type: 'tag', tagId: tags[0]?.id || '' }); break;
      case 'manual': onUpdate('recipientConfig', { type: 'manual', contactIds: [] }); break;
    }
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">

        {/* Campaign Settings card */}
        <div
          className="rounded-xl border p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2
            className="text-base font-semibold mb-6 pb-4 border-b"
            style={{ color: 'var(--text-main)', borderColor: 'var(--border)' }}
          >
            Campaign Settings
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Internal Campaign Name
              </label>
              <input
                type="text"
                value={campaign.name}
                onChange={e => onUpdate('name', e.target.value)}
                placeholder="e.g. Summer Sale 2024"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  From Name
                </label>
                <input
                  type="text"
                  value={campaign.fromName}
                  onChange={e => onUpdate('fromName', e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  From Email
                </label>
                <input
                  type="email"
                  value={campaign.fromEmail}
                  onChange={e => onUpdate('fromEmail', e.target.value)}
                  placeholder="hello@acme.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Reply-To Email <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="email"
                value={campaign.replyTo}
                onChange={e => onUpdate('replyTo', e.target.value)}
                placeholder="support@acme.com"
                className={inputCls}
              />
            </div>

            <div className="pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Subject Line
              </label>
              <input
                type="text"
                value={campaign.subject}
                onChange={e => onUpdate('subject', e.target.value)}
                placeholder="Don't miss our summer sale!"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Preview Text
              </label>
              <input
                type="text"
                value={campaign.previewText}
                onChange={e => onUpdate('previewText', e.target.value)}
                placeholder="This shows up in the inbox preview..."
                className={inputCls}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Keep it under 90 characters for best results.
              </p>
            </div>
          </div>
        </div>

        {/* Recipients card */}
        <div
          className="rounded-xl border p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center justify-between mb-6 pb-4 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-main)' }}>Recipients</h2>
            {recipientCount !== null && (
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
              >
                {recipientCount} contacts selected
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Send to
              </label>
              <select
                value={campaign.recipientConfig.type}
                onChange={e => updateRecipientType(e.target.value as any)}
                className={inputCls}
              >
                <option value="all">All Contacts</option>
                <option value="segment">A Specific Segment</option>
                <option value="tag">Contacts with Tag</option>
              </select>
            </div>

            {campaign.recipientConfig.type === 'segment' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Select Segment
                </label>
                <select
                  value={campaign.recipientConfig.segmentId}
                  onChange={e => onUpdate('recipientConfig', { type: 'segment', segmentId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Choose a segment...</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {campaign.recipientConfig.type === 'tag' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Select Tag
                </label>
                <select
                  value={campaign.recipientConfig.tagId}
                  onChange={e => onUpdate('recipientConfig', { type: 'tag', tagId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Choose a tag...</option>
                  {tags.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
