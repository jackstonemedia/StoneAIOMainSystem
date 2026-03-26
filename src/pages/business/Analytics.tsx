import { 
  TrendingUp, DollarSign, Users, Bot, Zap, Mail, ArrowUpRight, 
  ArrowDownRight, BarChart3, Activity
} from 'lucide-react';

export default function Analytics() {
  const metrics = [
    { label: 'Monthly Recurring Revenue', value: '$48,250', change: '+12.5%', up: true, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Total Pipeline Value', value: '$182,400', change: '+8.2%', up: true, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Agent Runs (30d)', value: '4,892', change: '+34%', up: true, icon: Bot, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Credits Used', value: '12,450', change: '+18%', up: true, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  const agentPerformance = [
    { name: 'Lead Scorer', runs: 2340, success: 98.2, avgTime: '1.2s', credits: 4200 },
    { name: 'Invoice Processor', runs: 890, success: 95.6, avgTime: '3.4s', credits: 2800 },
    { name: 'Email Follow-up', runs: 1450, success: 99.1, avgTime: '0.8s', credits: 3100 },
    { name: 'Customer Triage', runs: 212, success: 87.3, avgTime: '5.1s', credits: 2350 },
  ];

  const campaignMetrics = [
    { name: 'Black Friday VIP', sent: 14500, opens: 42.5, clicks: 18.2, conversions: 3.8 },
    { name: 'Cart Recovery', sent: 320, opens: 65.1, clicks: 28.7, conversions: 12.4 },
    { name: 'Newsletter Q4', sent: 22000, opens: 31.2, clicks: 8.5, conversions: 1.2 },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Analytics</h1>
            <p className="text-sm text-text-muted mt-1">Monitor performance across your entire business.</p>
          </div>
          <div className="flex bg-surface p-1 rounded-lg border border-border">
            {['7d', '30d', '90d', '1y'].map(period => (
              <button key={period} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === '30d' ? 'bg-bg text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-main'
              }`}>
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((m, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-muted">{m.label}</span>
                <div className={`p-2 rounded-lg ${m.bg} ${m.color}`}><m.icon className="w-4 h-4" /></div>
              </div>
              <h3 className="text-2xl font-bold text-text-main">{m.value}</h3>
              <span className={`text-xs font-medium flex items-center gap-1 mt-1 ${m.up ? 'text-emerald-500' : 'text-red-500'}`}>
                {m.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {m.change} vs last period
              </span>
            </div>
          ))}
        </div>

        {/* Charts Placeholder */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Revenue Over Time
            </h3>
            <div className="h-48 flex items-end justify-between gap-2 px-4">
              {[35, 42, 38, 55, 48, 62, 58, 71, 65, 78, 82, 92].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/20 rounded-t-md relative overflow-hidden" style={{ height: `${h * 1.8}px` }}>
                    <div className="absolute bottom-0 w-full bg-primary rounded-t-md" style={{ height: `${h * 0.7}%` }} />
                  </div>
                  <span className="text-[10px] text-text-muted">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6">
            <h3 className="font-semibold text-text-main mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" /> Agent Runs Over Time
            </h3>
            <div className="h-48 flex items-end justify-between gap-2 px-4">
              {[20, 28, 45, 38, 52, 61, 55, 78, 82, 95, 110, 128].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-purple-500/20 rounded-t-md relative overflow-hidden" style={{ height: `${h * 1.3}px` }}>
                    <div className="absolute bottom-0 w-full bg-purple-500 rounded-t-md" style={{ height: `${h * 0.7}%` }} />
                  </div>
                  <span className="text-[10px] text-text-muted">{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Performance Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold text-text-main flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Agent Performance
            </h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Agent</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Runs</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Success Rate</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Avg Time</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentPerformance.map((agent, i) => (
                <tr key={i} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-text-main">{agent.name}</td>
                  <td className="px-6 py-4 text-sm text-text-main">{agent.runs.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-bg rounded-full overflow-hidden border border-border">
                        <div className={`h-full rounded-full ${agent.success > 95 ? 'bg-emerald-500' : agent.success > 90 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${agent.success}%` }} />
                      </div>
                      <span className="text-sm text-text-main">{agent.success}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">{agent.avgTime}</td>
                  <td className="px-6 py-4 text-sm text-text-main">{agent.credits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Campaign Performance Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold text-text-main flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-500" /> Campaign Performance
            </h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Campaign</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Sent</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Open Rate</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Click Rate</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaignMetrics.map((c, i) => (
                <tr key={i} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-text-main">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-text-main">{c.sent.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-text-main">{c.opens}%</td>
                  <td className="px-6 py-4 text-sm text-text-main">{c.clicks}%</td>
                  <td className="px-6 py-4 text-sm font-medium text-emerald-500">{c.conversions}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
