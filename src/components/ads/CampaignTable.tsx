import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Copy, Trash2, Search, ChevronDown, ChevronUp,
  ChevronsUpDown, MoreHorizontal, Settings2, CheckSquare, Square,
  ExternalLink, AlertCircle, RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react';
import type { AdCampaign, AdCampaignStatus } from '../../types/ads';
import { formatCurrency } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedCampaign extends AdCampaign {
  reach30d?: number;
  impressions30d?: number;
  clicks30d?: number;
  frequency30d?: number;
}

interface CampaignTableProps {
  campaigns: ExtendedCampaign[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onBulkPause?: (ids: string[]) => void;
  onBulkResume?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  isLoading?: boolean;
  searchQuery: string;
  statusFilter: string;
  platformFilter: string;
}

type SortKey =
  | 'name' | 'status' | 'platform'
  | 'cachedSpend30dCents' | 'cachedLeads30d' | 'cachedCtr30d'
  | 'reach30d' | 'impressions30d' | 'clicks30d' | 'budgetAmountCents';

type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  sortKey?: SortKey;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

const ALL_COLUMNS: Column[] = [
  { key: 'delivery',    label: 'Delivery',       align: 'center', width: '80px' },
  { key: 'name',        label: 'Campaign Name',  sortKey: 'name', align: 'left' },
  { key: 'platform',    label: 'Platform',       sortKey: 'platform', align: 'left', width: '110px' },
  { key: 'status',      label: 'Status',         sortKey: 'status', align: 'left', width: '110px' },
  { key: 'budget',      label: 'Budget/day',     sortKey: 'budgetAmountCents', align: 'right', width: '110px' },
  { key: 'results',     label: 'Results',        sortKey: 'cachedLeads30d', align: 'right', width: '100px' },
  { key: 'reach',       label: 'Reach',          sortKey: 'reach30d', align: 'right', width: '100px' },
  { key: 'impressions', label: 'Impressions',    sortKey: 'impressions30d', align: 'right', width: '120px' },
  { key: 'cpm',         label: 'CPM',            align: 'right', width: '90px' },
  { key: 'clicks',      label: 'Clicks',         sortKey: 'clicks30d', align: 'right', width: '90px' },
  { key: 'cpc',         label: 'CPC',            align: 'right', width: '90px' },
  { key: 'ctr',         label: 'CTR',            sortKey: 'cachedCtr30d', align: 'right', width: '90px' },
  { key: 'spend',       label: 'Amount Spent',   sortKey: 'cachedSpend30dCents', align: 'right', width: '130px' },
  { key: 'cpl',         label: 'Cost/Result',    align: 'right', width: '120px' },
  { key: 'actions',     label: '',               align: 'right', width: '56px' },
];

const DEFAULT_VISIBLE = new Set([
  'delivery', 'name', 'platform', 'status', 'budget',
  'results', 'impressions', 'ctr', 'spend', 'cpl', 'actions',
]);

// ─── Status config ────────────────────────────────────────────────────────────

function statusConfig(status: AdCampaignStatus) {
  switch (status) {
    case 'ACTIVE':   return { label: 'Active',   dot: 'bg-green-500',  text: 'text-green-600', bg: 'bg-green-500/10' };
    case 'PAUSED':   return { label: 'Paused',   dot: 'bg-amber-400',  text: 'text-amber-600', bg: 'bg-amber-400/10' };
    case 'DRAFT':    return { label: 'Draft',    dot: 'bg-gray-400',   text: 'text-gray-500',  bg: 'bg-gray-400/10' };
    case 'ENDED':    return { label: 'Ended',    dot: 'bg-gray-400',   text: 'text-gray-500',  bg: 'bg-gray-400/10' };
    case 'REJECTED': return { label: 'Rejected', dot: 'bg-red-500',    text: 'text-red-600',   bg: 'bg-red-500/10' };
    default:         return { label: status,     dot: 'bg-gray-400',   text: 'text-gray-500',  bg: 'bg-gray-400/10' };
  }
}

function deliveryIcon(status: AdCampaignStatus) {
  if (status === 'ACTIVE')   return <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)] animate-pulse" />;
  if (status === 'PAUSED')   return <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />;
  if (status === 'REJECTED') return <AlertCircle className="w-4 h-4 text-red-500" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-400/60" />;
}

function platformBadge(platform: string) {
  if (platform === 'GOOGLE') return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Google
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      Meta
    </span>
  );
}

function formatCompact(n: number | undefined): string {
  if (n == null || n === 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-border/50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded bg-border/60 animate-pulse" style={{ width: `${50 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignTable({
  campaigns,
  onPause,
  onResume,
  onDuplicate,
  onDelete,
  onBulkPause,
  onBulkResume,
  onBulkDelete,
  isLoading,
  searchQuery,
  statusFilter,
  platformFilter,
}: CampaignTableProps) {
  const navigate = useNavigate();

  // Table state
  const [sortKey, setSortKey]         = useState<SortKey>('cachedSpend30dCents');
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [openMenu, setOpenMenu]       = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm]       = useState<null | 'pause' | 'resume' | 'delete'>(null);

  // Filtering + sorting
  const filtered = useMemo(() => {
    let result = [...campaigns];

    if (platformFilter !== 'ALL') {
      result = result.filter(c => c.platform === platformFilter);
    }
    if (statusFilter !== 'ALL') {
      result = result.filter(c => c.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      let av = (a as any)[sortKey] ?? 0;
      let bv = (b as any)[sortKey] ?? 0;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [campaigns, searchQuery, sortKey, sortDir, platformFilter, statusFilter]);

  const allSelected   = filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected  = filtered.some(c => selected.has(c.id));
  const selectedCount = [...selected].filter(id => filtered.some(c => c.id === id)).length;

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }, [sortKey]);

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(c => n.delete(c.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(c => n.add(c.id)); return n; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectedIds = () => [...selected].filter(id => filtered.some(c => c.id === id));

  const colsToShow = ALL_COLUMNS.filter(c => visibleCols.has(c.key));

  function SortIcon({ col }: { col: Column }) {
    if (!col.sortKey) return null;
    if (sortKey !== col.sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-primary" />
      : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
  }

  function cellValue(col: Column, c: ExtendedCampaign): React.ReactNode {
    const spendCents  = c.cachedSpend30dCents ?? 0;
    const leads       = c.cachedLeads30d ?? 0;
    const impressions = c.impressions30d ?? 0;
    const clicks      = c.clicks30d ?? 0;
    const reach       = c.reach30d ?? 0;
    const ctr         = c.cachedCtr30d ?? 0;
    const cpl         = leads > 0 ? spendCents / leads : null;
    const cpc         = clicks > 0 ? spendCents / clicks : null;
    const cpm         = impressions > 0 ? (spendCents / impressions) * 1000 : null;

    switch (col.key) {
      case 'delivery':    return <div className="flex items-center justify-center">{deliveryIcon(c.status)}</div>;
      case 'name':        return (
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-text-main truncate text-[13px] max-w-[220px]">{c.name}</span>
          <span className="text-[11px] text-text-muted mt-0.5">
            {c.adType.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      );
      case 'platform':    return platformBadge(c.platform);
      case 'status': {
        const s = statusConfig(c.status);
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        );
      }
      case 'budget':      return <span className="tabular-nums">{formatCurrency(c.budgetAmountCents / 100)}</span>;
      case 'results':     return <span className="tabular-nums font-medium">{leads > 0 ? leads.toLocaleString() : '—'}</span>;
      case 'reach':       return <span className="tabular-nums">{formatCompact(reach)}</span>;
      case 'impressions': return <span className="tabular-nums">{formatCompact(impressions)}</span>;
      case 'cpm':         return <span className="tabular-nums">{cpm != null && cpm > 0 ? formatCurrency(cpm / 100) : '—'}</span>;
      case 'clicks':      return <span className="tabular-nums">{formatCompact(clicks)}</span>;
      case 'cpc':         return <span className="tabular-nums">{cpc != null && cpc > 0 ? formatCurrency(cpc / 100) : '—'}</span>;
      case 'ctr':         return <span className="tabular-nums">{ctr > 0 ? `${(ctr * 100).toFixed(2)}%` : '—'}</span>;
      case 'spend':       return <span className="tabular-nums font-medium">{spendCents > 0 ? formatCurrency(spendCents / 100) : '—'}</span>;
      case 'cpl':         return <span className="tabular-nums">{cpl != null && cpl > 0 ? formatCurrency(cpl / 100) : '—'}</span>;
      case 'actions':     return null; // handled separately
      default:            return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative" onClick={() => { setOpenMenu(null); setColPickerOpen(false); }}>
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              {/* Checkbox */}
              <th className="w-10 px-3 py-2.5">
                <button onClick={e => { e.stopPropagation(); toggleAll(); }}>
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : someSelected
                      ? <span className="w-4 h-4 border-2 border-primary rounded flex items-center justify-center"><span className="w-2 h-0.5 bg-primary" /></span>
                      : <Square className="w-4 h-4 text-text-muted" />
                  }
                </button>
              </th>

              {colsToShow.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : {}}
                >
                  {col.sortKey ? (
                    <button
                      className="inline-flex items-center gap-0.5 hover:text-text-main transition-colors"
                      onClick={e => { e.stopPropagation(); toggleSort(col.sortKey!); }}
                    >
                      {col.label}
                      <SortIcon col={col} />
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} cols={colsToShow.length + 1} />
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={colsToShow.length + 1} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-text-muted/40" />
                    <p className="text-sm font-medium text-text-muted">No campaigns found</p>
                    <p className="text-xs text-text-muted/60">Try adjusting your filters or search query</p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && filtered.map(c => {
              const isSelected = selected.has(c.id);
              const isMenuOpen = openMenu === c.id;
              const sc = statusConfig(c.status);

              return (
                <tr
                  key={c.id}
                  className={`border-b border-border/50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-surface-hover/50'
                  }`}
                  onClick={() => navigate(`/ads/campaigns/${c.id}`)}
                >
                  {/* Checkbox */}
                  <td className="w-10 px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleOne(c.id); }}>
                    {isSelected
                      ? <CheckSquare className="w-4 h-4 text-primary" />
                      : <Square className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    }
                  </td>

                  {colsToShow.map(col => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 text-[13px] text-text-main whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {col.key === 'actions' ? (
                        <div className="relative flex items-center justify-end" onClick={e => e.stopPropagation()}>
                          {/* Inline pause/resume toggle */}
                          {c.status === 'ACTIVE' && (
                            <button
                              onClick={() => onPause(c.id)}
                              title="Pause campaign"
                              className="p-1.5 rounded text-text-muted hover:text-amber-500 hover:bg-amber-500/10 transition-colors mr-1 opacity-0 group-hover:opacity-100"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {c.status === 'PAUSED' && (
                            <button
                              onClick={() => onResume(c.id)}
                              title="Resume campaign"
                              className="p-1.5 rounded text-text-muted hover:text-green-500 hover:bg-green-500/10 transition-colors mr-1 opacity-0 group-hover:opacity-100"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setOpenMenu(isMenuOpen ? null : c.id)}
                            className="p-1.5 rounded text-text-muted hover:text-text-main hover:bg-border/60 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {/* Dropdown menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-8 z-50 bg-surface border border-border rounded-xl shadow-xl py-1.5 w-48">
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-main hover:bg-border/50 transition-colors"
                                onClick={() => { navigate(`/ads/campaigns/${c.id}`); setOpenMenu(null); }}
                              >
                                <ExternalLink className="w-4 h-4 text-text-muted" /> View Campaign
                              </button>
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-main hover:bg-border/50 transition-colors"
                                onClick={() => { navigate(`/ads/campaigns/${c.id}/edit`); setOpenMenu(null); }}
                              >
                                <Settings2 className="w-4 h-4 text-text-muted" /> Edit
                              </button>
                              {c.status === 'ACTIVE' && (
                                <button
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-amber-600 hover:bg-amber-500/10 transition-colors"
                                  onClick={() => { onPause(c.id); setOpenMenu(null); }}
                                >
                                  <Pause className="w-4 h-4" /> Pause
                                </button>
                              )}
                              {c.status === 'PAUSED' && (
                                <button
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-green-600 hover:bg-green-500/10 transition-colors"
                                  onClick={() => { onResume(c.id); setOpenMenu(null); }}
                                >
                                  <Play className="w-4 h-4" /> Resume
                                </button>
                              )}
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-main hover:bg-border/50 transition-colors"
                                onClick={() => { onDuplicate(c.id); setOpenMenu(null); }}
                              >
                                <Copy className="w-4 h-4 text-text-muted" /> Duplicate
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 hover:bg-red-500/10 transition-colors"
                                onClick={() => { onDelete(c.id); setOpenMenu(null); }}
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        cellValue(col, c)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Paginator */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted flex items-center gap-3">
          Page 1 of 1
          <div className="w-[1px] h-4 bg-border"></div>
          <span className="px-2.5 py-0.5 rounded-lg text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60"></span>
            {campaigns.length} Campaigns
          </span>
          <span className="text-[11px] text-text-muted/60">Showing 30-day metrics · sorted by {sortKey.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main">
            20 <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Prev</button>
            <button className="px-3.5 py-1.5 rounded-lg shadow-sm text-bg font-bold" style={{ backgroundColor: 'var(--primary)' }}>1</button>
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Next</button>
          </div>
        </div>
      </div>

      {/* ── Bulk confirm dialog ──────────────────────────────────────────── */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm" onClick={() => setBulkConfirm(null)}>
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-text-main text-lg mb-2">
              {bulkConfirm === 'delete' ? 'Delete Campaigns?' : bulkConfirm === 'pause' ? 'Pause Campaigns?' : 'Resume Campaigns?'}
            </h3>
            <p className="text-sm text-text-muted mb-6">
              {bulkConfirm === 'delete'
                ? `This will permanently delete ${selectedCount} campaign${selectedCount !== 1 ? 's' : ''}. Active campaigns will be paused on the platform first. This can't be undone.`
                : bulkConfirm === 'pause'
                  ? `This will pause ${selectedCount} campaign${selectedCount !== 1 ? 's' : ''} across all connected platforms.`
                  : `This will resume ${selectedCount} campaign${selectedCount !== 1 ? 's' : ''} across all connected platforms.`
              }
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setBulkConfirm(null)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-border/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const ids = selectedIds();
                  if (bulkConfirm === 'pause'  && onBulkPause)  onBulkPause(ids);
                  if (bulkConfirm === 'resume' && onBulkResume) onBulkResume(ids);
                  if (bulkConfirm === 'delete' && onBulkDelete) onBulkDelete(ids);
                  setSelected(new Set());
                  setBulkConfirm(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                  bulkConfirm === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {bulkConfirm === 'delete' ? `Delete ${selectedCount}` : bulkConfirm === 'pause' ? `Pause ${selectedCount}` : `Resume ${selectedCount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
