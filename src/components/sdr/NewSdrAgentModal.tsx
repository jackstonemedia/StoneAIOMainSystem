/**
 * New Autonomous AI SDR Agent Wizard Modal
 *
 * 4-step interactive configuration:
 * 1. ICP Target (Niche, Location, Size)
 * 2. Value Proposition & Offer
 * 3. Sequence Cadence & Guardrails
 * 4. Mode Selection (Autopilot vs. Copilot)
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';
import {
  X, Target, Sparkles, Clock, ShieldCheck, ChevronRight,
  ChevronLeft, Check, Bot, Building2, MapPin, Calendar, Flame, Loader2
} from 'lucide-react';

interface NewSdrAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (agent: any) => void;
}

export function NewSdrAgentModal({ isOpen, onClose, onSuccess }: NewSdrAgentModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState('Outbound Growth SDR');
  const [niche, setNiche] = useState('Residential Plumbing & HVAC');
  const [location, setLocation] = useState('Austin, TX');
  const [companySize, setCompanySize] = useState('5-50 employees');
  const [targetTitles, setTargetTitles] = useState('Owner, Founder, VP Operations');
  const [valueProposition, setValueProposition] = useState('Automated customer lead capture and instant appointment booking');
  const [primaryOffer, setPrimaryOffer] = useState('15+ qualified local service leads per month on a pay-per-show model');
  const [calendarUrl, setCalendarUrl] = useState('https://calendar.stoneaio.com/growth-team');
  const [dailyLimit, setDailyLimit] = useState(35);
  const [mode, setMode] = useState<'COPILOT' | 'AUTOPILOT'>('COPILOT');

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        targetIcp: {
          niche,
          location,
          companySize,
          targetTitles: targetTitles.split(',').map(t => t.trim()).filter(Boolean),
        },
        valueProposition,
        primaryOffer,
        calendarUrl,
        mode,
        dailyLimit,
        sequenceConfig: {
          stepCount: 3,
          followUpDelayDays: [0, 3, 7],
          sendingWindow: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
          stopOnReply: true,
        },
      };

      const { data } = await apiClient.post('/sdr/agents', payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sdr', 'agents'] });
      toast('success', 'Autonomous SDR Deployed', `${name} is ready for prospecting.`);
      onSuccess?.(data);
      setStep(1);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Could not deploy SDR agent.';
      toast('error', 'Deployment Failed', msg);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-surface border border-border/80 rounded-3xl w-full max-w-2xl shadow-luxury overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between bg-surface-hover/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-sm">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-main">Deploy Autonomous AI SDR</h2>
              <p className="text-xs text-text-muted">Step {step} of 4 — {
                step === 1 ? 'Target ICP' :
                step === 2 ? 'Value Proposition & Offer' :
                step === 3 ? 'Cadence & Guardrails' : 'Autopilot Mode'
              }</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-hover transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-border/40 h-1">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Body Form */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main uppercase tracking-wider">Agent Identifier</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Austin HVAC Outbound SDR"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main font-medium focus:border-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-primary" /> Target Niche / Industry
                  </label>
                  <input
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    placeholder="e.g. Dental Clinics, Roofing, SaaS"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Geographic Target
                  </label>
                  <input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. Austin, TX or United States"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main">Company Size</label>
                  <input
                    value={companySize}
                    onChange={e => setCompanySize(e.target.value)}
                    placeholder="e.g. 1-10, 11-50 employees"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main">Decision Maker Job Titles</label>
                  <input
                    value={targetTitles}
                    onChange={e => setTargetTitles(e.target.value)}
                    placeholder="Owner, CEO, VP Marketing"
                    className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Core Value Proposition
                </label>
                <textarea
                  rows={2}
                  value={valueProposition}
                  onChange={e => setValueProposition(e.target.value)}
                  placeholder="What specific outcome or efficiency do you deliver for them?"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary resize-none"
                />
                <p className="text-[11px] text-text-muted">The AI will seamlessly weave this into bespoke icebreakers.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> Primary Call to Action / Pitch
                </label>
                <textarea
                  rows={2}
                  value={primaryOffer}
                  onChange={e => setPrimaryOffer(e.target.value)}
                  placeholder="e.g. Free 14-day pipeline audit, 15 qualified meetings guarantee"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-accent-green" /> Calendar Booking URL
                </label>
                <input
                  value={calendarUrl}
                  onChange={e => setCalendarUrl(e.target.value)}
                  placeholder="https://calendar.stoneaio.com/your-team"
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-main outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl bg-surface-hover/50 border border-border/60 space-y-3">
                <h4 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> Automated Sequence Timeline
                </h4>
                <div className="space-y-2 text-xs text-text-muted">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[11px] flex items-center justify-center">1</span>
                    <span><strong>Step 1 (Day 0)</strong>: Bespoke Website Icebreaker + Value Angle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-[11px] flex items-center justify-center">2</span>
                    <span><strong>Step 2 (Day 3)</strong>: Low-friction context bump</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center justify-center">3</span>
                    <span><strong>Step 3 (Day 7)</strong>: Respectful closing loop + Calendar URL</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-text-main">Daily Outreach Cap</label>
                  <span className="text-xs font-bold text-primary">{dailyLimit} emails / day</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={dailyLimit}
                  onChange={e => setDailyLimit(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-[11px] text-text-muted">Keeps domain reputation pristine with humanized sending jitter.</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-text-main">Select Operational Mode</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Copilot Card */}
                <div
                  onClick={() => setMode('COPILOT')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    mode === 'COPILOT'
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border/60 bg-surface hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Copilot (Recommended)
                    </span>
                    {mode === 'COPILOT' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    AI researches leads and writes 1-to-1 drafts, then queues them in your dashboard for <strong>1-click batch review</strong> before dispatching.
                  </p>
                </div>

                {/* Autopilot Card */}
                <div
                  onClick={() => setMode('AUTOPILOT')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    mode === 'AUTOPILOT'
                      ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                      : 'border-border/60 bg-surface hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                      <Bot className="w-4 h-4" /> Autopilot (Full Auto)
                    </span>
                    {mode === 'AUTOPILOT' && <Check className="w-4 h-4 text-purple-400" />}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Self-driving outreach. AI continuously finds prospects, drafts personalized emails, and dispatches them automatically on schedule.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-border/60 flex items-center justify-between bg-surface-hover/30">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main flex items-center gap-1.5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-interactive"
            >
              Next Step <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-interactive cursor-pointer"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Deploy Autonomous AI SDR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
