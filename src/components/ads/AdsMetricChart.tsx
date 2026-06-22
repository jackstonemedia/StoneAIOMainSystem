import { formatCurrency } from "../../lib/utils";

interface DataPoint {
  date: string;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
}

interface AdsMetricChartProps {
  data: DataPoint[];
  metric: 'spend' | 'leads' | 'cpl' | 'ctr';
}

export default function AdsMetricChart({ data, metric }: AdsMetricChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
        <p className="text-sm">No data available for this period</p>
      </div>
    );
  }

  // Calculate totals to display in the placeholder
  const totalSpend = data.reduce((sum, d) => sum + d.spend, 0);
  const totalLeads = data.reduce((sum, d) => sum + d.leads, 0);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="w-full max-w-sm p-6 border border-border/50 rounded-xl bg-surface/50 text-center">
        <h3 className="text-lg font-bold text-text-main mb-2">
          {metric === 'spend' ? 'Ad Spend' : metric === 'leads' ? 'Total Leads' : 'Chart Unavailable'}
        </h3>
        <p className="text-3xl font-bold text-primary mb-2">
          {metric === 'spend' ? formatCurrency(totalSpend) : totalLeads}
        </p>
        <p className="text-xs text-text-muted">
          Chart visualization temporarily disabled.
        </p>
      </div>
    </div>
  );
}
