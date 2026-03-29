import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCampaigns, createCampaign } from '../../lib/api';
import { 
  Mail, MessageSquare, Plus, Search, Filter, BarChart3, 
  Send, Clock, Users, ArrowUpRight, MoreHorizontal, MousePointerClick, CheckCircle2, GitMerge
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'sms';
  status: 'draft' | 'scheduled' | 'sent' | 'sending';
  audience: number;
  openRate?: number;
  clickRate?: number;
  scheduledFor?: string;
  lastEdited: string;
}

const mockCampaigns: Campaign[] = [
  { id: '1', name: 'Black Friday VIP Early Access', type: 'email', status: 'sent', audience: 14500, openRate: 42.5, clickRate: 18.2, lastEdited: '2 days ago' },
  { id: '2', name: 'Abandoned Cart Recovery Series', type: 'email', status: 'sending', audience: 320, openRate: 0, clickRate: 0, lastEdited: '1 hour ago' },
  { id: '3', name: 'Flash Sale SMS Blast', type: 'sms', status: 'scheduled', audience: 5800, scheduledFor: 'Tomorrow, 10:00 AM', lastEdited: '4 hours ago' },
  { id: '4', name: 'Q4 Product Update Newsletter', type: 'email', status: 'draft', audience: 22000, lastEdited: 'Just now' },
];

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'email' | 'sms'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [campaignName, setCampaignName] = useState('Untitled Campaign');
  const [campaignType, setCampaignType] = useState<'email' | 'sms'>('email');

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns
  });

  const createMutation = useMutation<any, Error, any>({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsCreating(false);
      setCampaignName('Untitled Campaign');
    }
  });

  const handleSaveDraft = () => {
    createMutation.mutate({
      name: campaignName,
      type: campaignType,
      status: 'draft',
      audience: JSON.stringify({ segment: 'all' }),
      metrics: JSON.stringify({ opens: 0, clicks: 0 }),
    });
  };

  const filteredCampaigns = campaigns.filter((c: any) => activeTab === 'all' || c.type === activeTab);

  if (isCreating) {
    return (
      <div className="flex-1 flex flex-col h-full bg-bg font-sans overflow-hidden">
        {/* Builder Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-main border border-border rounded-lg bg-bg hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <div className="h-4 w-px bg-border"></div>
            <input 
              type="text" 
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 w-64 text-text-main"
            />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveDraft}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-main border border-border rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              <Clock className="w-4 h-4" /> {createMutation.isPending ? 'Saving...' : 'Save Draft'}
            </button>
            <button className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors shadow-md">
              <Send className="w-4 h-4" /> Send Test
            </button>
          </div>
        </header>

        {/* Builder Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Settings */}
          <div className="w-80 border-r border-border bg-surface flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-border">
              <h3 className="font-semibold text-text-main mb-4">Campaign Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Campaign Type</label>
                  <div className="flex bg-bg p-1 rounded-lg border border-border">
                    <button 
                      onClick={() => setCampaignType('email')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors ${campaignType === 'email' ? 'bg-surface shadow-sm border border-border text-primary' : 'text-text-muted hover:text-text-main'}`}
                    >
                      <Mail className="w-4 h-4" /> Email
                    </button>
                    <button 
                      onClick={() => setCampaignType('sms')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-colors ${campaignType === 'sms' ? 'bg-surface shadow-sm border border-border text-primary' : 'text-text-muted hover:text-text-main'}`}
                    >
                      <MessageSquare className="w-4 h-4" /> SMS
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">To (Audience)</label>
                  <select className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-main">
                    <option>All Subscribers (22,450)</option>
                    <option>VIP Customers (1,200)</option>
                    <option>Active in last 30 days (8,400)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">From Name</label>
                  <input type="text" defaultValue="Jack Stone" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-main" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Subject Line</label>
                  <input type="text" placeholder="e.g., Huge announcements inside!" className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-main" />
                </div>
              </div>
            </div>
            
            <div className="p-5 flex-1">
              <h3 className="font-semibold text-text-main mb-4">Content Blocks</h3>
              <div className="grid grid-cols-2 gap-3">
                {['Text', 'Image', 'Button', 'Divider', 'Spacer', 'Social', 'Video', 'HTML'].map(block => (
                  <div key={block} className="border border-border bg-bg hover:border-primary/50 cursor-grab rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-surface group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <Plus className="w-4 h-4 text-text-muted group-hover:text-primary" />
                    </div>
                    <span className="text-xs font-medium text-text-main">{block}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Canvas */}
          <div className="flex-1 bg-bg p-8 flex justify-center overflow-y-auto" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 min-h-[800px] flex flex-col items-center justify-center text-gray-400">
              <Mail className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium text-gray-500">Drag and drop blocks here to design your email.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-bg font-sans overflow-hidden">
      
      {/* Header & Metrics */}
      <header className="px-8 pt-8 pb-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Campaigns</h1>
            <p className="text-sm text-text-muted mt-1">Manage email and SMS broadcasts, flows, and analytics.</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md shadow-primary/20 hover:shadow-primary/40"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </button>
        </div>

        {/* Global Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Sent (30d)', value: '142.5k', change: '+12%', icon: Send, color: 'text-blue-500' },
            { label: 'Avg Open Rate', value: '38.2%', change: '+2.4%', icon: Mail, color: 'text-emerald-500' },
            { label: 'Avg Click Rate', value: '4.8%', change: '-0.3%', icon: MousePointerClick, color: 'text-purple-500' },
            { label: 'Active Flows', value: '12', change: '+2', icon: GitMerge, color: 'text-amber-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-bg border border-border rounded-xl p-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-text-muted mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-text-main">{stat.value}</h3>
                  <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded-lg bg-surface border border-border ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-surface p-1 rounded-lg border border-border">
            {[
              { id: 'all', label: 'All Campaigns' },
              { id: 'email', label: 'Email Only' },
              { id: 'sms', label: 'SMS Only' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-bg text-primary shadow-sm border border-border' 
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search campaigns..." 
                className="w-64 pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text-main placeholder:text-text-muted/60"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover text-text-main transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
          </div>
        </div>

        {/* Campaign List */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Campaign Name</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Audience</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Engagement</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">Loading campaigns...</td></tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">No campaigns found. Create one to get started.</td></tr>
              ) : filteredCampaigns.map((campaign: any) => {
                const metrics = campaign.metrics ? JSON.parse(campaign.metrics) : {};
                const audience = campaign.audience ? JSON.parse(campaign.audience) : { count: 0 };
                return (
                <tr key={campaign.id} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border ${campaign.type === 'email' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 'bg-purple-500/10 border-purple-500/20 text-purple-500'}`}>
                        {campaign.type === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-main group-hover:text-primary transition-colors cursor-pointer">{campaign.name}</h4>
                        <p className="text-xs text-text-muted mt-0.5">Last edited {new Date(campaign.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {campaign.status === 'sent' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Sent</span>}
                    {campaign.status === 'draft' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20"><MoreHorizontal className="w-3.5 h-3.5" /> Draft</span>}
                    {campaign.status === 'scheduled' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20"><Clock className="w-3.5 h-3.5" /> {campaign.scheduledFor || 'Scheduled'}</span>}
                    {campaign.status === 'sending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"><Send className="w-3.5 h-3.5 animate-pulse" /> Sending</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-text-main">
                      <Users className="w-4 h-4 text-text-muted" />
                      {(audience.count || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {metrics.opens !== undefined && metrics.opens > 0 ? (
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-text-muted mb-0.5">Open Rate</p>
                          <p className="font-medium text-sm text-text-main">{metrics.openRate || 0}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted mb-0.5">Click Rate</p>
                          <p className="font-medium text-sm text-text-main">{metrics.clickRate || 0}%</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-text-muted hover:text-text-main hover:bg-surface rounded-lg transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
