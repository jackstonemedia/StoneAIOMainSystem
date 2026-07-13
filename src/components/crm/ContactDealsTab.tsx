import { useState } from 'react';
import { TrendingUp, Plus, ArrowRight, RefreshCw, DollarSign, Calendar, User, CircleDollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useToast } from '../ui/Toast';
import { apiFetch } from '../../lib/apiClient';

interface Props { contactId: string; workspaceId?: string; }

const STAGE_COLORS: Record<string, string> = {
  won: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  lost: 'text-red-400 bg-red-400/10 border-red-400/20',
  default: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
};

export default function ContactDealsTab({ contactId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', closeDate: '', description: '' });

  const { data: allDeals = [], isLoading } = useQuery<any[]>({
    queryKey: ['deals'],
    queryFn: () => apiFetch('/api/crm/deals').then(r => r.ok ? r.json() : []),
  });

  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['pipelines'],
    queryFn: () => apiFetch('/api/crm/pipelines').then(r => r.ok ? r.json() : []),
  });

  const contactDeals = allDeals.filter((d: any) => d.contactId === contactId);
  const firstStageId = pipelines[0]?.stages?.[0]?.id;

  const createDeal = useMutation({
    mutationFn: (data: any) => apiFetch('/api/crm/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, contactId, pipelineStageId: firstStageId }),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      setShowForm(false);
      setForm({ title: '', amount: '', closeDate: '', description: '' });
      toast('success', 'Deal created');
    },
  });

  const totalValue = contactDeals.reduce((s: number, d: any) => s + (d.amount || 0), 0);
  const openDeals = contactDeals.filter((d: any) => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost');
  const wonDeals = contactDeals.filter((d: any) => d.pipelineStage?.name === 'Won');

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      {contactDeals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Pipeline', value: `$${totalValue.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
            { label: 'Open Deals', value: openDeals.length, icon: TrendingUp, color: 'text-blue-400' },
            { label: 'Won Deals', value: wonDeals.length, icon: TrendingUp, color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-bg border border-border rounded-[8px] p-3 flex items-center gap-2.5">
              <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
              <div>
                <p className="text-[15px] font-bold text-text-main">{stat.value}</p>
                <p className="text-[10px] text-text-muted font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 transition-opacity">
          <Plus className="w-3.5 h-3.5" /> Create Deal
        </button>
      </div>

      {showForm && (
        <div className="bg-bg border border-border rounded-[10px] p-4 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Deal name *"
            className="w-full bg-surface border border-border rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Deal Value ($)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0"
                className="w-full bg-surface border border-border rounded-[6px] px-3 py-1.5 text-[12px] text-text-main focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Close Date</label>
              <input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })}
                className="w-full bg-surface border border-border rounded-[6px] px-3 py-1.5 text-[12px] text-text-main focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text-main">Cancel</button>
            <button onClick={() => createDeal.mutate({ ...form, amount: parseFloat(form.amount) || 0 })}
              disabled={!form.title || !firstStageId || createDeal.isPending}
              className="px-4 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {createDeal.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Create
            </button>
          </div>
          {!firstStageId && <p className="text-[11px] text-amber-400">No pipeline stages found. Set up a pipeline first.</p>}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-hover">
              <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="skeleton h-3 w-40 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
              </div>
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(contactDeals.length === 0 ? [
            { id: 'dummy-1', title: 'Enterprise Plan Upgrade', amount: 12500, pipelineStage: { name: 'Needs Analysis' }, closeDate: new Date(Date.now() + 86400000 * 30).toISOString(), isDummy: true },
            { id: 'dummy-2', title: 'Additional User Licenses', amount: 3200, pipelineStage: { name: 'Proposal Sent' }, closeDate: new Date(Date.now() + 86400000 * 15).toISOString(), isDummy: true }
          ] : contactDeals).map((deal: any) => {
            const stageName = deal.pipelineStage?.name || 'Unknown';
            const isWon = stageName === 'Won';
            const isLost = stageName === 'Lost';
            const colorClass = isWon ? 'text-emerald-500' : isLost ? 'text-red-500' : 'text-amber-500';
            
            return (
              <div key={deal.id} className="relative">
                {deal.isDummy && <div className="absolute -top-2 -right-2 bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full z-10 border border-primary/20">Example</div>}
                <Link to={deal.isDummy ? '#' : `/crm/pipeline`}
                  className="flex items-center justify-between p-4 bg-bg border border-border rounded-[10px] hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CircleDollarSign className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-[14px] text-text-main group-hover:text-primary transition-colors">{deal.title}</div>
                      <div className="text-[12px] text-text-muted mt-0.5">
                        Close date: {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[15px] text-text-main">${(deal.amount || 0).toLocaleString()}</div>
                    <div className={`text-[12px] font-bold mt-0.5 ${colorClass}`}>{stageName}</div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
