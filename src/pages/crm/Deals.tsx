import React, { useState, useEffect } from 'react';
import {
  MondayGroup, MondayHeaderRow, MondayHeaderCell, MondayRow, MondayCell,
  StatusPill, MondayAddBlock, MondayHeader, MondayToolbar
} from '../../components/crm/MondayTable';
import DealSlideOver from '../../components/crm/DealSlideOver';
import KanbanBoard from '../../components/crm/KanbanBoard';
import WinLossModal from '../../components/crm/WinLossModal';
import { Building2, Users, Columns, Grid, List, ChevronDown, Target, TrendingUp, Calendar, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Deal {
  id: string; title: string; value: number; stage: string; probability: number;
  expectedCloseDate: string; stageAge?: number;
  contact?: { firstName: string; lastName?: string | null } | null;
  company?: { name: string } | null;
}

const PIPELINES = [
  { id: 'p1', name: 'Main Sales Pipeline' },
  { id: 'p2', name: 'Enterprise Pipeline' },
  { id: 'p3', name: 'Partner Pipeline' },
];

const KANBAN_STAGES = [
  { id: '1', name: 'Discovery', color: 'text-[#52677D]', rottingDays: 14 },
  { id: '2', name: 'Proposal', color: 'text-[#52677D]', rottingDays: 10 },
  { id: '3', name: 'Negotiation', color: 'text-[#52677D]', rottingDays: 7 },
  { id: '4', name: 'Won', color: 'text-[#52677D]' },
  { id: '5', name: 'Lost', color: 'text-[#52677D]' },
];

const STAGE_COLORS: Record<string, string> = {
  Discovery: '#52677D', Proposal: '#52677D', Negotiation: '#52677D', Won: '#52677D', Lost: '#52677D',
};

const INITIAL_DEALS: Deal[] = [
  { id: '1', title: 'Google Integration Suite', value: 70000, stage: 'Discovery', probability: 20, expectedCloseDate: 'May 30', stageAge: 3, contact: { firstName: 'Steven', lastName: 'Scott' }, company: { name: 'Google' } },
  { id: '2', title: 'Apple Enterprise Plan', value: 55000, stage: 'Discovery', probability: 40, expectedCloseDate: 'Jun 15', stageAge: 18, contact: { firstName: 'Sam', lastName: 'Jones' }, company: { name: 'Apple' } },
  { id: '3', title: 'Amazon AWS Contract', value: 100000, stage: 'Proposal', probability: 60, expectedCloseDate: 'Apr 28', stageAge: 5, contact: { firstName: 'Robert', lastName: 'Thompson' }, company: { name: 'Amazon' } },
  { id: '4', title: 'Acme Q3 Software', value: 55000, stage: 'Won', probability: 100, expectedCloseDate: 'Mar 20', stageAge: 0, contact: { firstName: 'Alice', lastName: 'Freeman' }, company: { name: 'Acme Corp' } },
  { id: '5', title: 'Tesla Hardware Upgrade', value: 30000, stage: 'Won', probability: 100, expectedCloseDate: 'Mar 15', stageAge: 0, contact: { firstName: 'Elon', lastName: 'Musk' }, company: { name: 'Tesla' } },
  { id: '6', title: 'NovaStar AI Platform', value: 88000, stage: 'Negotiation', probability: 75, expectedCloseDate: 'May 5', stageAge: 9, contact: { firstName: 'David', lastName: 'Chen' }, company: { name: 'NovaStar' } },
  { id: '7', title: 'Orbit Labs Pro Tier', value: 36000, stage: 'Proposal', probability: 55, expectedCloseDate: 'Jun 1', stageAge: 2, contact: { firstName: 'James', lastName: 'Lee' }, company: { name: 'Orbit Labs' } },
];

type ViewMode = 'kanban' | 'table' | 'list';

function getStagePill(stage: string) {
  const color = STAGE_COLORS[stage] || '#52677D';
  return { label: stage, color };
}

export default function Deals() {
  const [localDeals, setLocalDeals] = useState<Deal[]>(() => {
    const saved = localStorage.getItem('crm_deals');
    return saved ? JSON.parse(saved) : INITIAL_DEALS;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('crm_deals_view') as ViewMode) || 'kanban');
  const [activePipeline, setActivePipeline] = useState(PIPELINES[0]);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [closedCollapsed, setClosedCollapsed] = useState(false);
  const [winLoss, setWinLoss] = useState<{ dealId: string; title: string; outcome: 'won' | 'lost' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const persist = (updated: Deal[]) => {
    setLocalDeals(updated);
    localStorage.setItem('crm_deals', JSON.stringify(updated));
  };

  const setView = (v: ViewMode) => { setViewMode(v); localStorage.setItem('crm_deals_view', v); };

  const filtered = localDeals.filter(d => {
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase()) && !d.company?.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStage && d.stage !== filterStage) return false;
    return true;
  });

  const activeDeals = filtered.filter(d => !['Won', 'Lost'].includes(d.stage));
  const closedDeals = filtered.filter(d => ['Won', 'Lost'].includes(d.stage));

  const totalPipeline = activeDeals.reduce((acc, d) => acc + d.value, 0);
  const weightedForecast = activeDeals.reduce((acc, d) => acc + d.value * (d.probability / 100), 0);
  const wonValue = closedDeals.filter(d => d.stage === 'Won').reduce((acc, d) => acc + d.value, 0);

  const handleDealMove = (dealId: string, destStageName: string) => {
    const deal = localDeals.find(d => d.id === dealId);
    if (!deal) return;
    persist(localDeals.map(d => d.id === dealId ? { ...d, stage: destStageName, stageAge: 0 } : d));
    if (destStageName === 'Won' || destStageName === 'Lost') {
      setWinLoss({ dealId, title: deal.title, outcome: destStageName === 'Won' ? 'won' : 'lost' });
    }
  };

  const handleWinLossConfirm = (reason: string, note: string) => {
    console.log('Win/Loss reason:', reason, note);
    setWinLoss(null);
  };

  const deleteDeal = (id: string) => persist(localDeals.filter(d => d.id !== id));

  const sumActive = activeDeals.reduce((acc, d) => acc + d.value, 0);
  const sumClosed = closedDeals.reduce((acc, d) => acc + d.value, 0);

  const headerCols = (
    <MondayHeaderRow>
      <MondayHeaderCell width="flex-1 min-w-[240px]">Deal</MondayHeaderCell>
      <MondayHeaderCell width="w-[140px]">Stage</MondayHeaderCell>
      <MondayHeaderCell width="w-[130px]">Value</MondayHeaderCell>
      <MondayHeaderCell width="w-[80px]">Prob.</MondayHeaderCell>
      <MondayHeaderCell width="w-[120px]">Weighted</MondayHeaderCell>
      <MondayHeaderCell width="w-[110px]">Close Date</MondayHeaderCell>
      <MondayHeaderCell width="w-[180px]">Contact</MondayHeaderCell>
      <MondayHeaderCell width="w-[160px]">Company</MondayHeaderCell>
    </MondayHeaderRow>
  );

  const renderDealRow = (d: Deal, groupColor: string) => {
    const stage = getStagePill(d.stage);
    return (
      <MondayRow key={d.id} groupColorClass={groupColor}>
        <MondayCell width="flex-1 min-w-[240px]">
          <span onClick={() => setIsSlideOverOpen(true)} className="font-bold text-text-main hover:text-primary cursor-pointer transition-colors text-[13px]">{d.title}</span>
        </MondayCell>
        <MondayCell width="w-[140px]" isStatusPill statusColor={stage.color}>
          <StatusPill color={stage.color} label={stage.label} />
        </MondayCell>
        <MondayCell width="w-[130px]">
          <span className="font-bold text-text-main">${(d.value || 0).toLocaleString()}</span>
        </MondayCell>
        <MondayCell width="w-[80px]">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-hover rounded-full overflow-hidden shadow-inner flex shrink-0">
              <div className="h-full rounded-full drop-shadow-[0_0_8px_currentColor]" style={{ background: stage.color, color: stage.color, width: `${d.probability}%` }} />
            </div>
            <span className="text-[11px] font-bold text-text-muted">{d.probability}%</span>
          </div>
        </MondayCell>
        <MondayCell width="w-[120px]">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-muted">
            <Target className="w-3.5 h-3.5 text-primary shrink-0" />
            ${Math.round((d.value || 0) * (d.probability / 100)).toLocaleString()}
          </div>
        </MondayCell>
        <MondayCell width="w-[110px]">
          {d.expectedCloseDate ? (
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-muted">
              <Calendar className="w-3.5 h-3.5 text-primary" /> {d.expectedCloseDate}
            </div>
          ) : <span className="text-text-muted/50 text-[12px] font-bold">—</span>}
        </MondayCell>
        <MondayCell width="w-[180px]">
          {d.contact ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover shadow-sm rounded-md text-text-main text-[11px] font-bold max-w-full w-max mt-1">
              <Users className="w-3 h-3 shrink-0 text-accent-teal" />
              <span className="truncate">{d.contact.firstName} {d.contact.lastName}</span>
            </div>
          ) : <span className="opacity-0">-</span>}
        </MondayCell>
        <MondayCell width="w-[160px]">
          {d.company ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/[0.06] rounded-md text-primary/80 text-[11px] font-semibold max-w-full w-max mt-1">
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{d.company.name}</span>
            </div>
          ) : <span className="opacity-0">-</span>}
        </MondayCell>
      </MondayRow>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg relative styled-scrollbar">
      <MondayHeader title="Deals" subtitle={activePipeline.name} />

      {/* Forecast Bar */}
      <div className="flex items-center gap-6 px-8 py-3 border-b border-border shrink-0 bg-surface/90 backdrop-blur-md">
        {[
          { label: 'Pipeline',         value: `$${totalPipeline.toLocaleString()}`,                icon: TrendingUp, color: 'var(--primary)' },
          { label: 'Weighted Forecast', value: `$${Math.round(weightedForecast).toLocaleString()}`, icon: Target,     color: 'var(--accent-teal)' },
          { label: 'Won (Period)',       value: `$${wonValue.toLocaleString()}`,                    icon: TrendingUp, color: 'var(--accent-green)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-surface">
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
              <div className="text-[15px] font-bold text-text-main">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-8 py-4 bg-bg border-b border-border shrink-0 flex-wrap relative z-20">
        <button onClick={() => setIsSlideOverOpen(true)} className="btn-primary px-5 py-2 text-[13px]">
          + New deal
        </button>

        {/* Pipeline Selector */}
        <div className="relative">
          <button onClick={() => setPipelineOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent text-[13px] font-bold text-text-main hover:bg-surface-hover hover:border-border/50 transition-all">
            {activePipeline.name} <ChevronDown className="w-4 h-4 text-text-muted" />
          </button>
          <AnimatePresence>
            {pipelineOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 mt-2 z-50 bg-surface border border-border rounded-xl shadow-luxury py-1.5 min-w-[200px]">
                {PIPELINES.map(p => (
                  <button key={p.id} onClick={() => { setActivePipeline(p); setPipelineOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] font-bold transition-all ${activePipeline.id === p.id ? 'text-primary bg-primary/10' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'}`}>
                    {p.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <div className="relative flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 gap-2 shadow-inner group focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search deals..."
            className="bg-transparent text-[13px] font-bold text-text-main outline-none w-48 placeholder:text-text-muted/60" />
          {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3.5 h-3.5 text-text-muted hover:text-accent-red" /></button>}
        </div>

        {/* Stage filter */}
        <div className="relative">
          <button onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all border border-transparent ${filterStage ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'text-text-muted hover:bg-surface-hover hover:border-border/50'}`}>
            <Filter className="w-4 h-4" /> {filterStage || 'All Stages'}
          </button>
          <AnimatePresence>
            {filterOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full left-0 mt-2 z-50 bg-surface border border-border rounded-xl shadow-luxury py-1.5 min-w-[150px]">
                {['', ...KANBAN_STAGES.map(s => s.name)].map(s => (
                  <button key={s || 'all'} onClick={() => { setFilterStage(s); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] font-bold flex items-center gap-3 transition-all ${filterStage === s ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'}`}>
                    {s && <div className="w-3 h-3 rounded-md shadow-sm" style={{ background: STAGE_COLORS[s], boxShadow: `0 0 8px ${STAGE_COLORS[s]}` }} />}
                    {s || 'All Stages'}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* View Switcher */}
        <div className="ml-auto flex items-center gap-1 bg-surface-hover p-1.5 rounded-xl border border-border flex-wrap shadow-inner">
          {([['kanban', Columns, 'Board'], ['table', Grid, 'Table'], ['list', List, 'List']] as [ViewMode, any, string][]).map(([mode, Icon, label]) => (
            <button key={mode} onClick={() => setView(mode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[12px] font-bold ${viewMode === mode ? 'bg-surface text-primary shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-105' : 'text-text-muted hover:text-text-main hover:bg-bg'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex flex-col items-stretch">
        {viewMode === 'kanban' ? (
          <KanbanBoard deals={filtered} stages={KANBAN_STAGES} onDealMove={handleDealMove} onDealDelete={deleteDeal} onDealEdit={() => setIsSlideOverOpen(true)} />
        ) : viewMode === 'list' ? (
          <div className="divide-y divide-border bg-surface rounded-xl border border-border shadow-sm mx-8 my-6">
            {filtered.map(d => {
              const stage = getStagePill(d.stage);
              return (
                <div key={d.id} onClick={() => setIsSlideOverOpen(true)} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-hover transition-colors group cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px] text-text-main group-hover:text-primary transition-colors">{d.title}</p>
                    {d.company && <p className="text-[12px] text-text-muted mt-0.5">{d.company.name}</p>}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                  <span className="text-[14px] font-bold text-text-main w-[100px] text-right">${d.value.toLocaleString()}</span>
                  <div className="flex items-center gap-2 w-[120px]">
                    <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.probability}%`, background: stage.color }} />
                    </div>
                    <span className="text-[11px] font-bold text-text-muted">{d.probability}%</span>
                  </div>
                  <span className="text-[12px] font-bold text-text-muted w-[100px] px-4">{d.expectedCloseDate || '—'}</span>
                  <button onClick={() => deleteDeal(d.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-accent-red hover:bg-red/10 w-8 h-8 rounded-lg flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pb-24 w-full px-8 py-6">
            <MondayGroup title={`Active Deals (${activeDeals.length})`} color="var(--primary)"
              isCollapsed={activeCollapsed} onToggle={() => setActiveCollapsed(!activeCollapsed)}>
              {headerCols}
              {activeDeals.map(d => renderDealRow(d, 'var(--primary)'))}
              <div className="flex border-b border-border bg-bg h-10 items-center px-4 rounded-b-xl border-x">
                <div className="flex-1 px-4 text-[13px] font-bold text-text-muted">
                  <span className="text-text-main">${sumActive.toLocaleString()}</span> total · <span className="text-primary">${Math.round(weightedForecast).toLocaleString()}</span> weighted
                </div>
              </div>
            </MondayGroup>

            <div className="h-8" />

            <MondayGroup title={`Closed Deals (${closedDeals.length})`} color="var(--accent-green)"
              isCollapsed={closedCollapsed} onToggle={() => setClosedCollapsed(!closedCollapsed)}>
              {headerCols}
              {closedDeals.map(d => renderDealRow(d, 'var(--accent-green)'))}
              <div className="flex border-b border-border bg-bg h-10 items-center px-4 rounded-b-xl border-x">
                <div className="flex-1 px-4 text-[13px] font-bold text-text-muted"><span className="text-text-main">${sumClosed.toLocaleString()}</span> total</div>
              </div>
            </MondayGroup>
            <div className="mt-8">
              <MondayAddBlock onClick={() => setIsSlideOverOpen(true)} />
            </div>
          </div>
        )}
      </div>

      <DealSlideOver isOpen={isSlideOverOpen} onClose={() => setIsSlideOverOpen(false)} />

      {winLoss && (
        <WinLossModal isOpen={true} onClose={() => setWinLoss(null)}
          outcome={winLoss.outcome} dealTitle={winLoss.title} onConfirm={handleWinLossConfirm} />
      )}
    </div>
  );
}
