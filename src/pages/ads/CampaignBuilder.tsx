import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, Rocket, Check, Info, MonitorPlay, Plus, X, ChevronDown, MapPin, AlertCircle } from 'lucide-react';
import { useCreateCampaign, useUpdateCampaign, useAdCampaign, useLaunchCampaign } from '../../hooks/useAdCampaigns';
import type { AdType, CampaignDraft, AdTargeting } from '../../types/ads';
import MediaLibraryModal from '../../components/ads/MediaLibraryModal';

import { GoogleLogo, MetaLogo, OBJECTIVE_MAP, STEPS } from './components/CampaignBuilder/shared';
import { Step1Campaign } from './components/CampaignBuilder/Step1Campaign';
import { Step2Budget } from './components/CampaignBuilder/Step2Budget';
import { Step3Targeting } from './components/CampaignBuilder/Step3Targeting';
import { Step4Creative } from './components/CampaignBuilder/Step4Creative';
import { Step5Review } from './components/CampaignBuilder/Step5Review';

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isComplete = step.id < currentStep;
        const isActive = step.id === currentStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                isComplete
                  ? 'bg-primary text-white'
                  : isActive
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-border/60 text-text-muted'
              }`}>
                {isComplete ? <Check className="w-3.5 h-3.5" /> : step.id}
              </div>
              <span className={`text-[12px] font-semibold hidden sm:block ${isActive ? 'text-text-main' : 'text-text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 sm:w-16 h-px mx-2 transition-colors ${i < currentStep - 1 ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main CampaignBuilder ──────────────────────────────────────────────────────
export default function CampaignBuilder() {
  const { id, type: typeParam } = useParams<{ id: string; type: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Resolve objective from URL param
  const objectiveId = typeParam || 'google_leads';
  const objInfo = OBJECTIVE_MAP[objectiveId] || OBJECTIVE_MAP['google_leads'];
  const platform = objInfo.platform;

  const { data: existingCampaign, isLoading } = useAdCampaign(id || '');
  const { mutate: create, isPending: isCreating } = useCreateCampaign();
  const { mutate: update, isPending: isUpdating } = useUpdateCampaign();
  const { mutate: launch, isPending: isLaunching } = useLaunchCampaign();

  const [step, setStep] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CampaignDraft>>({
    adType: objInfo.adType,
    name: '',
    objective: '',
    budgetType: 'DAILY',
    budgetAmountCents: 5000,
    scheduleType: 'CONTINUOUS',
    bidStrategy: 'MAXIMIZE_CONVERSIONS',
    targeting: { locations: ['United States'] },
    creative: { headlines: [], descriptions: [] },
  });

  useEffect(() => {
    if (existingCampaign) {
      setDraft({
        adType: existingCampaign.adType as AdType,
        name: existingCampaign.name,
        objective: existingCampaign.objective,
        budgetType: existingCampaign.budgetType,
        budgetAmountCents: existingCampaign.budgetAmountCents,
        scheduleType: existingCampaign.scheduleType,
        startDate: existingCampaign.startDate || undefined,
        endDate: existingCampaign.endDate || undefined,
        bidStrategy: existingCampaign.bidStrategy || 'MAXIMIZE_CONVERSIONS',
        targeting: existingCampaign.targeting,
        creative: existingCampaign.creative,
      });
    }
  }, [existingCampaign]);

  // Ensure creative.descriptions is never empty (backend requires min 1)
  const prepareDraft = useCallback((d: Partial<CampaignDraft>): Partial<CampaignDraft> => {
    const creative = d.creative || {};
    const descriptions = (creative.descriptions || []).filter(Boolean);
    if (descriptions.length === 0) {
      // fallback: use primaryText or first headline as description
      const fallback = creative.primaryText || (creative.headlines || [])[0] || 'Contact us today';
      return { ...d, creative: { ...creative, descriptions: [fallback.slice(0, 90)] } };
    }
    return d;
  }, []);

  const handleSaveDraft = useCallback(() => {
    setSaveError(null);
    const prepared = prepareDraft(draft);
    if (isEditing) {
      update({ id, data: prepared }, {
        onSuccess: () => navigate('/ads/campaigns'),
        onError: (e: any) => setSaveError(e?.message || 'Failed to save. Check all required fields.'),
      });
    } else {
      create(prepared, {
        onSuccess: () => navigate('/ads/campaigns'),
        onError: (e: any) => setSaveError(e?.message || 'Failed to save. Check all required fields.'),
      });
    }
  }, [draft, isEditing, id, prepareDraft]);

  const handleLaunch = useCallback(() => {
    setLaunchError(null);
    const prepared = prepareDraft(draft);

    // Hard validation before launch
    if (!prepared.name) return setLaunchError('Campaign name is required.');
    if (!prepared.targeting?.locations?.length) return setLaunchError('At least one location is required.');
    if (!prepared.creative?.finalUrl) return setLaunchError('Website URL is required for the ad destination.');
    if (platform === 'META' && !prepared.creative?.imageUrls?.length) return setLaunchError('An ad image or video is required for Meta Ads.');

    if (!id) {
      create(prepared, {
        onSuccess: (newC: any) => {
          launch(newC.id, {
            onSuccess: () => navigate(`/ads/campaigns/${newC.id}`),
            onError: (e: any) => setLaunchError(e?.message || 'Launch failed. Please try again.'),
          });
        },
        onError: (e: any) => setLaunchError(e?.message || 'Could not save campaign. Check all required fields.'),
      });
    } else {
      update({ id, data: prepared }, {
        onSuccess: () => {
          launch(id, {
            onSuccess: () => navigate(`/ads/campaigns/${id}`),
            onError: (e: any) => setLaunchError(e?.message || 'Launch failed. Please try again.'),
          });
        },
        onError: (e: any) => setLaunchError(e?.message || 'Could not save campaign. Check all required fields.'),
      });
    }
  }, [draft, id, isEditing, prepareDraft]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isSaving = isCreating || isUpdating;
  const isLastStep = step === STEPS.length;

  const creative = draft.creative || {};

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* ── Top header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-16 border-b border-border bg-surface flex items-center justify-between px-6 gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ads/campaigns/new')}
            className="text-text-muted hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: platform === 'GOOGLE' ? 'rgba(234,67,53,0.1)' : 'rgba(24,119,242,0.1)' }}>
              {platform === 'GOOGLE' ? <GoogleLogo size={16} /> : <MetaLogo size={16} />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-text-main leading-tight">{isEditing ? 'Edit Campaign' : 'New Campaign'}</p>
              <p className="text-[11px] text-text-muted">{platform === 'GOOGLE' ? 'Google Ads' : 'Meta Ads'} · {objInfo.label}</p>
            </div>
          </div>
        </div>

        {/* Progress bar (desktop) */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-8">
          <ProgressBar currentStep={step} totalSteps={STEPS.length} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isLaunching}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save draft</>}
          </button>
          {isLastStep && (
            <button
              onClick={handleLaunch}
              disabled={isSaving || isLaunching || existingCampaign?.status === 'ACTIVE'}
              className="flex items-center gap-1.5 h-9 px-4 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isLaunching ? 'Launching...' : <><Rocket className="w-3.5 h-3.5" /> Launch</>}
            </button>
          )}
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex bg-bg">
        {/* Main form */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Mobile step indicator */}
            <div className="lg:hidden mb-6 overflow-x-auto pb-1">
              <ProgressBar currentStep={step} totalSteps={STEPS.length} />
            </div>

            {/* Step label */}
            <div className="mb-6">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">
                Step {step} of {STEPS.length}
              </p>
              <h2 className="text-[20px] font-black text-text-main tracking-tight">
                {STEPS[step - 1].label}
              </h2>
            </div>

            {/* Save / Launch error banners */}
            {saveError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-red-400/30 bg-red-400/8 text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold mb-0.5">Couldn't save draft</p>
                  <p className="text-[11px] opacity-80">{saveError}</p>
                </div>
                <button onClick={() => setSaveError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {launchError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-red-400/30 bg-red-400/8 text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold mb-0.5">Launch failed</p>
                  <p className="text-[11px] opacity-80">{launchError}</p>
                </div>
                <button onClick={() => setLaunchError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Step content */}
            {step === 1 && <Step1Campaign draft={draft} setDraft={setDraft} objectiveId={objectiveId} platform={platform} />}
            {step === 2 && <Step2Budget draft={draft} setDraft={setDraft} platform={platform} />}
            {step === 3 && <Step3Targeting draft={draft} setDraft={setDraft} platform={platform} objectiveId={objectiveId} />}
            {step === 4 && <Step4Creative draft={draft} setDraft={setDraft} platform={platform} objectiveId={objectiveId} />}
            {step === 5 && <Step5Review draft={draft} objectiveId={objectiveId} platform={platform} />}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/50">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="flex items-center gap-2 h-10 px-5 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}
                  className="flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLaunch}
                  disabled={isSaving || isLaunching}
                  className="flex items-center gap-2 h-10 px-6 bg-primary text-white rounded-lg text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isLaunching ? 'Launching...' : <><Rocket className="w-4 h-4" /> Launch Campaign</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div
          className="hidden xl:flex w-[400px] shrink-0 border-l border-border bg-surface flex-col overflow-hidden shadow-[inset_1px_0_0_0_rgba(0,0,0,0.02)]"
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-surface">
            <MonitorPlay className="w-4 h-4 text-text-muted" />
            <h3 className="text-[12px] font-bold text-text-main">Live Preview</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {platform === 'GOOGLE' ? (
              <div className="rounded-xl border border-border bg-white p-4 font-['Arial',sans-serif]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold border border-gray-200">Ad</span>
                  <span className="text-[11px] text-green-700">{(creative.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</span>
                </div>
                <div className="text-[18px] text-blue-700 font-medium leading-snug mb-1.5">
                  {(creative.headlines || []).filter(Boolean).slice(0, 3).join(' | ') || 'Your Headline Here'}
                </div>
                <div className="text-[13px] text-gray-800 leading-relaxed">
                  {creative.descriptions?.[0] || 'Your description shows here and tells users what to do. Keep it informative.'}
                </div>
                {creative.imageUrls?.[0] && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 aspect-video">
                    <img src={creative.imageUrls[0]} className="w-full h-full object-cover" alt="Ad preview" />
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
                <div className="flex items-center gap-2 p-3.5 border-b border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[12px]">S</div>
                  <div>
                    <p className="text-[13px] font-semibold text-text-main leading-tight">Your Page</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Sponsored</p>
                  </div>
                </div>
                {creative.primaryText && (
                  <div className="px-3.5 pt-3 pb-2 text-[14px] text-text-main leading-relaxed">{creative.primaryText}</div>
                )}
                {creative.imageUrls?.[0] ? (
                  <div className="w-full aspect-square border-y border-border/50 bg-black flex items-center justify-center">
                     <img src={creative.imageUrls[0]} alt="Creative preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/25 flex items-center justify-center border-y border-border/50">
                    <span className="text-[12px] text-text-muted">Ad image</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3.5 bg-surface hover:bg-surface-hover transition-colors cursor-pointer">
                  <div>
                    <p className="text-[11px] text-text-muted mb-0.5">{(creative.finalUrl || 'yourwebsite.com').replace(/^https?:\/\//, '').split('/')[0]}</p>
                    <p className="text-[14px] font-bold text-text-main leading-tight">{creative.headlines?.[0] || 'Your Headline'}</p>
                    {creative.descriptions?.[0] && <p className="text-[13px] text-text-muted mt-1">{creative.descriptions[0]}</p>}
                  </div>
                  <span className="px-3 py-1.5 bg-border text-text-main rounded-md text-[12px] font-bold shrink-0 ml-2">
                    {(creative.callToAction || 'LEARN_MORE').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg border border-border/50 bg-surface">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">Campaign Summary</p>
              <div className="space-y-1.5">
                {[
                  { k: 'Name', v: draft.name || '—' },
                  { k: 'Budget', v: draft.budgetAmountCents ? `$${(draft.budgetAmountCents/100).toFixed(0)}/day` : '—' },
                  { k: 'Locations', v: (draft.targeting?.locations || []).join(', ') || '—' },
                ].map(item => (
                  <div key={item.k} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-text-muted">{item.k}</span>
                    <span className="text-[10px] font-semibold text-text-main text-right truncate max-w-[120px]">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
