import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Zap, Download, Trash2, Clock, CheckCircle, XCircle, Megaphone,
  RefreshCw, Phone, Mail, Globe, MapPin, ChevronDown, ChevronRight,
  TrendingUp, Users, Target, AlertCircle, Copy, ChevronUp,
  Filter, ArrowUpDown, Building2, Loader2, UserPlus
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { ImportContactsModal } from '../crm/components/ImportContactsModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadJob {
  id: string;
  status: 'queued' | 'running' | 'expanding' | 'completed' | 'failed';
  niche: string;
  area: string;
  maxLeads: number;
  leadsFound: number;
  leadsReturned: number;
  progressPct: number;
  message?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface Lead {
  id: string;
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  category?: string;
  confidenceScore?: number;
  phoneValidated?: boolean;
  discoveryEngine?: string;
  sourceUrl?: string;
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const api = {
  generateLeads: (body: { niche: string; area: string; maxLeads: number }) =>
    apiClient.post('/leads/generate', body).then(r => r.data),
  listJobs: () =>
    apiClient.get('/leads/jobs').then(r => r.data),
  getJob: (id: string) =>
    apiClient.get(`/leads/jobs/${id}`).then(r => r.data),
  deleteJob: (id: string) =>
    apiClient.delete(`/leads/jobs/${id}`).then(r => r.data),
  getQuota: () =>
    apiClient.get('/leads/quota').then(r => r.data),
  exportCsv: (id: string) =>
    window.open(`/api/leads/export/${id}`, '_blank'),
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LeadJob['status'] }) {
  const cfg = {
    queued:    { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Clock, label: 'Queued' },
    running:   { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: Loader2, label: 'Running', spin: true },
    expanding: { color: 'text-violet-400 bg-violet-400/10 border-violet-400/20', icon: Loader2, label: 'Expanding', spin: true },
    completed: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle, label: 'Done' },
    failed:    { color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle, label: 'Failed' },
  }[status] ?? { color: 'text-muted bg-surface border-border', icon: Clock, label: status };

  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${'spin' in cfg && cfg.spin ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ── Confidence pill ───────────────────────────────────────────────────────────

function ConfidencePill({ score }: { score?: number }) {
  if (!score) return <span className="text-muted text-[11px]">—</span>;
  const color = score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-orange-400';
  return <span className={`text-[11px] font-bold tabular-nums ${color}`}>{score}%</span>;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const isActive = status === 'running' || status === 'expanding' || status === 'queued';
  return (
    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${isActive ? 'animate-pulse' : ''}`}
        style={{
          width: `${pct}%`,
          background: status === 'failed' ? '#ef4444' : status === 'completed' ? '#10b981' : 'var(--primary)',
        }}
      />
    </div>
  );
}

// ── Lead row ──────────────────────────────────────────────────────────────────

function LeadRow({ lead, idx }: { lead: Lead; idx: number }) {
  const [copied, setCopied] = useState(false);

  const copyPhone = () => {
    if (!lead.phone) return;
    navigator.clipboard.writeText(lead.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr className="border-b border-border/40 hover:bg-surface/50 transition-colors group">
      <td className="px-4 py-3 text-[12px] text-muted tabular-nums w-8">{idx + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
               style={{ background: 'var(--primary)', opacity: 0.15 }}>
          </div>
          <div style={{ marginLeft: '-2rem', paddingLeft: '2.25rem' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 absolute"
                 style={{ background: 'rgba(var(--primary-rgb,59,130,246),0.12)', marginTop: '-0.1rem', marginLeft: '-2.25rem' }}>
              <Building2 className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            </div>
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-main)' }}>
              {lead.businessName || <span className="text-muted italic">Unknown</span>}
            </p>
            {lead.category && (
              <p className="text-[11px] text-muted">{lead.category}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {lead.phone ? (
          <button
            onClick={copyPhone}
            className="flex items-center gap-1.5 text-[12px] font-mono hover:text-primary transition-colors group/phone"
            style={{ color: 'var(--text-main)' }}
          >
            <Phone className="w-3 h-3 text-muted shrink-0" />
            {lead.phone}
            {lead.phoneValidated && <span className="text-emerald-400 text-[9px]">✓</span>}
            {copied ? <span className="text-emerald-400 text-[10px]">Copied!</span> :
              <Copy className="w-3 h-3 opacity-0 group-hover/phone:opacity-50 transition-opacity" />}
          </button>
        ) : <span className="text-muted text-[12px]">—</span>}
      </td>
      <td className="px-4 py-3">
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-[12px] hover:text-primary transition-colors" style={{ color: 'var(--text-main)' }}>
            <Mail className="w-3 h-3 text-muted shrink-0" />
            <span className="truncate max-w-[180px]">{lead.email}</span>
          </a>
        ) : <span className="text-muted text-[12px]">—</span>}
      </td>
      <td className="px-4 py-3">
        {lead.city && (
          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-main)' }}>
            <MapPin className="w-3 h-3 text-muted shrink-0" />
            {[lead.city, lead.state].filter(Boolean).join(', ')}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {lead.website ? (
          <a href={lead.website} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1.5 text-[12px] text-muted hover:text-primary transition-colors truncate max-w-[140px]">
            <Globe className="w-3 h-3 shrink-0" />
            {new URL(lead.website).hostname.replace('www.', '')}
          </a>
        ) : <span className="text-muted text-[12px]">—</span>}
      </td>
      <td className="px-4 py-3 text-right">
        <ConfidencePill score={lead.confidenceScore} />
      </td>
    </tr>
  );
}

// ── Job card (collapsed) ──────────────────────────────────────────────────────

function JobCard({ job, onSelect, isSelected }: { job: LeadJob; onSelect: () => void; isSelected: boolean }) {
  const qc = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteJob(job.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-jobs'] }),
  });

  const duration = job.startedAt && job.completedAt
    ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
    : null;

  return (
    <div
      className={`rounded-xl border transition-all cursor-pointer ${
        isSelected ? 'border-primary/40 shadow-lg' : 'border-border/60 hover:border-border'
      }`}
      style={{ background: isSelected ? 'rgba(var(--primary-rgb,59,130,246),0.04)' : 'var(--surface)' }}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-bold" style={{ color: 'var(--text-main)' }}>
                {job.niche} <span className="font-normal text-muted">in</span> {job.area}
              </p>
              <StatusBadge status={job.status} />
            </div>
            {job.message && (
              <p className="text-[11px] text-muted mt-1 truncate">{job.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.status === 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); api.exportCsv(job.id); }}
                className="p-1.5 rounded-lg transition-colors hover:bg-surface"
                style={{ color: 'var(--text-muted)' }}
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
              className="p-1.5 rounded-lg transition-colors hover:bg-red-400/10 hover:text-red-400"
              style={{ color: 'var(--text-muted)' }}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div style={{ color: 'var(--text-muted)' }}>
              {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Progress */}
        {(job.status === 'running' || job.status === 'expanding' || job.status === 'queued') && (
          <div className="mt-3">
            <ProgressBar pct={job.progressPct} status={job.status} />
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Users className="w-3 h-3" />
            <span><strong style={{ color: 'var(--text-main)' }}>{job.leadsReturned}</strong> leads</span>
          </div>
          {duration && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Clock className="w-3 h-3" />
              <span>{duration}s</span>
            </div>
          )}
          <div className="text-[11px] text-muted">
            {new Date(job.queuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadStudio() {
  const qc = useQueryClient();
  const [niche, setNiche] = useState('');
  const [area, setArea] = useState('');
  const [maxLeads, setMaxLeads] = useState(100);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'confidence' | 'name'>('confidence');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const nicheRef = useRef<HTMLInputElement>(null);

  // Auto-poll active jobs
  const { data: jobs = [] } = useQuery<LeadJob[]>({
    queryKey: ['lead-jobs'],
    queryFn: api.listJobs,
    refetchInterval: 3000,
  });

  const { data: quota } = useQuery<Quota>({
    queryKey: ['lead-quota'],
    queryFn: api.getQuota,
    refetchInterval: 30_000,
  });

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const { data: jobDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['lead-job-detail', selectedJobId],
    queryFn: () => api.getJob(selectedJobId!),
    enabled: !!selectedJobId && selectedJob?.status === 'completed',
    refetchInterval: false,
  });

  const hasActiveJob = jobs.some(j => j.status === 'running' || j.status === 'expanding' || j.status === 'queued');

  const generateMutation = useMutation({
    mutationFn: () => api.generateLeads({ niche: niche.trim(), area: area.trim(), maxLeads }),
    onSuccess: (data: any) => {
      setSelectedJobId(data.jobId);
      setNiche('');
      setArea('');
      qc.invalidateQueries({ queryKey: ['lead-jobs'] });
      qc.invalidateQueries({ queryKey: ['lead-quota'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !area.trim()) return;
    generateMutation.mutate();
  };

  // Auto-select first completed job if none selected
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  // Auto-refresh job detail when job completes
  useEffect(() => {
    if (selectedJob?.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['lead-job-detail', selectedJobId] });
    }
  }, [selectedJob?.status, selectedJobId, qc]);

  const leads: Lead[] = jobDetail?.leads || [];
  const filteredLeads = leads.filter(l => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.businessName?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === 'confidence') return (b.confidenceScore || 0) - (a.confidenceScore || 0);
    return (a.businessName || '').localeCompare(b.businessName || '');
  });

  const activeJob = jobs.find(j => j.status === 'running' || j.status === 'expanding' || j.status === 'queued');

  // Quick niche suggestions
  const nicheSuggestions = ['Plumber', 'Electrician', 'HVAC', 'Roofer', 'Landscaper', 'Dentist', 'Lawyer', 'Restaurant', 'Gym', 'Auto Repair'];

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* ── Left Panel: Form + Jobs ── */}
      <div className="w-[340px] shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'var(--primary)', boxShadow: '0 0 16px rgba(var(--primary-rgb,59,130,246),0.35)' }}>
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold" style={{ color: 'var(--text-main)' }}>Marketing</h1>
              <p className="text-[11px] text-muted">AI-powered business lead scraper</p>
            </div>
          </div>

          {/* Quota bar */}
          {quota && (
            <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted">Daily quota</span>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-main)' }}>
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(quota.used / quota.limit) * 100}%`,
                    background: quota.remaining < 50 ? '#ef4444' : 'var(--primary)',
                  }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">{quota.remaining} leads remaining today</p>
            </div>
          )}
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">
                Business Type
              </label>
              <input
                ref={nicheRef}
                type="text"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g. Plumber, Electrician, HVAC"
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {nicheSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNiche(s)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors"
                    style={{
                      background: niche === s ? 'var(--primary)' : 'var(--surface)',
                      color: niche === s ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">
                Location
              </label>
              <input
                type="text"
                value={area}
                onChange={e => setArea(e.target.value)}
                placeholder="e.g. San Jose CA, Chicago IL"
                className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">
                Max leads: <strong style={{ color: 'var(--text-main)' }}>{maxLeads}</strong>
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={maxLeads}
                onChange={e => setMaxLeads(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted mt-0.5">
                <span>10</span><span>100</span><span>200</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={generateMutation.isPending || !niche.trim() || !area.trim()}
              className="w-full py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-2 transition-all"
              style={{
                background: generateMutation.isPending || !niche.trim() || !area.trim()
                  ? 'var(--surface)'
                  : 'var(--primary)',
                color: generateMutation.isPending || !niche.trim() || !area.trim() ? 'var(--text-muted)' : '#fff',
                boxShadow: niche.trim() && area.trim() ? '0 4px 16px rgba(var(--primary-rgb,59,130,246),0.35)' : 'none',
              }}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Queuing...</>
              ) : (
                <><Search className="w-4 h-4" /> Generate Leads</>
              )}
            </button>
          </div>
        </form>

        {/* Live active job status */}
        {activeJob && (
          <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="rounded-lg p-3" style={{ background: 'rgba(var(--primary-rgb,59,130,246),0.08)', border: '1px solid rgba(var(--primary-rgb,59,130,246),0.2)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--primary)' }}>
                  {activeJob.status === 'expanding' ? 'Expanding search...' : 'Scraping in progress...'}
                </span>
              </div>
              <ProgressBar pct={activeJob.progressPct} status={activeJob.status} />
              <p className="text-[11px] text-muted mt-1.5">{activeJob.message || 'Initializing...'}</p>
            </div>
          </div>
        )}

        {/* Job list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-8 h-8 text-muted mx-auto mb-2 opacity-40" />
              <p className="text-[12px] text-muted">No jobs yet. Run your first search above.</p>
            </div>
          ) : (
            jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onSelect={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
                isSelected={selectedJobId === job.id}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right Panel: Results ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedJobId ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Megaphone className="w-7 h-7 text-muted opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text-main)' }}>Select a job to view leads</p>
              <p className="text-[12px] text-muted mt-1">Run a search on the left to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Results header */}
            <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-[15px] font-bold" style={{ color: 'var(--text-main)' }}>
                  {selectedJob?.niche} <span className="font-normal text-muted">in</span> {selectedJob?.area}
                </p>
                <p className="text-[12px] text-muted">
                  {selectedJob?.status === 'completed'
                    ? `${leads.length} leads found`
                    : selectedJob?.message || 'Working...'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Search filter */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Filter results..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none w-40"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>

                {/* Sort toggle */}
                <button
                  onClick={() => setSortBy(s => s === 'confidence' ? 'name' : 'confidence')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {sortBy === 'confidence' ? 'Confidence' : 'Name'}
                </button>

                {/* Export & Import */}
                {selectedJob?.status === 'completed' && leads.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setImportModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all shadow-sm"
                      style={{ background: 'var(--primary)', color: '#fff' }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Import to Contacts
                    </button>
                    <button
                      onClick={() => api.exportCsv(selectedJobId!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:bg-surface-hover"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            {selectedJob?.status === 'completed' && (
              <div className="px-6 py-3 border-b shrink-0 flex items-center gap-6" style={{ borderColor: 'var(--border)' }}>
                {[
                  { label: 'Total leads', value: leads.length, icon: Users },
                  { label: 'With phone', value: leads.filter(l => l.phone).length, icon: Phone },
                  { label: 'With email', value: leads.filter(l => l.email).length, icon: Mail },
                  { label: 'Validated phones', value: leads.filter(l => l.phoneValidated).length, icon: CheckCircle },
                  { label: 'Avg confidence', value: leads.length ? `${Math.round(leads.reduce((s, l) => s + (l.confidenceScore || 0), 0) / leads.length)}%` : '—', icon: TrendingUp },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted" />
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: 'var(--text-main)' }}>{value}</p>
                      <p className="text-[10px] text-muted">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Running state */}
            {(selectedJob?.status === 'running' || selectedJob?.status === 'expanding' || selectedJob?.status === 'queued') && (
              <div className="flex-1 flex items-center justify-center flex-col gap-6 p-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-4 border-t-primary border-transparent animate-spin absolute inset-0" />
                    <Search className="w-7 h-7" style={{ color: 'var(--primary)' }} />
                  </div>
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-[15px] font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    {selectedJob?.status === 'expanding' ? 'Expanding to related niches...' : 'Scraping the web...'}
                  </p>
                  <p className="text-[13px] text-muted">{selectedJob?.message}</p>
                  <div className="mt-4 w-48 mx-auto">
                    <ProgressBar pct={selectedJob?.progressPct || 0} status={selectedJob?.status || 'running'} />
                    <p className="text-[11px] text-muted mt-1.5 text-center">{selectedJob?.progressPct || 0}% complete</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted">Results will appear automatically when ready</p>
              </div>
            )}

            {/* Failed state */}
            {selectedJob?.status === 'failed' && (
              <div className="flex-1 flex items-center justify-center flex-col gap-3">
                <XCircle className="w-10 h-10 text-red-400" />
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-main)' }}>Job failed</p>
                <p className="text-[12px] text-muted max-w-sm text-center">{selectedJob.errorMessage}</p>
              </div>
            )}

            {/* Loading detail */}
            {detailLoading && selectedJob?.status === 'completed' && (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
              </div>
            )}

            {/* Results table */}
            {selectedJob?.status === 'completed' && !detailLoading && (
              <div className="flex-1 overflow-auto">
                {filteredLeads.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center flex-col gap-3 py-20">
                    <AlertCircle className="w-8 h-8 text-muted opacity-40" />
                    <p className="text-[13px] text-muted">
                      {searchFilter ? 'No leads match your filter.' : 'No leads found for this search.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--bg)' }}>
                      <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                        {['#', 'Business', 'Phone', 'Email', 'Location', 'Website', 'Score'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead, i) => (
                        <LeadRow key={lead.id} lead={lead} idx={i} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Import Contacts Modal with Tagging ── */}
      <ImportContactsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        initialJobTitle={selectedJob ? `${selectedJob.niche} in ${selectedJob.area}` : undefined}
        defaultTags={['Lead Studio', selectedJob?.niche, selectedJob?.area].filter(Boolean) as string[]}
        initialLeads={leads.map(l => ({
          name: l.businessName,
          businessName: l.businessName,
          phone: l.phone,
          email: l.email,
          website: l.website,
          address: l.address,
          city: l.city,
          state: l.state,
          postalCode: l.postalCode,
          category: l.category,
          source: 'Lead Studio',
          notes: `Scraped via Lead Studio (${selectedJob?.niche} in ${selectedJob?.area})`,
          tags: [selectedJob?.niche, selectedJob?.area].filter(Boolean) as string[],
        }))}
      />
    </div>
  );
}
