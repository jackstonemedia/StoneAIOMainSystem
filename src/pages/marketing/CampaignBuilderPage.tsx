import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { db, StorageKey } from '../../lib/storage'
import { EmailCampaignRecord, EmailCampaignDraft } from '../../types/emailCampaign'
import { createEmptyCampaign, resolveRecipients } from '../../lib/emailCampaignUtils'
import { useToast } from '../../components/ui/Toast'
import { ThemeProvider } from '../../context/ThemeContext'
import { Step2Settings } from './builder/Step2Settings'
import { Step1Designer } from './builder/Step1Designer'
import { Step3Send } from './builder/Step3Send'

export default function CampaignBuilderPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [campaign, setCampaign] = useState<EmailCampaignDraft>(() => {
    return createEmptyCampaign({
      fromName: '',
      fromEmail: '',
    })
  })

  const isEditMode = Boolean(id)
  const campaignId = useRef<string | null>(id || null)

  useEffect(() => {
    if (!isEditMode || !id) return
    db.findById<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, id).then(existing => {
      if (!existing) {
        toast('error', 'Campaign not found')
        navigate('/marketing/email')
        return
      }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = existing
      setCampaign(rest)
    })
  }, [id, isEditMode, navigate, toast])

  const updateCampaign = useCallback(<K extends keyof EmailCampaignDraft>(
    key: K,
    value: EmailCampaignDraft[K]
  ) => {
    setCampaign(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateTemplate = useCallback((templateJson: any, htmlContent: string) => {
    setCampaign(prev => ({
      ...prev,
      templateJson,
      htmlContent
    }))
  }, [])

  function validateStep1(): string | null {
    if (!campaign.templateJson) return 'Add at least some content to your email'
    return null
  }

  function validateStep2(): string | null {
    if (!campaign.name.trim()) return 'Campaign name is required'
    if (!campaign.fromName.trim()) return 'From name is required'
    if (!campaign.fromEmail.trim()) return 'From email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campaign.fromEmail)) return 'From email must be a valid email address'
    if (!campaign.subject.trim()) return 'Subject line is required'
    return null
  }

  function handleNextStep() {
    if (currentStep === 1) {
      const error = validateStep1()
      if (error) { toast('error', error); return }
    }
    if (currentStep === 2) {
      const error = validateStep2()
      if (error) { toast('error', error); return }
    }
    setCurrentStep(s => Math.min(s + 1, 3) as 1 | 2 | 3)
  }

  async function handleSaveDraft() {
    const data = { ...campaign, status: 'draft' as const }

    if (isEditMode && campaignId.current) {
      await db.update<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, campaignId.current, data)
      toast('success', 'Draft saved')
    } else {
      const saved = await db.insert<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, data)
      campaignId.current = saved.id
      navigate(`/marketing/email/${saved.id}/edit`, { replace: true })
      toast('success', 'Draft saved')
    }
  }

  async function handleSchedule(scheduledAt: string) {
    const recipients = await resolveRecipients(campaign.recipientConfig)
    const data = {
      ...campaign,
      status: 'scheduled' as const,
      scheduledAt,
      stats: {
        ...campaign.stats,
        recipients: recipients.length,
      },
      recipientTracking: recipients.map(c => ({
        contactId: c.id,
        email: c.email!,
        status: 'pending' as const,
      })),
    }

    if (isEditMode && campaignId.current) {
      await db.update<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, campaignId.current, data)
    } else {
      const saved = await db.insert<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, data)
      campaignId.current = saved.id
    }

    toast('success', `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}`)
    navigate('/marketing/email')
  }

  async function handleSendNow() {
    const recipients = await resolveRecipients(campaign.recipientConfig)
    const data = {
      ...campaign,
      status: 'sent' as const,
      sentAt: new Date().toISOString(),
      stats: {
        ...campaign.stats,
        recipients: recipients.length,
        delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0,
        timeline: [],
      },
      recipientTracking: recipients.map(c => ({
        contactId: c.id,
        email: c.email!,
        status: 'pending' as const,
      })),
    }

    if (isEditMode && campaignId.current) {
      await db.update<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, campaignId.current, data)
    } else {
      const saved = await db.insert<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, data)
      campaignId.current = saved.id
    }

    toast('success', 'Campaign sent!')
    navigate('/marketing/email')
  }

  const STEPS = [
    { number: 1, label: 'Design' },
    { number: 2, label: 'Settings' },
    { number: 3, label: 'Review & Send' },
  ]

  return (
    <ThemeProvider>
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Top Header ─────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 border-b shrink-0"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          height: '48px',
        }}
      >
        {/* Left: back + campaign name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/marketing/email')}
            className="flex items-center gap-1 text-xs font-medium shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ChevronLeft size={14} />
            Campaigns
          </button>
          <span className="text-xs shrink-0" style={{ color: 'var(--border)' }}>/</span>
          <span
            className="text-xs font-semibold truncate"
            style={{ color: 'var(--text-main)' }}
          >
            {campaign.name || 'New Campaign'}
          </span>
        </div>

        {/* Center: step indicators */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isActive   = currentStep === step.number
            const isComplete = step.number < currentStep
            const isLocked   = step.number > currentStep
            return (
              <div key={step.number} className="flex items-center">
                <button
                  onClick={() => { if (isComplete) setCurrentStep(step.number as 1|2|3) }}
                  disabled={isLocked}
                  className="flex items-center gap-2 px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    color: isActive
                      ? 'var(--text-main)'
                      : isComplete
                      ? 'var(--text-muted)'
                      : 'var(--border)',
                    cursor: isComplete ? 'pointer' : isLocked ? 'not-allowed' : 'default',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{
                      background: isActive
                        ? 'var(--primary)'
                        : isComplete
                        ? 'var(--border)'
                        : 'transparent',
                      border: isActive || isComplete
                        ? 'none'
                        : '1px solid var(--border)',
                      color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    }}
                  >
                    {step.number}
                  </span>
                  {step.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-8 h-px"
                    style={{ background: 'var(--border)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              background: 'transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-main)'
              e.currentTarget.style.borderColor = 'var(--primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <Save size={13} />
            Save Draft
          </button>
          {currentStep < 3 && (
            <button
              onClick={handleNextStep}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: 'var(--primary)',
                color: 'var(--text-main)',
                border: '1px solid transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
            >
              Next <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {currentStep === 1 && (
          <Step1Designer
            initialContent={campaign.templateJson}
            onChange={updateTemplate}
          />
        )}
        {currentStep === 2 && (
          <Step2Settings
            campaign={campaign}
            onUpdate={updateCampaign}
          />
        )}
        {currentStep === 3 && (
          <Step3Send
            campaign={campaign}
            onUpdate={updateCampaign}
            onSchedule={handleSchedule}
            onSendNow={handleSendNow}
            onBack={() => setCurrentStep(2)}
          />
        )}
      </div>
    </div>
    </ThemeProvider>
  )
}
