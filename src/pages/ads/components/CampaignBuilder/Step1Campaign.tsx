import type { CampaignDraft } from '../../../../types/ads';
import { SectionCard, Label, Input, OptionPill, MetaLogo, OBJECTIVE_MAP, GOOGLE_CAMPAIGN_TYPES, META_AD_FORMATS } from './shared';

export function Step1Campaign({
  draft,
  setDraft,
  objectiveId,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  objectiveId: string;
  platform: 'GOOGLE' | 'META';
}) {
  const objInfo = OBJECTIVE_MAP[objectiveId];
  const types = platform === 'GOOGLE' ? GOOGLE_CAMPAIGN_TYPES : META_AD_FORMATS;

  return (
    <div className="space-y-5">
      <SectionCard title="Campaign name" description="Give your campaign a descriptive name to identify it later.">
        <div>
          <Label required>Name</Label>
          <Input
            type="text"
            value={draft.name || ''}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder={`e.g., ${objInfo?.label || 'Campaign'} — ${new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' })}`}
          />
        </div>
      </SectionCard>

      {platform === 'GOOGLE' && (
        <SectionCard title="Campaign type" description="Select how you want to reach people with your ads.">
          <div>
            <Label>Type</Label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <OptionPill
                  key={t}
                  selected={draft.objective === t}
                  onClick={() => setDraft(d => ({ ...d, objective: t }))}
                >
                  {t}
                </OptionPill>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-2.5">
              {draft.objective === 'Search' && 'Text ads that appear in Google search results when people search for your products or services.'}
              {draft.objective === 'Display' && 'Image ads shown across 3 million+ websites and apps in the Google Display Network.'}
              {draft.objective === 'Shopping' && 'Product listings that appear in Google Search and Google Shopping.'}
              {draft.objective === 'Video' && 'Video ads that appear on YouTube and across the web.'}
              {draft.objective === 'Performance Max' && 'Access all Google channels with a single campaign. Machine learning optimizes across Search, Display, YouTube, and more.'}
              {draft.objective === 'Smart' && 'A simplified campaign with automated targeting, creatives, and bidding.'}
              {!draft.objective && 'Choose a campaign type to see details.'}
            </p>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Ad format" description="Choose how your creative will be presented.">
          <div>
            <Label>Format</Label>
            <div className="flex flex-wrap gap-2">
              {types.map(t => (
                <OptionPill
                  key={t}
                  selected={draft.objective === t}
                  onClick={() => setDraft(d => ({ ...d, objective: t }))}
                >
                  {t}
                </OptionPill>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && objectiveId === 'meta_leads' && (
        <SectionCard title="Lead form" description="Collect contact info directly in the app — no website needed.">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#1877F2]/8 border border-[#1877F2]/20">
            <MetaLogo size={18} />
            <div>
              <p className="text-[13px] font-semibold text-text-main mb-0.5">Instant Forms enabled</p>
              <p className="text-[12px] text-text-muted">Your lead form will be pre-filled with the user's Facebook profile data for higher conversion.</p>
            </div>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Facebook Page" description="Required — your ad will run on behalf of your connected page.">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-primary/8 border border-primary/20">
            <MetaLogo size={18} />
            <div>
              <p className="text-[13px] font-semibold text-text-main mb-0.5">Auto-connected</p>
              <p className="text-[12px] text-text-muted">Your ad will automatically run on behalf of the primary Facebook Page tied to your connected account.</p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
