import { Users, CircleDollarSign, CalendarDays, Activity, ArrowUpRight, ArrowDownRight, Sparkles, Filter, TrendingUp, CheckCircle2, AlertCircle, GitBranch, Phone, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface DashboardData {
  stats: {
    totalContacts: number;
    openDeals: number;
    openDealsValue: string;
    wonDeals: number;
    wonDealsValue: string;
    activitiesToday: number;
  };
  recentActivities: any[];
  topContacts: any[];
}

export default function CrmDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/dashboard')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch dashboard data:', err);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-bg relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--glow-color)_0%,transparent_50%)] opacity-20 pointer-events-none" />
        <div className="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin mb-4" />
        <div className="text-text-muted font-medium animate-pulse slow">Loading workspace...</div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Contacts', value: data.stats.totalContacts.toString(), change: '+12%', trend: 'up', icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Open Deals', value: data.stats.openDeals.toString(), subtitle: `${data.stats.openDealsValue} pipeline`, icon: CircleDollarSign, color: 'text-amber', bg: 'bg-amber/10' },
    { label: 'Deals Won (30d)', value: data.stats.wonDeals.toString(), subtitle: `${data.stats.wonDealsValue} revenue`, icon: CircleDollarSign, color: 'text-green', bg: 'bg-green/10' },
    { label: 'Daily Activities', value: data.stats.activitiesToday.toString(), subtitle: '8 tasks due', icon: CalendarDays, color: 'text-accent-teal', bg: 'bg-accent-teal/10' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 bg-bg relative">
      {/* Ambient background glow */}
      <div className="fixed top-0 left-[20%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-[10%] w-[500px] h-[500px] bg-accent-teal/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto space-y-8 relative z-10">
        
        {/* Welcome Hero */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-4 animate-fade-in opacity-0" style={{ animationFillMode: 'forwards' }}>
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-2 text-sm tracking-wide">
              <Sparkles className="w-4 h-4" />
              <span>WELCOME BACK</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-text-main">
              Pipeline Overview
            </h1>
            <p className="text-text-muted text-[15px]">You have {data.stats.activitiesToday} high-priority tasks to complete today. Let's win.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary bg-surface/50 backdrop-blur-md border-border/50">
              <Filter className="w-4 h-4"/> Filter View
            </button>
            <button className="btn-primary shadow-luxury">
              <TrendingUp className="w-4 h-4"/> Generate Report
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {stats.map((stat, i) => (
            <div key={i} className="glass-card-hover metric-card-glow p-6 relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.change && (
                  <span className={`flex items-center gap-1 text-[13px] font-bold px-2 py-1 rounded-md ${stat.trend === 'up' ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="relative z-10">
                <div className="text-3xl font-bold mb-1 tracking-tight text-text-main group-hover:text-primary transition-colors">{stat.value}</div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</div>
                {stat.subtitle && <div className="text-[13px] text-text-muted font-medium">{stat.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-slide-up opacity-0" style={{ animation: 'fade-up 0.5s ease-out 0.3s forwards' }}>
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pipeline Summary */}
            <div className="glass-panel p-7">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-primary" /> Sales Pipeline Tracker
                </h2>
                <Link to="/business/crm/deals" className="text-sm font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-all">
                  View full board <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="flex h-[110px] gap-2 pt-2">
                {[
                  { name: 'Lead', count: 45, value: '$120k', color: 'from-slate-500 to-slate-400' },
                  { name: 'Qualified', count: 28, value: '$240k', color: 'from-blue-500 to-blue-400' },
                  { name: 'Proposal', count: 15, value: '$180k', color: 'from-amber to-yellow-400' },
                  { name: 'Negotiation', count: 8, value: '$305k', color: 'from-purple to-accent-light-purple' },
                  { name: 'Won', count: 18, value: '$210k', color: 'from-green to-emerald-400' },
                ].map((stage, i) => (
                  <div key={i} className="flex-1 flex flex-col group cursor-pointer relative pt-4">
                    {/* Hover tooltip effect */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface border border-border px-3 py-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 z-20 pointer-events-none whitespace-nowrap">
                      <span className="text-xs font-bold text-text-main">{stage.count} Active Deals</span>
                    </div>

                    <div className={`h-2.5 w-full rounded-full mb-4 bg-gradient-to-r ${stage.color} opacity-70 group-hover:opacity-100 transition-all shadow-sm group-hover:shadow-[0_0_12px_rgba(255,255,255,0.2)] group-hover:-translate-y-0.5`} />
                    <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5 transition-colors group-hover:text-text-main">{stage.name}</div>
                    <div className="text-lg font-bold text-text-main transition-transform group-hover:scale-105 origin-left">{stage.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-panel p-7">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <Activity className="w-5 h-5 text-accent-teal" /> Recent Activity
                </h2>
                <Link to="/business/crm/activities" className="text-sm font-semibold text-text-muted hover:text-primary transition-colors">See complete log</Link>
              </div>
              <div className="space-y-1">
                {data.recentActivities.map((act, i) => {
                  const Icon = act.type === 'email' ? Activity : 
                               act.type === 'call' ? Phone : 
                               act.type === 'meeting' ? CalendarDays : Users;
                  return (
                    <div key={i} className="group flex items-start gap-4 p-3 -mx-3 rounded-xl hover:bg-surface-hover/50 transition-colors cursor-pointer border border-transparent hover:border-border/50">
                      <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform group-hover:border-primary/30 group-hover:shadow-[0_0_10px_var(--glow-color)]">
                        <Icon className={`w-4 h-4 text-primary group-hover:text-accent-teal transition-colors`} />
                      </div>
                      <div className="flex-1 mt-0.5">
                        <div className="text-[14px] font-semibold text-text-main mb-0.5 group-hover:text-primary transition-colors">{act.title}</div>
                        <div className="text-[13px] text-text-muted font-medium flex items-center gap-2">
                          <span>{act.target}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{act.date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* My Tasks */}
            <div className="glass-panel p-7">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber" /> Priority Tasks
                </h2>
                <button className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/50 transition-all focus:outline-none shadow-sm">+</button>
              </div>
              <div className="space-y-2">
                {[
                  { title: 'Follow up on enterprise proposal', target: 'Alice Freeman', due: 'Today', overdue: false },
                  { title: 'Send revised contract', target: 'TechStart Inc', due: 'Yesterday', overdue: true },
                  { title: 'Initial discovery call', target: 'Charlie Davis', due: 'Tomorrow', overdue: false },
                ].map((task, i) => (
                  <div key={i} className="group flex items-start gap-3 p-3 -mx-3 rounded-xl hover:bg-surface-hover transition-colors border border-transparent hover:border-border/50 cursor-pointer">
                    <div className="mt-1 relative">
                      <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer peer appearance-none checked:bg-primary checked:border-primary transition-colors" />
                      <CheckCircle2 className="w-3 h-3 text-white absolute top-0.5 left-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[14px] font-semibold mb-1 text-text-main group-hover:text-primary transition-colors line-clamp-1">{task.title}</div>
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] font-medium text-text-muted">{task.target}</div>
                        <div className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${task.overdue ? 'bg-red/10 text-red' : 'bg-surface text-text-muted border border-border'}`}>
                          {task.overdue && <AlertCircle className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
                          {task.due}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2.5 text-sm font-semibold text-text-muted hover:text-text-main bg-surface/50 border border-border rounded-xl transition-all hover:bg-surface-hover">
                View all tasks
              </button>
            </div>

            {/* Hot Leads */}
            <div className="glass-panel p-7">
              <h2 className="text-lg font-bold text-text-main mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-accent-red" /> Hot Leads
              </h2>
              <div className="space-y-4">
                {data.topContacts.map((lead, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-surface/50 p-2 -mx-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent-purple text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                        {lead.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-text-main group-hover:text-primary transition-colors">{lead.name}</div>
                        <div className="text-[12px] font-medium text-text-muted">{lead.company}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-[13px] font-bold text-green drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]">{lead.leadScore}</div>
                      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Score</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
