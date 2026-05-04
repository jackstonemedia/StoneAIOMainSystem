import { useState } from 'react';
import { TrendingUp, Plus, ArrowRight, RefreshCw, DollarSign, Calendar, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useToast } from '../ui/Toast';

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
    queryFn: () => fetch('/api/crm/deals').then(r => r.ok ? r.json() : []),
  });

  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['pipelines'],
    queryFn: () => fetch('/api/crm/pipelines').then(r => r.ok ? r.json() : []),
  });

  const contactDeals = allDeals.filter((d: any) => d.contactId === contactId);
  const firstStageId = pipelines[0]?.stages?.[0]?.id;

  const createDeal = useMutation({
    mutationFn: (data: any) => fetch('/api/crm/deals', {
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
        <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>
      ) : contactDeals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px]">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
          <p className="text-[13px] font-semibold text-text-muted">No deals linked yet</p>
          <p className="text-[12px] text-text-muted/60 mt-1">Create a deal to start tracking this contact's pipeline</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contactDeals.map((deal: any) => {
            const stageName = deal.pipelineStage?.name || 'Unknown';
            const isWon = stageName === 'Won';
            const isLost = stageName === 'Lost';
            const colorClass = isWon ? STAGE_COLORS.won : isLost ? STAGE_COLORS.lost : STAGE_COLORS.default;
            return (
              <Link to={`/crm/pipeline`} key={deal.id}
                className="flex items-center gap-4 p-4 bg-bg border border-border rounded-[8px] hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[14px] font-bold text-text-main group-hover:text-primary transition-colors truncate">{deal.title}</span>
                    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border ${colorClass}`}>{stageName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-text-muted">
                    {deal.ownerId && <span className="flex items-center gap-1"><User className="w-3 h-3" /> Owner</span>}
                    {deal.closeDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    {deal.probability != null && <span>{deal.probability}% probability</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[16px] font-bold text-text-main">${(deal.amount || 0).toLocaleString()}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
