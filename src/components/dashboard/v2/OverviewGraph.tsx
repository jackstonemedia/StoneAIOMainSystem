import { useMemo } from 'react';
import { DashboardFadeIn } from './DashboardPanel';
import { Link } from 'react-router-dom';

interface OverviewGraphProps {
  data?: number[];
  pipelineStages?: { name: string; count: number; color: string; value: number }[];
  isLoading: boolean;
  fullWidth?: boolean;
}

export function OverviewGraph({ data, pipelineStages = [], isLoading, fullWidth }: OverviewGraphProps) {
  const primaryData = data && data.length > 1 ? data : [12, 18, 15, 22, 28, 24, 32, 30, 26, 34, 38, 42];
  const secondaryData = useMemo(() => {
    return primaryData.map((v, i) => Math.max(4, Math.round(v * (0.55 + (i % 3) * 0.08))));
  }, [primaryData]);

  const max = Math.max(...primaryData, ...secondaryData, 1);
  const w = 800;
  const h = 200;

  const buildSmoothPath = (points: number[]) => {
    const coords = points.map((v, i) => ({
      x: (i / (points.length - 1)) * w,
      y: h - (v / max) * h,
    }));
    let path = `M ${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const midX = (prev.x + curr.x) / 2;
      path += ` C ${midX},${prev.y} ${midX},${curr.y} ${curr.x},${curr.y}`;
    }
    return { path, coords };
  };

  const primary = buildSmoothPath(primaryData);
  const secondary = buildSmoothPath(secondaryData);

  const xLabels = primaryData.map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (primaryData.length - 1 - i));
    return d.toLocaleDateString(undefined, { month: 'short' });
  });

  const wonStage = pipelineStages.find((s) => s.name === 'Won');
  const lostStage = pipelineStages.find((s) => s.name === 'Lost');

  return (
    <DashboardFadeIn delay={0.1} className={fullWidth ? 'w-full' : 'h-full'}>
      <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col h-full min-h-[320px]">

        {/* Top band — matches contacts thead */}
        <div className="px-5 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div>
            <span className="text-label-caps mb-0.5 block">Performance</span>
            <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Revenue trend</h3>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" /> Pipeline
            </span>
          </div>
        </div>

        {/* Chart body */}
        <div className="flex-1 px-5 pt-5 pb-10 relative">
          {isLoading ? (
            <div className="w-full h-full skeleton rounded-lg min-h-[160px]" />
          ) : (
            <div className="flex h-full gap-4">
              {/* Y-axis */}
              <div className="hidden sm:flex flex-col justify-between text-[10px] font-semibold text-text-muted py-1 shrink-0 w-8 text-right">
                {[100, 75, 50, 25, 0].map((pct) => (
                  <span key={pct}>{Math.round((pct / 100) * max)}</span>
                ))}
              </div>
              {/* Chart area */}
              <div className="flex-1 relative min-h-[160px]">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-full h-px bg-border/30" />
                  ))}
                </div>
                <svg
                  viewBox={`0 0 ${w} ${h}`}
                  preserveAspectRatio="none"
                  className="absolute top-0 left-0 w-full h-full"
                  aria-hidden
                >
                  <path d={secondary.path} fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth="2" strokeLinecap="round" />
                  <path d={primary.path} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {/* Stat callout */}
                <div className="absolute top-2 right-0 bg-surface/80 backdrop-blur-md border border-border/50 rounded-[8px] px-3 py-2 text-[11px] font-semibold shadow-luxury ring-1 ring-white/5">
                  <div className="flex items-center gap-1.5 text-text-main">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {wonStage?.count ?? '—'} won
                  </div>
                  <div className="flex items-center gap-1.5 text-text-muted mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                    {lostStage?.count ?? '—'} lost
                  </div>
                </div>
                {/* X-axis labels */}
                <div className="absolute -bottom-7 left-0 right-0 flex justify-between text-[10px] font-medium text-text-muted">
                  {xLabels.map((l) => (
                    <span key={l} className="truncate">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom band — subtitle + link, matches contacts footer */}
        <div className="px-5 py-2.5 border-t border-border/50 bg-surface flex items-center justify-between shrink-0">
          <span className="text-[11px] font-medium text-text-muted">Period-over-period movement across your closed pipeline.</span>
          <Link to="/crm/pipeline" className="text-[11px] font-semibold text-primary hover:underline shrink-0 ml-4">
            View pipeline
          </Link>
        </div>

      </div>
    </DashboardFadeIn>
  );
}
