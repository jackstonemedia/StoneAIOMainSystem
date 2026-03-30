import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Mail, DollarSign, Calendar, FileText,
  ArrowUpRight, ArrowDownRight, BarChart3, Zap, Plus, Phone,
  MessageSquare, ChevronRight, Activity, Star, Bot, Target
} from 'lucide-react';
import { MetricCard } from '../../components/ui/MetricCard';

const SPARKLINES = {
  revenue:   [38,42,41,55,52,62,58,71,68,78,82,92],
  pipeline:  [120,130,118,145,140,160,155,175,170,185,195,210],
  contacts:  [2100,2180,2220,2300,2380,2450,2520,2610,2680,2750,2800,2847],
  conversion:[22,24,23,26,25,27,24,26,25,27,26,25],
};

const ACTIVITY = [
  { type:'deal',    text:'Enterprise License moved to Negotiation',   time:'2m ago',   icon:DollarSign, color:'text-amber-400' },
  { type:'campaign',text:'Black Friday email campaign sent to 14.5k', time:'1h ago',   icon:Mail,       color:'text-blue-400' },
  { type:'contact', text:'23 new leads imported from web form',       time:'3h ago',   icon:Users,      color:'text-purple-400' },
  { type:'agent',   text:'Lead Scorer completed 142 evaluations',     time:'4h ago',   icon:Bot,        color:'text-primary' },
  { type:'review',  text:'5★ review received on Google',              time:'5h ago',   icon:Star,       color:'text-amber-400' },
];

const SCHEDULE = [
  { title:'Discovery call — Acme Corp',    time:'2:00 PM', contact:'Sarah Chen',   type:'call',    color:'bg-blue-500' },
  { title:'Product demo — Enterprise tier',time:'3:30 PM', contact:'Mike Johnson', type:'video',   color:'bg-purple-500' },
  { title:'Contract review follow-up',     time:'4:15 PM', contact:'Lisa Wang',    type:'meeting', color:'bg-emerald-500' },
];

// Simple SVG area chart
function AreaChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 300, h = 80;
  const pts = data.map((v, i) => ({ x: (i / (data.length-1))*w, y: h - ((v-min)/range)*h }));
  const pathD = pts.map((p,i) => `${i===0?'M':'L'}${p.x},${p.y}`).join(' ');
  const areaD = `M0,${h} L${pts.map(p=>`${p.x},${p.y}`).join(' L')} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`ag-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#ag-${color})`}/>
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/business/metrics')
      .then(r => r.ok ? r.json() : null)
      .then(d => setMetrics(d))
      .catch(() => {});
  }, []);

  const pipeline = metrics?.pipeline || [
    { name:'Lead',        count:45, value:120000, color:'#64748b' },
    { name:'Qualified',   count:28, value:240000, color:'#818cf8' },
    { name:'Proposal',    count:15, value:180000, color:'#fbbf24' },
    { name:'Negotiation', count:8,  value:305000, color:'#a78bfa' },
    { name:'Won',         count:18, value:210000, color:'#34d399' },
  ];
  const totalPipelineCount = pipeline.reduce((s:number,p:any)=>s+p.count,0);

  return (
    <div className="flex-1 overflow-y-auto bg-bg">
      <div className="max-w-[1400px] mx-auto p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-main tracking-tight">Business Overview</h1>
            <p className="text-sm text-text-muted mt-1.5">Good evening, Jack — here's your business at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/business/campaigns')}
              className="btn-secondary text-sm py-2 px-4"
            >
              <Mail className="w-4 h-4" /> New Campaign
            </button>
            <button
              onClick={() => navigate('/business/crm/contacts')}
              className="btn-primary text-sm py-2 px-4"
            >
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4 stagger-children">
          <MetricCard label="Monthly Revenue"   value="$48,250" change="+12.5%" trend="up"   icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" sparkline={SPARKLINES.revenue}   delay={0}  />
          <MetricCard label="Pipeline Value"    value="$182,400" change="+8.2%"  trend="up"   icon={TrendingUp}  iconColor="text-blue-400"    iconBg="bg-blue-500/10"    sparkline={SPARKLINES.pipeline}  delay={60} />
          <MetricCard label="Active Contacts"   value="2,847"   change="+156"   trend="up"   icon={Users}       iconColor="text-purple-400"  iconBg="bg-purple-500/10"  sparkline={SPARKLINES.contacts}  delay={120}/>
          <MetricCard label="Conversion Rate"   value="24.8%"   change="-1.2%"  trend="down" icon={BarChart3}   iconColor="text-amber-400"   iconBg="bg-amber-500/10"   sparkline={SPARKLINES.conversion} delay={180}/>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">

          {/* Left 2/3 */}
          <div className="col-span-2 space-y-6">

            {/* Revenue chart */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-text-main">Revenue Trend</h2>
                  <p className="text-xs text-text-muted mt-0.5">12-month rolling revenue</p>
                </div>
                <div className="flex bg-bg border border-border rounded-lg p-1">
                  {['7d','30d','90d','1y'].map((p,i) => (
                    <button key={p} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${i===1?'bg-surface text-primary border border-border shadow-sm':'text-text-muted hover:text-text-main'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="h-32">
                <AreaChart data={SPARKLINES.revenue} color="var(--primary)" />
              </div>
              <div className="flex justify-between mt-2">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m=>(
                  <span key={m} className="text-[10px] text-text-muted">{m}</span>
                ))}
              </div>
            </div>

            {/* Pipeline Funnel */}
            <div className="card-surface p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-text-main">Sales Pipeline</h2>
                  <p className="text-xs text-text-muted mt-0.5">{totalPipelineCount} active deals</p>
                </div>
                <Link to="/business/crm/deals" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  View all <ChevronRight className="w-3 h-3"/>
                </Link>
              </div>
              <div className="space-y-3">
                {pipeline.map((stage: any, i: number) => {
                  const pct = Math.round((stage.count / totalPipelineCount) * 100);
                  return (
                    <div key={i} className="group cursor-pointer" onClick={() => navigate('/business/crm/deals')}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-text-main">{stage.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-text-muted">{stage.count} deals</span>
                          <span className="text-sm font-semibold text-text-main">${(stage.value/1000).toFixed(0)}k</span>
                        </div>
                      </div>
                      <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                          style={{ width: `${pct}%`, backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}40` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-text-main">Recent Activity</h2>
                <Link to="/business/crm/activities" className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                  View all <ChevronRight className="w-3 h-3"/>
                </Link>
              </div>
              <div className="divide-y divide-border/60">
                {ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-hover transition-colors group">
                    <div className={`w-8 h-8 rounded-lg bg-bg border border-border flex items-center justify-center shrink-0 ${item.color}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-main truncate">{item.text}</p>
                    </div>
                    <span className="text-xs text-text-muted shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 1/3 */}
          <div className="space-y-6">

            {/* Today's schedule */}
            <div className="card-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="font-semibold text-text-main flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary"/> Today
                </h2>
                <Link to="/business/calendar" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Full calendar →</Link>
              </div>
              <div className="p-4 space-y-3">
                {SCHEDULE.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-bg border border-border rounded-xl hover:border-primary/30 transition-colors group cursor-pointer">
                    <div className={`w-1.5 h-12 rounded-full ${ev.color} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-main truncate group-hover:text-primary transition-colors">{ev.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{ev.time} · {ev.contact}</p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/business/calendar')}
                  className="w-full py-2 border border-dashed border-border rounded-xl text-xs text-text-muted hover:border-primary/40 hover:text-primary transition-colors"
                >
                  + Add appointment
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card-surface p-5">
              <h2 className="font-semibold text-text-main mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:'New Campaign',   icon:Mail,        path:'/business/campaigns',     color:'text-blue-400  bg-blue-500/10'  },
                  { label:'Add Contact',    icon:Users,       path:'/business/crm/contacts',  color:'text-purple-400 bg-purple-500/10'},
                  { label:'Create Form',    icon:FileText,    path:'/business/forms',         color:'text-teal-400  bg-teal-500/10'  },
                  { label:'View Reports',   icon:BarChart3,   path:'/business/analytics',     color:'text-amber-400 bg-amber-500/10' },
                  { label:'Send SMS',       icon:MessageSquare,path:'/inbox',                 color:'text-green-400 bg-green-500/10' },
                  { label:'Reputation',     icon:Star,        path:'/business/reputation',    color:'text-red-400   bg-red-500/10'   },
                ].map((a, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(a.path)}
                    className="glass-card-hover flex flex-col items-center gap-2 p-3 text-center"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.color}`}>
                      <a.icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-text-main">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            <div className="card-surface p-5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-teal flex items-center justify-center">
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <h2 className="font-semibold text-text-main text-sm">AI Insights</h2>
                <span className="badge badge-info ml-auto">Live</span>
              </div>
              <ul className="space-y-2">
                {[
                  '3 deals stagnant for 14+ days — follow up needed',
                  'Email open rate up 4% after subject line change',
                  'Top lead: TechStart Inc. (score 94)',
                ].map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-muted leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0 mt-1.5" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
