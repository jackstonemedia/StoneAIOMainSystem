import { useState, useEffect } from 'react'
import { Clock, Send, ChevronLeft, Calendar } from 'lucide-react'
import { EmailCampaignDraft } from '../../../types/emailCampaign'
import { getRecipientCount } from '../../../lib/emailCampaignUtils'

interface Props {
  campaign: EmailCampaignDraft
  onUpdate: <K extends keyof EmailCampaignDraft>(key: K, value: EmailCampaignDraft[K]) => void
  onSchedule: (date: string) => void
  onSendNow: () => void
  onBack: () => void
}

const inputDateCls = [
  'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-colors',
  'bg-[var(--bg)] border-[var(--border)] text-[var(--text-main)]',
  'focus:border-[var(--primary)] focus:ring-[var(--glow-color)]',
].join(' ')

export function Step3Send({ campaign, onSchedule, onSendNow, onBack }: Props) {
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => {
    getRecipientCount(campaign.recipientConfig).then(setRecipientCount)
  }, [campaign.recipientConfig])

  const handleScheduleClick = () => {
    if (!scheduleDate || !scheduleTime) return
    const dateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
    onSchedule(dateTime)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Left sidebar: Summary & Actions */}
      <div
        className="w-[400px] shrink-0 border-r overflow-y-auto p-6 flex flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center text-sm mb-6 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <ChevronLeft size={16} className="mr-1" /> Back to Settings
        </button>

        <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-main)' }}>
          Review & Send
        </h2>

        {/* Summary blocks */}
        <div className="space-y-3 mb-8">
          <div
            className="p-4 rounded-xl border"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <div className="text-label-caps mb-1.5">Subject</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
              {campaign.subject || <span style={{ color: 'var(--text-muted)' }}>—</span>}
            </div>
            {campaign.previewText && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {campaign.previewText}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="p-4 rounded-xl border"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <div className="text-label-caps mb-1">From Name</div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                {campaign.fromName || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            </div>
            <div
              className="p-4 rounded-xl border"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <div className="text-label-caps mb-1">From Email</div>
              <div className="text-sm font-medium truncate" title={campaign.fromEmail} style={{ color: 'var(--text-main)' }}>
                {campaign.fromEmail || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            </div>
          </div>

          <div
            className="p-4 rounded-xl border"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <div className="text-label-caps mb-1">Recipients</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
              {recipientCount === null ? 'Calculating...' : `${recipientCount} contacts`}
            </div>
            <div className="text-xs mt-1 capitalize" style={{ color: 'var(--text-muted)' }}>
              Via: {campaign.recipientConfig.type}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-5 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
          {!isScheduling ? (
            <>
              <button
                onClick={onSendNow}
                className="btn-primary w-full justify-center h-11 text-sm"
              >
                <Send size={16} /> Send Now
              </button>
              <button
                onClick={() => setIsScheduling(true)}
                className="btn-secondary w-full justify-center h-11 text-sm"
              >
                <Clock size={16} /> Schedule for Later
              </button>
            </>
          ) : (
            <div
              className="p-4 rounded-xl border"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <h3
                className="font-semibold text-sm flex items-center gap-2 mb-4"
                style={{ color: 'var(--text-main)' }}
              >
                <Calendar size={15} /> Select Date & Time
              </h3>
              <div className="space-y-2">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className={inputDateCls}
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className={inputDateCls}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  className="btn-secondary flex-1 justify-center text-sm"
                  onClick={() => setIsScheduling(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1 justify-center text-sm disabled:opacity-50"
                  onClick={handleScheduleClick}
                  disabled={!scheduleDate || !scheduleTime}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right preview area — intentionally blank for now */}
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <div className="text-4xl mb-3">📧</div>
          <div className="text-sm font-medium">Email Preview</div>
          <div className="text-xs mt-1 opacity-60">Live preview coming soon</div>
        </div>
      </div>
    </div>
  )
}
