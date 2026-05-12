import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, CheckCircle2, XCircle, Clock, Loader2,
  RefreshCw, ChevronDown, ChevronRight, AlertCircle,
  ExternalLink, Search, Filter,
} from 'lucide-react';
import { useGlobalRuns } from '../../hooks/useTables';
import type { GlobalRunEntry } from '../../hooks/useTables';

type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PAUSED' | 'STOPPED' | 'INTERNAL_ERROR';

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SUCCEEDED:      { label: 'Success',      color: 'text-green-400  bg-green-500/10  border-green-500/25',   icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> },
  FAILED:         { label: 'Failed',       color: 'text-red-400    bg-red-500/10    border-red-500/25',     icon: <XCircle      className="w-3.5 h-3.5 text-red-400" /> },
  RUNNING:        { label: 'Running',      color: 'text-blue-400   bg-blue-500/10   border-blue-500/25',    icon: <Loader2      className="w-3.5 h-3.5 text-blue-400 animate-spin" /> },
  PAUSED:         { label: 'Paused',       color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', icon: <Clock        className="w-3.5 h-3.5 text-yellow-400" /> },
  STOPPED:        { label: 'Stopped',      color: 'text-text-muted bg-surface       border-border',         icon: <Clock        className="w-3.5 h-3.5 text-text-muted" /> },
  INTERNAL_ERROR: { label: 'System Error', color: 'text-red-600    bg-red-600/10    border-red-600/25',     icon: <AlertCircle  className="w-3.5 h-3.5 text-red-600" /> },
};

const ALL_STATUSES = ['ALL', 'SUCCEEDED', 'FAILED', 'RUNNING', 'PAUSED', 'STOPPED'];
const PAGE_SIZE = 50;

export default function AutomationsRuns() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isRefetching, refetch } = useGlobalRuns({
    status: status !== 'ALL' ? status : undefined,
    limit: PAGE_SIZE,
    page,
  });

  const runs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = search
    ? runs.filter((r) => r.flowName.toLowerCase().includes(search.toLowerCase()))
    : runs;

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Play className="w-4 h-4 text-accent" />
              Run History
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {isLoading ? 'Loading...' : `${total.toLocaleString()} runs total`}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by workflow name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent w-64"
            />
          </div>
          {/* Status tabs */}
          <div className="flex gap-1 p-1 bg-bg border border-border rounded-lg">
            {ALL_STATUSES.map((s) => {
              const cfg = s === 'ALL' ? null : STATUS_CFG[s];
              return (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    status === s
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-main hover:bg-surface'
                  }`}
                >
                  {s === 'ALL' ? 'All' : (cfg?.label ?? s)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            <p className="text-sm text-text-muted">Loading runs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center">
              <Play className="w-6 h-6 text-text-muted" />
            </div>
            <p className="text-text-muted text-sm">No runs found</p>
            <p className="text-text-muted text-xs">Run a workflow test to see results here</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Workflow</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Duration</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Steps</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Started</th>
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Finished</th>
                  <th className="w-10 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((run) => {
                  const cfg = STATUS_CFG[run.status] ?? STATUS_CFG.STOPPED;
                  return (
                    <tr
                      key={run.id}
                      className="hover:bg-surface/50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/automations/${run.workflowId}`)}
                    >
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium border ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-text-main">{run.flowName}</span>
                        {run.errorMessage && (
                          <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs">{run.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted font-mono">
                        {formatDuration(run.duration)}
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted">
                        {run.stepCount ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                        {formatDate(run.startTime)}
                      </td>
                      <td className="px-5 py-3 text-xs text-text-muted whitespace-nowrap">
                        {run.finishTime ? formatDate(run.finishTime) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-surface">
                <p className="text-xs text-text-muted">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-bg disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-text-muted">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-bg disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
