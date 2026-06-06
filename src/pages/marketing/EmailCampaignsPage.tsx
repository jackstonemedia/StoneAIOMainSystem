import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BarChart2, Edit, Copy, Trash2, Mail } from 'lucide-react'
import { db, StorageKey } from '../../lib/storage'
import { EmailCampaignRecord } from '../../types/emailCampaign'
import { useToast } from '../../components/ui/Toast'
import { DataTable } from '../../components/ui/DataTable'
import { formatDate, formatNumber, calcRate } from '../../lib/emailCampaignUtils'

const STATUS_CONFIG: Record<EmailCampaignRecord['status'], { label: string; color: any }> = {
  draft:     { label: 'Draft',     color: 'gray' },
  scheduled: { label: 'Scheduled', color: 'blue' },
  sent:      { label: 'Sent',      color: 'green' },
  active:    { label: 'Active',    color: 'purple' },
}

export default function EmailCampaignsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [campaigns, setCampaigns] = useState<EmailCampaignRecord[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    db.get<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS).then(setCampaigns)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return campaigns
    return campaigns.filter(c =>
      (c?.name || '').toLowerCase().includes(q) ||
      (c?.subject || '').toLowerCase().includes(q) ||
      (c?.fromEmail || '').toLowerCase().includes(q)
    )
  }, [campaigns, search])

  async function handleDuplicate(campaign: EmailCampaignRecord) {
    const { id, createdAt, updatedAt, sentAt, scheduledAt, stats, recipientTracking, ...rest } = campaign
    const newCampaign = await db.insert<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, {
      ...rest,
      name: `${rest.name} (Copy)`,
      status: 'draft',
      stats: { recipients: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, bounced: 0, timeline: [] },
      recipientTracking: [],
    })
    setCampaigns(prev => [...prev, newCampaign])
    toast('success', 'Campaign duplicated')
  }

  async function handleDelete(campaign: EmailCampaignRecord) {
    const confirmed = window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)
    if (!confirmed) return
    await db.delete(StorageKey.EMAIL_CAMPAIGNS, campaign.id)
    setCampaigns(prev => prev.filter(c => c.id !== campaign.id))
    toast('success', 'Campaign deleted')
  }

  const columns = [
    {
      key: 'name',
      label: 'Campaign',
      sortable: true,
      render: (c: EmailCampaignRecord) => (
        <div>
          <div className="font-medium text-gray-900">{c.name}</div>
          <div className="text-sm text-gray-500">{c.subject}</div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (c: EmailCampaignRecord) => (
        <span className="capitalize text-sm text-gray-600">
          {c?.type === 'one-time' ? 'One-time' : c?.type === 'drip' ? 'Drip' : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (c: EmailCampaignRecord) => {
        const status = c?.status || 'draft';
        const config = STATUS_CONFIG[status] || STATUS_CONFIG['draft']
        const bg = config.color === 'gray' ? 'bg-gray-100 text-gray-800' :
                   config.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                   config.color === 'green' ? 'bg-green-100 text-green-800' :
                   config.color === 'purple' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg}`}>{config.label}</span>
      },
    },
    {
      key: 'recipients',
      label: 'Recipients',
      sortable: true,
      render: (c: EmailCampaignRecord) => formatNumber(c?.stats?.recipients || 0),
    },
    {
      key: 'openRate',
      label: 'Open Rate',
      sortable: false,
      render: (c: EmailCampaignRecord) => calcRate(c?.stats?.opened || 0, c?.stats?.delivered || 0),
    },
    {
      key: 'clickRate',
      label: 'Click Rate',
      sortable: false,
      render: (c: EmailCampaignRecord) => calcRate(c?.stats?.clicked || 0, c?.stats?.delivered || 0),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (c: EmailCampaignRecord) => formatDate(c?.createdAt),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_val: any, c: EmailCampaignRecord) => (
        <div className="flex items-center justify-end gap-0.5">
          {c?.status === 'sent' && (
            <button
              onClick={() => navigate(`/marketing/email/${c.id}/analytics`)}
              title="View Analytics"
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <BarChart2 size={15} />
            </button>
          )}
          <button
            onClick={() => navigate(`/marketing/email/${c.id}/edit`)}
            title="Edit"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Edit size={15} />
          </button>
          <button
            onClick={() => handleDuplicate(c)}
            title="Duplicate"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => handleDelete(c)}
            title="Delete"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--accent-red)' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-main)' }}>Email Campaigns</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/marketing/email/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={15} />
          New Campaign
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-80 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-main)',
          }}
        />
      </div>

      {campaigns.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed py-20"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
          >
            <Mail size={24} />
          </div>
          <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--text-main)' }}>No campaigns yet</h3>
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            Create your first email campaign to start reaching your contacts.
          </p>
          <button
            onClick={() => navigate('/marketing/email/new')}
            className="btn-primary"
          >
            New Campaign
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
        />
      )}
    </div>
  )
}
