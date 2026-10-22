import React, { useState, useMemo } from 'react';
import { 
  Monitor, Smartphone, Sparkles, CheckCircle2, Clock, 
  ExternalLink, Mail, User, ShieldCheck, ArrowRight, 
  Layers, Target, Zap, Split, FileText, Check
} from 'lucide-react';
import type { BusinessProfile, CampaignDraftState, InterviewPhase } from '../../lib/createWithAiApi';

interface LiveEmailCanvasProps {
  draft: CampaignDraftState;
  profile: BusinessProfile;
}

export default function LiveEmailCanvas({ draft, profile }: LiveEmailCanvasProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [tab, setTab] = useState<'preview' | 'blueprint'>('preview');

  // Derive dynamic email content based on conversation and checklist state
  const goalAnswer = useMemo(() => {
    const userMsg = draft.conversation.find(m => m.role === 'user' && m.phase === 'goal');
    return userMsg?.text || '';
  }, [draft.conversation]);

  const audienceAnswer = useMemo(() => {
    const userMsg = draft.conversation.find(m => m.role === 'user' && m.phase === 'audience');
    return userMsg?.text || '';
  }, [draft.conversation]);

  const ctaAnswer = useMemo(() => {
    const userMsg = draft.conversation.find(m => m.role === 'user' && m.phase === 'cta');
    return userMsg?.text || '';
  }, [draft.conversation]);

  // Dynamic subject line
  const subjectLine = useMemo<string>(() => {
    if (typeof (draft.brief as any)?.subjectSuggestion === 'string') {
      return (draft.brief as any).subjectSuggestion;
    }
    if (goalAnswer) {
      // Create a punchy subject line from goal
      const cleanGoal = goalAnswer.slice(0, 45).replace(/\.$/, '');
      return `Special Update: ${cleanGoal} | ${profile.businessName}`;
    }
    return `An exclusive update from ${profile.businessName}`;
  }, [draft.brief, goalAnswer, profile.businessName]);

  // Dynamic hook / headline
  const headline = useMemo(() => {
    if (goalAnswer) return goalAnswer;
    return `We have something exciting to share with you this week at ${profile.businessName}.`;
  }, [goalAnswer, profile.businessName]);

  // Dynamic target audience display
  const audienceLabel = useMemo(() => {
    if (audienceAnswer) return audienceAnswer;
    return profile.customerType || 'Valued Clients & Subscribers';
  }, [audienceAnswer, profile.customerType]);

  // Dynamic CTA button label
  const ctaText = useMemo(() => {
    if (ctaAnswer) {
      if (ctaAnswer.toLowerCase().includes('book')) return 'Book Your Appointment Now';
      if (ctaAnswer.toLowerCase().includes('call') || ctaAnswer.toLowerCase().includes('phone')) return 'Call Us Today';
      if (ctaAnswer.toLowerCase().includes('offer') || ctaAnswer.toLowerCase().includes('discount')) return 'Claim Your Exclusive Offer';
      if (ctaAnswer.length < 30) return ctaAnswer;
    }
    if (profile.bookingLink) return 'Schedule an Appointment';
    if (profile.phone) return `Call Now (${profile.phone})`;
    return 'Learn More';
  }, [ctaAnswer, profile.bookingLink, profile.phone]);

  const currentPhase = draft.currentPhase;
  const isCtaPhase = currentPhase === 'cta';

  // Strategy checklist items
  const blueprintItems = [
    {
      id: 'goal',
      title: '1. Campaign Goal',
      description: goalAnswer || 'Waiting for goal input…',
      done: !!goalAnswer,
      active: currentPhase === 'goal',
      icon: Target,
    },
    {
      id: 'audience',
      title: '2. Target Audience',
      description: audienceAnswer || 'Waiting for audience segment…',
      done: !!audienceAnswer,
      active: currentPhase === 'audience',
      icon: User,
    },
    {
      id: 'cta',
      title: '3. Call to Action',
      description: ctaAnswer || (profile.bookingLink ? `Link: ${profile.bookingLink}` : 'Waiting for CTA definition…'),
      done: !!ctaAnswer,
      active: currentPhase === 'cta',
      icon: Zap,
    },
    {
      id: 'sequence',
      title: '4. Sequence Structure',
      description: draft.sequence ? `${(draft.sequence as any).count || 1} email(s) planned` : 'Pending brief confirmation…',
      done: !!draft.sequence,
      active: currentPhase === 'sequence',
      icon: Layers,
    },
    {
      id: 'reactions',
      title: '5. Behavioral Reactions',
      description: (draft as any).reactionRules?.length ? `${(draft as any).reactionRules.length} rule(s) configured` : 'Configured after sequence…',
      done: false,
      active: currentPhase === 'reactions' || currentPhase === 'reactions_confirm',
      icon: Sparkles,
    },
    {
      id: 'ab_testing',
      title: '6. A/B Optimization',
      description: 'Split test subject & CTA variations',
      done: false,
      active: currentPhase === 'ab_testing',
      icon: Split,
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-surface/20 backdrop-blur-md overflow-hidden select-none">
      {/* Top Canvas Bar */}
      <div className="px-5 py-3 border-b border-border/50 bg-surface/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-text-main tracking-wide uppercase">Live Email Canvas</span>
          </div>

          <div className="h-3.5 w-[1px] bg-border/60" />

          {/* View Mode Tabs */}
          <div className="flex items-center bg-surface/80 p-0.5 rounded-lg border border-border/60">
            <div
              onClick={() => setTab('preview')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all cursor-pointer ${
                tab === 'preview' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Email Preview
            </div>
            <div
              onClick={() => setTab('blueprint')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all cursor-pointer ${
                tab === 'blueprint' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              Strategy Blueprint
            </div>
          </div>
        </div>

        {/* Device Switcher (when preview tab is active) */}
        {tab === 'preview' && (
          <div className="flex items-center bg-surface/80 p-0.5 rounded-lg border border-border/60">
            <div
              onClick={() => setDevice('desktop')}
              title="Desktop View (600px)"
              className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                device === 'desktop' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </div>
            <div
              onClick={() => setDevice('mobile')}
              title="Mobile View (375px)"
              className={`p-1.5 rounded-[6px] transition-all cursor-pointer ${
                device === 'mobile' ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        {tab === 'blueprint' ? (
          /* Strategy Blueprint Matrix */
          <div className="w-full max-w-2xl space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-[12px] bg-surface/40 border border-border/60 shadow-luxury">
              <h4 className="text-sm font-bold text-text-main flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span>Campaign Blueprint & AI Knowledge Graph</span>
              </h4>
              <p className="text-xs text-text-muted mt-1">
                As you chat with the AI Strategist on the left, each campaign dimension is locked in and synthesized in real time.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {blueprintItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-[12px] border transition-all ${
                      item.active
                        ? 'bg-primary/5 border-primary/50 shadow-luxury ring-1 ring-primary/20'
                        : item.done
                        ? 'bg-surface/50 border-green-500/30'
                        : 'bg-surface/20 border-border/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.done
                              ? 'bg-green-500/15 text-green-400'
                              : item.active
                              ? 'bg-primary/20 text-primary'
                              : 'bg-surface text-text-muted'
                          }`}
                        >
                          {item.done ? <Check className="w-4 h-4 stroke-[3]" /> : <ItemIcon className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main">{item.title}</p>
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.description}</p>
                        </div>
                      </div>

                      {item.active && (
                        <span className="px-2 py-0.5 bg-primary/15 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0">
                          Active Focus
                        </span>
                      )}
                      {item.done && !item.active && (
                        <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0">
                          Captured
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Live Rendered Email Canvas */
          <div
            className={`transition-all duration-300 flex flex-col ${
              device === 'desktop' ? 'w-full max-w-[580px]' : 'w-[360px]'
            }`}
          >
            {/* Email Envelope Header */}
            <div className="p-4 rounded-t-[14px] bg-surface/70 border border-border/70 border-b-0 backdrop-blur-md space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium">From:</span>
                <span className="text-text-main font-semibold truncate max-w-[340px]">
                  {profile.senderName || 'Stone AIO'} &lt;{profile.replyToEmail || 'hello@yourdomain.com'}&gt;
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted font-medium">To:</span>
                <span className="text-text-main font-semibold truncate max-w-[340px]">
                  Alex Rivera &lt;alex@clientdomain.com&gt; · <span className="text-primary">{audienceLabel}</span>
                </span>
              </div>
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-muted font-medium shrink-0">Subject:</span>
                  <span className="text-xs text-text-main font-bold truncate flex-1 text-right">
                    {subjectLine}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border/50">
                    {subjectLine.length} chars · High open probability
                  </span>
                </div>
              </div>
            </div>

            {/* Email Body Card */}
            <div className="p-6 rounded-b-[14px] bg-white text-slate-900 shadow-2xl border border-border/80 space-y-5">
              {/* Brand Header */}
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {profile.businessName || 'Your Company'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {profile.services || profile.businessType || 'Premium Services'}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Greeting */}
              <div className="text-sm font-semibold text-slate-800">
                Hi Alex,
              </div>

              {/* Hook Paragraph */}
              <p className="text-xs leading-relaxed text-slate-700">
                {headline}
              </p>

              {/* Value Proposition Points */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                  What this means for you:
                </p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Tailored directly for {audienceLabel}.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Serving clients throughout {profile.serviceArea || 'your local area'}.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>Guaranteed response and white-glove communication.</span>
                  </div>
                </div>
              </div>

              {/* Glowing CTA Button */}
              <div className="py-2 text-center space-y-1.5">
                <div
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-white transition-all shadow-md ${
                    isCtaPhase
                      ? 'bg-primary ring-4 ring-primary/30 animate-pulse'
                      : 'bg-primary hover:opacity-90'
                  }`}
                >
                  <span>{ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
                {profile.bookingLink && (
                  <p className="text-[10px] text-slate-400 truncate max-w-xs mx-auto">
                    Direct link: {profile.bookingLink}
                  </p>
                )}
              </div>

              {/* Sign-off */}
              <div className="pt-2 text-xs text-slate-700 space-y-0.5">
                <p>Best regards,</p>
                <p className="font-bold text-slate-900">{profile.senderName || 'The Team'}</p>
                <p className="text-slate-500">{profile.businessName}</p>
                {profile.phone && <p className="text-slate-500">{profile.phone}</p>}
              </div>

              {/* Locked Compliance Footer */}
              <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 space-y-1 text-center">
                <p>{profile.physicalAddress || '123 Business Way, Suite 100, City, ST 00000'}</p>
                <p>
                  You received this email because you are a client of {profile.businessName || 'our business'}.
                </p>
                <p className="text-slate-500">
                  <span className="underline cursor-pointer">Unsubscribe</span> ·{' '}
                  <span className="underline cursor-pointer">Manage Preferences</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
