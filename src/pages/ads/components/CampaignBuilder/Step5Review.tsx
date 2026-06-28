import { Info } from 'lucide-react';
import type { CampaignDraft } from '../../../../types/ads';
import { SectionCard, OBJECTIVE_MAP } from './shared';

export function Step5Review({
  draft,
  objectiveId,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  objectiveId: string;
  platform: 'GOOGLE' | 'META';
}) {
  const objInfo = OBJECTIVE_MAP[objectiveId];
  const daily = (draft.budgetAmountCents ?? 0) / 100;

  const rows = [
    { label: 'Campaign name', value: draft.name || '—' },
    { label: 'Platform', value: platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads' },
    { label: 'Objective', value: objInfo?.label || '—' },
    { label: 'Campaign type', value: draft.objective || '—' },
    { label: 'Budget', value: daily > 0 ? `$${daily.toFixed(2)} / ${draft.budgetType?.toLowerCase() || 'day'}` : '—' },
    { label: 'Bid strategy', value: draft.bidStrategy?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) || 'Default' },
    { label: 'Schedule', value: draft.scheduleType === 'CONTINUOUS' ? 'Continuous' : `${draft.startDate || '?'} → ${draft.endDate || 'No end'}` },
    { label: 'Locations', value: (draft.targeting?.locations || []).join(', ') || '—' },
    { label: 'Keywords', value: platform === 'GOOGLE' ? `${(draft.targeting?.keywords || []).length} keywords` : 'N/A' },
  ];

  const warnings: string[] = [];
  if (!draft.name) warnings.push('Campaign name is required');
  if (!daily) warnings.push('Set a budget');
  if (!draft.targeting?.locations?.length) warnings.push('Add at least one location');
  if (platform === 'GOOGLE' && draft.objective === 'Search' && !(draft.targeting?.keywords?.length)) warnings.push('Add search keywords');
  if (!draft.creative?.headlines?.length) warnings.push('Add ad headlines');
  if (!draft.creative?.finalUrl) warnings.push('Add a website URL for the ad destination');
  if (!draft.creative?.imageUrls?.length && platform === 'META') warnings.push('Upload an ad image or video');

  return (
    <div className="space-y-5">
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-400/30 bg-amber-400/8 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="text-[13px] font-bold text-amber-400 mb-1">Before you launch</p>
            <ul className="space-y-0.5">
              {warnings.map(w => (
                <li key={w} className="text-[12px] text-text-muted">· {w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <SectionCard title="Campaign summary" description="Review your settings before launching.">
        <dl className="divide-y divide-border/50">
          {rows.map(row => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <dt className="text-[12px] text-text-muted shrink-0 w-32">{row.label}</dt>
              <dd className="text-[12px] font-semibold text-text-main text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <SectionCard title="Creative preview" description="">
        {platform === 'GOOGLE' ? (
          <div className="p-4 rounded-xl border border-border bg-background font-['Arial',sans-serif] max-w-lg">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] bg-border/80 text-text-muted px-1.5 py-0.5 rounded font-semibold">Ad</span>
              <span className="text-[12px] text-green-600">{(draft.creative?.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</span>
            </div>
            <div className="text-[18px] text-blue-600 font-medium leading-snug mb-1">
              {(draft.creative?.headlines || []).slice(0, 3).filter(Boolean).join(' | ') || 'Your Ad Headline'}
            </div>
            <div className="text-[13px] text-text-main">
              {draft.creative?.descriptions?.[0] || 'Your ad description appears here.'}
            </div>
          </div>
        ) : (
          <div className="max-w-sm border border-border rounded-xl overflow-hidden bg-surface">
            <div className="flex items-center gap-2 p-3 border-b border-border/50">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">S</div>
              <div>
                <p className="text-[12px] font-semibold text-text-main">Your Page Name</p>
                <p className="text-[10px] text-text-muted">Sponsored</p>
              </div>
            </div>
            {draft.creative?.primaryText && (
              <div className="px-3 pt-3 pb-2 text-[13px] text-text-main">{draft.creative.primaryText}</div>
            )}
            {draft.creative?.imageUrls?.[0] ? (
              <img src={draft.creative.imageUrls[0]} alt="Creative preview" className="w-full aspect-square object-cover border-y border-border/50" />
            ) : (
              <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/25 flex items-center justify-center border-y border-border/50">
                <span className="text-[11px] text-text-muted">Ad image</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-background/50">
              <div>
                <p className="text-[11px] text-text-muted">{(draft.creative?.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</p>
                <p className="text-[13px] font-semibold text-text-main">{draft.creative?.headlines?.[0] || 'Your Headline'}</p>
              </div>
              <button className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[12px] font-semibold border border-primary/30">
                {draft.creative?.callToAction?.replace(/_/g, ' ') || 'Learn More'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="p-4 rounded-xl bg-primary/6 border border-primary/20 flex items-start gap-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-muted">
          <strong className="text-text-main">Launching</strong> submits this campaign to {platform === 'GOOGLE' ? 'Google' : 'Meta'} for review. Most campaigns enter review within 24 hours. You can edit or pause at any time.
        </p>
      </div>
    </div>
  );
}
