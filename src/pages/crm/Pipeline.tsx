import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, BarChart3, List, LayoutGrid, RefreshCw,
  DollarSign, Target, TrendingUp, MoreVertical,
  ChevronDown
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import KanbanBoard, { KanbanDeal } from '../../components/crm/KanbanBoard';
import DealSlideOver from '../../components/crm/DealSlideOver';
import ForecastView from '../../components/crm/ForecastView';
import { apiClient } from '../../lib/apiClient';

type ViewMode = 'kanban' | 'list' | 'forecast';

interface Stage { id: string; name: string; color: string; probability?: number; }
interface Pipeline { id: string; name: string; stages: Stage[]; }

export default function Opportunities() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>('kanban');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string | undefined>(undefined);
  const [sortField, setSortField] = useState<string>('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortDropOpen, setSortDropOpen] = useState(false);

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery<Pipeline[]>({
    queryKey: ['pipelines'],
    queryFn: () => apiClient.get('/crm/pipelines').then(r => r.data),
  });

  const { data: rawDeals = [], isLoading: loadingDeals } = useQuery<any[]>({
    queryKey: ['deals'],
    queryFn: () => apiClient.get('/crm/deals').then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const moveDeal = useMutation({
    mutationFn: async ({ dealId, stageName }: { dealId: string; stageName: string }) => {
      const allStages = pipelines.flatMap(p => p.stages ?? []);
      const stage = allStages.find(s => s.name === stageName);
      return apiClient.put(`/crm/deals/${dealId}`, { pipelineStageId: stage?.id ?? null }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
    onError: () => toast('error', 'Failed to move deal'),
  });

  const deleteDeal = useMutation({
    mutationFn: (dealId: string) => apiClient.delete(`/crm/deals/${dealId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      toast('success', 'Deal deleted');
    },
    onError: () => toast('error', 'Failed to delete deal'),
  });

  const pipeline = pipelines[0];
  const stages: Stage[] = (pipeline?.stages ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? '#52677D',
    probability: s.probability,
    rottingDays: 14,
  }));

  // Normalize deals for Kanban
  const deals: KanbanDeal[] = rawDeals.map((d: any) => ({
    id: d.id,
    title: d.title,
    value: d.amount ?? 0,
    stage: d.pipelineStage?.name ?? d.stage ?? (stages[0]?.name ?? 'Lead'),
    probability: d.probability ?? 0,
    expectedCloseDate: d.closeDate
      ? new Date(d.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : undefined,
    stageAge: d.daysInStage,
    contact: d.contact ? { firstName: d.contact.firstName, lastName: d.contact.lastName } : null,
    company: d.company ? { name: d.company.name } : null,
  }));

  // Summary stats
  const activeDeals = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost');
  const totalValue = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const weightedValue = activeDeals.reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);
  const wonDeals = deals.filter(d => d.stage === 'Won');
  const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);

  const isLoading = loadingPipelines || loadingDeals;

  // List view sorting
  const sortedDeals = [...rawDeals].sort((a, b) => {
    let av: any = a[sortField];
    let bv: any = b[sortField];
    if (sortField === 'amount') { av = Number(av) || 0; bv = Number(bv) || 0; }
    if (sortField === 'closeDate') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const openNewDeal = (stageName?: string) => {
    setSelectedDealId(null);
    setDefaultStage(stageName);
    setSlideOverOpen(true);
  };

  const openEditDeal = (dealId: string) => {
    setSelectedDealId(dealId);
    setDefaultStage(undefined);
    setSlideOverOpen(true);
  };

  const VIEW_TABS: { id: ViewMode; label: string; Icon: any }[] = [
    { id: 'kanban',   label: 'Kanban',   Icon: LayoutGrid },
    { id: 'list',     label: 'List',     Icon: List },
    { id: 'forecast', label: 'Forecast', Icon: BarChart3 },
  ];

  const SORT_OPTIONS = [
    { label: 'Deal Name (A–Z)', field: 'title', dir: 'asc' as const },
    { label: 'Deal Name (Z–A)', field: 'title', dir: 'desc' as const },
    { label: 'Highest Value',   field: 'amount', dir: 'desc' as const },
    { label: 'Lowest Value',    field: 'amount', dir: 'asc' as const },
    { label: 'Close Date ↑',   field: 'closeDate', dir: 'asc' as const },
    { label: 'Close Date ↓',   field: 'closeDate', dir: 'desc' as const },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Unified Toolbar */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px] shrink-0">
        {/* Left — View Tabs */}
        <div className="flex items-center gap-1.5">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-[13px] font-medium ${
                view === tab.id
                  ? 'text-text-main bg-surface-hover border-border'
                  : 'text-text-muted bg-surface border-border/60 hover:text-text-main hover:bg-surface-hover hover:border-border'
              }`}
            >
              <tab.Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}

          {view === 'list' && (
            <>
              <div className="w-[1px] h-5 bg-border mx-2" />
              <div className="relative">
                <button
                  onClick={() => setSortDropOpen(o => !o)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-border bg-surface rounded-lg text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shadow-sm"
                >
                  <ChevronDown className="w-4 h-4" /> Sort
                </button>
                {sortDropOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortDropOpen(false)} />
                    <div className="absolute left-0 mt-2 w-[200px] bg-surface border border-border shadow-luxury rounded-lg overflow-hidden py-1 z-50">
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={`${opt.field}-${opt.dir}`}
                          onClick={() => { setSortField(opt.field); setSortDir(opt.dir); setSortDropOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-hover ${
                            sortField === opt.field && sortDir === opt.dir ? 'text-text-main bg-surface-hover' : 'text-text-muted'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['deals'] })}
            className="flex items-center gap-2 px-3 py-2 border border-border bg-surface rounded-lg text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => openNewDeal()}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Add Deal
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-8 py-2.5 border-b border-border bg-bg shrink-0 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.75} />
          <span className="text-[12px] font-medium text-text-muted">Pipeline</span>
          <span className="text-[13px] font-semibold text-text-main">${totalValue.toLocaleString()}</span>
        </div>
        <div className="w-[1px] h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.75} />
          <span className="text-[12px] font-medium text-text-muted">Weighted</span>
          <span className="text-[13px] font-semibold text-text-main">${Math.round(weightedValue).toLocaleString()}</span>
        </div>
        <div className="w-[1px] h-4 bg-border" />
        <div className="flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.75} />
          <span className="text-[12px] font-medium text-text-muted">Won</span>
          <span className="text-[13px] font-semibold text-emerald-500">${wonValue.toLocaleString()}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-text-muted">{activeDeals.length} active · {deals.length} total · {stages.length} stages</span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 overflow-hidden p-6 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 min-w-0 bg-surface rounded-xl p-4 space-y-3 border border-border">
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-5 w-10 rounded" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="skeleton h-[72px] rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : stages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-text-muted">
          <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center border border-border">
            <Target className="w-7 h-7 text-text-muted" strokeWidth={1.5} />
          </div>
          <div className="text-center max-w-[320px]">
            <div className="text-[16px] font-semibold text-text-main mb-2">No pipeline set up yet</div>
            <div className="text-[13px] text-text-muted leading-relaxed">A pipeline tracks deals as they move from lead to close. Add your first deal and Stone AIO will create a default pipeline for you.</div>
          </div>
          <button onClick={() => openNewDeal()} className="btn-primary">
            <Plus className="w-4 h-4" /> Add your first deal
          </button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            deals={deals}
            stages={stages}
            onDealMove={(dealId, stageName) => moveDeal.mutate({ dealId, stageName })}
            onDealDelete={(dealId) => deleteDeal.mutate(dealId)}
            onDealEdit={(dealId) => openEditDeal(dealId)}
            onAddDeal={(stageName) => openNewDeal(stageName)}
          />
        </div>
      ) : view === 'forecast' ? (
        <div className="flex-1 overflow-auto p-8">
          <ForecastView deals={rawDeals} stages={stages} />
        </div>
      ) : (
        /* List View */
        <div className="flex-1 overflow-auto">
          {sortedDeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
              <Target className="w-10 h-10 opacity-20" strokeWidth={1} />
              <div className="text-[14px]">No deals yet</div>
              <button onClick={() => openNewDeal()} className="flex items-center gap-2 px-4 py-2 border border-border bg-surface rounded-lg text-[13px] font-medium text-text-muted hover:bg-surface-hover transition-colors">
                <Plus className="w-4 h-4" /> Add Deal
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface border-b border-border z-10">
                <tr>
                  {['Deal', 'Stage', 'Amount', 'Probability', 'Contact', 'Company', 'Close Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-[11px] font-medium text-text-muted uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-5 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedDeals.map((deal: any) => {
                  const stageInfo = stages.find(s => s.name === (deal.pipelineStage?.name ?? deal.stage));
                  return (
                    <tr
                      key={deal.id}
                      className="hover:bg-surface-hover transition-colors cursor-pointer group"
                      onClick={() => openEditDeal(deal.id)}
                    >
                      <td className="px-5 py-3 text-[13px] font-medium text-text-main max-w-[200px]">
                        <div className="truncate">{deal.title}</div>
                      </td>
                      <td className="px-5 py-3">
                        {stageInfo && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium border border-border bg-surface-hover text-text-muted">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: stageInfo.color }} />
                            {stageInfo.name}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[13px] font-medium text-text-main">
                        ${(Number(deal.amount) || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${deal.probability ?? 0}%`, backgroundColor: stageInfo?.color ?? 'var(--primary)' }} />
                          </div>
                          <span className="text-[12px] text-text-muted">{deal.probability ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-text-muted">
                        {deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName ?? ''}`.trim() : '—'}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-text-muted">
                        {deal.company?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-text-muted">
                        {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); openEditDeal(deal.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-surface text-text-muted transition-all"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Deal Slide-Over */}
      <DealSlideOver
        isOpen={slideOverOpen}
        dealId={selectedDealId}
        defaultStage={defaultStage}
        onClose={() => { setSlideOverOpen(false); setSelectedDealId(null); }}
        onSave={() => {
          qc.invalidateQueries({ queryKey: ['deals'] });
          setSlideOverOpen(false);
          setSelectedDealId(null);
        }}
      />
    </div>
  );
}
