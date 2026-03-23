import { Users, CircleDollarSign, CalendarDays, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
      .then(res => res.json())
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
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">Loading dashboard...</div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Contacts', value: data.stats.totalContacts.toString(), change: '+12%', trend: 'up', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Open Deals', value: data.stats.openDeals.toString(), subtitle: `${data.stats.openDealsValue} pipeline`, icon: CircleDollarSign, color: 'text-amber', bg: 'bg-amber/10' },
    { label: 'Deals Won (30d)', value: data.stats.wonDeals.toString(), subtitle: `${data.stats.wonDealsValue} revenue`, icon: CircleDollarSign, color: 'text-green', bg: 'bg-green/10' },
    { label: 'Activities Today', value: data.stats.activitiesToday.toString(), subtitle: '8 tasks due', icon: CalendarDays, color: 'text-purple', bg: 'bg-purple/10' },
  ];

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">CRM Dashboard</h1>
          <p className="text-sm text-text-muted">Overview of your sales pipeline and recent activities.</p>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                {stat.change && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-green' : 'text-red'}`}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="text-2xl font-semibold mb-1">{stat.value}</div>
              <div className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">{stat.label}</div>
              {stat.subtitle && <div className="text-xs text-text-muted">{stat.subtitle}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pipeline Summary */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Sales Pipeline</h2>
                <Link to="/crm/deals" className="text-sm text-primary hover:underline">View all deals</Link>
              </div>
              <div className="flex h-24 gap-1">
                {[
                  { name: 'Lead', count: 45, value: '$120k', color: 'bg-slate-400', width: 'w-1/5' },
                  { name: 'Qualified', count: 28, value: '$240k', color: 'bg-blue-400', width: 'w-1/5' },
                  { name: 'Proposal', count: 15, value: '$180k', color: 'bg-amber', width: 'w-1/5' },
                  { name: 'Negotiation', count: 8, value: '$305k', color: 'bg-purple', width: 'w-1/5' },
                  { name: 'Won', count: 18, value: '$210k', color: 'bg-green', width: 'w-1/5' },
                ].map((stage, i) => (
                  <div key={i} className={`flex-1 flex flex-col group cursor-pointer`}>
                    <div className={`h-2 w-full rounded-full mb-3 ${stage.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                    <div className="text-xs font-semibold mb-1">{stage.name}</div>
                    <div className="text-sm font-bold mb-1">{stage.value}</div>
                    <div className="text-xs text-text-muted">{stage.count} deals</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Recent Activity</h2>
                <Link to="/crm/activities" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              <div className="space-y-4">
                {data.recentActivities.map((act, i) => {
                  const Icon = act.type === 'email' ? Activity : 
                               act.type === 'call' ? Activity : 
                               act.type === 'meeting' ? CalendarDays : Users;
                  return (
                    <div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                      <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 text-primary`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-0.5">{act.title}</div>
                        <div className="text-xs text-text-muted">{act.target} • {act.date}</div>
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
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">My Tasks</h2>
                <button className="text-primary hover:text-primary/80 text-sm font-medium">+</button>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Follow up on proposal', target: 'Alice Freeman', due: 'Today', overdue: false },
                  { title: 'Send contract', target: 'TechStart', due: 'Yesterday', overdue: true },
                  { title: 'Discovery call', target: 'Charlie Davis', due: 'Tomorrow', overdue: false },
                ].map((task, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 rounded border-border text-primary focus:ring-primary/50" />
                    <div>
                      <div className="text-sm font-medium mb-0.5">{task.title}</div>
                      <div className="text-xs text-text-muted">{task.target}</div>
                      <div className={`text-xs mt-1 ${task.overdue ? 'text-red font-medium' : 'text-text-muted'}`}>
                        {task.due}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Contacts */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <h2 className="font-semibold mb-6">Hot Leads</h2>
              <div className="space-y-4">
                {data.topContacts.map((lead, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                        {lead.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{lead.name}</div>
                        <div className="text-xs text-text-muted">{lead.company}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-green">{lead.leadScore}</div>
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
