/**
 * Email Campaign Composer — Email Marketing Module
 *
 * Full-featured campaign builder supporting Single Broadcasts,
 * Multi-Step Drip Sequences, Delivery Throttling / Drip Feeding,
 * Merge Tag Variables, AI Drafting, and Pre-built Sequence Templates.
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
  Flame, Rocket, Check, ArrowRight, ShieldCheck, HelpCircle, MousePointer
} from 'lucide-react';
import { useAI } from '../../lib/useAI';

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
  daysOfWeek: number[]; // 1=Mon, 2=Tue, etc.
  startHour: string; // "09:00"
  endHour: string;   // "17:00"
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

  // Single Broadcast State
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

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
  const [previewHtml, setPreviewHtml] = useState<string>('');
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
        if (bj.campaignType === 'drip' && Array.isArray(bj.dripSteps) && bj.dripSteps.length > 0) {
          setCampaignType('drip');
          setDripSteps(bj.dripSteps);
        } else if (bj.html) {
          setCampaignType('broadcast');
          setBodyHtml(bj.html);
        } else if (typeof bj === 'string') {
          setCampaignType('broadcast');
          setBodyHtml(bj);
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
    if (campaignType === 'drip') {
      const currentBody = dripSteps[activeStepIndex]?.body || '';
      updateActiveStep({ body: currentBody + ' ' + varTag });
    } else {
      setBodyHtml(prev => prev + ' ' + varTag);
    }
  };

  // ── Live Preview Generator ──────────────────────────────────────────────────

  const activeSubject = campaignType === 'drip' ? (dripSteps[activeStepIndex]?.subject || subject) : subject;
  const activeBody = campaignType === 'drip' ? (dripSteps[activeStepIndex]?.body || '') : bodyHtml;

  useEffect(() => {
    const unsubUrl = '#';
    const sampleFirstName = 'John';
    const sampleLastName = 'Doe';
    const sampleFullName = 'John Doe';
    const sampleEmail = 'john.doe@example.com';
    const sampleBusiness = 'Acme Corp';
    const samplePhone = '+1 (555) 234-5678';

    const htmlToRender = formatPlainContentToHtml(activeBody);
    const interpolatedBody = htmlToRender
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

    const fullHtml = `<!DOCTYPE html>
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
  ${interpolatedBody || '<p style="color: #9ca3af; font-style: italic;">Start typing your email message on the left to see the live preview...</p>'}
  <div class="footer">
    <p>Sent via ${sender.fromName || 'Stone AIO'} · 123 Business St, Suite 100</p>
    <p><a href="${unsubUrl}">Unsubscribe from future emails</a></p>
  </div>
</body>
</html>`;

    setPreviewHtml(fullHtml);
  }, [activeBody, sender.fromName]);

  // ── Save / Update Mutation ──────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const primarySubject = campaignType === 'drip' ? (dripSteps[0]?.subject || subject || name) : subject;
      const formattedHtml = campaignType === 'drip' ? formatPlainContentToHtml(dripSteps[0]?.body || '') : formatPlainContentToHtml(bodyHtml);

      const blockPayload: Record<string, any> = {
        campaignType,
        html: formattedHtml,
        dripSteps: campaignType === 'drip' ? dripSteps : [],
        throttle,
        sender,
        tracking,
      };

      const payload: Record<string, any> = {
        name,
        subject: primarySubject || name,
        blockJson: blockPayload,
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
      toast('success', 'Draft Saved', 'Campaign and drip settings saved successfully.');
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
      await apiClient.post(`/email-marketing/campaigns/${currentId}/send-test`, {
        email: testEmailAddress,
        subject: activeSubject,
        html: previewHtml,
        fromName: sender.fromName || 'Stone AIO Test',
      });
      toast('success', 'Test Email Sent', `Preview delivered to ${testEmailAddress}`);
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
          toast('success', 'Campaign Launched', `${campaignType === 'drip' ? 'Drip sequence activated' : 'Campaign sent'} for ${sent} contact${sent !== 1 ? 's' : ''}.`);
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
          className="flex items-center justify-between px-6 py-3.5 border-b shrink-0 gap-4 sticky top-0 z-20 shadow-sm"
          style={{
            background: 'var(--sidebar-bg)',
            borderColor: 'var(--sidebar-border)',
            color: 'var(--sidebar-text-main)',
          } as React.CSSProperties}
        >
          {/* Left: Back Arrow + Editable Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/email-marketing/campaigns')}
              className="text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
              title="Back to Campaigns"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Campaign Name"
              className="bg-transparent text-text-main font-bold text-base border-b border-transparent hover:border-border/60 focus:border-primary outline-none px-1.5 py-0.5 transition-all truncate min-w-44"
            />

            {/* Campaign Type Pill Switcher */}
            <div className="hidden lg:flex items-center bg-surface border border-border/60 rounded-xl p-0.5 shadow-inner ml-2">
              <button
                onClick={() => setCampaignType('broadcast')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${
                  campaignType === 'broadcast'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Single Broadcast
              </button>
              <button
                onClick={() => setCampaignType('drip')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-bold transition-all ${
                  campaignType === 'drip'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" /> Drip Sequence
                {dripSteps.length > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
                    {dripSteps.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-[12px] font-semibold transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-primary" /> Templates
            </button>

            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                showSettingsDrawer
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border bg-surface hover:bg-surface-hover text-text-main'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Sender & Drip Feed
            </button>

            <button
              onClick={() => setShowTestEmailModal(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-main text-[12px] font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5 text-accent-green" /> Test Send
            </button>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-secondary flex items-center gap-1.5 py-1.5 text-[12px]"
            >
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </button>

            <button
              onClick={() => setShowSendModal(true)}
              disabled={
                saveMutation.isPending ||
                (campaignType === 'broadcast' && !subject) ||
                (campaignType === 'drip' && (!dripSteps[0]?.subject || dripSteps.length === 0)) ||
                (audienceType === 'list' && !listId) ||
                (audienceType === 'smartList' && !smartListId) ||
                (audienceType === 'segment' && !segmentId)
              }
              className="flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-bold transition-all shadow-interactive"
            >
              <Rocket className="w-3.5 h-3.5" /> {campaignType === 'drip' ? 'Launch Drip Sequence' : 'Send Campaign'}
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

              {/* ── DRIP SEQUENCE STEP TABS (When Drip Mode Active) ──────── */}
              {campaignType === 'drip' && (
                <div className="bg-surface/40 border border-border/40 rounded-xl p-4 space-y-3 backdrop-blur-md shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-[12px] font-bold text-text-main uppercase tracking-wider">
                        Sequence Timeline
                      </span>
                    </div>
                    <button
                      onClick={handleAddDripStep}
                      className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-hover bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Follow-Up Step
                    </button>
                  </div>

                  {/* Step Tabs Row */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 styled-scrollbar">
                    {dripSteps.map((step, idx) => (
                      <div
                        key={step.id}
                        onClick={() => setActiveStepIndex(idx)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border transition-all shrink-0 ${
                          activeStepIndex === idx
                            ? 'bg-primary text-white border-primary shadow-sm font-bold'
                            : 'bg-surface border-border/60 text-text-muted hover:text-text-main hover:border-border font-medium'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          activeStepIndex === idx ? 'bg-white text-zinc-950' : 'bg-surface-hover text-text-main'
                        }`}>
                          {step.stepNumber}
                        </span>
                        <div className="text-left">
                          <p className="text-[12px] leading-tight truncate max-w-[120px]">
                            {idx === 0 ? 'Initial Email' : `Follow-up #${idx}`}
                          </p>
                          <span className={`text-[10px] block leading-tight ${activeStepIndex === idx ? 'text-white/80' : 'text-text-muted'}`}>
                            {idx === 0 ? 'Day 0' : `+${step.delayDays}d ${step.delayHours ? `${step.delayHours}h` : ''}`}
                          </span>
                        </div>
                        {dripSteps.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveDripStep(idx);
                            }}
                            className={`p-1 rounded-md hover:bg-black/20 transition-colors ${
                              activeStepIndex === idx ? 'text-white/80 hover:text-white' : 'text-text-muted hover:text-red-400'
                            }`}
                            title="Delete step"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Delay Configuration for Steps > 0 */}
                  {activeStepIndex > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border/30 flex-wrap">
                      <div className="flex items-center gap-2 text-[12px] text-text-muted font-medium">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Send follow-up</span>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={dripSteps[activeStepIndex]?.delayDays ?? 2}
                          onChange={e => updateActiveStep({ delayDays: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-surface border border-border/60 rounded-lg px-2 py-1 text-center text-text-main font-bold text-xs"
                        />
                        <span>days &</span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={dripSteps[activeStepIndex]?.delayHours ?? 0}
                          onChange={e => updateActiveStep({ delayHours: parseInt(e.target.value) || 0 })}
                          className="w-14 bg-surface border border-border/60 rounded-lg px-2 py-1 text-center text-text-main font-bold text-xs"
                        />
                        <span>hours after previous email</span>
                      </div>

                      <label className="flex items-center gap-1.5 text-[12px] text-text-muted font-medium cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={dripSteps[activeStepIndex]?.threadWithPrevious ?? true}
                          onChange={e => updateActiveStep({ threadWithPrevious: e.target.checked })}
                          className="accent-primary rounded"
                        />
                        <span>Thread as reply (Re:...)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBJECT LINE & MERGE TAG CHIPS ───────────────────────── */}
              <div className="bg-surface/40 border border-border/40 rounded-xl p-4 space-y-3 backdrop-blur-md shadow-card">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      {campaignType === 'drip' ? `Step ${activeStepIndex + 1} Subject Line` : 'Subject Line'}
                    </label>
                    <span className="text-[11px] text-text-muted">Use merge tags for personalization</span>
                  </div>
                  <input
                    value={campaignType === 'drip' ? (dripSteps[activeStepIndex]?.subject || '') : subject}
                    onChange={e => {
                      if (campaignType === 'drip') {
                        updateActiveStep({ subject: e.target.value });
                      } else {
                        setSubject(e.target.value);
                      }
                    }}
                    placeholder="e.g. Quick question regarding {{business_name}}"
                    className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2 text-[13px] text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-primary transition-all hover:border-border font-medium"
                  />
                </div>

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
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {campaignType === 'drip' ? `Step ${activeStepIndex + 1} Email Message` : 'Email Message'}
                  </label>
                  <button
                    onClick={() => setShowAIPanel(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold hover:bg-primary/20 transition-all shadow-sm"
                  >
                    <Sparkles className="w-3 h-3" /> Write with AI
                  </button>
                </div>
                <textarea
                  ref={activeTextareaRef}
                  value={campaignType === 'drip' ? (dripSteps[activeStepIndex]?.body || '') : bodyHtml}
                  onChange={e => {
                    if (campaignType === 'drip') {
                      updateActiveStep({ body: e.target.value });
                    } else {
                      setBodyHtml(e.target.value);
                    }
                  }}
                  rows={14}
                  placeholder={`Hi {{first_name}},\n\nWrite your email message naturally here. Paragraphs and line breaks will format cleanly for your recipients.\n\nBest,\n{{name}}`}
                  className="w-full flex-1 bg-surface border border-border/60 rounded-xl p-4 text-[14px] text-text-main focus:outline-none focus:border-primary font-sans leading-relaxed resize-none shadow-inner"
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
                        {sender.fromName || 'Stone AIO'} &lt;outreach@domain.com&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14 font-medium">Subject:</span>
                      <span className="text-text-main font-semibold truncate">{activeSubject || '(No subject line)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14 font-medium">To:</span>
                      <span className="text-text-muted">John Doe &lt;john.doe@example.com&gt;</span>
                    </div>
                  </div>

                  {/* Rendered HTML inside iframe */}
                  <iframe
                    srcDoc={previewHtml}
                    title="Live Email Preview"
                    className="w-full flex-1 bg-white border-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

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
                    <label className="block text-[11px] font-bold text-text-muted uppercase mb-1">From Name</label>
                    <input
                      value={sender.fromName}
                      onChange={e => setSender({ ...sender, fromName: e.target.value })}
                      placeholder="e.g. Jack from Stone AIO"
                      className="w-full bg-surface-hover border border-border/60 rounded-xl px-3.5 py-2 text-xs text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
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
                Send a live sample copy of {campaignType === 'drip' ? `Step ${activeStepIndex + 1}` : 'this email'} to your inbox with sample merge values populated.
              </p>

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
                  <Rocket className="w-4 h-4 text-primary" /> Launch {campaignType === 'drip' ? 'Drip Sequence' : 'Campaign'}
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
                    <span>Recipients:</span>
                    <strong className="text-text-main">{targetRecipientCount} contacts</strong>
                  </div>
                  {campaignType === 'drip' && (
                    <div className="flex justify-between text-text-muted">
                      <span>Drip Sequence Steps:</span>
                      <strong className="text-amber-400">{dripSteps.length} automated steps</strong>
                    </div>
                  )}
                </div>

                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">When should delivery begin?</label>
                
                {/* Send Instantly */}
                <div
                  onClick={() => setSendTiming('now')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    sendTiming === 'now' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-surface-hover/50 border-border hover:border-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={sendTiming === 'now'}
                    onChange={() => setSendTiming('now')}
                    className="mt-1 accent-primary"
                  />
                  <div>
                    <div className="font-bold text-text-main text-sm">Start Immediately</div>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Begin delivering {campaignType === 'drip' ? 'Step 1' : 'emails'} immediately to your selected audience.
                    </p>
                  </div>
                </div>

                {/* Schedule for Later */}
                <div
                  onClick={() => setSendTiming('schedule')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    sendTiming === 'schedule' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-surface-hover/50 border-border hover:border-border/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={sendTiming === 'schedule'}
                    onChange={() => setSendTiming('schedule')}
                    className="mt-1 accent-primary"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-text-main text-sm">📅 Schedule for Specific Date/Time</div>
                    <p className="text-[11px] text-text-muted mt-0.5 mb-2">
                      Queue background execution for an upcoming date and time.
                    </p>

                    {sendTiming === 'schedule' && (
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={e => setScheduledDateTime(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-surface border border-primary/50 rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-primary mt-1 font-medium"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
                <button onClick={() => setShowSendModal(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSendOrSchedule}
                  disabled={isSendingOrScheduling || (sendTiming === 'schedule' && !scheduledDateTime)}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-interactive transition-all"
                >
                  {isSendingOrScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  {sendTiming === 'now' ? 'Confirm & Launch Now' : 'Confirm & Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI WRITER MODAL ─────────────────────────────────────────────── */}
        {showAIPanel && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-lg shadow-luxury overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-surface-hover/60">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-text-main text-[14px]">Stone AI Writer</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-green/10 text-accent-green border border-accent-green/20">Gemini</span>
                </div>
                <button onClick={() => setShowAIPanel(false)} className="text-text-muted hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Generate Full Email */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                    ✨ Generate Email Copy from Prompt
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    rows={3}
                    placeholder="e.g. Write a friendly follow-up email proposing a quick 10-minute demo of our CRM platform to increase pipeline conversion."
                    className="w-full bg-surface border border-border/60 rounded-xl px-4 py-3 text-[13px] text-text-main focus:outline-none focus:border-primary transition-all resize-none"
                  />
                  <button
                    disabled={!aiPrompt.trim() || aiLoading}
                    onClick={async () => {
                      const html = await generateEmail(aiPrompt, name);
                      if (html) {
                        if (campaignType === 'drip') {
                          updateActiveStep({ body: html });
                        } else {
                          setBodyHtml(html);
                        }
                        setShowAIPanel(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl text-[13px] font-bold transition-all shadow-interactive"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Generate Email Body
                  </button>
                </div>

                <div className="border-t border-border/30" />

                {/* Improve existing body */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                    🔧 Refine & Polish Current Copy
                  </label>
                  <input
                    value={aiInstruction}
                    onChange={e => setAiInstruction(e.target.value)}
                    placeholder="e.g. Make it punchier, shorter, and add an engaging question at the end."
                    className="w-full bg-surface border border-border/60 rounded-xl px-4 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    disabled={!activeBody.trim() || aiLoading}
                    onClick={async () => {
                      const improved = await improveEmail(activeBody, aiInstruction || undefined);
                      if (improved) {
                        if (campaignType === 'drip') {
                          updateActiveStep({ body: improved });
                        } else {
                          setBodyHtml(improved);
                        }
                        setShowAIPanel(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-xl text-[13px] font-semibold transition-all"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-primary" />}
                    Refine Email
                  </button>
                </div>

                <div className="border-t border-border/30" />

                {/* Subject line suggestions */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                    💡 Subject Line Ideas
                  </label>
                  <button
                    disabled={aiLoading}
                    onClick={async () => {
                      const subjects = await generateSubjectLines(activeBody, name);
                      setAiSubjects(subjects);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-xl text-[13px] font-semibold transition-all"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
                    Generate Subject Lines
                  </button>
                  {aiSubjects.length > 0 && (
                    <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto">
                      {aiSubjects.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (campaignType === 'drip') {
                              updateActiveStep({ subject: s });
                            } else {
                              setSubject(s);
                            }
                            setAiSubjects([]);
                            setShowAIPanel(false);
                          }}
                          className="w-full text-left px-3 py-2 bg-surface border border-border/60 hover:border-primary/40 hover:bg-primary/5 rounded-lg text-[12px] text-text-main transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
