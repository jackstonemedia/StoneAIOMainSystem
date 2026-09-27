/**
 * Email Campaign Composer — Email Marketing Module
 *
 * Full-featured campaign builder supporting:
 * 1. Single Broadcasts & Multi-Step Drip Sequences
 * 2. Complete A/B Split Testing (Subject, Body, Sender, Split Ratio, Auto-Rollout)
 * 3. Side-by-Side & Mobile/Desktop Live Personalized Previews
 * 4. Delivery Throttling / Drip Feeding
 * 5. Dynamic Merge Tag Variables & AI Drafting Assistant
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import {
  Send, Save, Eye, ChevronLeft, Loader2,
  CheckCircle2, Users, AlertCircle, X, Calendar, Sparkles, Wand2, RefreshCw,
  Clock, Plus, Trash2, Sliders, Smartphone, Monitor, Mail, Layers,
  Flame, Rocket, Check, ArrowRight, ShieldCheck, HelpCircle, MousePointer,
  Split, GitCompare, Crown, Zap, BarChart2
} from 'lucide-react';
import { useAI } from '../../lib/useAI';
import { ABTestConfig } from '../../types/emailCampaign';
import { AICampaignCopilotModal, type GeneratedCampaignPayload } from '../../components/email-marketing/AICampaignCopilotModal';
import { EmailBuilderCanvas } from '../../components/email-marketing/EmailBuilderCanvas';
import {
  analyzeEmailDeliverability,
  type SpamCheckResult,
  type DeliveryThrottleSettings,
  DEFAULT_DELIVERY_SETTINGS,
} from '../../lib/emailDeliverabilityUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DripStep {
  id: string;
  stepNumber: number;
  subject: string;
  delayDays: number;
  delayHours: number;
  body: string;
  threadWithPrevious: boolean;
  stopOnReply?: boolean;
}

export interface ThrottleConfig {
  enabled: boolean;
  rateLimit: number;
  unit: 'hour' | 'day';
  daysOfWeek: number[];
  startHour: string;
  endHour: string;
}

export interface SenderConfig {
  fromName: string;
  replyTo: string;
}

// ── Pre-built Sequence Templates ──────────────────────────────────────────────

const SEQUENCE_TEMPLATES: {
  id: string;
  title: string;
  description: string;
  tag: string;
  steps: Array<{
    subject: string;
    delayDays: number;
    delayHours: number;
    body: string;
    threadWithPrevious: boolean;
  }>;
}[] = [
  {
    id: 'cold-outreach-3',
    title: 'Cold Outreach Pitch (3 Steps)',
    description: 'Proven 3-step sequence: Value Hook → Case Study / Social Proof → Breakup / Closing File.',
    tag: 'Cold Outreach',
    steps: [
      {
        subject: 'Quick question regarding {{business_name}}',
        delayDays: 0,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nI noticed {{business_name}} has been expanding lately. Are you currently looking for ways to streamline operations and drive higher conversion rates from your inbound leads?\n\nWe helped similar teams boost qualified pipeline by over 35% in under 60 days.\n\nWould you be open to a brief 5-minute chat this Thursday at 2:00 PM to see how this could look for {{business_name}}?\n\nBest regards,\n{{name}}`,
        threadWithPrevious: false,
      },
      {
        subject: 'Re: Quick question regarding {{business_name}}',
        delayDays: 2,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nFollowing up on my previous note. I wanted to share a quick 1-page case study of how we recently helped a partner achieve a 3.4x ROI within their first quarter.\n\nDo you have 10 minutes next Tuesday or Wednesday to explore if this is relevant for {{business_name}}?\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
      {
        subject: 'Permission to close your file at {{business_name}}?',
        delayDays: 4,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nI haven't heard back, so I assume improving your workflow isn't a priority right now.\n\nShould I close your file for now, or is this something you'd like to revisit next quarter?\n\nEither way, wishing you and {{business_name}} continued success!\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
    ],
  },
  {
    id: 'lead-onboarding-4',
    title: 'New Lead Onboarding (4 Steps)',
    description: 'Nurture new leads from sign-up to discovery call booking.',
    tag: 'Lead Nurture',
    steps: [
      {
        subject: 'Welcome to Stone AIO, {{first_name}}! Here is your quick start guide',
        delayDays: 0,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nWelcome aboard! We are thrilled to partner with {{business_name}}.\n\nHere are 3 quick things you can set up right now:\n1. Connect your Gmail or Outlook inbox\n2. Import your existing contacts or create a Smart List\n3. Launch your first outreach campaign\n\nIf you ever have questions, simply reply to this email!\n\nCheers,\n{{name}}`,
        threadWithPrevious: false,
      },
      {
        subject: 'Pro tip for {{business_name}}: 3 features our top users love',
        delayDays: 1,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nHope you're having a great week! Did you know you can automate lead routing and set up automated follow-ups in seconds?\n\nCheck out your dashboard whenever you have a moment, or reply here if you'd like a guided walkthrough.\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
      {
        subject: 'How {{business_name}} can save 10+ hours every week',
        delayDays: 3,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nMost teams spend 15+ hours a week on manual data entry and follow-ups. Our automated workflows eliminate 90% of that friction.\n\nWould you like to hop on a 15-minute strategy session to tailor your setup?\n\nLet me know what time works best!\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
      {
        subject: 'Let’s get you scheduled: 1-on-1 strategy call for {{business_name}}',
        delayDays: 5,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nJust wanted to ensure you're getting maximum value from Stone AIO. Let's schedule a dedicated strategy call to review your pipeline.\n\nGrab any slot that works for you on our calendar: https://example.com/schedule\n\nLooking forward to speaking,\n{{name}}`,
        threadWithPrevious: true,
      },
    ],
  },
  {
    id: 'webinar-nurture-3',
    title: 'Event / Webinar Nurture (3 Steps)',
    description: 'Confirmation, 24-hour reminder, and post-event replay delivery.',
    tag: 'Events & Webinars',
    steps: [
      {
        subject: 'You are registered: Live Masterclass Confirmation',
        delayDays: 0,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nYour spot is reserved for our upcoming Live Masterclass! We will be sharing actionable frameworks for accelerating revenue.\n\nAdd this to your calendar and bring any questions about {{business_name}} to the live Q&A.\n\nSee you there,\n{{name}}`,
        threadWithPrevious: false,
      },
      {
        subject: 'Starting tomorrow: Live Masterclass Checklist',
        delayDays: 1,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nQuick reminder that our Live Masterclass kicks off tomorrow. We have prepared an exclusive resource kit for attendees.\n\nMake sure to join 5 minutes early to secure your spot.\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
      {
        subject: 'Recording & Resource Deck from yesterday’s session',
        delayDays: 2,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nThank you for joining our session! Here is the full replay recording and resource deck for you and your team at {{business_name}}.\n\nIf you have any questions, feel free to reply directly.\n\nWarm regards,\n{{name}}`,
        threadWithPrevious: true,
      },
    ],
  },
  {
    id: 'winback-2',
    title: 'Win-Back / Re-Engagement (2 Steps)',
    description: 'Re-ignite inactive leads with a compelling special offer.',
    tag: 'Re-engagement',
    steps: [
      {
        subject: 'Are you still looking for solutions for {{business_name}}?',
        delayDays: 0,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nIt has been a little while since we last connected. Are you still exploring ways to optimize operations at {{business_name}}?\n\nWe recently rolled out major performance upgrades and would love to show you what is new.\n\nBest,\n{{name}}`,
        threadWithPrevious: false,
      },
      {
        subject: 'Special offer for {{business_name}} (Expires this Friday)',
        delayDays: 3,
        delayHours: 0,
        body: `Hi {{first_name}},\n\nTo help you get started, we are offering an exclusive 25% discount on all plans if you activate your account by this Friday.\n\nReply to this email or click here to claim your offer.\n\nBest,\n{{name}}`,
        threadWithPrevious: true,
      },
    ],
  },
];

// ── Merge Tags ────────────────────────────────────────────────────────────────

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{first_name}}' },
  { label: 'Last Name', tag: '{{last_name}}' },
  { label: 'Full Name', tag: '{{name}}' },
  { label: 'Business Name', tag: '{{business_name}}' },
  { label: 'Email', tag: '{{email}}' },
  { label: 'Phone', tag: '{{phone}}' },
];

// ── API Fetchers ──────────────────────────────────────────────────────────────

async function fetchCampaign(id: string) {
  const { data } = await apiClient.get(`/email-marketing/campaigns/${id}`);
  return data;
}

async function fetchLists() {
  const { data } = await apiClient.get('/email-marketing/lists');
  return data;
}

async function fetchSegments() {
  const { data } = await apiClient.get('/email-marketing/segments');
  return data;
}

async function fetchSmartLists() {
  const { data } = await apiClient.get('/crm/smart-lists');
  return data;
}

async function saveCampaign(id: string, payload: Record<string, any>) {
  await apiClient.patch(`/email-marketing/campaigns/${id}`, payload);
}

async function createCampaign(payload: Record<string, any>) {
  const { data } = await apiClient.post('/email-marketing/campaigns', payload);
  return data;
}

function formatPlainContentToHtml(text: string): string {
  if (!text.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n\n+/)
    .map(para => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${para.trim().replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export default function CampaignBuilder() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isNew = !campaignId || campaignId === 'new';

  // ── Mode & Settings State ───────────────────────────────────────────────────
  const [campaignType, setCampaignType] = useState<'broadcast' | 'drip'>('broadcast');
  const [name, setName] = useState('New Campaign');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Single Broadcast State (Variant A)
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [previewTextA, setPreviewTextA] = useState('');

  // A/B Split Testing State
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A');
  const [previewVariant, setPreviewVariant] = useState<'A' | 'B' | 'side-by-side'>('A');
  const [testEmailVariant, setTestEmailVariant] = useState<'A' | 'B' | 'both'>('A');
  const [showABSettingsModal, setShowABSettingsModal] = useState(false);
  const [isGeneratingAIVariant, setIsGeneratingAIVariant] = useState(false);

  // Variant B Specific State
  const [subjectB, setSubjectB] = useState('');
  const [bodyHtmlB, setBodyHtmlB] = useState('');
  const [fromNameB, setFromNameB] = useState('');
  const [previewTextB, setPreviewTextB] = useState('');

  // A/B Configuration Parameters
  const [abSplitPct, setAbSplitPct] = useState<number>(50);
  const [abWinnerMetric, setAbWinnerMetric] = useState<'open_rate' | 'click_rate'>('open_rate');
  const [abEvalHours, setAbEvalHours] = useState<number>(24);
  const [abAutoRollout, setAbAutoRollout] = useState<boolean>(true);

  // Multi-Step Drip Sequence State
  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    {
      id: 'step-1',
      stepNumber: 1,
      subject: '',
      delayDays: 0,
      delayHours: 0,
      body: '',
      threadWithPrevious: false,
      stopOnReply: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      subject: 'Re: {{subject}}',
      delayDays: 2,
      delayHours: 0,
      body: '',
      threadWithPrevious: true,
      stopOnReply: true,
    },
  ]);

  // Delivery Throttling (Drip Rate Limiting)
  const [throttle, setThrottle] = useState<ThrottleConfig>({
    enabled: false,
    rateLimit: 25,
    unit: 'hour',
    daysOfWeek: [1, 2, 3, 4, 5],
    startHour: '09:00',
    endHour: '17:00',
  });

  // Sender Settings
  const [sender, setSender] = useState<SenderConfig>({
    fromName: '',
    replyTo: '',
  });

  // Tracking Settings (Open & Click Tracking)
  const [tracking, setTracking] = useState<{ clicks: boolean; opens: boolean }>({
    clicks: true,
    opens: true,
  });

  // Audience Target State
  const [audienceType, setAudienceType] = useState<'list' | 'smartList' | 'segment'>('smartList');
  const [listId, setListId] = useState<string>('');
  const [segmentId, setSegmentId] = useState<string>('');
  const [smartListId, setSmartListId] = useState<string>('');

  // UI View Modes & Modals
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHtmlA, setPreviewHtmlA] = useState<string>('');
  const [previewHtmlB, setPreviewHtmlB] = useState<string>('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Send & Schedule Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTiming, setSendTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [isSendingOrScheduling, setIsSendingOrScheduling] = useState(false);

  // AI Writer
  const { generateEmail, improveEmail, generateSubjectLines, isLoading: aiLoading } = useAI();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSubjects, setAiSubjects] = useState<string[]>([]);
  const [aiInstruction, setAiInstruction] = useState('');

  const activeTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['email-marketing', 'campaigns', campaignId],
    queryFn: () => fetchCampaign(campaignId!),
    enabled: !isNew,
  });

  const { data: lists = [] } = useQuery({ queryKey: ['email-marketing', 'lists'], queryFn: fetchLists });
  const { data: segments = [] } = useQuery({ queryKey: ['email-marketing', 'segments'], queryFn: fetchSegments });
  const { data: smartLists = [] } = useQuery({ queryKey: ['crm', 'smart-lists'], queryFn: fetchSmartLists });

  // Pre-fill smartListId from query params
  useEffect(() => {
    const qSmartList = searchParams.get('smartListId');
    if (qSmartList) {
      setSmartListId(qSmartList);
      setAudienceType('smartList');
    }
  }, [searchParams]);

  // Load existing campaign data
  useEffect(() => {
    if (campaign) {
      setName(campaign.name || 'Untitled Campaign');
      setSubject(campaign.subject || '');

      const bj = campaign.blockJson as any;
      if (bj) {
        if ((bj.campaignType === 'drip' || bj.type === 'drip' || (Array.isArray(bj.dripSteps) && bj.dripSteps.length > 0))) {
          setCampaignType('drip');
          const loadedSteps = (bj.dripSteps || []).map((st: any, idx: number) => ({
            id: st.id || `step-${idx + 1}-${Date.now()}`,
            stepNumber: st.stepNumber || idx + 1,
            subject: st.subject || st.title || (idx === 0 ? campaign.subject : `Follow-up #${idx}`),
            delayDays: typeof st.delayDays === 'number' ? st.delayDays : (idx === 0 ? 0 : 2),
            delayHours: typeof st.delayHours === 'number' ? st.delayHours : 0,
            body: st.body || st.bodyHtml || st.html || st.content || st.text || (idx === 0 ? (bj.html || bj.bodyHtml || '') : ''),
            threadWithPrevious: st.threadWithPrevious ?? (idx > 0),
            stopOnReply: st.stopOnReply ?? true,
          }));
          const finalSteps = loadedSteps.length > 0 ? loadedSteps : [{
            id: 'step-1',
            stepNumber: 1,
            subject: campaign.subject || '',
            delayDays: 0,
            delayHours: 0,
            body: bj.html || bj.bodyHtml || '',
            threadWithPrevious: false,
            stopOnReply: true,
          }];
          setDripSteps(finalSteps);
          setActiveStepIndex(0);
          if (finalSteps[0]?.body) {
            setBodyHtml(finalSteps[0].body);
          }
        } else if (bj.html || bj.bodyHtml) {
          setCampaignType('broadcast');
          setBodyHtml(bj.html || bj.bodyHtml);
        } else if (typeof bj === 'string') {
          setCampaignType('broadcast');
          setBodyHtml(bj);
        }

        if (bj.deliverySettings) {
          setDeliverySettings(prev => ({ ...prev, ...bj.deliverySettings }));
        }

        if (bj.throttle) {
          setThrottle({ ...throttle, ...bj.throttle });
        }
        if (bj.sender) {
          setSender({ ...sender, ...bj.sender });
        }
        if (bj.tracking) {
          setTracking({
            clicks: bj.tracking.clicks !== false,
            opens: bj.tracking.opens !== false,
          });
        }
      }

      if (campaign.abTestConfig && (campaign.abTestConfig as any).enabled) {
        const ab = campaign.abTestConfig as any;
        setAbTestEnabled(true);
        setSubjectB(ab.subjectB || '');
        setBodyHtmlB(ab.bodyHtmlB || '');
        setFromNameB(ab.fromNameB || '');
        setPreviewTextA(ab.previewTextA || '');
        setPreviewTextB(ab.previewTextB || '');
        setAbSplitPct(ab.splitPercentage ?? ab.testPercentage ?? 50);
        setAbWinnerMetric(ab.winnerMetric || 'open_rate');
        setAbEvalHours(ab.autoSelectAfterHours || ab.evaluationHours || 24);
        setAbAutoRollout(ab.autoRollout !== false);
      }

      if (campaign.smartListId) {
        setAudienceType('smartList');
        setSmartListId(campaign.smartListId);
      } else if (campaign.segmentId) {
        setAudienceType('segment');
        setSegmentId(campaign.segmentId);
      } else if (campaign.listId) {
        setAudienceType('list');
        setListId(campaign.listId);
      }
    }
  }, [campaign]);

  // Default select first available smart list
  useEffect(() => {
    if (smartLists.length > 0 && !smartListId && !listId && !segmentId) {
      setSmartListId(smartLists[0].id);
      setAudienceType('smartList');
    }
  }, [smartLists, smartListId, listId, segmentId]);

  // ── Drip Sequence Step Handlers ─────────────────────────────────────────────

  const handleAddDripStep = () => {
    const nextNum = dripSteps.length + 1;
    const newStep: DripStep = {
      id: `step-${Date.now()}`,
      stepNumber: nextNum,
      subject: `Re: ${subject || 'Quick follow-up'}`,
      delayDays: 3,
      delayHours: 0,
      body: `Hi {{first_name}},\n\nWanted to quickly follow up on my previous note. Do you have a few minutes this week to connect?\n\nBest,\n{{name}}`,
      threadWithPrevious: true,
      stopOnReply: true,
    };
    setDripSteps([...dripSteps, newStep]);
    setActiveStepIndex(dripSteps.length);
  };

  const handleRemoveDripStep = (indexToRemove: number) => {
    if (dripSteps.length <= 1) {
      toast('warning', 'Minimum Step Required', 'A drip sequence must have at least 1 step.');
      return;
    }
    const updated = dripSteps
      .filter((_, idx) => idx !== indexToRemove)
      .map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setDripSteps(updated);
    if (activeStepIndex >= updated.length) {
      setActiveStepIndex(updated.length - 1);
    }
  };

  const handleMoveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= dripSteps.length) return;
    const next = [...dripSteps];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    const reindexed = next.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setDripSteps(reindexed);
    setActiveStepIndex(toIndex);
  };

  const cumulativeDays = React.useMemo(() => {
    let total = 0;
    return dripSteps.map((step, idx) => {
      if (idx === 0) return 0;
      total += (step.delayDays || 0);
      return total;
    });
  }, [dripSteps]);

  const totalSequenceDays = cumulativeDays[cumulativeDays.length - 1] || 0;

  const updateActiveStep = (fields: Partial<DripStep>) => {
    setDripSteps(prev =>
      prev.map((step, idx) => (idx === activeStepIndex ? { ...step, ...fields } : step))
    );
  };

  const applyTemplate = (tpl: typeof SEQUENCE_TEMPLATES[0]) => {
    setCampaignType('drip');
    setName(tpl.title);
    setSubject(tpl.steps[0].subject);
    const newSteps: DripStep[] = tpl.steps.map((st, idx) => ({
      id: `step-${idx + 1}-${Date.now()}`,
      stepNumber: idx + 1,
      subject: st.subject,
      delayDays: st.delayDays,
      delayHours: st.delayHours,
      body: st.body,
      threadWithPrevious: st.threadWithPrevious,
      stopOnReply: true,
    }));
    setDripSteps(newSteps);
    setActiveStepIndex(0);
    setShowTemplateModal(false);
    toast('success', 'Template Applied', `Loaded "${tpl.title}" with ${newSteps.length} automated steps.`);
  };

  // ── Variable Inserter ───────────────────────────────────────────────────────

  const insertVariable = (varTag: string) => {
    if (abTestEnabled && activeVariant === 'B') {
      setBodyHtmlB(prev => prev + ' ' + varTag);
    } else if (campaignType === 'drip') {
      const currentBody = dripSteps[activeStepIndex]?.body || '';
      updateActiveStep({ body: currentBody + ' ' + varTag });
    } else {
      setBodyHtml(prev => prev + ' ' + varTag);
    }
  };

  // ── AI Variant B Generator ──────────────────────────────────────────────────

  const handleGenerateAIVariantB = async () => {
    try {
      setIsGeneratingAIVariant(true);
      const currentSubj = subject || 'Exclusive Announcement';
      const currentBody = bodyHtml || 'Hi {{first_name}},\n\nWe have exciting updates for you.';

      const generatedSubjects = await generateSubjectLines(currentSubj);
      if (generatedSubjects && generatedSubjects.length > 0) {
        setSubjectB(generatedSubjects[0]);
      } else {
        setSubjectB(`🔥 ${currentSubj}`);
      }

      const generatedBody = await improveEmail(
        currentBody,
        'Make this alternative version punchier, more direct, and conversion focused for an A/B test variation.'
      );
      if (generatedBody) {
        setBodyHtmlB(generatedBody);
      }

      setActiveVariant('B');
      setPreviewVariant('B');
      toast('success', 'Variant B Created with AI', 'Generated alternative subject line and persuasive body copy for Variant B.');
    } catch (err: any) {
      toast('error', 'AI Generation Error', 'Could not generate variant with AI.');
    } finally {
      setIsGeneratingAIVariant(false);
    }
  };

  // ── Live Preview Generator ──────────────────────────────────────────────────

  const activeSubjectA = campaignType === 'drip' ? (dripSteps[activeStepIndex]?.subject || subject) : subject;
  const activeBodyA = campaignType === 'drip' ? (dripSteps[activeStepIndex]?.body || '') : bodyHtml;

  const activeSubjectB = subjectB || `Alternative: ${activeSubjectA}`;
  const activeBodyB = bodyHtmlB || activeBodyA;

  // ── Deliverability & AI Copilot State ───────────────────────────────────────
  const [showDeliverabilityModal, setShowDeliverabilityModal] = useState(false);
  const [showAICopilotModal, setShowAICopilotModal] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliveryThrottleSettings>(DEFAULT_DELIVERY_SETTINGS);

  const spamReport: SpamCheckResult = React.useMemo(() => {
    return analyzeEmailDeliverability(activeSubjectA, activeBodyA);
  }, [activeSubjectA, activeBodyA]);

  const handleApplyAICampaign = (payload: GeneratedCampaignPayload) => {
    if (payload.campaignName) setName(payload.campaignName);

    if (Array.isArray(payload.dripSteps) && payload.dripSteps.length > 0) {
      setCampaignType('drip');
      const formattedSteps: DripStep[] = payload.dripSteps.map((st: any, idx: number) => ({
        id: st.id || `step-${idx + 1}-${Date.now()}`,
        stepNumber: st.stepNumber || idx + 1,
        subject: st.subject || st.title || `Email ${idx + 1}`,
        delayDays: typeof st.delayDays === 'number' ? st.delayDays : (idx === 0 ? 0 : 2),
        delayHours: typeof st.delayHours === 'number' ? st.delayHours : 0,
        body: st.body || st.bodyHtml || st.html || st.content || st.text || '',
        threadWithPrevious: st.threadWithPrevious ?? (idx > 0),
        stopOnReply: st.stopOnReply ?? true,
      }));
      setDripSteps(formattedSteps);
      setActiveStepIndex(0);
      if (formattedSteps[0]?.subject) {
        setSubject(formattedSteps[0].subject);
      }
      if (formattedSteps[0]?.body) {
        setBodyHtml(formattedSteps[0].body);
      }
    }

    if (payload.abTest?.enabled) {
      setAbTestEnabled(true);
      if (payload.abTest.subjectA) setSubject(payload.abTest.subjectA);
      if (payload.abTest.subjectB) setSubjectB(payload.abTest.subjectB);
      if (payload.abTest.bodyHtmlA) setBodyHtml(payload.abTest.bodyHtmlA);
      if (payload.abTest.bodyHtmlB) setBodyHtmlB(payload.abTest.bodyHtmlB);
      if (payload.abTest.previewTextA) setPreviewTextA(payload.abTest.previewTextA);
      if (payload.abTest.previewTextB) setPreviewTextB(payload.abTest.previewTextB);
    } else if (!Array.isArray(payload.dripSteps) || payload.dripSteps.length === 0) {
      setCampaignType('broadcast');
      if ((payload as any).subject) setSubject((payload as any).subject);
      if ((payload as any).body || (payload as any).bodyHtml) {
        setBodyHtml((payload as any).body || (payload as any).bodyHtml);
      }
    }

    if (payload.deliverySettings) {
      setDeliverySettings(prev => ({
        ...prev,
        ...payload.deliverySettings,
      }));
    }
  };

  useEffect(() => {
    const unsubUrl = '#';
    const sampleFirstName = 'John';
    const sampleLastName = 'Doe';
    const sampleFullName = 'John Doe';
    const sampleEmail = 'john.doe@example.com';
    const sampleBusiness = 'Acme Corp';
    const samplePhone = '+1 (555) 234-5678';

    const compileHtml = (bodyText: string, fromAuthor: string) => {
      const htmlToRender = formatPlainContentToHtml(bodyText);
      const interpolated = htmlToRender
        .replace(/\{\{first_name\}\}/gi, sampleFirstName)
        .replace(/\{\{firstName\}\}/gi, sampleFirstName)
        .replace(/\{\{last_name\}\}/gi, sampleLastName)
        .replace(/\{\{lastName\}\}/gi, sampleLastName)
        .replace(/\{\{name\}\}/gi, sampleFullName)
        .replace(/\{\{full_name\}\}/gi, sampleFullName)
        .replace(/\{\{email\}\}/gi, sampleEmail)
        .replace(/\{\{business_name\}\}/gi, sampleBusiness)
        .replace(/\{\{businessName\}\}/gi, sampleBusiness)
        .replace(/\{\{company\}\}/gi, sampleBusiness)
        .replace(/\{\{phone\}\}/gi, samplePhone);

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; margin: 0; padding: 24px; background-color: #ffffff; }
    a { color: #52677d; text-decoration: underline; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  ${interpolated || '<p style="color: #9ca3af; font-style: italic;">Start typing your email message on the left to see the live preview...</p>'}
  <div class="footer">
    <p>Sent via ${fromAuthor || 'Stone AIO'} · 123 Business St, Suite 100</p>
    <p><a href="${unsubUrl}">Unsubscribe from future emails</a></p>
  </div>
</body>
</html>`;
    };

    setPreviewHtmlA(compileHtml(activeBodyA, sender.fromName));
    setPreviewHtmlB(compileHtml(activeBodyB, fromNameB || sender.fromName));
  }, [activeBodyA, activeBodyB, sender.fromName, fromNameB]);

  // ── Save / Update Mutation ──────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const primarySubject = campaignType === 'drip' ? (dripSteps[0]?.subject || subject || name) : subject;
      const formattedHtmlA = campaignType === 'drip' ? formatPlainContentToHtml(dripSteps[0]?.body || '') : formatPlainContentToHtml(bodyHtml);
      const formattedHtmlB = formatPlainContentToHtml(bodyHtmlB);

      const blockPayload: Record<string, any> = {
        campaignType,
        html: formattedHtmlA,
        dripSteps: campaignType === 'drip' ? dripSteps : [],
        throttle,
        deliverySettings,
        sender,
        tracking,
      };

      const abTestPayload: ABTestConfig = abTestEnabled
        ? {
            enabled: true,
            testType: 'full',
            subjectA: primarySubject,
            subjectB: subjectB || primarySubject,
            bodyHtmlA: formattedHtmlA,
            bodyHtmlB: formattedHtmlB || formattedHtmlA,
            previewTextA,
            previewTextB,
            fromNameA: sender.fromName,
            fromNameB: fromNameB || sender.fromName,
            testPercentage: abSplitPct,
            splitPercentage: abSplitPct,
            winnerMetric: abWinnerMetric,
            autoSelectAfterHours: abEvalHours,
            autoRollout: abAutoRollout,
            status: 'draft',
          }
        : {
            enabled: false,
            subjectA: '',
            subjectB: '',
            testPercentage: 50,
            winnerMetric: 'open_rate',
            autoSelectAfterHours: 24,
          };

      const payload: Record<string, any> = {
        name,
        subject: primarySubject || name,
        blockJson: blockPayload,
        abTestConfig: abTestPayload,
        listId: audienceType === 'list' ? (listId || null) : null,
        segmentId: audienceType === 'segment' ? (segmentId || null) : null,
        smartListId: audienceType === 'smartList' ? (smartListId || null) : null,
      };

      if (isNew) {
        const created = await createCampaign(payload);
        return created.id;
      } else {
        await saveCampaign(campaignId!, payload);
        return campaignId!;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
      toast('success', 'Draft Saved', 'Campaign and split settings saved successfully.');
      if (isNew && id) {
        navigate(`/email-marketing/campaigns/${id}`, { replace: true });
      }
    },
    onError: (err: any) => {
      setErrorMsg(extractApiError(err));
      toast('error', 'Save Error', extractApiError(err));
    },
  });

  // ── Send Test Email ─────────────────────────────────────────────────────────

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      toast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      setIsSendingTest(true);
      const currentId = await saveMutation.mutateAsync();

      if (abTestEnabled && testEmailVariant === 'both') {
        // Send Variant A
        await apiClient.post(`/email-marketing/campaigns/${currentId}/send-test`, {
          email: testEmailAddress,
          subject: `[Variant A] ${activeSubjectA || 'Campaign Preview'}`,
          html: previewHtmlA,
          fromName: sender.fromName || 'Stone AIO Test',
        });
        // Send Variant B
        await apiClient.post(`/email-marketing/campaigns/${currentId}/send-test`, {
          email: testEmailAddress,
          subject: `[Variant B] ${activeSubjectB || 'Campaign Preview'}`,
          html: previewHtmlB,
          fromName: fromNameB || sender.fromName || 'Stone AIO Test',
        });
        toast('success', 'Both Variants Sent', `Delivered Variant A and Variant B test emails to ${testEmailAddress}`);
      } else if (abTestEnabled && testEmailVariant === 'B') {
        await apiClient.post(`/email-marketing/campaigns/${currentId}/send-test`, {
          email: testEmailAddress,
          subject: `[Variant B] ${activeSubjectB || 'Campaign Preview'}`,
          html: previewHtmlB,
          fromName: fromNameB || sender.fromName || 'Stone AIO Test',
        });
        toast('success', 'Variant B Test Sent', `Delivered Variant B preview to ${testEmailAddress}`);
      } else {
        await apiClient.post(`/email-marketing/campaigns/${currentId}/send-test`, {
          email: testEmailAddress,
          subject: abTestEnabled ? `[Variant A] ${activeSubjectA || 'Campaign Preview'}` : activeSubjectA,
          html: previewHtmlA,
          fromName: sender.fromName || 'Stone AIO Test',
        });
        toast('success', 'Test Email Sent', `Preview delivered to ${testEmailAddress}`);
      }

      setShowTestEmailModal(false);
    } catch (err: any) {
      toast('error', 'Test Send Error', extractApiError(err) || 'Failed to dispatch test email.');
    } finally {
      setIsSendingTest(false);
    }
  };

  // ── Send or Schedule Campaign ───────────────────────────────────────────────

  const handleConfirmSendOrSchedule = async () => {
    try {
      setErrorMsg('');
      setIsSendingOrScheduling(true);

      const currentId = await saveMutation.mutateAsync();

      if (sendTiming === 'now') {
        const { data: sendResult } = await apiClient.post(`/email-marketing/campaigns/${currentId}/send`);
        setSendSuccess(true);
        const sent = sendResult?.queued ?? 0;
        const failed = sendResult?.failed ?? 0;
        if (failed > 0 && sent === 0) {
          toast('error', 'Send Failed', `0 emails delivered. Please connect or reconnect your Gmail account in Settings → Channels.`);
        } else if (failed > 0) {
          toast('warning', 'Partial Send', `${sent} email${sent !== 1 ? 's' : ''} sent, ${failed} failed.`);
        } else {
          toast('success', 'Campaign Launched', `${abTestEnabled ? 'A/B split test launched' : (campaignType === 'drip' ? 'Drip sequence activated' : 'Campaign sent')} for ${sent} contact${sent !== 1 ? 's' : ''}.`);
        }
        setTimeout(() => navigate('/email-marketing/campaigns'), 1800);
      } else {
        if (!scheduledDateTime) {
          throw new Error('Please select a date and time to schedule the campaign.');
        }
        await apiClient.post(`/email-marketing/campaigns/${currentId}/schedule`, {
          scheduledAtUtc: new Date(scheduledDateTime).toISOString(),
        });
        setShowSendModal(false);
        qc.invalidateQueries({ queryKey: ['email-marketing', 'campaigns'] });
        toast('success', 'Campaign Scheduled', `Delivery scheduled for ${new Date(scheduledDateTime).toLocaleString()}`);
        navigate('/email-marketing/campaigns');
      }
    } catch (err: any) {
      setErrorMsg(extractApiError(err));
    } finally {
      setIsSendingOrScheduling(false);
    }
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin mr-3 text-primary" /> Loading campaign composer…
      </div>
    );
  }

  const selectedSmartList = smartLists.find((s: any) => s.id === smartListId);
  const targetRecipientCount = selectedSmartList?.contactCount ?? selectedSmartList?._count?.items ?? 'All';

  return (
    <>
      <div className="flex flex-col h-full w-full relative z-0 bg-bg text-text-main min-h-screen overflow-hidden">
        {/* Full-tab frosted glass background */}
        <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b shrink-0 gap-4 sticky top-0 z-20 shadow-sm overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-w-full"
          style={{
            background: 'var(--sidebar-bg)',
            borderColor: 'var(--sidebar-border)',
            color: 'var(--sidebar-text-main)',
          } as React.CSSProperties}
        >
          {/* Left: Back Arrow + Editable Title + Mode Segmented Control */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              onClick={() => navigate('/email-marketing/campaigns')}
              className="text-text-muted hover:text-text-main p-1.5 rounded-xl hover:bg-surface-hover transition-colors shrink-0"
              title="Back to Campaigns"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-[240px]">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Campaign Name"
                className="bg-transparent text-text-main font-bold text-sm border-b border-transparent hover:border-border/60 focus:border-primary outline-none px-1.5 py-0.5 transition-all truncate w-full"
              />
              <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-hover border border-border/60 text-text-muted shrink-0">
                {isNew ? 'New Draft' : 'Draft'}
              </span>
            </div>

            {/* Campaign Mode Switcher Capsule */}
            <div className="flex items-center bg-surface border border-border/60 rounded-xl p-0.5 shadow-inner shrink-0">
              <button
                onClick={() => {
                  setCampaignType('broadcast');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  campaignType === 'broadcast' && !abTestEnabled
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
                title="Single Broadcast Email"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>Broadcast</span>
              </button>

              <button
                onClick={() => {
                  setCampaignType('drip');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  campaignType === 'drip'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
                title="Multi-Step Drip Sequence"
              >
                <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Drip</span>
                {dripSteps.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
                    {dripSteps.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const nextState = !abTestEnabled;
                  setAbTestEnabled(nextState);
                  if (nextState && !subjectB) {
                    setSubjectB(subject ? `Alternative: ${subject}` : '');
                    setBodyHtmlB(bodyHtml);
                  }
                  toast(
                    nextState ? 'success' : 'info',
                    nextState ? 'A/B Split Testing Enabled' : 'A/B Split Testing Disabled',
                    nextState ? 'Configure Variant A and Variant B in the split bar below.' : 'Switched back to standard broadcast.'
                  );
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  abTestEnabled
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
                title="A/B Split Testing"
              >
                <Split className="w-3.5 h-3.5 shrink-0" />
                <span>A/B Split</span>
                {abTestEnabled && (
                  <span className="text-[9px] bg-white/25 px-1 py-0.2 rounded-full uppercase font-black">
                    ON
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right: Actions Cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {/* AI Campaign Copilot Button */}
            <button
              onClick={() => setShowAICopilotModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary/15 via-purple-500/15 to-primary/10 hover:from-primary/25 hover:to-purple-500/25 text-primary border border-primary/35 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 group whitespace-nowrap"
              title="Open AI Campaign Copilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary group-hover:rotate-12 transition-transform shrink-0" />
              <span>AI Copilot</span>
            </button>

            {/* Deliverability Score Badge */}
            <button
              onClick={() => setShowDeliverabilityModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: `${spamReport.badgeColor}15`,
                borderColor: `${spamReport.badgeColor}40`,
                color: spamReport.badgeColor,
              }}
              title="Click to view Deliverability & Anti-Spam Pre-Flight Scorecard"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{spamReport.score}% Deliverability</span>
            </button>

            {/* Templates Quick Action */}
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/70 bg-surface hover:bg-surface-hover text-text-main text-xs font-semibold transition-colors shrink-0 whitespace-nowrap"
              title="Browse Email Templates"
            >
              <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Templates</span>
            </button>

            {/* Sender & Throttling */}
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors shrink-0 whitespace-nowrap ${
                showSettingsDrawer
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border/70 bg-surface hover:bg-surface-hover text-text-main'
              }`}
              title="Configure Sender Profile and Delivery Throttling"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Sender & Limits</span>
            </button>

            {/* Test Send */}
            <button
              onClick={() => setShowTestEmailModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border/70 bg-surface hover:bg-surface-hover text-text-main text-xs font-semibold transition-colors shrink-0 whitespace-nowrap"
              title="Send a Test Email"
            >
              <Send className="w-3.5 h-3.5 text-accent-green shrink-0" />
              <span>Test Send</span>
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-border/60 shrink-0 mx-0.5" />

            {/* Save Draft */}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-surface hover:bg-surface-hover text-text-main text-xs font-bold transition-all shrink-0 whitespace-nowrap"
              title="Save Campaign Draft"
            >
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Save className="w-3.5 h-3.5 text-text-muted shrink-0" />}
              <span>Save</span>
            </button>

            {/* Launch / Send Button */}
            <button
              onClick={() => setShowSendModal(true)}
              disabled={
                saveMutation.isPending ||
                (campaignType === 'broadcast' && !subject && !abTestEnabled) ||
                (campaignType === 'drip' && (!dripSteps[0]?.subject || dripSteps.length === 0)) ||
                (audienceType === 'list' && !listId) ||
                (audienceType === 'smartList' && !smartListId) ||
                (audienceType === 'segment' && !segmentId)
              }
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-interactive shrink-0 whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>{abTestEnabled ? 'Launch A/B' : (campaignType === 'drip' ? 'Launch Drip' : 'Send Campaign')}</span>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 text-xs font-medium text-red-400 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-text-main">✕</button>
          </div>
        )}

        {/* Send Success banner */}
        {sendSuccess && (
          <div className="bg-accent-green/10 border-b border-accent-green/20 px-6 py-3 text-xs font-semibold text-accent-green flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-accent-green" />
            <span>Campaign launched successfully! Redirecting to campaigns dashboard…</span>
          </div>
        )}

        {/* ── A/B Split Testing Variant Switcher Bar ──────────────────────── */}
        {abTestEnabled && (
          <div className="bg-purple-950/40 border-b border-purple-500/20 px-6 py-2.5 flex items-center justify-between shrink-0 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Split className="w-4 h-4 text-purple-400" /> A/B Split Variants:
              </span>

              {/* Variant A tab */}
              <button
                onClick={() => {
                  setActiveVariant('A');
                  setPreviewVariant('A');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  activeVariant === 'A'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                    : 'bg-surface/80 border-border/50 text-text-muted hover:text-text-main hover:border-border'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">A</span>
                <span>Variant A (Control)</span>
              </button>

              {/* Variant B tab */}
              <button
                onClick={() => {
                  setActiveVariant('B');
                  setPreviewVariant('B');
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  activeVariant === 'B'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                    : 'bg-surface/80 border-border/50 text-text-muted hover:text-text-main hover:border-border'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">B</span>
                <span>Variant B (Variation)</span>
              </button>
            </div>

            {/* AI Generator & Config Details & Split Settings */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateAIVariantB}
                disabled={isGeneratingAIVariant}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-purple-200 text-xs font-bold transition-all"
              >
                {isGeneratingAIVariant ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                )}
                <span>Generate Variant B with AI</span>
              </button>

              <button
                onClick={() => setShowABSettingsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold transition-all"
                title="Configure A/B Split Ratio, Winner Metric, and Rollout Timers"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Split Settings</span>
              </button>

              <div className="hidden lg:flex items-center gap-2 text-[11px] text-text-muted bg-surface/60 border border-border/50 px-3 py-1.5 rounded-xl font-medium">
                <span>Split: <strong className="text-text-main">{abSplitPct}% ({Math.round(abSplitPct/2)}% A / {Math.round(abSplitPct/2)}% B)</strong></span>
                <span>·</span>
                <span>Goal: <strong className="text-purple-300 uppercase">{abWinnerMetric === 'open_rate' ? 'Open Rate' : 'Click Rate'}</strong></span>
                <span>·</span>
                <span>Window: <strong className="text-text-main">{abEvalHours}h</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Composer Workspace ────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Sequence / Content Composer */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-border/50' : 'w-full'} flex flex-col p-6 overflow-y-auto space-y-4`}>
              
              {/* Target Audience Bar */}
              <div className="bg-surface/40 border border-border/40 rounded-xl p-4 space-y-3 backdrop-blur-md shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Target Audience
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-text-muted">
                      Matching Contacts: <strong className="text-text-main">{targetRecipientCount}</strong>
                    </span>
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      CRM Smart Lists
                    </span>
                  </div>
                </div>

                <select
                  value={smartListId}
                  onChange={e => setSmartListId(e.target.value)}
                  className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2 text-[13px] text-text-main font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer hover:border-border"
                >
                  <option value="">-- Select Target CRM Smart List --</option>
                  {smartLists.map((sl: any) => (
                    <option key={sl.id} value={sl.id}>
                      {sl.name} ({sl.contactCount ?? sl._count?.items ?? '0'} contacts)
                    </option>
                  ))}
                </select>
              </div>

              {/* ── DRIP SEQUENCE STEP TABS & VISUAL TIMELINE ROADMAP ──────── */}
              {campaignType === 'drip' && (
                <div className="bg-surface/40 border border-border/40 rounded-2xl p-5 space-y-4 backdrop-blur-md shadow-card">
                  {/* Sequence Header Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-main">
                            Sequence Timeline & Roadmap
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {dripSteps.length} Touchpoint{dripSteps.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {totalSequenceDays === 0
                            ? 'All emails send immediately on campaign trigger'
                            : `Full automated outreach spans ~${totalSequenceDays} days · Stops automatically when contact replies`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAICopilotModal(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30 px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                        title="Refine this campaign sequence with AI Copilot"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                        <span>AI Refine Sequence</span>
                      </button>

                      <button
                        onClick={handleAddDripStep}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary border border-primary/30 px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Email Step</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Roadmap Flow */}
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1 styled-scrollbar">
                    {dripSteps.map((step, idx) => {
                      const isActive = activeStepIndex === idx;
                      const cumDay = cumulativeDays[idx] || 0;
                      return (
                        <React.Fragment key={step.id}>
                          {/* Delay connector badge between steps */}
                          {idx > 0 && (
                            <div className="flex flex-col items-center justify-center px-1 text-center shrink-0">
                              <span className="text-[10px] font-bold text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shadow-xs">
                                +{step.delayDays || 0}d
                              </span>
                              <div className="w-8 h-px bg-border/60 my-1" />
                            </div>
                          )}

                          {/* Step card */}
                          <div
                            onClick={() => setActiveStepIndex(idx)}
                            className={`flex flex-col justify-between p-3 rounded-xl cursor-pointer border transition-all shrink-0 w-48 min-w-[190px] group ${
                              isActive
                                ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/20'
                                : 'bg-surface/80 border-border/60 hover:bg-surface-hover hover:border-border text-text-muted hover:text-text-main'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    isActive ? 'bg-primary text-white' : 'bg-surface-hover border border-border text-text-main'
                                  }`}>
                                    {step.stepNumber || idx + 1}
                                  </span>
                                  <span className={`text-[11px] font-bold truncate ${isActive ? 'text-primary' : 'text-text-main'}`}>
                                    {idx === 0 ? 'Email 1 (Initial)' : `Email ${idx + 1} (Follow-up)`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                                  {idx > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveStep(idx, idx - 1);
                                      }}
                                      className="p-0.5 hover:text-primary rounded text-xs"
                                      title="Move earlier"
                                    >
                                      ←
                                    </button>
                                  )}
                                  {idx < dripSteps.length - 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveStep(idx, idx + 1);
                                      }}
                                      className="p-0.5 hover:text-primary rounded text-xs"
                                      title="Move later"
                                    >
                                      →
                                    </button>
                                  )}
                                  {dripSteps.length > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveDripStep(idx);
                                      }}
                                      className="p-0.5 hover:text-red-400 rounded text-text-muted"
                                      title="Delete step"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="text-[11px] font-medium text-text-main truncate leading-snug">
                                {step.subject || '(Untitled Email Subject)'}
                              </p>
                            </div>

                            <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-text-muted">
                              <span>
                                {idx === 0 ? 'Day 0 (Launch)' : `Day ~${cumDay} (+${step.delayDays}d)`}
                              </span>
                              {step.stopOnReply !== false && (
                                <span className="text-emerald-400 font-medium">✓ Stop on reply</span>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Active Step Timing & Reply Rules Configuration */}
                  {activeStepIndex > 0 && (
                    <div className="bg-surface/60 border border-border/50 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-text-muted font-medium flex-wrap">
                        <div className="flex items-center gap-1.5 text-primary font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Timing for Email #{activeStepIndex + 1}:</span>
                        </div>
                        <span>Send follow-up</span>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={dripSteps[activeStepIndex]?.delayDays ?? 2}
                          onChange={e => updateActiveStep({ delayDays: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-surface border border-border/60 rounded-lg px-2 py-1 text-center text-text-main font-bold text-xs focus:border-primary"
                        />
                        <span>day(s) &</span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={dripSteps[activeStepIndex]?.delayHours ?? 0}
                          onChange={e => updateActiveStep({ delayHours: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-surface border border-border/60 rounded-lg px-2 py-1 text-center text-text-main font-bold text-xs focus:border-primary"
                        />
                        <span>hour(s) after previous email</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-medium">
                        <label className="flex items-center gap-1.5 text-text-muted hover:text-text-main cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dripSteps[activeStepIndex]?.threadWithPrevious ?? true}
                            onChange={e => updateActiveStep({ threadWithPrevious: e.target.checked })}
                            className="accent-primary rounded"
                          />
                          <span>Thread as reply (Re:...)</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-text-muted hover:text-text-main cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dripSteps[activeStepIndex]?.stopOnReply ?? true}
                            onChange={e => updateActiveStep({ stopOnReply: e.target.checked })}
                            className="accent-primary rounded"
                          />
                          <span>Stop if contact replies</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBJECT LINE & MERGE TAG CHIPS ───────────────────────── */}
              <div className="bg-surface/40 border border-border/40 rounded-xl p-4 space-y-3 backdrop-blur-md shadow-card">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                      {abTestEnabled ? (
                        <>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${activeVariant === 'A' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'}`}>
                            Variant {activeVariant}
                          </span>
                          <span>Subject Line</span>
                        </>
                      ) : (
                        campaignType === 'drip' ? `Step ${activeStepIndex + 1} Subject Line` : 'Subject Line'
                      )}
                    </label>
                    <span className="text-[11px] text-text-muted">Use merge tags for personalization</span>
                  </div>
                  <input
                    value={
                      abTestEnabled
                        ? (activeVariant === 'A' ? (campaignType === 'drip' ? (dripSteps[activeStepIndex]?.subject || '') : subject) : subjectB)
                        : (campaignType === 'drip' ? (dripSteps[activeStepIndex]?.subject || '') : subject)
                    }
                    onChange={e => {
                      if (abTestEnabled && activeVariant === 'B') {
                        setSubjectB(e.target.value);
                      } else if (campaignType === 'drip') {
                        updateActiveStep({ subject: e.target.value });
                      } else {
                        setSubject(e.target.value);
                      }
                    }}
                    placeholder={
                      abTestEnabled && activeVariant === 'B'
                        ? 'e.g. 🔥 Unlock 35% more pipeline with this strategy, {{first_name}}'
                        : 'e.g. Quick question regarding {{business_name}}'
                    }
                    className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2 text-[13px] text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary transition-all hover:border-border font-medium"
                  />
                </div>

                {/* Optional Preview Preheader Text */}
                {abTestEnabled && (
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                      Preview Preheader Text (Optional)
                    </label>
                    <input
                      value={activeVariant === 'A' ? previewTextA : previewTextB}
                      onChange={e => {
                        if (activeVariant === 'A') setPreviewTextA(e.target.value);
                        else setPreviewTextB(e.target.value);
                      }}
                      placeholder="Brief teaser text shown in inbox inbox list..."
                      className="w-full bg-surface border border-border/60 rounded-xl px-3 py-1.5 text-xs text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* Dynamic Merge Tag Variable Chips */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[11px] text-text-muted font-bold mr-1">Insert variable:</span>
                  {MERGE_TAGS.map(item => (
                    <button
                      key={item.tag}
                      onClick={() => insertVariable(item.tag)}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shadow-sm flex items-center gap-1"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── EMAIL BODY EDITOR ────────────────────────────────────── */}
              <div className="flex-1 flex flex-col bg-surface/40 border border-border/40 rounded-xl p-4 min-h-[360px] backdrop-blur-md shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    {abTestEnabled ? (
                      <>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${activeVariant === 'A' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'}`}>
                          Variant {activeVariant}
                        </span>
                        <span>Email Message Body</span>
                      </>
                    ) : (
                      campaignType === 'drip' ? `Step ${activeStepIndex + 1} Email Message` : 'Email Message'
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAIPanel(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold hover:bg-primary/20 transition-all shadow-sm"
                    >
                      <Sparkles className="w-3 h-3" /> Write with AI
                    </button>
                  </div>
                </div>
                <EmailBuilderCanvas
                  key={`${campaignType}-${activeStepIndex}-${activeVariant}`}
                  initialContent={
                    abTestEnabled
                      ? (activeVariant === 'A' ? (campaignType === 'drip' ? (dripSteps[activeStepIndex]?.body || '') : bodyHtml) : bodyHtmlB)
                      : (campaignType === 'drip' ? (dripSteps[activeStepIndex]?.body || '') : bodyHtml)
                  }
                  onChange={(html) => {
                    if (abTestEnabled && activeVariant === 'B') {
                      setBodyHtmlB(html);
                    } else if (campaignType === 'drip') {
                      updateActiveStep({ body: html });
                    } else {
                      setBodyHtml(html);
                    }
                  }}
                  height="520px"
                  placeholder="Hi {{first_name}},\n\nWrite your email message naturally here or drag in blocks. Paragraphs and styling format cleanly for your recipients.\n\nBest,\n{{name}}"
                />
              </div>
            </div>
          )}

          {/* Right Column: Live Personalized Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-bg flex flex-col p-6`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-[13px] text-text-main font-bold">
                  <Eye className="w-4 h-4 text-primary" /> Live Personalized Preview
                  {campaignType === 'drip' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-1">
                      Step {activeStepIndex + 1} of {dripSteps.length}
                    </span>
                  )}
                  {abTestEnabled && (
                    <div className="flex items-center bg-purple-500/10 border border-purple-500/30 rounded-lg p-0.5 ml-2">
                      <button
                        onClick={() => setPreviewVariant('A')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          previewVariant === 'A' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'
                        }`}
                      >
                        Variant A
                      </button>
                      <button
                        onClick={() => setPreviewVariant('B')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                          previewVariant === 'B' ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'
                        }`}
                      >
                        Variant B
                      </button>
                    </div>
                  )}
                </div>

                {/* Device Switcher */}
                <div className="flex items-center bg-surface border border-border/60 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded text-xs transition-all ${
                      previewDevice === 'desktop' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                    title="Desktop Preview"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded text-xs transition-all ${
                      previewDevice === 'mobile' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                    title="Mobile Preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Email Frame Container */}
              <div className="flex-1 flex justify-center items-stretch overflow-hidden">
                <div
                  className={`bg-surface rounded-2xl border border-border/50 overflow-hidden flex flex-col shadow-luxury transition-all duration-300 ${
                    previewDevice === 'mobile' ? 'w-[375px] max-h-[640px]' : 'w-full'
                  }`}
                >
                  {/* Header preview bar */}
                  <div className="bg-surface-hover/80 px-4 py-3 border-b border-border/50 text-[12px] space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14 font-medium">From:</span>
                      <span className="text-text-main font-semibold truncate">
                        {(previewVariant === 'B' && fromNameB) ? fromNameB : (sender.fromName || 'Stone AIO')} &lt;outreach@domain.com&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14 font-medium">Subject:</span>
                      <span className="text-text-main font-semibold truncate">
                        {previewVariant === 'B' ? activeSubjectB : (activeSubjectA || '(No subject line)')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14 font-medium">To:</span>
                      <span className="text-text-muted">John Doe &lt;john.doe@example.com&gt;</span>
                    </div>
                  </div>

                  {/* Rendered HTML inside iframe */}
                  <iframe
                    srcDoc={previewVariant === 'B' ? previewHtmlB : previewHtmlA}
                    title="Live Email Preview"
                    className="w-full flex-1 bg-white border-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── A/B SPLIT SETTINGS MODAL ─────────────────────────────────────── */}
        {showABSettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-lg p-6 shadow-luxury space-y-5">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Split className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main text-base">A/B Split Test Configuration</h3>
                    <p className="text-[11px] text-text-muted">Configure split distribution, winning metrics, and evaluation timeline.</p>
                  </div>
                </div>
                <button onClick={() => setShowABSettingsModal(false)} className="p-1 rounded-lg text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Audience Distribution Slider */}
              <div className="space-y-3 bg-surface-hover/40 border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-main">Audience Split Distribution</label>
                  <span className="text-xs font-black text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    {abSplitPct >= 100 ? '50% / 50% (Full Audience)' : `${abSplitPct}% Test Sample (${Math.round(abSplitPct/2)}% A / ${Math.round(abSplitPct/2)}% B)`}
                  </span>
                </div>

                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={abSplitPct}
                  onChange={e => setAbSplitPct(parseInt(e.target.value) || 50)}
                  className="w-full accent-purple-500 cursor-pointer"
                />

                <div className="flex justify-between text-[10px] text-text-muted font-semibold">
                  <span>10% Sample</span>
                  <span>50% Split</span>
                  <span>100% Full (50/50)</span>
                </div>

                {abSplitPct < 100 && (
                  <p className="text-[11px] text-purple-300/80 bg-purple-500/5 p-2.5 rounded-lg border border-purple-500/20">
                    💡 <strong>{100 - abSplitPct}% of audience</strong> will be held in reserve. Once a winning variant is determined, it will automatically roll out to the remaining contacts.
                  </p>
                )}
              </div>

              {/* Winning Metric Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-main">Winning Criteria Metric</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setAbWinnerMetric('open_rate')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      abWinnerMetric === 'open_rate'
                        ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                        : 'border-border/60 bg-surface hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-text-main mb-1">
                      <Eye className="w-4 h-4 text-purple-400" />
                      <span>Highest Open Rate</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Best for testing subject lines & preview texts.</p>
                  </div>

                  <div
                    onClick={() => setAbWinnerMetric('click_rate')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      abWinnerMetric === 'click_rate'
                        ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                        : 'border-border/60 bg-surface hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-text-main mb-1">
                      <MousePointer className="w-4 h-4 text-purple-400" />
                      <span>Highest Click Rate</span>
                    </div>
                    <p className="text-[11px] text-text-muted">Best for testing email copy, CTAs & links.</p>
                  </div>
                </div>
              </div>

              {/* Evaluation Window & Auto-Rollout */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Evaluation Window</label>
                  <select
                    value={abEvalHours}
                    onChange={e => setAbEvalHours(parseInt(e.target.value) || 24)}
                    className="w-full bg-surface border border-border/60 rounded-xl px-3 py-2 text-xs font-semibold text-text-main"
                  >
                    <option value={1}>1 Hour</option>
                    <option value={4}>4 Hours</option>
                    <option value={24}>24 Hours (Recommended)</option>
                    <option value={48}>48 Hours</option>
                    <option value={72}>72 Hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Winner Auto-Rollout</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-medium text-text-main">
                    <input
                      type="checkbox"
                      checked={abAutoRollout}
                      onChange={e => setAbAutoRollout(e.target.checked)}
                      className="accent-purple-500 w-4 h-4"
                    />
                    <span>Auto-send winner to rest</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 flex justify-end">
                <button
                  onClick={() => {
                    setShowABSettingsModal(false);
                    toast('success', 'A/B Config Saved', 'A/B Split Testing settings updated.');
                  }}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-interactive"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SENDER & DRIP FEED SETTINGS DRAWER ───────────────────────────── */}
        {showSettingsDrawer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end">
            <div className="w-full max-w-md h-full bg-surface border-l border-border/60 shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-text-main text-base">Sender & Drip Settings</h3>
                </div>
                <button
                  onClick={() => setShowSettingsDrawer(false)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sender Identity */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-bold text-text-main uppercase tracking-wider">Sender Profile</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">From Name (Variant A)</label>
                    <input
                      value={sender.fromName}
                      onChange={e => setSender({ ...sender, fromName: e.target.value })}
                      placeholder="e.g. Jack from Stone AIO"
                      className="w-full bg-surface-hover border border-border/60 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                  {abTestEnabled && (
                    <div>
                      <label className="block text-[11px] font-bold text-purple-300 uppercase mb-1">From Name (Variant B)</label>
                      <input
                        value={fromNameB}
                        onChange={e => setFromNameB(e.target.value)}
                        placeholder="e.g. Jack Stone | Growth Partner"
                        className="w-full bg-surface-hover border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Reply-To Address (Optional)</label>
                    <input
                      value={sender.replyTo}
                      onChange={e => setSender({ ...sender, replyTo: e.target.value })}
                      placeholder="e.g. replies@yourcompany.com"
                      className="w-full bg-surface-hover border border-border/60 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Drip Feeding & Throttling */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-[12px] font-bold text-text-main uppercase tracking-wider">
                      Drip Feed / Rate Limit
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={throttle.enabled}
                    onChange={e => setThrottle({ ...throttle, enabled: e.target.checked })}
                    className="accent-primary w-4 h-4 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Evenly distribute outgoing emails over time to preserve sender domain reputation and prevent spam folder flags.
                </p>

                {throttle.enabled && (
                  <div className="bg-surface-hover/60 border border-border/50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-2 text-xs text-text-main">
                      <span>Send max</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={throttle.rateLimit}
                        onChange={e => setThrottle({ ...throttle, rateLimit: parseInt(e.target.value) || 20 })}
                        className="w-16 bg-surface border border-border/60 rounded-lg px-2 py-1 text-center font-bold"
                      />
                      <span>emails per</span>
                      <select
                        value={throttle.unit}
                        onChange={e => setThrottle({ ...throttle, unit: e.target.value as any })}
                        className="bg-surface border border-border/60 rounded-lg px-2 py-1 font-semibold"
                      >
                        <option value="hour">Hour</option>
                        <option value="day">Day</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Sending Window</label>
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="time"
                          value={throttle.startHour}
                          onChange={e => setThrottle({ ...throttle, startHour: e.target.value })}
                          className="bg-surface border border-border/60 rounded-lg px-2 py-1"
                        />
                        <span className="text-text-muted">to</span>
                        <input
                          type="time"
                          value={throttle.endHour}
                          onChange={e => setThrottle({ ...throttle, endHour: e.target.value })}
                          className="bg-surface border border-border/60 rounded-lg px-2 py-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Engagement & Click Tracking */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-bold text-text-main uppercase tracking-wider">
                    Engagement & Tracking
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Track opens and link clicks to view conversion metrics in Campaign Analytics and trigger automated CRM workflows.
                </p>

                <div className="bg-surface-hover/60 border border-border/50 rounded-xl p-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-main">Track Link Clicks</div>
                      <div className="text-[11px] text-text-muted">Record every URL click and update contact engagement score</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tracking.clicks}
                      onChange={e => setTracking({ ...tracking, clicks: e.target.checked })}
                      className="accent-primary w-4 h-4 cursor-pointer ml-3 shrink-0"
                    />
                  </label>

                  <div className="border-t border-border/40" />

                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-text-main">Track Email Opens</div>
                      <div className="text-[11px] text-text-muted">Embed invisible 1x1 pixel to measure open rates</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tracking.opens}
                      onChange={e => setTracking({ ...tracking, opens: e.target.checked })}
                      className="accent-primary w-4 h-4 cursor-pointer ml-3 shrink-0"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <button
                  onClick={() => {
                    setShowSettingsDrawer(false);
                    toast('success', 'Settings Applied', 'Sender, drip feeding, and tracking preferences configured.');
                  }}
                  className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[13px] font-bold transition-all shadow-interactive"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SEQUENCE TEMPLATES MODAL ────────────────────────────────────── */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-2xl shadow-luxury overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface-hover/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main text-base">Outreach & Drip Sequence Starters</h3>
                    <p className="text-[11px] text-text-muted">Select a proven pre-built sequence to populate all steps instantly.</p>
                  </div>
                </div>
                <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded-lg text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-3">
                {SEQUENCE_TEMPLATES.map(tpl => (
                  <div
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="p-4 rounded-xl border border-border/60 hover:border-primary bg-surface-hover/30 hover:bg-primary/5 cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main text-[14px] group-hover:text-primary transition-colors">
                          {tpl.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {tpl.steps.length} Steps
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-text-muted bg-surface border border-border px-2 py-0.5 rounded-md">
                        {tpl.tag}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-muted">{tpl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TEST EMAIL MODAL ────────────────────────────────────────────── */}
        {showTestEmailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-md p-6 shadow-luxury space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-accent-green" />
                  <h3 className="font-bold text-text-main text-base">Send Test Preview</h3>
                </div>
                <button onClick={() => setShowTestEmailModal(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[12px] text-text-muted">
                Send a live sample copy of this email to your inbox with sample merge values populated.
              </p>

              {abTestEnabled && (
                <div className="space-y-2 bg-surface-hover/50 p-3 rounded-xl border border-border/50">
                  <label className="block text-[11px] font-bold text-text-muted uppercase">Which variant to test?</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setTestEmailVariant('A')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                        testEmailVariant === 'A' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-muted'
                      }`}
                    >
                      Variant A
                    </button>
                    <button
                      onClick={() => setTestEmailVariant('B')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                        testEmailVariant === 'B' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-muted'
                      }`}
                    >
                      Variant B
                    </button>
                    <button
                      onClick={() => setTestEmailVariant('both')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                        testEmailVariant === 'both' ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-muted'
                      }`}
                    >
                      Both (A & B)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setShowTestEmailModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest || !testEmailAddress}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-interactive transition-all"
                >
                  {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Test
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SEND & SCHEDULE MODAL ───────────────────────────────────────── */}
        {showSendModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-md p-6 shadow-luxury space-y-5 relative">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="font-bold text-text-main text-base flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-primary" /> {abTestEnabled ? 'Launch A/B Split Test' : (campaignType === 'drip' ? 'Launch Drip Sequence' : 'Launch Campaign')}
                </h3>
                <button onClick={() => setShowSendModal(false)} className="text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-surface-hover/50 border border-border/50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between text-text-muted">
                    <span>Target Audience:</span>
                    <strong className="text-text-main">{selectedSmartList?.name || 'CRM Smart List'}</strong>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Total Audience:</span>
                    <strong className="text-text-main">{targetRecipientCount} contacts</strong>
                  </div>
                  {abTestEnabled && (
                    <div className="flex justify-between text-purple-300 pt-1 border-t border-border/30 font-semibold">
                      <span>A/B Strategy:</span>
                      <span>{abSplitPct >= 100 ? '50/50 Split' : `${abSplitPct}% Sample Test + Holdout`}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-text-muted uppercase">Sending Schedule</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSendTiming('now')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        sendTiming === 'now' ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-surface'
                      }`}
                    >
                      <div className="font-bold text-xs text-text-main flex items-center gap-1.5">
                        <Rocket className="w-3.5 h-3.5 text-primary" /> Send Immediately
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">Start dispatching right now</p>
                    </button>

                    <button
                      onClick={() => setSendTiming('schedule')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        sendTiming === 'schedule' ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-surface'
                      }`}
                    >
                      <div className="font-bold text-xs text-text-main flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" /> Schedule for Later
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">Pick future date and time</p>
                    </button>
                  </div>
                </div>

                {sendTiming === 'schedule' && (
                  <div>
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">Target Date & Time (UTC)</label>
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={e => setScheduledDateTime(e.target.value)}
                      className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <button onClick={() => setShowSendModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendOrSchedule}
                  disabled={isSendingOrScheduling}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-interactive transition-all"
                >
                  {isSendingOrScheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                  {sendTiming === 'now' ? 'Confirm & Send Now' : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI DRAFTING PANEL ───────────────────────────────────────────── */}
        {showAIPanel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-lg p-6 shadow-luxury space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-text-main text-base">AI Email Copy Assistant</h3>
                </div>
                <button onClick={() => setShowAIPanel(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">
                  What would you like to say in this email?
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder="e.g. Outreach email offering a free pipeline review to local HVAC contractors..."
                  className="w-full bg-surface border border-border/60 rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAIPanel(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!aiPrompt) return;
                    try {
                      const res = await generateEmail(aiPrompt);
                      if (res) {
                        if (abTestEnabled && activeVariant === 'B') {
                          setBodyHtmlB(res);
                        } else if (campaignType === 'drip') {
                          updateActiveStep({ body: res });
                        } else {
                          setBodyHtml(res);
                        }
                        setShowAIPanel(false);
                        toast('success', 'Email Generated', 'AI email content inserted.');
                      }
                    } catch (e) {
                      toast('error', 'AI Error', 'Could not generate email.');
                    }
                  }}
                  disabled={aiLoading || !aiPrompt}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-interactive transition-all"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Generate Content
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── DELIVERABILITY & ANTI-SPAM PRE-FLIGHT AUDIT MODAL ──────────── */}
        {showDeliverabilityModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border/70 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-luxury overflow-hidden animate-scale-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-surface/50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm"
                    style={{
                      backgroundColor: `${spamReport.badgeColor}20`,
                      color: spamReport.badgeColor,
                      border: `1px solid ${spamReport.badgeColor}40`,
                    }}
                  >
                    {spamReport.score}
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main text-base flex items-center gap-2">
                      Deliverability & Anti-Spam Pre-Flight Audit
                    </h3>
                    <p className="text-xs text-text-muted">
                      Real-time inbox placement scorecard & spam filter diagnostic
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowDeliverabilityModal(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Score Status Banner */}
                <div
                  className="p-4 rounded-xl border flex items-center justify-between"
                  style={{
                    backgroundColor: `${spamReport.badgeColor}10`,
                    borderColor: `${spamReport.badgeColor}30`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6" style={{ color: spamReport.badgeColor }} />
                    <div>
                      <div className="text-sm font-bold text-text-main">
                        Inbox Placement: <span style={{ color: spamReport.badgeColor }}>{spamReport.grade}</span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {spamReport.score >= 85
                          ? 'This email complies with 2024+ Gmail, Yahoo & Outlook delivery standards.'
                          : 'Fix the items below to avoid spam filters and improve inbox landing rates.'}
                      </p>
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-black"
                    style={{
                      backgroundColor: `${spamReport.badgeColor}25`,
                      color: spamReport.badgeColor,
                    }}
                  >
                    {spamReport.score}/100
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-text-muted">Spam Words</span>
                    <div className="text-lg font-bold text-text-main">{spamReport.metrics.spamKeywordCount}</div>
                    <div className="text-[10px] text-text-muted">
                      {spamReport.metrics.spamKeywordCount === 0 ? '✓ None found' : '⚠️ Flagged phrases'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-text-muted">Caps Ratio</span>
                    <div className="text-lg font-bold text-text-main">{Math.round(spamReport.metrics.capsRatio * 100)}%</div>
                    <div className="text-[10px] text-text-muted">
                      {spamReport.metrics.capsRatio < 0.2 ? '✓ Clean case' : '⚠️ Heavy caps'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-text-muted">Exclamations</span>
                    <div className="text-lg font-bold text-text-main">{spamReport.metrics.exclamationCount}</div>
                    <div className="text-[10px] text-text-muted">
                      {spamReport.metrics.exclamationCount <= 2 ? '✓ Normal density' : '⚠️ High density'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-hover/50 border border-border/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-text-muted">Unsubscribe</span>
                    <div className="text-lg font-bold text-text-main">
                      {spamReport.metrics.hasUnsubscribe ? 'Included' : 'Missing'}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {spamReport.metrics.hasUnsubscribe ? '✓ RFC 8058 ready' : '❌ Required by RFC'}
                    </div>
                  </div>
                </div>

                {/* Issues List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Diagnostic Items ({spamReport.issues.length})
                  </h4>

                  {spamReport.issues.length === 0 ? (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> No deliverability warnings found! Your email is clean.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {spamReport.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-3 rounded-xl bg-surface-hover/40 border border-border/50 flex items-start gap-3 text-xs"
                        >
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                              issue.type === 'critical'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : issue.type === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {issue.type} (-{issue.penalty} pts)
                          </span>
                          <div>
                            <div className="font-bold text-text-main">{issue.title}</div>
                            <div className="text-text-muted mt-0.5">{issue.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delivery Settings Tab */}
                <div className="space-y-4 pt-4 border-t border-border/60">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" /> Anti-Spam Drip & Pacing Protections
                  </h4>

                  <div className="space-y-3">
                    {/* Human Jitter Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/30 border border-border/40">
                      <div>
                        <div className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" /> Randomized Human Jitter
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Applies variable 30s–90s delays between sends to emulate natural human sending cadence.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={deliverySettings.humanJitterEnabled}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({ ...prev, humanJitterEnabled: e.target.checked }))
                        }
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </div>

                    {/* Sending Window Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/30 border border-border/40">
                      <div>
                        <div className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-primary" /> Business Hours Sending Window
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Only dispatch emails Monday through Friday between 8:00 AM and 6:00 PM.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={deliverySettings.sendingWindowEnabled}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({ ...prev, sendingWindowEnabled: e.target.checked }))
                        }
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </div>

                    {/* Domain Throttling */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/30 border border-border/40">
                      <div>
                        <div className="text-xs font-bold text-text-main flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Domain Throttling
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Limits maximum sends per mailbox provider (e.g. max 40 per hour to @gmail.com).
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={deliverySettings.domainThrottleEnabled}
                        onChange={(e) =>
                          setDeliverySettings((prev) => ({ ...prev, domainThrottleEnabled: e.target.checked }))
                        }
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border/60 bg-surface/50 flex justify-end">
                <button
                  onClick={() => setShowDeliverabilityModal(false)}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI CAMPAIGN COPILOT MODAL ────────────────────────────────────── */}
        <AICampaignCopilotModal
          isOpen={showAICopilotModal}
          onClose={() => setShowAICopilotModal(false)}
          onApplyCampaign={handleApplyAICampaign}
          currentDraft={{
            name,
            subject,
            bodyHtml,
            campaignType,
            dripSteps,
            abTestEnabled,
          }}
        />
      </div>
    </>
  );
}
