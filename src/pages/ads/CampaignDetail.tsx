import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, Trash2, Copy, Edit3, ExternalLink,
  BarChart3, Image, Users, Settings, AlertCircle, RefreshCw,
  CheckCircle, Clock, XCircle, ChevronRight, Layers, LayoutTemplate,
} from 'lucide-react';
import { useAdCampaign, usePauseCampaign, useResumeCampaign, useDeleteCampaign, useDuplicateCampaign } from '../../hooks/useAdCampaigns';
import { useCampaignMetrics } from '../../hooks/useAdMetrics';
import { useAdLeads } from '../../hooks/useAdLeads';
import { formatCurrency } from '../../lib/utils';
import type { AdCampaignStatus } from '../../types/ads';


// ─── Status config ────────────────────────────────────────────────────────────

function statusConfig(status: AdCampaignStatus) {
  switch (status) {
    case 'ACTIVE':   return { label: 'Active',   dot: 'bg-green-500', pulse: true,  text: 'text-green-600', bg: 'bg-green-500/10',  border: 'border-green-500/30' };
    case 'PAUSED':   return { label: 'Paused',   dot: 'bg-amber-400', pulse: false, text: 'text-amber-600', bg: 'bg-amber-400/10',  border: 'border-amber-400/30' };
    case 'DRAFT':    return { label: 'Draft',    dot: 'bg-gray-400',  pulse: false, text: 'text-gray-500',  bg: 'bg-gray-400/10',   border: 'border-gray-400/30' };
    case 'ENDED':    return { label: 'Ended',    dot: 'bg-gray-400',  pulse: false, text: 'text-gray-500',  bg: 'bg-gray-400/10',   border: 'border-gray-400/30' };
    case 'REJECTED': return { label: 'Rejected', dot: 'bg-red-500',   pulse: false, text: 'text-red-600',   bg: 'bg-red-500/10',    border: 'border-red-500/30' };
    default:         return { label: status,     dot: 'bg-gray-400',  pulse: false, text: 'text-gray-500',  bg: 'bg-gray-400/10',   border: 'border-gray-400/30' };
  }
}

// ─── Native SVG Area Chart ────────────────────────────────────────────────────

function MiniAreaChart({
  data,
  color = '#4285F4',
  height = 120,
  valueKey = 'value',
}: {
  data: Array<{ date: string; [key: string]: any }>;
  color?: string;
  height?: number;
  valueKey?: string;
}) {
  if (!data.length) return <div className="h-[120px] flex items-center justify-center text-text-muted text-sm">No data</div>;
  const vals   = data.map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...vals, 1);
  const W = 600;
  const H = height;
  const pad = { t: 8, r: 4, b: 20, l: 4 };

  function toX(i: number) { return pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r); }
  function toY(v: number) { return pad.t + (1 - v / maxVal) * (H - pad.t - pad.b); }

  const pts     = data.map((d, i) => `${toX(i)},${toY(Number(d[valueKey]) || 0)}`).join(' ');
  const areaD   = `M${toX(0)},${toY(0)} ${data.map((d, i) => `L${toX(i)},${toY(Number(d[valueKey]) || 0)}`).join(' ')} L${toX(data.length - 1)},${toY(0)} Z`;

  const xLabels = data.filter((_, i) => i === 0 || i === data.length - 1 || i % 7 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={areaD} fill={color} fillOpacity={0.1} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {xLabels.map(d => {
        const i = data.indexOf(d);
        return (
          <text key={d.date} x={toX(i)} y={H - 2} textAnchor="middle" fontSize={8} fill="currentColor" fillOpacity={0.35}>
            {String(d.date).slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Metric row item ──────────────────────────────────────────────────────────

function MetricItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{label}</span>
      <span className="text-xl font-black text-text-main tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
    </div>
  );
}

// ─── Ad Preview ──────────────────────────────────────────────────────────────

function AdPreview({ campaign }: { campaign: any }) {
  const isGoogle   = campaign.platform === 'GOOGLE';
  const creative   = campaign.creative || {};
  const headlines  = creative.headlines || [];
  const descs      = creative.descriptions || [];
  const finalUrl   = creative.finalUrl || 'https://yourwebsite.com';
  const domain     = finalUrl.replace(/^https?:\/\//, '').split('/')[0];
  const primaryTxt = creative.primaryText || creative.descriptions?.[0] || '';
  const cta        = creative.callToAction || 'Learn More';

  if (isGoogle) {
    return (
      <div className="max-w-lg">
        <p className="text-[11px] text-text-muted mb-2 font-semibold uppercase tracking-wider">Google Search Ad Preview</p>
        <div className="p-4 border border-border rounded-xl bg-background font-['Arial',sans-serif]">
          {/* URL bar */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] bg-border/80 text-text-muted px-1.5 py-0.5 rounded font-semibold">Ad</span>
            <span className="text-[12px] text-green-600">{domain}</span>
          </div>
          {/* Headline */}
          <div className="text-[18px] text-blue-600 font-medium leading-snug mb-1">
            {headlines.slice(0, 3).join(' | ') || 'Ad Headline'}
          </div>
          {/* Description */}
          <div className="text-[13px] text-text-main leading-relaxed">
            {descs[0] || 'Ad description text.'} {descs[1] || ''}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {headlines.map((h: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[11px] bg-border/60 px-1.5 py-0.5 rounded text-text-muted font-mono">H{i+1}</span>
              <div>
                <span className={`text-[12px] text-text-main ${h.length > 30 ? 'text-red-500' : ''}`}>{h}</span>
                <span className={`text-[11px] ml-2 ${h.length > 30 ? 'text-red-500 font-semibold' : 'text-text-muted'}`}>
                  {h.length}/30
                </span>
              </div>
            </div>
          ))}
          {descs.map((d: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[11px] bg-border/60 px-1.5 py-0.5 rounded text-text-muted font-mono">D{i+1}</span>
              <div>
                <span className={`text-[12px] text-text-main ${d.length > 90 ? 'text-red-500' : ''}`}>{d}</span>
                <span className={`text-[11px] ml-2 ${d.length > 90 ? 'text-red-500 font-semibold' : 'text-text-muted'}`}>
                  {d.length}/90
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Facebook preview
  return (
    <div className="max-w-sm">
      <p className="text-[11px] text-text-muted mb-2 font-semibold uppercase tracking-wider">Meta Feed Ad Preview</p>
      <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-surface">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-border/50">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">S</div>
          <div>
            <p className="text-[12px] font-semibold text-text-main">Stone AIO</p>
            <p className="text-[10px] text-text-muted">Sponsored</p>
          </div>
        </div>
        {/* Primary text */}
        {primaryTxt && (
          <div className="px-3 pt-2 pb-2">
            <p className="text-[13px] text-text-main leading-relaxed">{primaryTxt}</p>
          </div>
        )}
        {/* Image placeholder */}
        <div className="h-44 bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-text-muted">
            <Image className="w-8 h-8 opacity-40" />
            <span className="text-[11px]">Ad image</span>
          </div>
        </div>
        {/* Bottom */}
        <div className="flex items-center justify-between p-3 border-t border-border/50 bg-background/50">
          <div>
            <p className="text-[11px] text-text-muted">{domain}</p>
            <p className="text-[13px] font-semibold text-text-main">{headlines[0] || 'Ad Headline'}</p>
            {descs[0] && <p className="text-[11px] text-text-muted mt-0.5">{descs[0]}</p>}
          </div>
          <button className="shrink-0 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[12px] font-semibold border border-primary/30">
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Leads Table ─────────────────────────────────────────────────────────────

function LeadsTab({ campaignId }: { campaignId: string }) {
  const { data: leadsData } = useAdLeads({ campaignId, page: 1, pageSize: 25 });
  const leads = leadsData?.data || [];

  const MOCK_LEADS = [
    { id: 'l1', leadName: 'James Rodriguez', leadEmail: 'james.r@example.com', leadPhone: '+1 (813) 555-0192', syncStatus: 'SYNCED', capturedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
    { id: 'l2', leadName: 'Sarah Mitchell', leadEmail: 'smitchell@gmail.com', leadPhone: null, syncStatus: 'SYNCED', capturedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
    { id: 'l3', leadName: 'Michael Torres', leadEmail: 'mike.torres@outlook.com', leadPhone: '+1 (407) 555-0847', syncStatus: 'PENDING', capturedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
    { id: 'l4', leadName: 'Amanda Chen', leadEmail: 'achen.biz@gmail.com', leadPhone: '+1 (305) 555-1233', syncStatus: 'FAILED', capturedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
    { id: 'l5', leadName: 'Robert Williams', leadEmail: 'robwill@yahoo.com', leadPhone: null, syncStatus: 'SYNCED', capturedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(), platform: 'GOOGLE' },
    { id: 'l6', leadName: 'Jennifer Davis', leadEmail: 'jdavis.home@gmail.com', leadPhone: '+1 (904) 555-7732', syncStatus: 'SYNCED', capturedAt: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
    { id: 'l7', leadName: 'Thomas Anderson', leadEmail: null, leadPhone: '+1 (561) 555-8821', syncStatus: 'SYNCED', capturedAt: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000).toISOString(), platform: 'FACEBOOK' },
  ];

  const displayLeads = leads;

  function syncBadge(status: string) {
    if (status === 'SYNCED')  return <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600"><CheckCircle className="w-3.5 h-3.5" />Synced</span>;
    if (status === 'PENDING') return <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500"><Clock className="w-3.5 h-3.5" />Pending</span>;
    return <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500"><XCircle className="w-3.5 h-3.5" />Failed</span>;
  }

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 60)  return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-text-main">Captured Leads</h3>
          <p className="text-[12px] text-text-muted mt-0.5">{displayLeads.length} leads · all time</p>
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border rounded-lg text-[12px] font-medium hover:bg-border/50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Sync Leads
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-background/60 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Email</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Phone</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">CRM Status</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Captured</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {displayLeads.map((lead: any) => (
              <tr key={lead.id} className="hover:bg-surface/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold shrink-0">
                      {(lead.leadName || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-[13px] font-medium text-text-main">{lead.leadName || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-text-muted">{lead.leadEmail || '—'}</td>
                <td className="px-4 py-3 text-[13px] text-text-muted">{lead.leadPhone || '—'}</td>
                <td className="px-4 py-3">{syncBadge(lead.syncStatus)}</td>
                <td className="px-4 py-3 text-[12px] text-text-muted">{timeAgo(lead.capturedAt)}</td>
                <td className="px-4 py-3">
                  {lead.syncStatus === 'SYNCED' && (
                    <button className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline underline-offset-2">
                      <ExternalLink className="w-3.5 h-3.5" /> CRM
                    </button>
                  )}
                  {lead.syncStatus === 'FAILED' && (
                    <button className="text-[11px] text-red-500 font-medium hover:underline underline-offset-2">
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ad Groups Tab ────────────────────────────────────────────────────────────

function AdGroupsTab({ campaign }: { campaign: any }) {
  const isGoogle = campaign.platform === 'GOOGLE';
  
  const MOCK_AD_GROUPS = [
    { id: 'ag1', name: isGoogle ? 'Search - Brand Terms' : 'Retargeting - 30d', status: 'ACTIVE', budget: 2000, spend: 1250, cpc: 0.85, conversions: 12 },
    { id: 'ag2', name: isGoogle ? 'Search - Competitors' : 'Lookalike - 1%', status: 'ACTIVE', budget: 3000, spend: 2800, cpc: 1.15, conversions: 8 },
    { id: 'ag3', name: isGoogle ? 'Display - Remarketing' : 'Broad - US', status: 'PAUSED', budget: 1000, spend: 450, cpc: 0.45, conversions: 2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[14px] font-bold text-text-main">Ad Groups {isGoogle ? '' : '(Ad Sets)'}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">Manage targeting and budgets per group.</p>
        </div>
        <button className="h-8 px-3 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
          + New {isGoogle ? 'Ad Group' : 'Ad Set'}
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <table className="w-full text-left">
          <thead className="bg-background/60 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Budget</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Spend</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">CPC</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Conversions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {MOCK_AD_GROUPS.map(ag => (
              <tr key={ag.id} className="hover:bg-surface/80 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    {ag.status === 'ACTIVE' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)] animate-pulse" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[13px] text-text-main">{ag.name}</td>
                <td className="px-4 py-3 text-[13px] text-text-main text-right">${(ag.budget/100).toFixed(2)}/d</td>
                <td className="px-4 py-3 text-[13px] text-text-main text-right">${(ag.spend/100).toFixed(2)}</td>
                <td className="px-4 py-3 text-[13px] text-text-main text-right">${ag.cpc.toFixed(2)}</td>
                <td className="px-4 py-3 text-[13px] font-medium text-text-main text-right">{ag.conversions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ads Tab ──────────────────────────────────────────────────────────────────

function AdsTab({ campaign }: { campaign: any }) {
  const isGoogle = campaign.platform === 'GOOGLE';

  const MOCK_ADS = [
    { id: 'ad1', name: isGoogle ? 'RSA - Promo A' : 'Carousel - Spring Collection', status: 'ACTIVE', spend: 850, ctr: 0.042, conversions: 8, adGroup: isGoogle ? 'Search - Brand' : 'Retargeting' },
    { id: 'ad2', name: isGoogle ? 'RSA - Value Prop' : 'Single Image - Discount', status: 'ACTIVE', spend: 400, ctr: 0.028, conversions: 4, adGroup: isGoogle ? 'Search - Brand' : 'Retargeting' },
    { id: 'ad3', name: isGoogle ? 'RSA - Urgency' : 'Video - How it works', status: 'PAUSED', spend: 120, ctr: 0.015, conversions: 0, adGroup: isGoogle ? 'Search - Competitors' : 'Lookalike' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-[14px] font-bold text-text-main">Ads</h3>
          <p className="text-[12px] text-text-muted mt-0.5">Individual creative performance.</p>
        </div>
        <button className="h-8 px-3 bg-primary text-white rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors">
          + New Ad
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-surface">
        <table className="w-full text-left">
          <thead className="bg-background/60 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Ad Name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{isGoogle ? 'Ad Group' : 'Ad Set'}</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Spend</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">CTR</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">Conversions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {MOCK_ADS.map(ad => (
              <tr key={ad.id} className="hover:bg-surface/80 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center">
                    {ad.status === 'ACTIVE' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)] animate-pulse" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-[13px] text-text-main">
                  <div className="flex flex-col">
                    <span>{ad.name}</span>
                    <button className="text-[10px] text-primary hover:underline self-start mt-0.5">Preview</button>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-text-muted">{ad.adGroup}</td>
                <td className="px-4 py-3 text-[13px] text-text-main text-right">${(ad.spend/100).toFixed(2)}</td>
                <td className="px-4 py-3 text-[13px] text-text-main text-right">{(ad.ctr * 100).toFixed(2)}%</td>
                <td className="px-4 py-3 text-[13px] font-medium text-text-main text-right">{ad.conversions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ campaign }: { campaign: any }) {
  const [budgetVal, setBudgetVal] = useState(String(campaign.budgetAmountCents / 100));
  return (
    <div className="max-w-lg space-y-6">
      <div className="p-5 border border-border rounded-xl bg-surface space-y-4">
        <h4 className="text-[13px] font-bold text-text-main">Budget</h4>
        <div>
          <label className="text-[12px] text-text-muted font-medium block mb-1.5">
            {campaign.budgetType === 'DAILY' ? 'Daily budget' : 'Lifetime budget'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
            <input
              type="number"
              value={budgetVal}
              onChange={e => setBudgetVal(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          Save Budget
        </button>
      </div>

      <div className="p-5 border border-border rounded-xl bg-surface space-y-4">
        <h4 className="text-[13px] font-bold text-text-main">Schedule</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-text-muted font-medium block mb-1.5">Start date</label>
            <input
              type="date"
              defaultValue={campaign.startDate?.slice(0, 10)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-[12px] text-text-muted font-medium block mb-1.5">End date (optional)</label>
            <input
              type="date"
              defaultValue={campaign.endDate?.slice(0, 10) || ''}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          Save Schedule
        </button>
      </div>

      <div className="p-5 border border-red-500/20 rounded-xl bg-red-500/5 space-y-3">
        <h4 className="text-[13px] font-bold text-red-500">Danger Zone</h4>
        <p className="text-[12px] text-text-muted">Deleting this campaign is permanent. Active campaigns will be paused on the ad platform first.</p>
        <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors">
          Delete Campaign
        </button>
      </div>
    </div>
  );
}

// ─── Main CampaignDetail ──────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',     icon: BarChart3 },
  { id: 'adgroups',   label: 'Ad Groups',    icon: Layers },
  { id: 'ads',        label: 'Ads',          icon: LayoutTemplate },
  { id: 'creatives',  label: 'Ad Creative',  icon: Image },
  { id: 'leads',      label: 'Leads',        icon: Users },
  { id: 'settings',   label: 'Settings',     icon: Settings },
];

export default function CampaignDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [tab, setTab] = useState('overview');

  const { data: rawCampaign, isLoading } = useAdCampaign(id || '');
  const { data: metrics }                 = useCampaignMetrics(id || '', { preset: 'LAST_30' });

  const { mutate: pause }     = usePauseCampaign();
  const { mutate: resume }    = useResumeCampaign();
  const { mutate: remove }    = useDeleteCampaign();
  const { mutate: duplicate } = useDuplicateCampaign();

  const campaign = rawCampaign as any;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="w-10 h-10 text-text-muted/40" />
        <p className="text-text-muted">Campaign not found</p>
        <button onClick={() => navigate('/ads/campaigns')} className="text-primary text-sm font-medium hover:underline">
          Back to Campaigns
        </button>
      </div>
    );
  }

  const sc       = statusConfig(campaign.status as AdCampaignStatus);
  const isGoogle = campaign.platform === 'GOOGLE';
  const spend    = campaign.cachedSpend30dCents ?? 0;
  const leads    = campaign.cachedLeads30d ?? 0;
  const ctr      = campaign.cachedCtr30d ?? 0;
  const cpl      = leads > 0 ? spend / leads : null;
  const impressions = (campaign as any).impressions30d ?? 0;
  const clicks      = (campaign as any).clicks30d ?? 0;
  const cpc         = clicks > 0 ? spend / clicks : null;
  const cpm         = impressions > 0 ? (spend / impressions) * 1000 : null;

  // Generate mock chart data from campaign metrics
  const MOCK_DAILY = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    const base = 0.5 + Math.sin(i / 4) * 0.3 + Math.random() * 0.2;
    return {
      date: d.toISOString().slice(0, 10),
      spend: Math.round(base * (spend / 30) * (0.8 + Math.random() * 0.4)),
      leads: Math.round(base * (leads / 30) * (0.7 + Math.random() * 0.6)),
    };
  });

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="shrink-0 bg-surface border-b border-border sticky top-0 z-20">
        <div className="px-6 pt-4 pb-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[12px] text-text-muted mb-3">
            <button onClick={() => navigate('/ads/campaigns')} className="hover:text-text-main transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Campaigns
            </button>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="text-text-main font-medium truncate max-w-[300px]">{campaign.name}</span>
          </div>

          <div className="flex items-start justify-between mb-4">
            {/* Title + badges */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Platform badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                isGoogle
                  ? 'bg-red-500/10 text-red-600 border-red-500/20'
                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              }`}>
                {isGoogle ? (
                  <svg width="10" height="10" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                )}
                {isGoogle ? 'Google Ads' : 'Meta Ads'}
              </div>
              <h1 className="text-[17px] font-black text-text-main">{campaign.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${sc.pulse ? 'animate-pulse' : ''}`} />
                {sc.label}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {campaign.status === 'ACTIVE' && (
                <button
                  onClick={() => pause(campaign.id)}
                  className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border rounded-lg text-[12px] font-medium hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              )}
              {campaign.status === 'PAUSED' && (
                <button
                  onClick={() => resume(campaign.id)}
                  className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border rounded-lg text-[12px] font-medium hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
              )}
              <button
                onClick={() => navigate(`/ads/campaigns/${campaign.id}/edit`)}
                className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border rounded-lg text-[12px] font-medium hover:bg-border/50 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => duplicate(campaign.id)}
                className="flex items-center gap-1.5 h-8 px-3 bg-background border border-border rounded-lg text-[12px] font-medium hover:bg-border/50 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this campaign? This can\'t be undone.')) {
                    remove(campaign.id);
                    navigate('/ads/campaigns');
                  }
                }}
                className="flex items-center gap-1.5 h-8 px-3 bg-background border border-red-500/30 text-red-500 rounded-lg text-[12px] font-medium hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id === 'leads' && leads > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                    {leads}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1200px] mx-auto">

          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* KPI metrics bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 p-5 bg-surface border border-border rounded-xl">
                <MetricItem label="Spend (30d)" value={spend > 0 ? formatCurrency(spend / 100) : '—'} />
                <MetricItem label="Leads (30d)" value={leads > 0 ? String(leads) : '—'} />
                <MetricItem label="Impressions" value={impressions > 0 ? impressions >= 1000 ? `${(impressions/1000).toFixed(1)}K` : String(impressions) : '—'} />
                <MetricItem label="Clicks" value={clicks > 0 ? String(clicks) : '—'} />
                <MetricItem label="CTR" value={ctr > 0 ? `${(ctr * 100).toFixed(2)}%` : '—'} />
                <MetricItem label="CPC" value={cpc != null && cpc > 0 ? formatCurrency(cpc / 100) : '—'} />
                <MetricItem label="Cost/Lead" value={cpl != null && cpl > 0 ? formatCurrency(cpl / 100) : '—'} />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 bg-surface border border-border rounded-xl">
                  <h3 className="text-[13px] font-bold text-text-main mb-4">Daily Spend (30d)</h3>
                  <MiniAreaChart
                    data={MOCK_DAILY}
                    color={isGoogle ? '#4285F4' : '#1877F2'}
                    height={140}
                    valueKey="spend"
                  />
                </div>
                <div className="p-5 bg-surface border border-border rounded-xl">
                  <h3 className="text-[13px] font-bold text-text-main mb-4">Daily Leads (30d)</h3>
                  <MiniAreaChart
                    data={MOCK_DAILY}
                    color="#10b981"
                    height={140}
                    valueKey="leads"
                  />
                </div>
              </div>

              {/* Campaign info grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Config */}
                <div className="p-5 bg-surface border border-border rounded-xl space-y-4">
                  <h3 className="text-[13px] font-bold text-text-main">Configuration</h3>
                  <dl className="space-y-3">
                    {[
                      { term: 'Objective',     val: campaign.objective?.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()) },
                      { term: 'Budget',        val: `${formatCurrency(campaign.budgetAmountCents / 100)} / ${campaign.budgetType?.toLowerCase()}` },
                      { term: 'Schedule',      val: campaign.scheduleType === 'CONTINUOUS' ? 'Continuous (no end date)' : `${campaign.startDate?.slice(0,10) || '—'} → ${campaign.endDate?.slice(0,10) || '—'}` },
                      { term: 'Bid Strategy',  val: campaign.bidStrategy?.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Default' },
                      { term: 'Campaign ID',   val: campaign.platformCampaignId || 'Not launched' },
                    ].map(row => (
                      <div key={row.term} className="flex items-start justify-between gap-2">
                        <dt className="text-[12px] text-text-muted shrink-0">{row.term}</dt>
                        <dd className="text-[12px] font-medium text-text-main text-right truncate max-w-[180px]" title={String(row.val)}>{row.val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* Targeting */}
                <div className="p-5 bg-surface border border-border rounded-xl space-y-4">
                  <h3 className="text-[13px] font-bold text-text-main">Targeting</h3>
                  <div className="space-y-3">
                    {campaign.targeting?.locations?.length > 0 && (
                      <div>
                        <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Locations</p>
                        <div className="flex flex-wrap gap-1.5">
                          {campaign.targeting.locations.map((l: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-background border border-border rounded-md text-[11px] text-text-main">
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {campaign.targeting?.ageMin && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-text-muted">Age range</span>
                        <span className="text-[12px] font-medium text-text-main">{campaign.targeting.ageMin}–{campaign.targeting.ageMax ?? '65+'}</span>
                      </div>
                    )}
                    {campaign.targeting?.genders?.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-text-muted">Genders</span>
                        <span className="text-[12px] font-medium text-text-main">
                          {campaign.targeting.genders.join(', ').replace('MALE', 'Male').replace('FEMALE', 'Female').replace('ALL', 'All')}
                        </span>
                      </div>
                    )}
                    {campaign.targeting?.keywords?.length > 0 && (
                      <div>
                        <p className="text-[11px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">
                          Keywords ({campaign.targeting.keywords.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {campaign.targeting.keywords.slice(0, 6).map((k: any, i: number) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              k.matchType === 'EXACT'  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                              k.matchType === 'PHRASE' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                              'bg-border text-text-muted border-border'
                            }`}>
                              {k.matchType === 'EXACT' ? '[' : k.matchType === 'PHRASE' ? '"' : ''}{k.text}{k.matchType === 'EXACT' ? ']' : k.matchType === 'PHRASE' ? '"' : ''}
                            </span>
                          ))}
                          {campaign.targeting.keywords.length > 6 && (
                            <span className="text-[11px] text-text-muted px-1.5 py-0.5">+{campaign.targeting.keywords.length - 6} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent leads preview */}
                <div className="p-5 bg-surface border border-border rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-text-main">Recent Leads</h3>
                    <button onClick={() => setTab('leads')} className="text-[12px] text-primary font-medium hover:underline underline-offset-2">
                      See all →
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { name: 'James Rodriguez', email: 'james.r@example.com', ago: '2h ago', synced: true },
                      { name: 'Sarah Mitchell', email: 'smitchell@gmail.com', ago: '5h ago', synced: true },
                      { name: 'Michael Torres', email: 'mike.torres@outlook.com', ago: '8h ago', synced: false },
                    ].map((l, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold shrink-0">
                          {l.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-text-main truncate">{l.name}</p>
                          <p className="text-[11px] text-text-muted truncate">{l.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-text-muted">{l.ago}</p>
                          <span className={`text-[10px] font-semibold ${l.synced ? 'text-green-500' : 'text-amber-500'}`}>
                            {l.synced ? '✓ CRM' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Creatives tab */}
          {tab === 'creatives' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-[14px] font-bold text-text-main mb-4">Live Ad Preview</h3>
                  <AdPreview campaign={campaign} />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-text-main mb-4">Creative Assets</h3>
                  {campaign.creative?.imageUrls?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {campaign.creative.imageUrls.map((url: string, i: number) => (
                        <div key={i} className="aspect-video rounded-xl overflow-hidden border border-border bg-background">
                          <img src={url} alt={`Creative ${i+1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-44 border border-border border-dashed rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <Image className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                        <p className="text-sm text-text-muted">No images uploaded</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <button
                      onClick={() => navigate(`/ads/campaigns/${campaign.id}/edit`)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" /> Edit Creative
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leads tab */}
          {tab === 'leads' && <LeadsTab campaignId={id || ''} />}

          {/* Ad Groups tab */}
          {tab === 'adgroups' && <AdGroupsTab campaign={campaign} />}

          {/* Ads tab */}
          {tab === 'ads' && <AdsTab campaign={campaign} />}

          {/* Settings tab */}
          {tab === 'settings' && <SettingsTab campaign={campaign} />}
        </div>
      </div>
    </div>
  );
}
