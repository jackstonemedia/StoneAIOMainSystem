/**
 * AI Campaign Copilot Modal — Email Marketing Module
 *
 * Structured 8-question marketing agency intake. The AI never skips ahead,
 * never assumes A/B testing, and shows a full week-by-week email preview
 * when the campaign plan is ready.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';
import {
  Sparkles, Bot, Send, User, CheckCircle2, Split,
  ShieldCheck, X, Loader2, RefreshCw,
  TrendingUp, Award, Layers, ChevronDown, ChevronUp, Mail, Clock,
  Wand2, ArrowRight
} from 'lucide-react';

export interface GeneratedCampaignPayload {
  campaignName?: string;
  strategySummary?: string;
  targetAudience?: string;
  abTest?: {
    enabled: boolean;
    hypothesis?: string | null;
    subjectA?: string | null;
    subjectB?: string | null;
    previewTextA?: string | null;
    previewTextB?: string | null;
    bodyHtmlA?: string | null;
    bodyHtmlB?: string | null;
  };
  dripSteps?: Array<{
    stepNumber: number;
    title?: string;
    subject: string;
    delayDays: number;
    delayHours: number;
    body: string;
    threadWithPrevious: boolean;
    stopOnReply?: boolean;
  }>;
  sequenceSummary?: {
    totalEmails: number;
    totalDays: number;
    stopCondition: string;
    maxEmailsIfNoReply: number;
  };
  deliverySettings?: {
    humanJitterEnabled?: boolean;
    sendingWindowEnabled?: boolean;
    startHour?: number;
    endHour?: number;
  };
}

interface AICampaignCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCampaign: (payload: GeneratedCampaignPayload) => void;
  currentDraft?: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  generatedCampaign?: GeneratedCampaignPayload;
}

// The 8 intake questions — used to show progress in the sidebar
const INTAKE_STEPS = [
  { id: 'q1', label: 'Goal & Offer', short: 'What are you promoting?' },
  { id: 'q2', label: 'Target Audience', short: 'Who is the ideal recipient?' },
  { id: 'q3', label: 'Tone & Style', short: 'Professional, casual, direct?' },
  { id: 'q4', label: 'Sequence Length', short: 'How many emails, how many days?' },
  { id: 'q5', label: 'Send Cadence', short: 'Gaps between each email' },
  { id: 'q6', label: 'Non-Responder Rules', short: 'When to stop following up' },
  { id: 'q7', label: 'A/B Split Testing', short: 'Test variants?' },
  { id: 'q8', label: 'CTA & Links', short: 'What action should they take?' },
];

// Render inline **bold** and *italic* markdown
function renderMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Collapsible email body preview for each drip step
function EmailBodyPreview({ body, subject }: { body: string; subject: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = body?.slice(0, 180).trim() + (body?.length > 180 ? '…' : '');

  return (
    <div className="mt-2 text-xs text-text-muted leading-relaxed">
      <div className="whitespace-pre-wrap">{expanded ? body : preview}</div>
      {body?.length > 180 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show full email</>}
        </button>
      )}
    </div>
  );
}

export function AICampaignCopilotModal({
  isOpen,
  onClose,
  onApplyCampaign,
  currentDraft,
}: AICampaignCopilotModalProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        "👋 Welcome to the **Campaign Strategy Studio**.\n\nI'm going to walk you through a quick 8-question intake — the same process a marketing agency would run — so I can build you a campaign that's tailored to your audience, offer, and goals.\n\nNo guessing, no assumptions. Just a focused discovery call.\n\nLet's start: **What is the goal of this campaign, and what are you promoting or offering?** (e.g., book demos, sell a product, drive event sign-ups, generate leads)",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  // Rough estimate of which intake step we're on, based on message count
  const [currentStep, setCurrentStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: insights } = useQuery({
    queryKey: ['email-marketing', 'ai-copilot-insights'],
    queryFn: () => apiClient.get('/email-marketing/ai-copilot/insights').then(r => r.data).catch(() => null),
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 120);
    }
  }, [isOpen, messages]);

  // Estimate intake progress based on user message count (each user reply ≈ one answered question)
  useEffect(() => {
    const userMsgCount = messages.filter(m => m.role === 'user').length;
    // Q1+Q2 answered after 1st reply, Q3 after 2nd, etc.
    setCurrentStep(Math.min(userMsgCount, INTAKE_STEPS.length));
  }, [messages]);

  if (!isOpen) return null;

  // ── API call with exponential-backoff retry on overload ──────────────────────
  const callCopilotApi = async (
    text: string,
    historyPayload: Array<{ role: string; content: string }>,
    retryCount = 0,
  ): Promise<{ reply: string; isComplete: boolean; generatedCampaign?: GeneratedCampaignPayload }> => {
    try {
      const res = await apiClient.post('/email-marketing/ai-copilot/chat', {
        message: text,
        chatHistory: historyPayload,
        currentDraft,
      });
      return res.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const isOverloaded =
        status === 503 ||
        status === 429 ||
        err?.response?.data?.retryable === true ||
        String(err?.response?.data?.error || err?.message || '').toLowerCase().includes('overload');

      if (isOverloaded && retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return callCopilotApi(text, historyPayload, retryCount + 1);
      }
      throw err;
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputPrompt('');
    setIsLoading(true);
    setLastUserMessage(text);

    try {
      const historyPayload = nextMessages.slice(1).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const data = await callCopilotApi(text, historyPayload);

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'model',
          content: data?.reply || 'Got it — let me continue.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          generatedCampaign: data?.generatedCampaign,
        },
      ]);
    } catch (err: any) {
      const errText = String(err?.response?.data?.error || err?.message || '').toLowerCase();
      const isOverloaded = errText.includes('overload') || errText.includes('quota') || errText.includes('rate');
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'model',
          content: isOverloaded
            ? '⚠️ The AI engine is briefly overloaded. Click **Retry** below to try again.'
            : '⚠️ I encountered an error. Click **Retry** below or try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (!lastUserMessage || isLoading) return;
    setMessages(prev => {
      const last = prev[prev.length - 1];
      return last?.role === 'model' && last.content.includes('⚠️') ? prev.slice(0, -1) : prev;
    });
    setTimeout(() => handleSendMessage(lastUserMessage), 100);
  };

  const handleApply = (campaign: GeneratedCampaignPayload) => {
    onApplyCampaign(campaign);
    toast('success', 'Campaign Applied', 'Your tailored campaign has been loaded into the builder.');
    onClose();
  };

  const isCampaignComplete = messages.some(m => m.generatedCampaign);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="flex w-full max-w-5xl h-[90vh] max-h-[860px] rounded-2xl border shadow-2xl overflow-hidden animate-scale-in"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
      >
        {/* ── LEFT: Intake Progress Sidebar ─────────────────────────────────────── */}
        <div
          className="w-56 shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
        >
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary/40 to-purple-500/30 border border-primary/30 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-bold text-text-main">Intake</span>
            </div>
            <p className="text-[11px] text-text-muted leading-snug">
              {isCampaignComplete
                ? '✅ All questions answered — campaign ready!'
                : `Step ${Math.min(currentStep + 1, 8)} of 8`}
            </p>
          </div>

          <div className="flex-1 p-3 space-y-1">
            {INTAKE_STEPS.map((step, idx) => {
              const done = idx < currentStep;
              const active = idx === currentStep && !isCampaignComplete;
              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors ${
                    active ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                >
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : active
                        ? 'bg-primary border-primary text-white'
                        : 'bg-transparent border-border text-text-muted'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div>
                    <div className={`text-[12px] font-semibold ${active ? 'text-primary' : done ? 'text-text-main' : 'text-text-muted'}`}>
                      {step.label}
                    </div>
                    <div className="text-[10px] text-text-muted leading-tight">{step.short}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historical analytics pill */}
          {insights && insights.totalCampaignsSent > 0 && (
            <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-primary" /> Workspace Data
              </div>
              <div className="space-y-1 text-[11px] text-text-muted">
                <div>Avg Open <strong className="text-text-main">{((insights.avgOpenRate || 0) * 100).toFixed(1)}%</strong></div>
                <div>Avg CTR <strong className="text-text-main">{((insights.avgClickRate || 0) * 100).toFixed(1)}%</strong></div>
                <div>{insights.totalCampaignsSent} campaigns analyzed</div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-primary font-semibold">
                <Award className="w-3 h-3" /> AI uses your data
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Chat Area ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-text-main">Campaign Strategy Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Marketing Consultant
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                8-question agency-style intake → tailored campaign plan
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message bubble */}
                  <div
                    className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-none ml-auto'
                        : 'bg-surface-hover/80 border border-border/60 text-text-main rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
                    <div className={`text-[10px] mt-1.5 text-right ${msg.role === 'user' ? 'text-white/70' : 'text-text-muted'}`}>
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Retry button */}
                  {msg.role === 'model' && msg.content.includes('⚠️') && lastUserMessage && (
                    <button
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {isLoading ? 'Retrying…' : 'Retry'}
                    </button>
                  )}

                  {/* Generated campaign plan card */}
                  {msg.generatedCampaign && (
                    <CampaignPlanCard
                      campaign={msg.generatedCampaign}
                      onApply={handleApply}
                      onRefine={(promptText) => {
                        setInputPrompt(promptText);
                        inputRef.current?.focus();
                      }}
                    />
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 items-center text-text-muted text-xs p-3 bg-surface-hover/40 rounded-xl w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Strategist is thinking…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="p-4 border-t shrink-0 flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isCampaignComplete
                  ? 'Campaign ready — ask a follow-up or close this window…'
                  : 'Type your answer and press Enter…'
              }
              className="flex-1 px-4 py-2.5 bg-surface-hover border border-border/80 rounded-xl text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-all shadow-inner"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Plan Card ───────────────────────────────────────────────────────

function CampaignPlanCard({
  campaign,
  onApply,
  onRefine,
}: {
  campaign: GeneratedCampaignPayload;
  onApply: (c: GeneratedCampaignPayload) => void;
  onRefine: (suggestion: string) => void;
}) {
  const hasAB = campaign.abTest?.enabled && campaign.abTest?.subjectA;
  const steps = campaign.dripSteps || [];
  const summary = campaign.sequenceSummary;

  const refinementSuggestions = [
    'Make the tone more direct and concise',
    'Add an A/B test variant for Email 1',
    'Space the follow-up emails 3 days apart',
    'Shorten the sequence to 3 emails',
    'Include a stronger call-to-action with urgency',
  ];

  return (
    <div className="rounded-2xl border border-primary/40 bg-surface shadow-2xl overflow-hidden animate-scale-in">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Campaign Plan Ready
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready to Review
            </span>
          </div>
          <h4 className="text-base font-bold text-text-main">{campaign.campaignName || 'Multi-Step Outreach'}</h4>
          {campaign.targetAudience && (
            <p className="text-[11px] text-text-muted mt-0.5">Target: {campaign.targetAudience}</p>
          )}
        </div>

        {/* Action Buttons Top */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefine("I'd like to make some changes to this campaign plan: ")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border/80 bg-surface-hover/80 hover:bg-surface-hover text-text-main transition-all shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Make Changes</span>
          </button>

          <button
            onClick={() => onApply(campaign)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-interactive transition-all shrink-0 cursor-pointer"
          >
            <span>Continue with Campaign</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Strategy summary */}
        {campaign.strategySummary && (
          <p className="text-xs text-text-muted italic bg-surface-hover/50 p-3.5 rounded-xl border border-border/30 leading-relaxed">
            "{campaign.strategySummary}"
          </p>
        )}

        {/* Sequence stats row */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Emails', value: summary.totalEmails },
              { label: 'Sequence Duration', value: `${summary.totalDays} Days` },
              { label: 'Stop on Reply', value: summary.stopCondition || 'Active' },
            ].map(s => (
              <div key={s.label} className="bg-surface-hover/60 border border-border/30 rounded-xl p-3 text-center">
                <div className="text-base font-bold text-primary">{s.value}</div>
                <div className="text-[10px] text-text-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* A/B test section */}
        {hasAB && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Split className="w-3 h-3 text-amber-400" /> A/B Split Test
              {campaign.abTest?.hypothesis && (
                <span className="text-[10px] text-text-muted font-normal normal-case">— {campaign.abTest.hypothesis}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1.5">
                <span className="text-[10px] font-bold text-blue-400 uppercase">Variant A (Control)</span>
                <div className="font-semibold text-text-main">{campaign.abTest!.subjectA}</div>
                {campaign.abTest!.previewTextA && (
                  <div className="text-text-muted text-[11px]">{campaign.abTest!.previewTextA}</div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1.5">
                <span className="text-[10px] font-bold text-purple-400 uppercase">Variant B (Challenger)</span>
                <div className="font-semibold text-text-main">{campaign.abTest!.subjectB}</div>
                {campaign.abTest!.previewTextB && (
                  <div className="text-text-muted text-[11px]">{campaign.abTest!.previewTextB}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Week-by-week email preview */}
        {steps.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-primary" />
                Email Sequence Preview ({steps.length} emails)
              </div>
              <span className="text-[11px] text-text-muted">You can customize all copy in the builder</span>
            </div>
            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border/50 bg-surface-hover/30 overflow-hidden"
                >
                  {/* Step header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 bg-surface-hover/50">
                    <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      {step.stepNumber || idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-bold text-text-main truncate">{step.title || `Email ${idx + 1}`}</span>
                        <span className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {idx === 0 ? 'Sends immediately on launch' : `+${step.delayDays} day${step.delayDays !== 1 ? 's' : ''} after previous`}
                        </span>
                        {step.stopOnReply !== false && (
                          <span className="text-[10px] text-emerald-400 font-medium shrink-0">✓ Stops on reply</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="text-[11px] font-semibold text-text-main truncate">{step.subject}</span>
                      </div>
                    </div>
                  </div>
                  {/* Email body preview */}
                  {step.body && (
                    <div className="px-4 py-3">
                      <EmailBodyPreview body={step.body} subject={step.subject} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliverability badge */}
        <div className="flex items-center gap-2.5 text-[11px] text-text-muted bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Includes human jitter, sending window restriction, personalization tokens & RFC 8058 one-click unsubscribe.</span>
        </div>

        {/* Quick refinement suggestions chips */}
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="text-[11px] font-bold text-text-muted flex items-center gap-1.5">
            <Wand2 className="w-3 h-3 text-purple-400" />
            <span>Need adjustments? Ask the AI strategist or pick a refinement:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {refinementSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onRefine(suggestion)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-surface-hover hover:bg-primary/10 border border-border/60 hover:border-primary/30 text-text-muted hover:text-primary transition-all text-left"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom CTA Action Bar */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3 bg-surface-hover/30 -mx-5 -mb-5 p-4">
          <div className="text-xs text-text-muted">
            Ready to edit the emails and schedule your campaign?
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefine("Please revise the sequence with the following changes: ")}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            >
              Make Changes
            </button>
            <button
              onClick={() => onApply(campaign)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-interactive transition-all cursor-pointer"
            >
              <span>Continue to Campaign Builder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

