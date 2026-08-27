/**
 * Automations List — Email Marketing Module
 *
 * Full layout matching Campaigns section 1-to-1:
 * HeaderPortal search, frosted glass background, permanent bordered table headers,
 * status filter pills, and bottom paginator controls.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  Plus, Zap, Loader2, Trash2, Play, Pause, ChevronRight, AlertCircle,
  Search, ChevronDown, Check, Edit2, Users
} from 'lucide-react';

const api = {
  getAutomations: () => apiClient.get('/email-marketing/automations').then(r => r.data),
  deleteAutomation: (id: string) => apiClient.delete(`/email-marketing/automations/${id}`),
  activateAutomation: (id: string) => apiClient.patch(`/email-marketing/automations/${id}`, { status: 'ACTIVE' }),
  pauseAutomation: (id: string) => apiClient.patch(`/email-marketing/automations/${id}`, { status: 'PAUSED' }),
};

const STATUS_COLOR: Record<string, { label: string; badgeClass: string }> = {
  DRAFT:    { label: 'Draft',    badgeClass: 'text-text-muted bg-surface-hover border-border' },
  ACTIVE:   { label: 'Active',   badgeClass: 'text-accent-green bg-accent-green/10 border-accent-green/30' },
  PAUSED:   { label: 'Paused',   badgeClass: 'text-accent-amber bg-accent-amber/10 border-accent-amber/30' },
  ARCHIVED: { label: 'Archived', badgeClass: 'text-text-muted bg-surface-hover border-border' },
};

const TRIGGER_LABELS: Record<string, string> = {
  CONTACT_CREATED: 'Contact Created', TAG_ADDED: 'Tag Added', TAG_REMOVED: 'Tag Removed',
  FORM_SUBMITTED: 'Form Submitted', LIST_JOINED: 'List Joined', DEAL_STAGE_CHANGED: 'Deal Stage Changed',
  CUSTOM_FIELD_CHANGED: 'Custom Field Changed', DATE_BASED: 'Date Based',
  EMAIL_OPENED: 'Email Opened', EMAIL_LINK_CLICKED: 'Link Clicked',
  MANUAL_ENROLLMENT: 'Manual Enrollment', API_EVENT: 'API Event',
};

export default function AutomationsList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const { data: automations = [], isLoading, error } = useQuery({
    queryKey: ['email-marketing', 'automations'],
    queryFn: api.getAutomations,
    staleTime: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAutomation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'automations'] });
      toast('success', 'Automation Deleted', 'The workflow has been removed.');
    },
  });

  const activateMutation = useMutation({
    mutationFn: api.activateAutomation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'automations'] });
      toast('success', 'Automation Activated');
    },
  });

  const pauseMutation = useMutation({
    mutationFn: api.pauseAutomation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'automations'] });
      toast('success', 'Automation Paused');
    },
  });

  // Filter automations by search and status pill
  const processedAutomations = useMemo(() => {
    return automations.filter((a: any) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const triggerName = (TRIGGER_LABELS[a.triggerType] || a.triggerType || '').toLowerCase();
        return a.name.toLowerCase().includes(q) || triggerName.includes(q);
      }
      return true;
    });
  }, [automations, statusFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-bg text-text-main min-h-screen">
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Portal for Top App Bar Controls */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Automations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          
          <button 
            onClick={() => navigate('/email-marketing/automations/new')} 
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" /> New Automation
          </button>
        </div>
      </HeaderPortal>

      {/* Error state */}
      {error && (
        <div className="mx-8 mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-[13px]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Failed to load automations. Please refresh or try again.
        </div>
      )}

      {/* KPI Performance Overview & Filter Pills */}
      {!isLoading && !error && (
        <div className="mx-8 mt-5 mb-1 space-y-4 relative z-10">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Workflows</span>
                <Zap className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xl font-bold text-text-main">
                {automations.length}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Automated nurture & drip paths
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Workflows</span>
                <Play className="w-3.5 h-3.5 text-accent-green" />
              </div>
              <div className="text-xl font-bold text-accent-green">
                {automations.filter((a: any) => a.status === 'ACTIVE').length}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Running live triggers
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Enrollments</span>
                <Users className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-indigo-400">
                {automations.reduce((acc: number, a: any) => acc + (a._count?.enrollments ?? 0), 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Contacts progressing in sequence
              </div>
            </div>

            <div className="bg-surface/50 border border-border/60 rounded-xl p-3.5 backdrop-blur-md shadow-card hover:border-border transition-all">
              <div className="flex items-center justify-between text-text-muted mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Completed Executions</span>
                <Check className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-text-main">
                {automations.reduce((acc: number, a: any) => acc + (a.completedCount ?? 0), 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Full paths completed
              </div>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All', count: automations.length },
                { key: 'ACTIVE', label: 'Active', count: automations.filter((a: any) => a.status === 'ACTIVE').length },
                { key: 'PAUSED', label: 'Paused', count: automations.filter((a: any) => a.status === 'PAUSED').length },
                { key: 'DRAFT', label: 'Drafts', count: automations.filter((a: any) => a.status === 'DRAFT').length },
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setStatusFilter(pill.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === pill.key
                      ? 'bg-primary text-white shadow-interactive font-bold'
                      : 'bg-surface/60 border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === pill.key ? 'bg-white/20 text-white' : 'bg-surface border border-border/60 text-text-muted'
                  }`}>
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-xs text-text-muted font-medium">
              Showing <span className="text-text-main font-bold">{processedAutomations.length}</span> of {automations.length} automations
            </div>
          </div>
        </div>
      )}

      {/* Content Container — matches Campaigns section 1:1 */}
      {!isLoading && !error && (
        <div className="flex-1 overflow-auto mx-8 mt-3 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                <th className="w-12 p-3 text-center">
                  <span className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center text-text-muted text-[10px] font-bold">
                    #
                  </span>
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Automation name
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Trigger event
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Status
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Active Enrollments
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                  Completed
                </th>
                <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {processedAutomations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                        <Zap className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-text-main">No automations found</h3>
                      <p className="text-xs text-text-muted mt-1 mb-4">
                        {searchQuery.trim() || statusFilter !== 'ALL'
                          ? 'No automations match your active search and filter criteria.'
                          : 'Build automated email sequences triggered by tags, form submissions, or CRM events.'}
                      </p>
                      {searchQuery.trim() || statusFilter !== 'ALL' ? (
                        <button
                          onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
                          className="px-3 py-1.5 bg-surface-hover hover:bg-surface border border-border rounded-lg text-xs font-semibold text-text-main transition-all cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/email-marketing/automations/new')}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Automation
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedAutomations.map((a: any, idx: number) => {
                const cfg = STATUS_COLOR[a.status] || STATUS_COLOR.DRAFT;

                return (
                  <tr 
                    key={a.id}
                    className="border-b border-border/50 transition-colors cursor-pointer bg-black/5 hover:bg-black/10"
                    onClick={() => navigate(`/email-marketing/automations/${a.id}`)}
                  >
                    <td className="p-3 text-center text-[12px] font-medium text-text-muted opacity-60">
                      {idx + 1}
                    </td>

                    {/* Automation Name */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-primary shadow-sm shrink-0 bg-primary/20 border border-primary/30">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[13px] font-medium transition-colors text-text-main truncate hover:underline">
                          {a.name}
                        </span>
                      </div>
                    </td>

                    {/* Trigger Event */}
                    <td className="p-3">
                      <span className="text-[13px] font-medium text-text-muted truncate max-w-[240px] block">
                        {TRIGGER_LABELS[a.triggerType] || a.triggerType}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-sm ${cfg.badgeClass}`}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Active Enrollments */}
                    <td className="p-3 text-[13px] font-medium text-text-muted">
                      {a._count?.enrollments ?? 0}
                    </td>

                    {/* Completed */}
                    <td className="p-3 text-[13px] font-medium text-text-muted">
                      {a.completedCount ?? 0}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {a.status === 'ACTIVE' ? (
                          <button
                            onClick={() => pauseMutation.mutate(a.id)}
                            className="flex items-center gap-1 px-2.5 py-1 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                          >
                            <Pause className="w-3 h-3 text-amber-400" /> Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => activateMutation.mutate(a.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-primary hover:bg-primary-hover text-white rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                          >
                            <Play className="w-3 h-3" /> Activate
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/email-marketing/automations/${a.id}`)}
                          className="p-1 text-text-muted hover:text-text-main rounded-[6px] transition-colors"
                          title="Edit workflow canvas"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-[6px] transition-colors"
                          title="Delete automation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <ChevronRight className="w-4 h-4 text-text-muted opacity-40 hover:opacity-100" />
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Controls & Paginator */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg border border-border/50">
            {['ALL', 'ACTIVE', 'DRAFT', 'PAUSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                  statusFilter === st ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {st === 'ALL' ? 'All Automations' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Counter & Pagination */}
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-medium text-text-muted">
            {processedAutomations.length} Automations
          </span>
          <div className="flex items-center gap-3 font-semibold">
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Prev</button>
            <button className="px-3 py-0.5 rounded-[6px] shadow-sm bg-primary text-white font-bold text-[12px]">1</button>
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
