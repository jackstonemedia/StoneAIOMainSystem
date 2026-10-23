import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { DateRange } from '../types/dashboard';

export interface HeadlineMetrics {
  newContacts: {
    count: number;
    total: number;
    changePct: number | null;
  };
  openOpportunities: {
    count: number;
    value: number;
  };
  wonDeals: {
    count: number;
    value: number;
    changePct: number | null;
    wonCountChangePct: number | null;
    allTimeValue: number;
  };
  unreadConversations: {
    count: number;
    openThreads: number;
  };
  upcomingAppointments: {
    count: number;
  };
}

export interface CrmMetrics {
  pipelineStages: Array<{ name: string; count: number; value: number; color: string }>;
  winRate: number | null;
  wonDealsCount: number;
  lostDealsCount: number;
  leadSources: Array<{ source: string; count: number; percentage: number }>;
  staleDeals: {
    count: number;
    value: number;
    topStale: Array<{
      id: string;
      name: string;
      amount: number;
      daysStale: number;
      stage: string;
      contactName: string | null;
    }>;
  };
  contactsOverTime: Array<{ date: string; count: number }>;
}

export interface ConversationMetrics {
  unreadCount: number;
  openThreads: number;
  messages: {
    emailSent: number;
    emailReceived: number;
    smsSent: number;
    smsReceived: number;
    totalSent: number;
    totalReceived: number;
  };
  avgFirstResponseMinutes: number | null;
  awaitingReply: {
    count: number;
    items: Array<{
      id: string;
      subject: string;
      contactName: string;
      lastMessageAt: string;
      snippet: string;
    }>;
  };
}

export interface CalendarMetrics {
  todayAppointmentsCount: number;
  thisWeekAppointmentsCount: number;
  statusBreakdown: {
    booked: number;
    completed: number;
    cancelled: number;
  };
  upcomingAppointments: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    type: string;
    contactName: string | null;
    contactEmail: string | null;
  }>;
}

export interface EmailMarketingMetrics {
  sent: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounces: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
  lastCampaign: {
    id: string;
    name: string;
    subject: string;
    sentAt: string;
    totalRecipients: number;
    openRate: number;
    clickRate: number;
  } | null;
  listGrowth: {
    newSubscribers: number;
    unsubscribes: number;
    netGrowth: number;
  };
}

export interface AutomationMetrics {
  activeWorkflows: number;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  successRate: number;
  recentFailedRuns: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    startedAt: string;
    durationMs: number | null;
    error: string;
  }>;
}

export interface ActivityEvent {
  id: string;
  type: 'contact_created' | 'deal_won' | 'appointment_booked' | 'campaign_sent' | 'workflow_failed';
  title: string;
  subtitle: string;
  timestamp: string;
  link: string;
}

interface RevenueMetrics {
  current?: number;
  trend?: number[];
}

interface PipelineMetrics {
  value?: number;
  trend?: number[];
}

interface ContactsMetrics {
  total?: number;
  trend?: number[];
}

interface PipelineStageMetrics {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface CampaignSummary {
  name: string;
  sent: number;
  opens: number;
  clicks: number;
  conversions?: number;
}

interface AgentPerformanceRow {
  name: string;
  runs: number;
  success: number;
  avgTime: string;
}

export interface EmailMetrics {
  sent?: number;
  delivered?: number;
  uniqueOpens?: number;
  totalOpens?: number;
  uniqueClicks?: number;
  totalClicks?: number;
  hardBounces?: number;
  softBounces?: number;
  complaints?: number;
  unsubscribes?: number;
}

export interface BusinessMetrics {
  headline?: HeadlineMetrics;
  crm?: CrmMetrics;
  conversations?: ConversationMetrics;
  calendar?: CalendarMetrics;
  emailMarketing?: EmailMarketingMetrics;
  automations?: AutomationMetrics;
  activityFeed?: ActivityEvent[];

  // Backward compatibility
  revenue?: RevenueMetrics;
  pipeline?: PipelineMetrics;
  contacts?: ContactsMetrics;
  open_conversations?: number;
  pipeline_stages?: PipelineStageMetrics[];
  campaigns?: CampaignSummary[];
  email?: EmailMetrics;
  agentPerformance?: AgentPerformanceRow[];
}

function resolveDateRange(dateRange: DateRange) {
  if (typeof dateRange !== 'string') {
    const from = dateRange.from || undefined;
    const to = dateRange.to || undefined;
    const key = `${from ?? ''}-${to ?? ''}`;
    return { from, to, key };
  }

  const now = new Date();
  if (dateRange === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { from: startOfToday.toISOString(), to: now.toISOString(), key: 'today' };
  }

  let days = 30;
  if (dateRange === '7d') days = 7;
  else if (dateRange === '30d') days = 30;
  else if (dateRange === '90d') days = 90;
  else if (dateRange === '1y') days = 365;

  const to = now.toISOString();
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  return { from, to, key: dateRange };
}

export function useDashboardMetrics(dateRange: DateRange) {
  const { from, to, key } = resolveDateRange(dateRange);

  const query = useQuery<BusinessMetrics>({
    queryKey: ['dashboard_metrics', key],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await apiClient.get<BusinessMetrics>('/business/metrics', { params });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
