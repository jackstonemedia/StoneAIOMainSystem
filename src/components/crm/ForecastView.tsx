import { TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  amount: number | string;
  stage: string;
  closeDate?: string;
  priority?: string;
  company?: { name: string };
}

interface ForecastViewProps {
  deals: Deal[];
  stages: { id: string; name: string; color: string; probability?: number }[];
}

function getAmount(deal: Deal): number {
  if (typeof deal.amount === 'number') return deal.amount;
  return parseInt(String(deal.amount).replace(/[^0-9]/g, '') || '0', 10);
}

export default function ForecastView({ deals, stages }: ForecastViewProps) {
  // Group by close month
  const now = new Date();
  const months: Record<string, Deal[]> = {};
  const upcomingMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  upcomingMonths.forEach(m => { months[m] = []; });

  deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').forEach(deal => {
    if (!deal.closeDate) return;
    const label = new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!months[label]) months[label] = [];
    months[label].push(deal);
  });

  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]));

  // Stage pipeline health
  const totalDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost').length;

  const stageRevenue = stages
    .filter(s => s.id !== 'won' && s.id !== 'lost')
    .map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage.id);
      const total = stageDeals.reduce((sum, d) => sum + getAmount(d), 0);
      const weighted = total * ((stage.probability ?? 50) / 100);
      return { ...stage, total, weighted, count: stageDeals.length };
    });

  const totalWeighted = stageRevenue.reduce((s, r) => s + r.weighted, 0);
  const maxRevenue = Math.max(...Object.values(months).map(ms => ms.reduce((s, d) => s + getAmount(d), 0)), 1);

  // At-risk deals: no close date or close date passed
  const atRiskDeals = deals.filter(d => {
    if (d.stage === 'won' || d.stage === 'lost') return false;
    if (!d.closeDate) return true;
    return new Date(d.closeDate) < now;
  });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">

      {/* Weighted Forecast Header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            Weighted Pipeline
          </div>
          <div className="text-2xl font-bold text-text-main mt-1">${totalWeighted.toLocaleString()}</div>
          <div className="text-xs text-text-muted mt-1">Expected revenue from active deals</div>
        </div>
        <div className="bg-surface border border-border/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Open Deals
          </div>
          <div className="text-2xl font-bold text-text-main mt-1">{totalDeals}</div>
          <div className="text-xs text-text-muted mt-1">Active opportunities in pipeline</div>
        </div>
        <div className="bg-surface border border-border/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            At Risk
          </div>
          <div className="text-2xl font-bold text-red-400 mt-1">{atRiskDeals.length}</div>
          <div className="text-xs text-text-muted mt-1">Overdue or missing close dates</div>
        </div>
      </div>

      {/* Monthly Bar Chart */}
      <div className="bg-surface border border-border/60 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-text-main mb-6">Expected Close Revenue by Month</h3>
        <div className="flex items-end gap-4 h-40">
          {upcomingMonths.map(month => {
            const ms = months[month] || [];
            const total = ms.reduce((s, d) => s + getAmount(d), 0);
            const heightPct = (total / maxRevenue) * 100;
            const isCurrentMonth = month === now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

            return (
              <div key={month} className="flex flex-col items-center gap-2 flex-1 group">
                <div className="text-xs font-medium text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  ${total.toLocaleString()}
                </div>
                <div className="w-full flex-1 flex items-end rounded-t-lg overflow-hidden bg-bg/50">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ${
                      isCurrentMonth ? 'bg-primary shadow-[0_0_20px_var(--color-primary)]/30' : 'bg-primary/40 group-hover:bg-primary/60'
                    }`}
                    style={{ height: `${Math.max(heightPct, total > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className={`text-[11px] font-medium ${isCurrentMonth ? 'text-primary' : 'text-text-muted'}`}>{month}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Revenue Breakdown */}
      <div className="bg-surface border border-border/60 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-text-main mb-4">Pipeline by Stage</h3>
        <div className="flex flex-col gap-3">
          {stageRevenue.map(stage => {
            const maxTotal = Math.max(...stageRevenue.map(s => s.total), 1);
            const barPct = (stage.total / maxTotal) * 100;

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div className="w-28 text-xs font-medium text-text-muted truncate shrink-0">{stage.name}</div>
                <div className="flex-1 h-6 bg-bg/50 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-700"
                    style={{
                      width: `${barPct}%`,
                      background: `var(--color-primary)`,
                      opacity: 0.6 + (barPct / 100) * 0.4
                    }}
                  />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-[11px] font-medium text-text-main">
                      {stage.count} deals · ${stage.total.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-16 text-xs text-right font-semibold text-primary/80 shrink-0">
                  {stage.probability ?? 50}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* At Risk Deals */}
      {atRiskDeals.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">🚨 At-Risk Deals ({atRiskDeals.length})</h3>
          </div>
          <div className="flex flex-col gap-2">
            {atRiskDeals.map(deal => (
              <div key={deal.id} className="flex items-center justify-between bg-surface/50 border border-border/50 rounded-xl px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium text-text-main">{deal.title}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {deal.closeDate
                      ? `Close date: ${new Date(deal.closeDate).toLocaleDateString()} (overdue)`
                      : 'No close date set'}
                  </div>
                </div>
                <div className="text-sm font-bold text-text-muted">
                  ${getAmount(deal).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
