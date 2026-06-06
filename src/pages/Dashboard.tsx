import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRange } from '../types/dashboard';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { Contact } from '../types/crm';
import type { Appointment } from '../types/business';
import { businessApi } from '../lib/api/business';
import { apiClient } from '../lib/apiClient';

import { TopBanner } from '../components/dashboard/v2/TopBanner';
import { OverviewPanel } from '../components/dashboard/v2/OverviewPanel';
import { StatCards } from '../components/dashboard/v2/StatCards';
import { OverviewGraph } from '../components/dashboard/v2/OverviewGraph';
import { CalendarWidget } from '../components/dashboard/v2/CalendarWidget';
import { PipelineActivity } from '../components/dashboard/v2/PipelineActivity';
import { DashboardFadeIn } from '../components/dashboard/v2/DashboardPanel';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { metrics, isLoading: isMetricsLoading } = useDashboardMetrics(dateRange);

  const { data: contacts = [], isLoading: isContactsLoading } = useQuery<Contact[]>({
    queryKey: ['dashboard_contacts_v2'],
    queryFn: async () => {
      const res = await apiClient.get<{ contacts?: Contact[] } | Contact[]>('/crm/contacts');
      const body = res.data;
      return Array.isArray(body) ? body : body.contacts ?? [];
    },
  });

  const { data: appointments = [], isLoading: isApptsLoading } = useQuery<Appointment[]>({
    queryKey: ['dashboard_appointments_v2'],
    queryFn: () => businessApi.getAppointments(),
  });

  const revenueTrend = metrics?.revenue?.trend ?? [];

  return (
    <div className="flex flex-col h-full w-full relative bg-bg text-text-main font-sans">
      <TopBanner
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-4 md:mx-6 mt-5 mb-6 space-y-5">

          {/* ── Overview: one unified panel ── */}
          {activeTab === 'overview' && (
            <OverviewPanel
              metrics={metrics}
              contacts={contacts}
              appointments={appointments}
              isMetricsLoading={isMetricsLoading}
              isContactsLoading={isContactsLoading}
              isApptsLoading={isApptsLoading}
            />
          )}

          {/* ── Revenue tab ── */}
          {activeTab === 'revenue' && (
            <>
              <StatCards metrics={metrics} isLoading={isMetricsLoading} variant="row" />
              <OverviewGraph
                data={revenueTrend}
                pipelineStages={metrics?.pipeline_stages}
                isLoading={isMetricsLoading}
                fullWidth
              />
              <DashboardFadeIn delay={0.15}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(metrics?.pipeline_stages ?? []).slice(0, 6).map((stage) => (
                    <div
                      key={stage.name}
                      className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col"
                    >
                      <div className="px-4 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md">
                        <span className="text-label-caps">{stage.name}</span>
                      </div>
                      <div className="px-4 py-4 flex-1">
                        <div className="text-[22px] font-bold text-text-main">${stage.value.toLocaleString()}</div>
                      </div>
                      <div className="px-4 py-2.5 border-t border-border/50 bg-surface">
                        <span className="text-[11px] font-medium text-text-muted">{stage.count} {stage.count === 1 ? 'deal' : 'deals'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DashboardFadeIn>
            </>
          )}

          {/* ── Activity tab ── */}
          {activeTab === 'activity' && (
            <PipelineActivity metrics={metrics} isLoading={isMetricsLoading} />
          )}

          {/* ── Calendar tab ── */}
          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CalendarWidget appointments={appointments} isLoading={isApptsLoading} />
              <DashboardFadeIn delay={0.08}>
                <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden h-full min-h-[320px] flex flex-col">
                  <div className="px-5 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md">
                    <span className="text-label-caps mb-0.5 block">Upcoming</span>
                    <h3 className="text-[15px] font-semibold text-text-main">This week</h3>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {isApptsLoading ? (
                      <div className="p-5 space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="skeleton h-12 rounded-lg" />
                        ))}
                      </div>
                    ) : appointments.length === 0 ? (
                      <p className="p-5 text-[13px] text-text-muted">No appointments scheduled.</p>
                    ) : (
                      <ul>
                        {[...appointments]
                          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          .slice(0, 12)
                          .map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/40 last:border-0 hover:bg-surface-hover/50 transition-colors duration-150"
                            >
                              <span className="text-[13px] font-medium text-text-main truncate">
                                {a.title || 'Appointment'}
                              </span>
                              <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0 opacity-70">
                                {new Date(a.startTime).toLocaleString(undefined, {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                  hour: 'numeric', minute: '2-digit',
                                })}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div className="px-5 py-2.5 border-t border-border/50 bg-surface">
                    <span className="text-[11px] font-medium text-text-muted">{appointments.length} total appointments</span>
                  </div>
                </div>
              </DashboardFadeIn>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
