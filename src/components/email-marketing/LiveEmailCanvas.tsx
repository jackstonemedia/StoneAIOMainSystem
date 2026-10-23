import React, { useState, useMemo } from 'react';
import { Monitor, Smartphone, Sparkles } from 'lucide-react';
import type { BusinessProfile, CampaignDraftState } from '../../lib/createWithAiApi';

interface LiveEmailCanvasProps {
  draft: CampaignDraftState;
  profile?: Partial<BusinessProfile>;
  isGenerating?: boolean;
}

export default function LiveEmailCanvas({ draft, profile, isGenerating = false }: LiveEmailCanvasProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Single source of truth: live email draft from CampaignBrief
  const liveEmail = draft.brief?.liveEmail;
  const subjectLine = liveEmail?.subject || '';

  // Parse paragraphs from bodyText
  const paragraphs = useMemo(() => {
    if (!liveEmail?.bodyText) return [];
    return liveEmail.bodyText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [liveEmail?.bodyText]);

  const hasDraftContent = !!liveEmail && (paragraphs.length > 0 || !!subjectLine);

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden select-none">
      {/* Top Canvas Bar */}
      <div className="px-6 py-3 border-b border-border/50 bg-surface/30 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-main tracking-wider uppercase">
            Email Preview
          </span>

          {/* Smooth loading badge during generation */}
          {isGenerating && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium animate-pulse">
              <Sparkles className="w-3 h-3 animate-spin" />
              <span>Updating draft…</span>
            </div>
          )}
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted hidden sm:inline">Viewport:</span>
          <div className="flex items-center bg-surface/60 p-0.5 rounded-lg border border-border/60">
            <div
              onClick={() => setDevice('desktop')}
              title="Desktop View"
              className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                device === 'desktop' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <div
              onClick={() => setDevice('mobile')}
              title="Mobile View"
              className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                device === 'mobile' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Plain 1-on-1 direct email preview frame */}
      <div className="flex-1 overflow-y-auto w-full h-full p-6 lg:p-8 flex flex-col items-center">
        <div
          className={`transition-all duration-300 flex flex-col w-full ${
            device === 'desktop' ? 'max-w-3xl' : 'max-w-[390px]'
          }`}
        >
          {/* Email Envelope Header */}
          <div className="p-4 sm:px-6 rounded-t-[12px] bg-surface/60 border border-border/70 border-b-0 backdrop-blur-md space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <span className="text-text-muted font-medium">From:</span>
              <span className="text-text-main font-semibold truncate">
                You &lt;you@yourdomain.com&gt;
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <span className="text-text-muted font-medium">To:</span>
              <span className="text-text-main font-mono text-[11px] truncate">
                {"{{contact.email || 'prospect@company.com'}}"}
              </span>
            </div>
            <div className="pt-2 border-t border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-text-muted font-medium shrink-0">Subject:</span>
                <span className="text-xs text-text-main font-semibold truncate flex-1 sm:text-right min-h-[18px]">
                  {subjectLine}
                </span>
              </div>
            </div>
          </div>

          {/* Plain Text Direct Email Sheet */}
          <div className="p-6 sm:p-8 rounded-b-[12px] bg-white text-slate-900 shadow-md border border-border/80 font-sans space-y-3.5">
            {/* Email Body */}
            {hasDraftContent ? (
              <div className="space-y-3 animate-in fade-in duration-300">
                {paragraphs.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-800">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <div className="min-h-[140px] w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
