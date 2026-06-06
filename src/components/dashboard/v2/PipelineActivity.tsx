import { Link } from 'react-router-dom';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { DashboardFadeIn, DashboardPanel, DashboardSectionHeader } from './DashboardPanel';

interface PipelineActivityProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
}

export function PipelineActivity({ metrics, isLoading }: PipelineActivityProps) {
  const stages = metrics?.pipeline_stages ?? [];
  const campaigns = metrics?.campaigns ?? [];
  const agents = metrics?.agentPerformance ?? [];
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <DashboardFadeIn delay={0}>
        <DashboardPanel innerClassName="p-5 md:p-6">
          <DashboardSectionHeader
            eyebrow="Pipeline"
            title="Stage distribution"
            subtitle="Deal volume across each stage in your workspace."
          />
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <p className="text-[13px] text-text-muted py-6 text-center">
              No pipeline data yet.{' '}
              <Link to="/crm/pipeline" className="text-primary font-semibold hover:underline">
                Set up your pipeline
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {stages.map((stage) => (
                <li key={stage.name}>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-semibold text-text-main">{stage.name}</span>
                    <span className="text-text-muted opacity-70">
                      {stage.count} · {stage.value ? `$${stage.value.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg border border-border/40 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.max(8, (stage.count / maxCount) * 100)}%`,
                        backgroundColor: stage.color || 'var(--primary)',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </DashboardFadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardFadeIn delay={0.06}>
          <DashboardPanel innerClassName="p-5 md:p-6 h-full">
            <DashboardSectionHeader
              eyebrow="Marketing"
              title="Campaign health"
              subtitle="Recent send performance."
            />
            {isLoading ? (
              <div className="skeleton h-32 rounded-lg" />
            ) : campaigns.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No campaigns yet.{' '}
                <Link to="/business/campaigns" className="text-primary font-semibold">
                  Create one
                </Link>
              </p>
            ) : (
              <ul>
                {campaigns.slice(0, 5).map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between py-2.5 px-2 border-b border-border/40 last:border-0 hover:bg-surface-hover/50 rounded-lg transition-colors duration-150"
                  >
                    <span className="text-[13px] font-medium text-text-main truncate">{c.name}</span>
                    <span className="text-[11px] text-text-muted shrink-0 ml-2 opacity-70">
                      {c.opens} opens · {c.clicks} clicks
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        </DashboardFadeIn>

        <DashboardFadeIn delay={0.1}>
          <DashboardPanel innerClassName="p-5 md:p-6 h-full">
            <DashboardSectionHeader
              eyebrow="Agents"
              title="Agent performance"
              subtitle="Automation runs and success rates."
            />
            {isLoading ? (
              <div className="skeleton h-32 rounded-lg" />
            ) : agents.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No agent runs recorded.{' '}
                <Link to="/agents/voice/new" className="text-primary font-semibold">
                  Build an agent
                </Link>
              </p>
            ) : (
              <ul>
                {agents.slice(0, 5).map((a) => (
                  <li
                    key={a.name}
                    className="flex items-center justify-between py-2.5 px-2 border-b border-border/40 last:border-0 hover:bg-surface-hover/50 rounded-lg transition-colors duration-150"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-text-main">{a.name}</div>
                      <div className="text-[11px] text-text-muted opacity-70">{a.runs} runs · avg {a.avgTime}</div>
                    </div>
                    <span className="badge badge-success">{a.success}%</span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardPanel>
        </DashboardFadeIn>
      </div>
    </div>
  );
}
