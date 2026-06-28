import { Info } from 'lucide-react';
import type { CampaignDraft, AdTargeting } from '../../../../types/ads';
import { SectionCard, Label, Textarea, Select, OptionPill, LocationAutocomplete, TagInput } from './shared';

export function Step3Targeting({
  draft,
  setDraft,
  platform,
  objectiveId,
}: {
  draft: Partial<CampaignDraft>;
  setDraft: (fn: (d: Partial<CampaignDraft>) => Partial<CampaignDraft>) => void;
  platform: 'GOOGLE' | 'META';
  objectiveId: string;
}) {
  const targeting = draft.targeting || {};
  const update = (patch: Partial<AdTargeting>) =>
    setDraft(d => ({ ...d, targeting: { ...d.targeting, ...patch } }));

  const PREDEFINED_LOCATIONS = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Brazil', 'Mexico'];
  const INTEREST_SUGGESTIONS = ['Real Estate', 'Home Services', 'Fitness & Wellness', 'Finance', 'Healthcare', 'Technology', 'Food & Dining', 'Travel', 'Fashion', 'Education'];

  return (
    <div className="space-y-5">
      <SectionCard title="Locations" description="Target users in specific countries, regions, or cities.">
        <LocationAutocomplete
          values={targeting.locations || []}
          onChange={locs => update({ locations: locs })}
        />
      </SectionCard>

      {platform === 'GOOGLE' && (draft.objective === 'Search' || !draft.objective) && (
        <SectionCard title="Keywords" description="Your ads show when people search for these terms. One keyword per line.">
          <div>
            <Label>Search keywords</Label>
            <Textarea
              rows={8}
              value={(targeting.keywords || []).map((k: any) => typeof k === 'string' ? k : k.text).join('\n')}
              onChange={e => {
                const kws = e.target.value.split('\n').filter(Boolean).map(t => ({
                  text: t.trim().replace(/^["\[\]]+|["\[\]]+$/g, ''),
                  matchType: t.startsWith('[') ? 'EXACT' : t.startsWith('"') ? 'PHRASE' : 'BROAD' as any,
                }));
                update({ keywords: kws });
              }}
              placeholder={'roofing company near me\n"roof repair service"\n[roof installation]'}
            />
            <div className="mt-2 flex items-start gap-2 text-[11px] text-text-muted">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Use <code className="text-primary">[brackets]</code> for exact match, <code className="text-primary">"quotes"</code> for phrase match, or plain text for broad match.</span>
            </div>
          </div>

          <div>
            <Label>Negative keywords (optional)</Label>
            <Textarea
              rows={3}
              value={''}
              placeholder={'free\ncheap\nDIY'}
            />
            <p className="text-[11px] text-text-muted mt-1">Prevent your ads from showing for these terms.</p>
          </div>
        </SectionCard>
      )}

      {platform === 'META' && (
        <>
          <SectionCard title="Audience" description="Define who sees your ads on Facebook and Instagram.">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Min age</Label>
                <Select
                  value={targeting.ageMin || 18}
                  onChange={e => update({ ageMin: parseInt(e.target.value) })}
                >
                  {[18,21,25,30,35,40,45,50,55,60,65].map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>
              <div>
                <Label>Max age</Label>
                <Select
                  value={targeting.ageMax || 65}
                  onChange={e => update({ ageMax: parseInt(e.target.value) })}
                >
                  {[25,30,35,40,45,50,55,60,65].map(a => <option key={a} value={a}>{a === 65 ? '65+' : a}</option>)}
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={(targeting.genders || ['ALL'])[0]}
                  onChange={e => update({ genders: [e.target.value as any] })}
                >
                  <option value="ALL">All genders</option>
                  <option value="MALE">Men</option>
                  <option value="FEMALE">Women</option>
                </Select>
              </div>
            </div>

            <TagInput
              label="Detailed interests"
              values={targeting.interests || []}
              onChange={ints => update({ interests: ints })}
              placeholder="e.g., Homeowners, Real Estate"
            />
            {(!targeting.interests || targeting.interests.length === 0) && (
              <div>
                <p className="text-[11px] text-text-muted mb-2">Suggestions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_SUGGESTIONS.map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => update({ interests: [...(targeting.interests || []), i] })}
                      className="px-2.5 py-1 rounded-md border border-border text-[11px] text-text-muted hover:text-text-main hover:border-primary/40 transition-colors"
                    >
                      + {i}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Placements" description="Where your ads appear across Meta's platforms.">
            <div>
              <Label>Placement type</Label>
              <div className="flex gap-2 flex-wrap">
                {['Automatic (Recommended)', 'Manual placements'].map(p => (
                  <OptionPill
                    key={p}
                    selected={(draft as any).__placements === p}
                    onClick={() => setDraft(d => ({ ...d, __placements: p } as any))}
                  >
                    {p}
                  </OptionPill>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Automatic placements deliver your ads across Facebook, Instagram, Messenger, and Audience Network for the best results.
              </p>
            </div>
          </SectionCard>
        </>
      )}

      {platform === 'GOOGLE' && (
        <SectionCard title="Languages" description="Target users in specific languages.">
          <div>
            <Label>Languages</Label>
            <div className="flex flex-wrap gap-2">
              {['English', 'Spanish', 'French', 'German', 'Portuguese'].map(lang => (
                <OptionPill
                  key={lang}
                  selected={((draft as any).__langs || ['English']).includes(lang)}
                  onClick={() => {
                    const curr: string[] = (draft as any).__langs || ['English'];
                    const next = curr.includes(lang) ? curr.filter(l => l !== lang) : [...curr, lang];
                    setDraft(d => ({ ...d, __langs: next } as any));
                  }}
                >
                  {lang}
                </OptionPill>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
