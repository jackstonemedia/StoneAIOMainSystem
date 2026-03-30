import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, Phone, Send, Edit2, Trash2, BarChart3, Users, CheckCircle, Clock, FileText, ArrowLeft, Eye, PenLine } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { SlidePanel } from '../../components/ui/SlidePanel';
import { useToast } from '../../components/ui/Toast';

const API = '/api/business';
const getCampaigns = () => fetch(`${API}/campaigns`).then(r => r.ok ? r.json() : []);
const createCampaign = (data: any) => fetch(`${API}/campaigns`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) }).then(r=>r.json());

const STATUS_CONFIG: Record<string,{label:string;color:string;icon:any}> = {
  sent:      {label:'Sent',      color:'badge-success', icon:CheckCircle},
  sending:   {label:'Sending',  color:'badge-info',    icon:Send},
  scheduled: {label:'Scheduled',color:'badge-warning', icon:Clock},
  draft:     {label:'Draft',    color:'badge-neutral', icon:PenLine},
};

function parseJSON(s: any) { try { return JSON.parse(s); } catch { return {}; } }

export default function Campaigns() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<'list'|'builder'>('list');
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ name:'', type:'email', subject:'', previewText:'' });

  const { data: campaigns = [], isLoading } = useQuery<any[]>({ queryKey:['campaigns'], queryFn:getCampaigns });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => { qc.invalidateQueries({queryKey:['campaigns']}); setNewOpen(false); toast('success','Campaign created'); },
    onError: () => toast('error','Failed to create campaign'),
  });

  const columns = [
    {
      key: 'name', label: 'Campaign', sortable: true,
      render: (v: string, r: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-main">{v}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit mt-0.5 badge ${STATUS_CONFIG[r.status]?.color || 'badge-neutral'}`}>
            {STATUS_CONFIG[r.status]?.label || r.status}
          </span>
        </div>
      )
    },
    {
      key: 'type', label: 'Type',
      render: (v: string) => (
        <span className="flex items-center gap-1.5 text-sm">
          {v === 'email' ? <Mail className="w-3.5 h-3.5 text-blue-400" /> : <Phone className="w-3.5 h-3.5 text-purple-400" />}
          {v === 'email' ? 'Email' : 'SMS'}
        </span>
      )
    },
    {
      key: 'audience', label: 'Audience',
      render: (v: string) => {
        const a = parseJSON(v); return <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-text-muted" />{a.count?.toLocaleString() ?? '—'}</span>;
      }
    },
    {
      key: 'metrics', label: 'Open Rate',
      render: (v: string, r: any) => {
        const m = parseJSON(v);
        if (!m.openRate) return <span className="text-text-muted">—</span>;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{width:`${Math.min(m.openRate,100)}%`}}/>
            </div>
            <span className="text-sm font-medium">{m.openRate}%</span>
          </div>
        );
      }
    },
    {
      key: 'metrics', label: 'Clicks',
      render: (v: string) => {
        const m = parseJSON(v);
        return m.clickRate ? <span className="font-medium">{m.clickRate}%</span> : <span className="text-text-muted">—</span>;
      }
    },
    {
      key: 'updatedAt', label: 'Updated', sortable: true,
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '—'
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Campaigns"
        subtitle="Manage email and SMS campaigns"
        breadcrumb={['Business','Campaigns']}
        tabs={[
          { id:'list', label:'All Campaigns', count: campaigns.length },
          { id:'builder', label:'Campaign Builder' },
        ]}
        activeTab={view}
        onTabChange={v => setView(v as any)}
        actions={
          <button className="btn-primary text-sm py-2 px-4" onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        }
      />

      {view === 'list' ? (
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <DataTable
              columns={columns as any}
              data={campaigns}
              isLoading={isLoading}
              searchable
              searchPlaceholder="Search campaigns…"
              rowKey={(r: any) => r.id}
              emptyState={
                <div className="text-center py-8">
                  <Mail className="w-10 h-10 mx-auto text-border mb-3" />
                  <p className="font-medium text-text-main mb-1">No campaigns yet</p>
                  <p className="text-sm text-text-muted mb-4">Create your first email or SMS campaign</p>
                  <button className="btn-primary text-sm py-2 px-4" onClick={() => setNewOpen(true)}>
                    <Plus className="w-4 h-4" /> Create Campaign
                  </button>
                </div>
              }
            />
          </div>
        </div>
      ) : (
        /* Campaign Builder */
        <div className="flex-1 flex overflow-hidden">
          {/* Left settings */}
          <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Campaign Name</label>
              <input className="input-luxury" placeholder="e.g. Black Friday Promo" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">From Name</label>
              <input className="input-luxury" defaultValue="Jack @ Stone AIO" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Subject Line</label>
              <input className="input-luxury" placeholder="Don't miss out on this…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Preview Text</label>
              <input className="input-luxury" placeholder="Extra details shown in inbox…" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Audience</label>
              <select className="input-luxury">
                <option>All Contacts (2,847)</option>
                <option>Hot Leads (96)</option>
                <option>Enterprise Accounts (28)</option>
                <option>Custom Segment</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Send Time</label>
              <select className="input-luxury">
                <option>Send Immediately</option>
                <option>Schedule for Later</option>
                <option>Optimal Send Time (AI)</option>
              </select>
            </div>
          </div>

          {/* Center preview */}
          <div className="flex-1 overflow-y-auto bg-surface-hover/30 p-8 flex flex-col items-center">
            <div className="w-full max-w-lg">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs text-text-muted font-medium">Email Preview</span>
                <div className="flex gap-1 bg-bg border border-border rounded-lg p-0.5">
                  <button className="px-3 py-1 text-xs rounded-md bg-surface text-primary border border-border font-semibold">Desktop</button>
                  <button className="px-3 py-1 text-xs rounded-md text-text-muted hover:text-text-main">Mobile</button>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-[var(--shadow-luxury)] overflow-hidden border border-border/40">
                {/* Email header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-center">
                  <div className="inline-flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">S</span>
                    </div>
                    <span className="text-white font-bold text-sm">Stone AIO</span>
                  </div>
                </div>
                {/* Hero */}
                <div className="p-8 text-center bg-gradient-to-b from-blue-50 to-white">
                  <h2 className="text-2xl font-bold text-slate-900 mb-3">Exclusive Black Friday Offer 🎉</h2>
                  <p className="text-slate-600 text-sm mb-6 leading-relaxed">Get 40% off all annual plans this weekend only. Automate your business and save thousands.</p>
                  <a className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-bold no-underline hover:bg-indigo-700">Claim Your Discount →</a>
                </div>
                {/* Body */}
                <div className="px-8 py-6 space-y-4 text-sm text-slate-600 leading-relaxed">
                  <p>Hi [First Name],</p>
                  <p>The Black Friday deal is here. For 72 hours only, every Stone AIO annual plan is 40% off. That's hundreds of dollars back in your pocket — and full access to our entire platform.</p>
                  <p className="font-semibold text-slate-900">Here's what you get:</p>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-600">
                    <li>Unlimited AI voice & workflow agents</li>
                    <li>Full CRM + campaign builder</li>
                    <li>Priority 24/7 support</li>
                    <li>API access + integrations</li>
                  </ul>
                </div>
                {/* Footer */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">Stone AIO · 123 Business Ave · San Francisco, CA</p>
                  <p className="text-xs text-slate-400 mt-1"><a href="#" className="underline">Unsubscribe</a> · <a href="#" className="underline">View in browser</a></p>
                </div>
              </div>
            </div>
          </div>

          {/* Right AI panel */}
          <div className="w-64 shrink-0 border-l border-border overflow-y-auto p-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-teal flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-white" />
              </div>
              <h3 className="font-semibold text-sm text-text-main">AI Optimization</h3>
            </div>

            <div className="card-surface p-3">
              <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Deliverability Score</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{width:'87%'}}/>
                </div>
                <span className="text-sm font-bold text-emerald-400">87</span>
              </div>
            </div>

            <div className="card-surface p-3">
              <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Subject A/B Ideas</div>
              <div className="space-y-2">
                {["Don't miss out — 40% off ends soon", "Your exclusive Black Friday deal is here", "⏰ 72 hours only — save 40% today"].map((s,i) => (
                  <button key={i} className="w-full text-left text-xs p-2 rounded-lg bg-bg border border-border hover:border-primary/30 text-text-muted hover:text-text-main transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="card-surface p-3">
              <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Send Time</div>
              <div className="text-xs font-medium text-emerald-400">Tuesday · 10am–11am</div>
              <p className="text-[10px] text-text-muted mt-0.5">Based on your audience engagement history</p>
            </div>

            <div className="mt-auto pt-4 space-y-2">
              <button className="btn-primary w-full text-sm py-2.5">
                <Send className="w-4 h-4" /> Send Campaign
              </button>
              <button className="btn-secondary w-full text-sm py-2.5">
                <Clock className="w-4 h-4" /> Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Campaign Slide Panel */}
      <SlidePanel open={newOpen} onClose={() => setNewOpen(false)} title="Create Campaign" subtitle="Start a new email or SMS campaign"
        actions={
          <>
            <button className="btn-secondary text-sm py-2 px-4" onClick={() => setNewOpen(false)}>Cancel</button>
            <button className="btn-primary text-sm py-2 px-4" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>
              Create Campaign
            </button>
          </>
        }
      >
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Campaign Name *</label>
            <input className="input-luxury" placeholder="e.g. Black Friday Promo"
              value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(['email','sms'] as const).map(t => (
                <button key={t} onClick={() => setForm(f=>({...f,type:t}))}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${form.type===t?'border-primary bg-primary/5':'border-border hover:border-primary/30'}`}>
                  {t==='email' ? <Mail className={`w-5 h-5 ${form.type===t?'text-primary':'text-text-muted'}`}/> : <Phone className={`w-5 h-5 ${form.type===t?'text-primary':'text-text-muted'}`}/>}
                  <span className={`text-sm font-semibold capitalize ${form.type===t?'text-primary':'text-text-muted'}`}>{t}</span>
                </button>
              ))}
            </div>
          </div>
          {form.type === 'email' && (
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 block">Subject Line</label>
              <input className="input-luxury" placeholder="What's the email about?"
                value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} />
            </div>
          )}
        </div>
      </SlidePanel>
    </div>
  );
}
