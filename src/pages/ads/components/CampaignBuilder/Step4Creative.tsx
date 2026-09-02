import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { CampaignDraft } from '../../../../types/ads';
import { SectionCard, Label, Input, Textarea, Select, HeadlineList } from './shared';
import { useGenerateAdCopy } from '../../../../hooks/useAdAI';
import MediaLibraryModal from '../../../../components/ads/MediaLibraryModal';

export function Step4Creative({
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
  const creative = draft.creative || {};
  const update = (patch: Partial<typeof creative>) =>
    setDraft(d => ({ ...d, creative: { ...d.creative, ...patch } }));

  const isLeadAd = objectiveId === 'meta_leads' || objectiveId === 'google_leads';
  const [showMediaModal, setShowMediaModal] = useState(false);

  const { mutate: generateCopy, isPending: isGeneratingCopy } = useGenerateAdCopy();

  const handleAiCopy = () => {
    const desc = creative.primaryText || draft.name || draft.objective || 'Stone AIO Platform Campaign';
    const adType: any = platform === 'GOOGLE' ? 'GOOGLE_SEARCH' : 'FACEBOOK_FEED';

    generateCopy(
      { description: desc, adType },
      {
        onSuccess: (data) => {
          if (data && data.length > 0) {
            const first = data[0];
            if (platform === 'GOOGLE') {
              const allHeadlines = data.flatMap(v => v.headlines || []).filter(Boolean);
              const allDescriptions = data.flatMap(v => v.descriptions || []).filter(Boolean);
              update({
                headlines: allHeadlines.length >= 3 ? allHeadlines.slice(0, 5) : [allHeadlines[0] || 'Top Rated Service', `${draft.name || 'Professional Solutions'}`, 'Get Started Today'],
                descriptions: allDescriptions.length >= 2 ? allDescriptions.slice(0, 3) : [allDescriptions[0] || 'Contact our team of experts today for a consultation.', 'Specialized services with guaranteed results.'],
              });
            } else {
              update({
                primaryText: first.primaryText || (first.descriptions && first.descriptions[0]) || '',
                headlines: first.headlines && first.headlines.length > 0 ? [first.headlines[0]] : ['Get Started Today'],
                descriptions: first.descriptions && first.descriptions.length > 0 ? [first.descriptions[0]] : [],
                callToAction: creative.callToAction || 'LEARN_MORE',
              });
            }
          }
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      {/* URL */}
      <SectionCard title="Final URL" description={isLeadAd ? "Required for your privacy policy and ad creative." : "Where users go when they click your ad."}>
        <div>
          <Label required>Website URL</Label>
          <Input
            type="url"
            value={creative.finalUrl || ''}
            onChange={e => update({ finalUrl: e.target.value })}
            placeholder="https://yourwebsite.com/landing-page"
          />
        </div>
      </SectionCard>

      {platform === 'META' && (
        <SectionCard title="Facebook Page" description="Select the Facebook Page to run this ad from.">
          <div>
            <Label required>Facebook Page ID</Label>
            <Input
              value={creative.facebookPageId || ''}
              onChange={e => update({ facebookPageId: e.target.value })}
              placeholder="e.g. 1029384756"
            />
            <p className="text-[11px] text-text-muted mt-1">Enter the ID of the Facebook Page (you can find this in your Page's About section).</p>
          </div>
        </SectionCard>
      )}

      {/* Google Search: Headlines + Descriptions */}
      {platform === 'GOOGLE' && (draft.objective !== 'Display' && draft.objective !== 'Video') && (
        <SectionCard
          title="Responsive search ad"
          description="Google automatically combines up to 3 headlines and 2 descriptions to create the best-performing ad."
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={handleAiCopy}
              disabled={isGeneratingCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
              <span>{isGeneratingCopy ? 'Generating Copy...' : 'AI Generate Copy'}</span>
            </button>
          </div>

          <HeadlineList
            label="Headlines"
            headlines={creative.headlines || []}
            onChange={h => update({ headlines: h })}
            maxChars={30}
            maxItems={15}
            minItems={3}
            placeholder="Add a headline"
          />
          <HeadlineList
            label="Descriptions"
            headlines={creative.descriptions || []}
            onChange={d => update({ descriptions: d })}
            maxChars={90}
            maxItems={4}
            minItems={2}
            placeholder="Add a description"
          />
        </SectionCard>
      )}

      {/* Google Display: Image + headline */}
      {platform === 'GOOGLE' && draft.objective === 'Display' && (
        <SectionCard title="Responsive display ad" description="Upload images and write copy. Google resizes and reformats them automatically.">
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={handleAiCopy}
              disabled={isGeneratingCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
              <span>{isGeneratingCopy ? 'Generating Copy...' : 'AI Generate Copy'}</span>
            </button>
          </div>

          <div>
            <Label>Marketing images</Label>
            {creative.imageUrls?.[0] ? (
              <div className="relative group rounded-xl overflow-hidden border border-border aspect-video">
                <img src={creative.imageUrls[0]} alt="Creative" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setShowMediaModal(true)}
                    className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold shadow-sm"
                  >
                    Change Image
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setShowMediaModal(true)} className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 hover:bg-surface-hover transition-colors cursor-pointer">
                <svg className="w-8 h-8 text-text-muted mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M21 15l-5-5L5 21"/>
                </svg>
                <p className="text-[13px] font-medium text-text-muted">Click to open Media Library</p>
                <p className="text-[11px] text-text-muted mt-1">Select from library, upload file, or generate with AI.</p>
              </div>
            )}
          </div>
          <HeadlineList
            label="Headlines"
            headlines={creative.headlines || []}
            onChange={h => update({ headlines: h })}
            maxChars={30}
            maxItems={5}
            minItems={1}
            placeholder="Add a headline"
          />
          <HeadlineList
            label="Descriptions"
            headlines={creative.descriptions || []}
            onChange={d => update({ descriptions: d })}
            maxChars={90}
            maxItems={5}
            minItems={1}
            placeholder="Add a description"
          />
        </SectionCard>
      )}

      {/* Meta: Primary text + headline + image */}
      {platform === 'META' && (
        <>
          <SectionCard title="Ad copy" description="Write the text that appears in your ad.">
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={handleAiCopy}
                disabled={isGeneratingCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCopy ? 'animate-spin' : ''}`} />
                <span>{isGeneratingCopy ? 'Generating Copy...' : 'AI Generate Copy'}</span>
              </button>
            </div>

            <div>
              <Label required>Primary text</Label>
              <Textarea
                rows={4}
                value={creative.primaryText || ''}
                onChange={e => update({ primaryText: e.target.value })}
                placeholder="Write the main body text for your ad. Keep it concise and focus on your unique value..."
              />
              <p className="text-[11px] text-text-muted mt-1.5">
                {(creative.primaryText || '').length}/125 recommended
              </p>
            </div>

            <div>
              <Label>Headline</Label>
              <Input
                value={creative.headlines?.[0] || ''}
                onChange={e => update({ headlines: [e.target.value] })}
                placeholder="Bold headline under your image"
                maxLength={40}
              />
              <p className="text-[11px] text-text-muted mt-1">{(creative.headlines?.[0] || '').length}/40</p>
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                value={creative.descriptions?.[0] || ''}
                onChange={e => update({ descriptions: [e.target.value] })}
                placeholder="Additional details below the headline"
                maxLength={30}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Call to action</Label>
                <Select
                  value={creative.callToAction || 'LEARN_MORE'}
                  onChange={e => update({ callToAction: e.target.value })}
                >
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="SHOP_NOW">Shop Now</option>
                  <option value="GET_QUOTE">Get Quote</option>
                  <option value="BOOK_NOW">Book Now</option>
                  <option value="CONTACT_US">Contact Us</option>
                  <option value="SIGN_UP">Sign Up</option>
                  <option value="DOWNLOAD">Download</option>
                  <option value="GET_OFFER">Get Offer</option>
                  <option value="APPLY_NOW">Apply Now</option>
                </Select>
              </div>
              <div>
                <Label>Display link (optional)</Label>
                <Input value="" placeholder="yourwebsite.com" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Media" description="Select your image or video creative.">
            <div>
              <Label>Ad image or video</Label>
              {creative.imageUrls?.[0] ? (
                <div className="relative group rounded-xl overflow-hidden border border-border aspect-square w-64 max-w-full">
                  <img src={creative.imageUrls[0]} alt="Creative" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setShowMediaModal(true)}
                      className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold shadow-sm"
                    >
                      Change Media
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {['1:1 Square (1080×1080)', '1.91:1 Landscape (1200×628)', '9:16 Story (1080×1920)'].slice(0, 2).map(format => (
                    <div
                      key={format}
                      onClick={() => setShowMediaModal(true)}
                      className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      <svg className="w-6 h-6 text-text-muted mx-auto mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <p className="text-[11px] font-medium text-text-muted">{format}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {/* Meta Lead form fields */}
      {platform === 'META' && isLeadAd && (
        <>
          <SectionCard title="Lead form" description="Choose the fields to collect from potential leads.">
            <div>
              <Label>Form fields</Label>
              <div className="space-y-2">
                {[
                  { id: 'FULL_NAME', label: 'Full Name', required: true },
                  { id: 'EMAIL', label: 'Email', required: true },
                  { id: 'PHONE', label: 'Phone Number', required: false },
                  { id: 'COMPANY', label: 'Company Name', required: false },
                  { id: 'ADDRESS', label: 'Street Address', required: false },
                ].map(field => (
                  <label key={field.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={field.required}
                      disabled={field.required}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-text-main">{field.label}</span>
                      {field.required && <span className="ml-2 text-[10px] text-primary font-bold uppercase">Required</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {/* Google Lead Form Extension */}
      {platform === 'GOOGLE' && isLeadAd && (
        <SectionCard title="Lead form extension" description="Collect leads directly in Google search results — no website needed.">
          <div>
            <Label required>Headline</Label>
            <Input
              value={creative.headlines?.[0] || ''}
              onChange={e => update({ headlines: [e.target.value] })}
              placeholder="Get a free estimate"
              maxLength={30}
            />
          </div>
          <div>
            <Label required>Business name</Label>
            <Input placeholder="Your Company Name" maxLength={25} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} placeholder="Tell people what they'll get..." maxLength={200} />
          </div>
        </SectionCard>
      )}

      {/* Media Library Modal */}
      {showMediaModal && (
        <MediaLibraryModal
          onClose={() => setShowMediaModal(false)}
          onSelect={(url) => {
            update({ imageUrls: [url] });
            setShowMediaModal(false);
          }}
          initialPrompt={creative.primaryText || draft.name || ''}
        />
      )}
    </div>
  );
}
