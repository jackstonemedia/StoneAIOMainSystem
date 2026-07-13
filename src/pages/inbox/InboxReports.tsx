import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inboxApi } from './lib/api/inbox';
import { BarChart2, TrendingUp, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-[13px] text-slate-500">{label}</p>
        <p className="text-[22px] font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

export default function InboxReports() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: overview, isLoading } = useQuery({
    queryKey: ['inbox', 'reports', 'overview', startDate, endDate],
    queryFn: () => inboxApi.getReportOverview(startDate, endDate),
    staleTime: 60_000,
  });

  const { data: agentStats = [] } = useQuery({
    queryKey: ['inbox', 'reports', 'agents', startDate, endDate],
    queryFn: () => inboxApi.getAgentReport(startDate, endDate),
    staleTime: 60_000,
  });

  const { data: labelStats = [] } = useQuery({
    queryKey: ['inbox', 'reports', 'labels', startDate, endDate],
    queryFn: () => inboxApi.getLabelReport(startDate, endDate),
    staleTime: 60_000,
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 dark:text-white">Inbox Reports</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Track performance and conversation metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <label className="text-[11px] text-slate-500 font-semibold">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[13px] bg-transparent text-slate-900 dark:text-white focus:outline-none" />
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <label className="text-[11px] text-slate-500 font-semibold">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[13px] bg-transparent text-slate-900 dark:text-white focus:outline-none" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Conversations" value={overview?.totalConversations ?? 0} icon={BarChart2} color="bg-indigo-500" />
              <StatCard label="Resolved" value={overview?.resolvedConversations ?? 0} icon={CheckCircle} color="bg-green-500" />
              <StatCard label="Avg First Response" value={formatDuration(overview?.avgFirstResponseMs ?? null)} icon={Clock} color="bg-yellow-500" />
              <StatCard label="Avg Resolution Time" value={formatDuration(overview?.avgResolutionMs ?? null)} icon={TrendingUp} color="bg-purple-500" />
            </div>

            {/* Agent performance */}
            {(agentStats as any[]).length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mb-4">Agent Performance</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left py-2 text-slate-500 font-semibold">Agent</th>
                        <th className="text-right py-2 text-slate-500 font-semibold">Assigned</th>
                        <th className="text-right py-2 text-slate-500 font-semibold">Resolved</th>
                        <th className="text-right py-2 text-slate-500 font-semibold">Avg First Reply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(agentStats as any[]).map((a: any, i: number) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="py-3 font-medium text-slate-900 dark:text-white">{a.name || a.assignedUserId || 'Unknown'}</td>
                          <td className="py-3 text-right text-slate-600 dark:text-slate-400">{a.assigned ?? a._count?.id ?? 0}</td>
                          <td className="py-3 text-right text-slate-600 dark:text-slate-400">{a.resolved ?? 0}</td>
                          <td className="py-3 text-right text-slate-600 dark:text-slate-400">{formatDuration(a.avgFirstReplyMs ?? null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Label distribution */}
            {(labelStats as any[]).length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mb-4">Label Distribution</h2>
                <div className="space-y-3">
                  {(labelStats as any[]).map((l: any, i: number) => {
                    const max = Math.max(...(labelStats as any[]).map((s: any) => s.count || 0), 1);
                    const pct = Math.round(((l.count || 0) / max) * 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{l.title || l.labelId}</span>
                          <span className="text-[12px] text-slate-500">{l.count || 0}</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(agentStats as any[]).length === 0 && (labelStats as any[]).length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <BarChart2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-[15px] font-medium text-slate-500">No data for this period</p>
                <p className="text-[12px] text-slate-400 mt-1">Start creating and resolving conversations to see metrics here.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
