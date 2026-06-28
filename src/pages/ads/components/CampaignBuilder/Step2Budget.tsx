import type { CampaignDraft } from '../../../../types/ads';
import { SectionCard, Label, Input, OptionPill, Select } from './shared';

export function Step2Budget({
  draft,
  setDraft,
  platform,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  platform: 'GOOGLE' | 'META';
}) {
  const dailyBudget = (draft.budgetAmountCents ?? 5000) / 100;

  const BID_STRATEGIES_GOOGLE = [
    { value: 'MAXIMIZE_CONVERSIONS', label: 'Maximize Conversions', desc: 'Get as many conversions as possible within your budget.' },
    { value: 'TARGET_CPA', label: 'Target CPA', desc: 'Try to get conversions at or below your target cost per action.' },
    { value: 'TARGET_ROAS', label: 'Target ROAS', desc: 'Maximize conversion value while achieving your target return on ad spend.' },
    { value: 'MAXIMIZE_CLICKS', label: 'Maximize Clicks', desc: 'Get the most clicks within your budget.' },
    { value: 'MANUAL_CPC', label: 'Manual CPC', desc: 'Set your own maximum cost-per-click bids for full control.' },
  ];

  return (
    <div className="space-y-5">
      <SectionCard title="Budget" description="Set how much you want to spend.">
        <div>
          <Label>Budget type</Label>
          <div className="flex gap-2">
            {(['DAILY', 'LIFETIME'] as const).map(bt => (
              <OptionPill key={bt} selected={draft.budgetType === bt} onClick={() => setDraft(d => ({ ...d, budgetType: bt }))}>
                {bt === 'DAILY' ? 'Daily budget' : 'Lifetime budget'}
              </OptionPill>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-2">
            {draft.budgetType === 'DAILY'
              ? 'You\'ll be charged up to your daily limit. Spend may vary day-to-day but will average your daily budget over a month.'
              : 'You set a total budget for the full campaign duration. Delivery is automatically paced.'}
          </p>
        </div>

        <div>
          <Label required>{draft.budgetType === 'DAILY' ? 'Daily budget' : 'Total budget'}</Label>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-semibold">$</span>
            <Input
              type="number"
              value={dailyBudget || ''}
              onChange={e => setDraft(d => ({ ...d, budgetAmountCents: Math.round(parseFloat(e.target.value) * 100) }))}
              className="pl-7"
              min={1}
              step={0.01}
              placeholder="50.00"
            />
          </div>
          {dailyBudget > 0 && (
            <p className="text-[11px] text-text-muted mt-1.5">
              Estimated {draft.budgetType === 'DAILY'
                ? `$${(dailyBudget * 30.4).toFixed(0)}/month maximum`
                : 'flat total spend'}
            </p>
          )}
        </div>
      </SectionCard>

      {platform === 'GOOGLE' && (
        <SectionCard title="Bidding strategy" description="Tell Google how to optimize your bids for your goals.">
          <div className="space-y-2">
            {BID_STRATEGIES_GOOGLE.map(bs => (
              <label
                key={bs.value}
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
                  draft.bidStrategy === bs.value
                    ? 'border-primary bg-primary/8'
                    : 'border-border hover:border-border hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="bidStrategy"
                  value={bs.value}
                  checked={draft.bidStrategy === bs.value}
                  onChange={() => setDraft(d => ({ ...d, bidStrategy: bs.value }))}
                  className="mt-0.5 accent-primary shrink-0"
                />
                <div>
                  <p className="text-[13px] font-semibold text-text-main">{bs.label}</p>
                  <p className="text-[12px] text-text-muted mt-0.5">{bs.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {draft.bidStrategy === 'TARGET_CPA' && (
            <div className="pt-2">
              <Label>Target CPA</Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-semibold">$</span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="25.00"
                  value={draft.targetCpaCents ? draft.targetCpaCents / 100 : ''}
                  onChange={e => setDraft(d => ({ ...d, targetCpaCents: Math.round(parseFloat(e.target.value) * 100) }))}
                />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {platform === 'META' && (
        <SectionCard title="Bidding" description="How Meta optimizes your bids.">
          <div>
            <Label>Optimization goal</Label>
            <Select
              value={draft.bidStrategy || 'LOWEST_COST'}
              onChange={e => setDraft(d => ({ ...d, bidStrategy: e.target.value }))}
            >
              <option value="LOWEST_COST">Lowest Cost (auto)</option>
              <option value="COST_CAP">Cost Cap</option>
              <option value="BID_CAP">Bid Cap</option>
              <option value="VALUE_OPTIMIZATION">Value Optimization</option>
            </Select>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Schedule" description="Choose when your campaign runs.">
        <div>
          <Label>Run time</Label>
          <div className="flex gap-2 flex-wrap">
            {(['CONTINUOUS', 'SCHEDULED'] as const).map(st => (
              <OptionPill key={st} selected={draft.scheduleType === st} onClick={() => setDraft(d => ({ ...d, scheduleType: st }))}>
                {st === 'CONTINUOUS' ? 'Run continuously' : 'Set a start and end date'}
              </OptionPill>
            ))}
          </div>
        </div>

        {draft.scheduleType === 'SCHEDULED' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Start date</Label>
              <Input
                type="date"
                value={draft.startDate || ''}
                onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>End date (optional)</Label>
              <Input
                type="date"
                value={draft.endDate || ''}
                onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))}
              />
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
