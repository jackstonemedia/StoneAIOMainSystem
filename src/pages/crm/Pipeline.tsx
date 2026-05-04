import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Plus, BarChart3, List, LayoutGrid, RefreshCw,
  DollarSign, Target,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import KanbanBoard, { KanbanDeal } from '../../components/crm/KanbanBoard';
import DealSlideOver from '../../components/crm/DealSlideOver';
import ForecastView from '../../components/crm/ForecastView';

type ViewMode = 'kanban' | 'list' | 'forecast';

async function fetchPipelines() {
  const r = await fetch('/api/crm/pipelines');
  if (!r.ok) throw new Error('Failed');
  return r.json();
}
async function fetchDeals() {
  const r = await fetch('/api/crm/deals');
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

export default function Pipeline() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  const { data: rawDeals = [], isLoading: loadingDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: fetchDeals,
  });

  const moveDeal = useMutation({
    mutationFn: async ({ dealId, stageName }: { dealId: string; stageName: string }) => {
      // Find stage ID from the pipeline stages
      const allStages = pipelines.flatMap((p: any) => p.stages || []);
      const stage = allStages.find((s: any) => s.name === stageName);
      const r = await fetch(`/api/crm/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStageId: stage?.id || null }),
      });
      if (!r.ok) throw new Error('Failed to move deal');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => toast('error', 'Failed to move deal'),
  });

  const deleteDeal = useMutation({
    mutationFn: async (dealId: string) => {
      const r = await fetch(`/api/crm/deals/${dealId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast('success', 'Deal deleted');
    },
  });

  // Normalize deals for Kanban — map pipelineStage.name → stage
  const deals: KanbanDeal[] = rawDeals.map((d: any) => ({
    id: d.id,
    title: d.title,
    value: d.amount,
    stage: d.pipelineStage?.name ?? d.stage ?? 'Lead',
    probability: d.probability,
    expectedCloseDate: d.closeDate
      ? new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : undefined,
    stageAge: d.daysInStage,
    contact: d.contact ? { firstName: d.contact.firstName } : null,
    company: d.company ? { name: d.company.name } : null,
  }));

  const pipeline = pipelines[0];
  const stages = (pipeline?.stages ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? '#52677D',
    rottingDays: 14,
  }));

  // Summary stats
  const totalValue     = deals.reduce((s, d) => s + (d.value || 0), 0);
  const weightedValue  = deals.reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);
  const wonDeals       = deals.filter(d => d.stage === 'Won');
  const wonValue       = wonDeals.reduce((s, d) => s + (d.value || 0), 0);

  const isLoading = loadingPipelines || loadingDeals;

  const VIEW_TABS: { id: ViewMode; label: string; Icon: any }[] = [
    { id: 'kanban',   label: 'Kanban',   Icon: LayoutGrid },
    { id: 'list',     label: 'List',     Icon: List },
    { id: 'forecast', label: 'Forecast', Icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Pipeline"
        subtitle={pipeline ? `${pipeline.name} — ${deals.length} deals` : 'Sales pipeline'}
        breadcrumb={['CRM', 'Pipeline']}
        tabs={VIEW_TABS.map(t => ({ id: t.id, label: t.label }))}
        activeTab={view}
        onTabChange={t => setView(t as ViewMode)}
        actions={
          <>
            <button
              className="btn-secondary text-sm py-2 px-3"
              onClick={() => qc.invalidateQueries({ queryKey: ['deals'] })}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              className="btn-primary text-sm py-2 px-4"
              onClick={() => { setSelectedDealId(null); setSlideOverOpen(true); }}
            >
              <Plus className="w-4 h-4" /> Add Deal
            </button>
          </>
        }
      />

      {/* Stats bar */}
      <div className="px-8 py-3 border-b border-border bg-surface shrink-0 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-[13px] font-semibold text-text-muted">Pipeline:</span>
          <span className="text-[14px] font-bold text-text-main">${totalValue.toLocaleString()}</span>
        </div>
        <div className="w-[1px] h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-400" />
          <span className="text-[13px] font-semibold text-text-muted">Weighted:</span>
          <span className="text-[14px] font-bold text-text-main">${Math.round(weightedValue).toLocaleString()}</span>
        </div>
        <div className="w-[1px] h-4 bg-border" />
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span className="text-[13px] font-semibold text-text-muted">Won (this pipeline):</span>
          <span className="text-[14px] font-bold text-emerald-400">${wonValue.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[12px] text-text-muted">{deals.length} deals across {stages.length} stages</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-surface border-t-primary rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            deals={deals}
            stages={stages}
            onDealMove={(dealId, stageName) => moveDeal.mutate({ dealId, stageName })}
            onDealDelete={(dealId) => deleteDeal.mutate(dealId)}
            onDealEdit={(dealId) => { setSelectedDealId(dealId); setSlideOverOpen(true); }}
          />
        </div>
      ) : view === 'forecast' ? (
        <div className="flex-1 overflow-auto p-8">
          <ForecastView
            deals={rawDeals}
            stages={stages}
          />
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface border-b border-border z-10">
              <tr>
                {['Deal', 'Company', 'Contact', 'Stage', 'Amount', 'Probability', 'Close Date'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-bold text-text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {deals.map(deal => {
                const raw = rawDeals.find((d: any) => d.id === deal.id);
                const stageInfo = stages.find((s: any) => s.name === deal.stage);
                return (
                  <tr
                    key={deal.id}
                    className="hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => { setSelectedDealId(deal.id); setSlideOverOpen(true); }}
                  >
                    <td className="px-5 py-3.5 text-sm font-semibold text-text-main">{deal.title}</td>
                    <td className="px-5 py-3.5 text-sm text-text-muted">{deal.company?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-text-muted">{deal.contact?.firstName || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: `${stageInfo?.color}20`, color: stageInfo?.color }}
                      >
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-bold text-text-main">${(deal.value || 0).toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${deal.probability}%`, background: stageInfo?.color }}
                          />
                        </div>
                        <span className="text-sm text-text-muted">{deal.probability}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-muted">
                      {raw?.closeDate ? new Date(raw.closeDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Slide-Over */}
      <DealSlideOver
        isOpen={slideOverOpen}
        dealId={selectedDealId}
        onClose={() => { setSlideOverOpen(false); setSelectedDealId(null); }}
        onSave={() => {
          qc.invalidateQueries({ queryKey: ['deals'] });
          setSlideOverOpen(false);
          setSelectedDealId(null);
          toast('success', selectedDealId ? 'Deal updated' : 'Deal created');
        }}
      />
    </div>
  );
}
