import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Users, Mail, MousePointer, XCircle, AlertCircle } from 'lucide-react'
import { db, StorageKey } from '../../lib/storage'
import { EmailCampaignRecord } from '../../types/emailCampaign'
import { calcRate, formatDate, formatNumber } from '../../lib/emailCampaignUtils'
import { MetricCard } from '../../components/ui/MetricCard'
import { DataTable } from '../../components/ui/DataTable'

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<EmailCampaignRecord | null>(null)

  useEffect(() => {
    if (!id) return
    db.findById<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS, id).then(setCampaign)
  }, [id])

  if (!campaign) {
    return <div className="p-8 text-center text-gray-500">Loading campaign data...</div>
  }

  const { stats, recipientTracking } = campaign

  const columns = [
    { key: 'email', label: 'Email', sortable: true, render: (r: any) => r.email },
    { key: 'status', label: 'Status', sortable: true, render: (r: any) => {
      const colors: Record<string, any> = {
        delivered: 'blue',
        opened: 'green',
        clicked: 'purple',
        unsubscribed: 'gray',
        bounced: 'red',
        pending: 'gray'
      }
      const color = colors[r.status] || 'gray'
      const bg = color === 'gray' ? 'bg-gray-100 text-gray-800' :
                 color === 'blue' ? 'bg-blue-100 text-blue-800' :
                 color === 'green' ? 'bg-green-100 text-green-800' :
                 color === 'purple' ? 'bg-purple-100 text-purple-800' :
                 color === 'red' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
      return <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${bg}`}>{r.status}</span>
    }},
    { key: 'lastEventAt', label: 'Last Activity', sortable: true, render: (r: any) => r.lastEventAt ? formatDate(r.lastEventAt) : '—' },
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-[var(--border)] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/marketing/email')} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <ChevronLeft size={20} />
          </button>
            <div>
            <h1 className="text-xl font-semibold text-[var(--text-main)]">{campaign.name}</h1>
            <p className="text-sm text-[var(--text-muted)]">Sent on {formatDate(campaign.sentAt || '')}</p>
          </div>
        </div>
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Sent</span>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Delivered"
            value={formatNumber(stats.delivered)}
            icon={Mail}
            trend="up"
            subtitle={`of ${formatNumber(stats.recipients)} total recipients`}
          />
          <MetricCard
            label="Open Rate"
            value={calcRate(stats.opened, stats.delivered)}
            icon={Users}
            trend="up"
            subtitle="Total unique opens"
          />
          <MetricCard
            label="Click Rate"
            value={calcRate(stats.clicked, stats.delivered)}
            icon={MousePointer}
            trend="up"
            subtitle="Total unique clicks"
          />
          <div className="grid grid-rows-2 gap-4">
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Unsubscribed</p>
                <p className="text-xl font-semibold text-[var(--text-main)]">{stats.unsubscribed}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <XCircle size={20} />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[var(--border)] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Bounced</p>
                <p className="text-xl font-semibold text-[var(--text-main)]">{stats.bounced}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <AlertCircle size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Recipient Activity</h2>
          </div>
          <DataTable
            columns={columns}
            data={recipientTracking}
          />
        </div>
      </div>
    </div>
  )
}
