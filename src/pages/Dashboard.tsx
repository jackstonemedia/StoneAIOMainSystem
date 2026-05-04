import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAgents, useUpdateAgent, useDeleteAgent } from '../hooks/useAgents';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';

// Safe Clerk hook — gracefully no-ops when ClerkProvider is not mounted (dev bypass mode)
function useSafeUser() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { useUser } = require('@clerk/clerk-react');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  } catch {
    return { user: null, isLoaded: true };
  }
}
import {
  Plus, Activity, Zap, Bot, MoreVertical,
  Settings, FileText, GitBranch, Mic, MessageSquare,
  Sparkles, ArrowRight, TrendingUp, Play, Pause, Trash2
} from 'lucide-react';

const quickActions = [
  { name: 'New Workflow',  desc: 'Build an automation',   icon: GitBranch,    path: '/agents?type=workflow',   accent: '#52677D' },
  { name: 'Voice Agent',   desc: 'Deploy a phone agent',  icon: Mic,          path: '/agents?type=voice',      accent: '#10B981' },
  { name: 'AI Assistant',  desc: 'Chat with your AI',     icon: MessageSquare,path: '/assistant',              accent: '#BDC4D4' },
  { name: 'Autonomous',    desc: 'Launch a goal agent',   icon: Sparkles,     path: '/agents?type=autonomous', accent: '#52677D' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'Running':
    case 'active': return '#10B981';
    case 'Paused':
    case 'paused': return '#52677D';
    case 'Error':
    case 'error':  return '#EF4444';
    default:       return '#52677D';
  }
}

function getTypeBadge(type: string): { bg: string; color: string; border: string } {
  const t = type.toLowerCase();
  if (t === 'workflow')   return { bg: 'rgba(82,103,125,0.12)',  color: '#52677D', border: 'rgba(82,103,125,0.25)'  };
  if (t === 'voice')      return { bg: 'rgba(16,185,129,0.12)',  color: '#10B981', border: 'rgba(16,185,129,0.25)'  };
  if (t === 'autonomous') return { bg: 'rgba(189,196,212,0.12)', color: '#BDC4D4', border: 'rgba(189,196,212,0.25)' };
  if (t === 'assistant')  return { bg: 'rgba(82,103,125,0.12)',  color: '#52677D', border: 'rgba(82,103,125,0.25)'  };
  return { bg: 'var(--surface)', color: 'var(--text-muted)', border: 'var(--border)' };
}

function getIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'workflow') return FileText;
  if (t === 'voice') return Mic;
  return Bot;
}

export default function Dashboard() {
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();
  const { user } = useSafeUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: metrics } = useQuery<any>({
    queryKey: ['business_metrics'],
    queryFn: () => fetch('/api/business/metrics').then(r => r.ok ? r.json() : null)
  });

  const activeAgentsCount = agents.filter(a => a.status === 'active').length;

  const totalRuns   = metrics?.runsToday ?? (agents.length > 0 ? '—' : '0');
  const creditsUsed = metrics?.creditsUsed ?? '—';
  const successRate = metrics?.successRate ? `${metrics.successRate}%` : '—';

  const stats = [
    { label: 'Active Agents', value: activeAgentsCount.toString(), icon: Bot, change: `${agents.length} total`, trend: 'up' as const },
    { label: 'Runs Today',   value: String(totalRuns),   icon: Activity, change: metrics?.runsDelta ?? '',   trend: 'up' as const },
    { label: 'Credits Used', value: String(creditsUsed), icon: Zap,      change: metrics?.creditsRemaining ? `${metrics.creditsRemaining} remaining` : '', trend: 'neutral' as const },
    { label: 'Success Rate', value: successRate,          icon: TrendingUp, change: metrics?.successDelta ?? '', trend: 'up' as const },
  ];

  const recentAgents = agents.slice(0, 5).map(a => ({
    ...a,
    icon: getIcon(a.type),
  }));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight mb-1" style={{ color: 'var(--text-main)' }}>
              Welcome back, {user?.firstName || 'there'}
            </h1>
            <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              Here's what your AI team is up to today.
            </p>
          </div>
          <Link
            to="/agents"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all"
            style={{
              background: 'var(--primary)',
              color: 'var(--text-main)',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary)')}
          >
            <Plus className="w-4 h-4" />
            New Agent
          </Link>
        </header>

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7 stagger-children">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              to={action.path}
              className="group rounded-xl p-4 transition-all duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = action.accent;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${action.accent}18`, color: action.accent }}
              >
                <action.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
              </div>
              <div className="font-semibold text-[13px] mb-0.5" style={{ color: 'var(--text-main)' }}>
                {action.name}
              </div>
              <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {action.desc}
              </div>
            </Link>
          ))}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7 stagger-children">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-5 transition-all duration-200"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                >
                  <stat.icon className="w-4.5 h-4.5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
                </div>
                {stat.trend === 'up' && (
                  <span className="text-[11px] font-semibold" style={{ color: '#10B981' }}>
                    {stat.change}
                  </span>
                )}
                {stat.trend === 'neutral' && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="text-[24px] font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-main)' }}>
                {stat.value}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Recent Agents ── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="text-[13.5px] font-bold" style={{ color: 'var(--text-main)' }}>
              Active Agents
            </h2>
            <Link
              to="/agents"
              className="text-[12.5px] font-medium flex items-center gap-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-main)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoadingAgents ? (
            <div className="text-center py-16 m-6">
              <div className="w-8 h-8 border-4 border-surface border-t-primary rounded-full animate-spin mx-auto"></div>
            </div>
          ) : recentAgents.length === 0 ? (
            <div
              className="text-center py-16 m-6 rounded-xl border-2 border-dashed"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <h3 className="font-semibold mb-1" style={{ color: 'var(--text-main)' }}>No agents yet</h3>
              <p className="text-[13px] mb-5 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
                Create your first agent and start automating.
              </p>
              <Link
                to="/agents"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--primary)', color: 'var(--text-main)' }}
              >
                <Plus className="w-4 h-4" /> Create your first agent
              </Link>
            </div>
          ) : (
            <div>
              {recentAgents.map((agent, idx) => {
                const typeBadge = getTypeBadge(agent.type);
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.id}
                    className="px-6 py-4 flex items-center justify-between group transition-colors"
                    style={{
                      borderBottom: idx < recentAgents.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                  >
                    {/* Left */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                        >
                          <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                          style={{
                            background: getStatusColor(agent.status),
                            borderColor: 'var(--surface)',
                          }}
                        />
                      </div>

                      <div>
                        <Link
                          to={`/agents/${agent.id}/build?type=${agent.type}`}
                          className="font-semibold text-[13.5px] block mb-0.5 transition-colors"
                          style={{ color: 'var(--text-main)' }}
                        >
                          {agent.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize"
                            style={{
                              background: typeBadge.bg,
                              color: typeBadge.color,
                              border: `1px solid ${typeBadge.border}`,
                            }}
                          >
                            {agent.type}
                          </span>
                          <span className="text-[12px] capitalize" style={{ color: 'var(--text-muted)' }}>
                            {agent.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
                        <button
                          onClick={() => navigate(`${agent.type === 'voice' ? `/agents/voice/${agent.id}/build` : `/agents/${agent.id}/build`}`)}
                          className="p-1.5 rounded-lg transition-colors" title="Logs"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-main)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <FileText className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => navigate(agent.type === 'voice' ? `/agents/voice/${agent.id}/build` : `/agents/${agent.id}/build`)}
                          className="p-1.5 rounded-lg transition-colors" title="Settings"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-main)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <Settings className="w-4 h-4" strokeWidth={1.75} />
                        </button>

                        {/* More dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === agent.id ? null : agent.id)}
                            className="p-1.5 rounded-lg transition-colors" title="More"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-main)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                          {openMenuId === agent.id && (
                            <div className="absolute right-0 top-8 z-30 w-40 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                              <button
                                onClick={() => { updateAgent.mutate({ id: agent.id, data: { status: agent.status === 'active' ? 'paused' : 'active' } }, { onSuccess: () => { toast('success', agent.status === 'active' ? 'Agent paused' : 'Agent resumed'); setOpenMenuId(null); }, onError: () => toast('error', 'Failed') }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-surface-hover transition-colors"
                                style={{ color: 'var(--text-main)' }}
                              >
                                {agent.status === 'active' ? <Pause className="w-3.5 h-3.5 text-amber" /> : <Play className="w-3.5 h-3.5 text-green" />}
                                {agent.status === 'active' ? 'Pause' : 'Resume'}
                              </button>
                              <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                              {confirmDeleteId === agent.id ? (
                                <div className="px-3 py-2.5">
                                  <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Delete permanently?</p>
                                  <div className="flex gap-1.5">
                                    <button onClick={() => { deleteAgent.mutate(agent.id, { onSuccess: () => { toast('success', 'Agent deleted'); setOpenMenuId(null); setConfirmDeleteId(null); }, onError: () => toast('error', 'Failed to delete') }); }} className="flex-1 px-2 py-1 rounded-md text-[11px] font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>Delete</button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-2 py-1 rounded-md text-[11px]" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDeleteId(agent.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-red/5 transition-colors" style={{ color: '#ef4444' }}>
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

