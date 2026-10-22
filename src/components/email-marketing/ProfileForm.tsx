/**
 * Business Profile form — three short screens, all typed inputs.
 * No pick-lists, chips, or dropdowns anywhere (spec §4).
 *
 * Screen 1: Business basics (required) + website prefill shortcut.
 * Screen 2: Sending details (required + booking link and/or phone).
 * Screen 3: Optional extras (all skippable via "Skip for now").
 */

import React, { useState } from 'react';
import { 
  Building2, Sparkles, Mail, MapPin, Globe, Phone, Clock, 
  ArrowRight, ArrowLeft, Check, AlertCircle, ShieldCheck, 
  Layers, Users, MessageSquareQuote, CheckCircle2, ChevronRight
} from 'lucide-react';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { prefillFromWebsite, type BusinessProfile } from '../../lib/createWithAiApi';
import { extractApiError } from '../../lib/apiClient';

export type ProfileFormValues = {
  businessName: string;
  businessType: string;
  services: string;
  serviceArea: string;
  senderName: string;
  replyToEmail: string;
  physicalAddress: string;
  bookingLink: string;
  phone: string;
  customerType: string;
  voiceDescription: string;
  wordsToAvoid: string;
  websiteUrl: string;
  differentiators: string;
  guaranteesProof: string;
  timezone: string;
};

export function profileToFormValues(p: Partial<BusinessProfile> | null): ProfileFormValues {
  return {
    businessName: p?.businessName || '',
    businessType: p?.businessType || '',
    services: p?.services || '',
    serviceArea: p?.serviceArea || '',
    senderName: p?.senderName || '',
    replyToEmail: p?.replyToEmail || '',
    physicalAddress: p?.physicalAddress || '',
    bookingLink: p?.bookingLink || '',
    phone: p?.phone || '',
    customerType: p?.customerType || '',
    voiceDescription: p?.voiceDescription || '',
    wordsToAvoid: p?.wordsToAvoid || '',
    websiteUrl: p?.websiteUrl || '',
    differentiators: p?.differentiators || '',
    guaranteesProof: p?.guaranteesProof || '',
    timezone: p?.timezone || '',
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateScreen(values: ProfileFormValues, screen: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const req = (key: keyof ProfileFormValues, label: string) => {
    if (!values[key].trim()) errors[key] = `${label} is required.`;
  };
  if (screen === 1) {
    req('businessName', 'Business name');
    req('businessType', 'Business type');
    req('services', 'Services or products');
    req('serviceArea', 'Service area');
  }
  if (screen === 2) {
    req('senderName', 'Sender name');
    req('replyToEmail', 'Reply-to email');
    if (values.replyToEmail.trim() && !EMAIL_RE.test(values.replyToEmail.trim())) {
      errors.replyToEmail = 'Reply-to email must be a valid email address.';
    }
    req('physicalAddress', 'Business address');
    if (!values.bookingLink.trim() && !values.phone.trim()) {
      errors.bookingLink = 'Enter a booking/action link or phone number (at least one is required).';
    }
  }
  return errors;
}

function FormField({
  label,
  hint,
  error,
  required,
  icon: Icon,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="flex items-center justify-between text-[13px] font-semibold text-text-main">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          <span>{label}</span>
          {required && <span className="text-red-400 font-bold">*</span>}
        </span>
        {hint && <span className="text-[11px] text-text-muted font-normal">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-400 font-medium animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const inputCls =
  'w-full border border-border bg-surface-hover/80 text-text-main rounded-[10px] px-3.5 py-2.5 text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60 shadow-inner-sm';

export default function ProfileForm({
  initial,
  onSave,
  saving,
  serverErrors,
  submitLabel,
  onCancel,
  compact = false,
}: {
  initial: ProfileFormValues;
  onSave: (values: ProfileFormValues) => Promise<void>;
  saving: boolean;
  serverErrors?: Record<string, string>;
  submitLabel?: string;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const copy = createWithAiCopy.profile;
  const [screen, setScreen] = useState(1);
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [prefillUrl, setPrefillUrl] = useState('');
  const [prefillBusy, setPrefillBusy] = useState(false);
  const [prefillError, setPrefillError] = useState('');
  const [prefillInfo, setPrefillInfo] = useState('');
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);

  const errors = { ...localErrors, ...(serverErrors || {}) };
  const set = (key: keyof ProfileFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setLocalErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const next = () => {
    const errs = validateScreen(values, screen);
    setLocalErrors(errs);
    if (Object.keys(errs).length === 0) {
      setScreen((s) => Math.min(3, s + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const runPrefill = async () => {
    if (!prefillUrl.trim()) return;
    setPrefillBusy(true);
    setPrefillError('');
    setPrefillInfo('');
    setSuggestions(null);
    try {
      const result = await prefillFromWebsite(prefillUrl.trim());
      const found = result.suggestions;
      if (Object.keys(found).length === 0) {
        setPrefillInfo(copy.prefill.noneFound);
      } else {
        setSuggestions(found as Record<string, string>);
        setPrefillInfo(`${Object.keys(found).length} suggestion(s) detected. Review and apply below.`);
      }
    } catch (err) {
      setPrefillError(extractApiError(err) || copy.prefill.failed);
    } finally {
      setPrefillBusy(false);
    }
  };

  const applySuggestions = () => {
    if (!suggestions) return;
    setValues((v) => {
      const next = { ...v };
      for (const [key, value] of Object.entries(suggestions)) {
        if (key in next) (next as Record<string, string>)[key] = value;
      }
      if (suggestions.websiteUrl === undefined && prefillUrl.trim()) next.websiteUrl = prefillUrl.trim();
      return next;
    });
    setSuggestions(null);
    setPrefillInfo('Suggestions applied! Continue below to review.');
  };

  const steps = [
    { num: 1, title: 'Basics & Services', subtitle: 'Identity, offerings & location' },
    { num: 2, title: 'Sender & Compliance', subtitle: 'Email, address & action link' },
    { num: 3, title: 'Voice & Strategy', subtitle: 'Audience, tone & differentiators' },
  ];

  const screenTitle =
    screen === 1 ? copy.screens.basics.title : screen === 2 ? copy.screens.sending.title : copy.screens.extras.title;
  const screenHint =
    screen === 1 ? copy.screens.basics.hint : screen === 2 ? copy.screens.sending.hint : copy.screens.extras.hint;

  if (compact) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-semibold text-text-main">
            {screenTitle} <span className="text-text-muted font-normal">({screen} of 3)</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{screenHint}</p>
        </div>

        {screen === 1 && (
          <div className="space-y-4">
            <FormField label={copy.fields.businessName.label} required error={errors.businessName}>
              <input value={values.businessName} onChange={set('businessName')} placeholder={copy.fields.businessName.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.businessType.label} required error={errors.businessType}>
              <input value={values.businessType} onChange={set('businessType')} placeholder={copy.fields.businessType.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.services.label} hint={copy.fields.services.hint} required error={errors.services}>
              <textarea value={values.services} onChange={set('services')} placeholder={copy.fields.services.placeholder} rows={3} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.serviceArea.label} required error={errors.serviceArea}>
              <input value={values.serviceArea} onChange={set('serviceArea')} placeholder={copy.fields.serviceArea.placeholder} className={inputCls} />
            </FormField>
          </div>
        )}

        {screen === 2 && (
          <div className="space-y-4">
            <FormField label={copy.fields.senderName.label} required error={errors.senderName}>
              <input value={values.senderName} onChange={set('senderName')} placeholder={copy.fields.senderName.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.replyToEmail.label} required error={errors.replyToEmail}>
              <input type="email" value={values.replyToEmail} onChange={set('replyToEmail')} placeholder={copy.fields.replyToEmail.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.physicalAddress.label} hint={copy.fields.physicalAddress.hint} required error={errors.physicalAddress}>
              <input value={values.physicalAddress} onChange={set('physicalAddress')} placeholder={copy.fields.physicalAddress.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.bookingLink.label} hint={copy.fields.bookingOrPhoneHint} error={errors.bookingLink}>
              <input type="url" value={values.bookingLink} onChange={set('bookingLink')} placeholder={copy.fields.bookingLink.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.phone.label} error={errors.phone}>
              <input type="tel" value={values.phone} onChange={set('phone')} placeholder={copy.fields.phone.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.timezone.label} hint={copy.fields.timezone.hint} error={errors.timezone}>
              <input value={values.timezone} onChange={set('timezone')} placeholder={copy.fields.timezone.placeholder} className={inputCls} />
            </FormField>
          </div>
        )}

        {screen === 3 && (
          <div className="space-y-4">
            <FormField label={copy.fields.customerType.label} error={errors.customerType}>
              <input value={values.customerType} onChange={set('customerType')} placeholder={copy.fields.customerType.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.voiceDescription.label} error={errors.voiceDescription}>
              <textarea value={values.voiceDescription} onChange={set('voiceDescription')} placeholder={copy.fields.voiceDescription.placeholder} rows={3} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.wordsToAvoid.label} error={errors.wordsToAvoid}>
              <textarea value={values.wordsToAvoid} onChange={set('wordsToAvoid')} placeholder={copy.fields.wordsToAvoid.placeholder} rows={2} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.websiteUrl.label} error={errors.websiteUrl}>
              <input type="url" value={values.websiteUrl} onChange={set('websiteUrl')} placeholder={copy.fields.websiteUrl.placeholder} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.differentiators.label} error={errors.differentiators}>
              <textarea value={values.differentiators} onChange={set('differentiators')} placeholder={copy.fields.differentiators.placeholder} rows={2} className={inputCls} />
            </FormField>
            <FormField label={copy.fields.guaranteesProof.label} error={errors.guaranteesProof}>
              <textarea value={values.guaranteesProof} onChange={set('guaranteesProof')} placeholder={copy.fields.guaranteesProof.placeholder} rows={2} className={inputCls} />
            </FormField>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
          <div>
            {screen > 1 && (
              <button type="button" onClick={() => setScreen(screen - 1)} className="btn-secondary text-xs">
                {copy.buttons.back}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel} className="btn-secondary text-xs">
                Cancel
              </button>
            )}
            {screen < 3 ? (
              <button type="button" onClick={next} className="btn-primary text-xs">
                {copy.buttons.continue}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onSave(values)} disabled={saving} className="btn-secondary text-xs">
                  {copy.buttons.skip}
                </button>
                <button type="button" onClick={() => onSave(values)} disabled={saving} className="btn-primary text-xs">
                  {saving ? copy.buttons.saving : submitLabel || copy.buttons.save}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/25 rounded-full text-primary text-[12px] font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Business Profile Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            Configure Your Business Profile
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Stone AIO grounds all AI-generated email copy in your verified company identity, target audience, and compliance details.
          </p>
        </div>

        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel} 
            className="self-start sm:self-center px-4 py-2 border border-border bg-surface-hover rounded-[10px] text-[13px] font-semibold text-text-muted hover:text-text-main transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* 3-Step Interactive Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((st) => {
          const isActive = screen === st.num;
          const isDone = screen > st.num;
          return (
            <div
              key={st.num}
              onClick={() => {
                if (isDone) setScreen(st.num);
              }}
              className={`flex items-center gap-3.5 p-4 rounded-[12px] border transition-all ${
                isDone ? 'cursor-pointer hover:border-primary/50' : ''
              } ${
                isActive
                  ? 'bg-surface/70 border-primary/50 shadow-luxury ring-1 ring-primary/20'
                  : isDone
                  ? 'bg-surface/40 border-border/70 text-text-muted'
                  : 'bg-surface/20 border-border/30 text-text-muted/60 opacity-70'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-interactive'
                    : isDone
                    ? 'bg-green-500/15 border border-green-500/30 text-green-400'
                    : 'bg-surface border border-border text-text-muted'
                }`}
              >
                {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : st.num}
              </div>
              <div className="min-w-0">
                <p className={`text-[13px] font-bold truncate ${isActive ? 'text-text-main' : isDone ? 'text-text-main' : 'text-text-muted'}`}>
                  {st.title}
                </p>
                <p className="text-[11px] text-text-muted truncate">{st.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen 1: Business Basics */}
      {screen === 1 && (
        <div className="space-y-6">
          {/* Smart Website Auto-Fill Hero Card */}
          <div className="p-6 rounded-[16px] bg-gradient-to-br from-surface/60 via-surface/40 to-primary/5 border border-primary/20 shadow-luxury backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-text-main">Instant Auto-Fill From Website</h3>
                  <p className="text-xs text-text-muted">Enter your business URL and our crawler will automatically detect your business name, services, and location.</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="url"
                    value={prefillUrl}
                    onChange={(e) => setPrefillUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    className={`${inputCls} pl-10 h-11 text-sm`}
                  />
                </div>
                <button
                  type="button"
                  onClick={runPrefill}
                  disabled={prefillBusy || !prefillUrl.trim()}
                  className="px-5 h-11 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-[13px] font-bold shadow-interactive transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{prefillBusy ? 'Analyzing Website…' : 'Scan & Auto-Fill'}</span>
                </button>
              </div>

              {prefillError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{prefillError}</span>
                </div>
              )}

              {prefillInfo && (
                <div className="flex items-center gap-2 text-xs text-text-muted bg-surface/60 border border-border/50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>{prefillInfo}</span>
                </div>
              )}

              {suggestions && (
                <div className="mt-4 p-4 rounded-[12px] bg-bg/80 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-main uppercase tracking-wider">Detected Business Information</span>
                    <button
                      type="button"
                      onClick={applySuggestions}
                      className="px-3 py-1 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply All Suggestions</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {Object.entries(suggestions).map(([key, value]) => (
                      <div key={key} className="p-2.5 rounded-lg bg-surface/50 border border-border/40">
                        <span className="text-text-muted font-medium block">
                          {(copy.fields as unknown as Record<string, { label: string }>)[key]?.label || key}
                        </span>
                        <span className="text-text-main font-semibold mt-0.5 line-clamp-2">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Core Information Card Grid */}
          <div className="p-7 rounded-[16px] bg-surface/30 border border-border/50 shadow-luxury backdrop-blur-md space-y-6">
            <h3 className="text-base font-bold text-text-main flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Core Business Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label={copy.fields.businessName.label} 
                required 
                icon={Building2}
                error={errors.businessName}
              >
                <input
                  value={values.businessName}
                  onChange={set('businessName')}
                  placeholder={copy.fields.businessName.placeholder}
                  className={inputCls}
                />
              </FormField>

              <FormField 
                label={copy.fields.businessType.label} 
                required 
                icon={Layers}
                error={errors.businessType}
              >
                <input
                  value={values.businessType}
                  onChange={set('businessType')}
                  placeholder={copy.fields.businessType.placeholder}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField 
              label={copy.fields.services.label} 
              hint={copy.fields.services.hint} 
              required 
              icon={Sparkles}
              error={errors.services}
            >
              <textarea
                value={values.services}
                onChange={set('services')}
                placeholder={copy.fields.services.placeholder}
                rows={4}
                className={inputCls}
              />
            </FormField>

            <FormField 
              label={copy.fields.serviceArea.label} 
              required 
              icon={MapPin}
              error={errors.serviceArea}
            >
              <input
                value={values.serviceArea}
                onChange={set('serviceArea')}
                placeholder={copy.fields.serviceArea.placeholder}
                className={inputCls}
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Screen 2: Sending & Compliance */}
      {screen === 2 && (
        <div className="space-y-6">
          <div className="p-7 rounded-[16px] bg-surface/30 border border-border/50 shadow-luxury backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Sending Identity & CAN-SPAM Compliance</span>
              </h3>
              <span className="text-[11px] text-text-muted bg-surface px-2.5 py-1 rounded-full border border-border/60">
                Required for real-world email deliverability
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label={copy.fields.senderName.label} 
                required 
                icon={Users}
                error={errors.senderName}
              >
                <input
                  value={values.senderName}
                  onChange={set('senderName')}
                  placeholder={copy.fields.senderName.placeholder}
                  className={inputCls}
                />
              </FormField>

              <FormField 
                label={copy.fields.replyToEmail.label} 
                required 
                icon={Mail}
                error={errors.replyToEmail}
              >
                <input
                  type="email"
                  value={values.replyToEmail}
                  onChange={set('replyToEmail')}
                  placeholder={copy.fields.replyToEmail.placeholder}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField 
              label={copy.fields.physicalAddress.label} 
              hint={copy.fields.physicalAddress.hint} 
              required 
              icon={MapPin}
              error={errors.physicalAddress}
            >
              <input
                value={values.physicalAddress}
                onChange={set('physicalAddress')}
                placeholder={copy.fields.physicalAddress.placeholder}
                className={inputCls}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label={copy.fields.bookingLink.label} 
                hint={copy.fields.bookingOrPhoneHint} 
                icon={Globe}
                error={errors.bookingLink}
              >
                <input
                  type="url"
                  value={values.bookingLink}
                  onChange={set('bookingLink')}
                  placeholder={copy.fields.bookingLink.placeholder}
                  className={inputCls}
                />
              </FormField>

              <FormField 
                label={copy.fields.phone.label} 
                icon={Phone}
                error={errors.phone}
              >
                <input
                  type="tel"
                  value={values.phone}
                  onChange={set('phone')}
                  placeholder={copy.fields.phone.placeholder}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField 
              label={copy.fields.timezone.label} 
              hint={copy.fields.timezone.hint} 
              icon={Clock}
              error={errors.timezone}
            >
              <input
                value={values.timezone}
                onChange={set('timezone')}
                placeholder={copy.fields.timezone.placeholder}
                className={inputCls}
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Screen 3: Voice & Strategy */}
      {screen === 3 && (
        <div className="space-y-6">
          <div className="p-7 rounded-[16px] bg-surface/30 border border-border/50 shadow-luxury backdrop-blur-md space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <MessageSquareQuote className="w-4 h-4 text-primary" />
                <span>Brand Voice, Audience & Differentiators</span>
              </h3>
              <span className="text-[11px] text-text-muted bg-surface px-2.5 py-1 rounded-full border border-border/60">
                Optional · Enhances copy nuance
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label={copy.fields.customerType.label} 
                icon={Users}
                error={errors.customerType}
              >
                <input
                  value={values.customerType}
                  onChange={set('customerType')}
                  placeholder={copy.fields.customerType.placeholder}
                  className={inputCls}
                />
              </FormField>

              <FormField 
                label={copy.fields.websiteUrl.label} 
                icon={Globe}
                error={errors.websiteUrl}
              >
                <input
                  type="url"
                  value={values.websiteUrl}
                  onChange={set('websiteUrl')}
                  placeholder={copy.fields.websiteUrl.placeholder}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField 
              label={copy.fields.voiceDescription.label} 
              icon={Sparkles}
              error={errors.voiceDescription}
            >
              <textarea
                value={values.voiceDescription}
                onChange={set('voiceDescription')}
                placeholder={copy.fields.voiceDescription.placeholder}
                rows={3}
                className={inputCls}
              />
            </FormField>

            <FormField 
              label={copy.fields.wordsToAvoid.label} 
              icon={AlertCircle}
              error={errors.wordsToAvoid}
            >
              <textarea
                value={values.wordsToAvoid}
                onChange={set('wordsToAvoid')}
                placeholder={copy.fields.wordsToAvoid.placeholder}
                rows={2}
                className={inputCls}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField 
                label={copy.fields.differentiators.label} 
                icon={Sparkles}
                error={errors.differentiators}
              >
                <textarea
                  value={values.differentiators}
                  onChange={set('differentiators')}
                  placeholder={copy.fields.differentiators.placeholder}
                  rows={3}
                  className={inputCls}
                />
              </FormField>

              <FormField 
                label={copy.fields.guaranteesProof.label} 
                icon={ShieldCheck}
                error={errors.guaranteesProof}
              >
                <textarea
                  value={values.guaranteesProof}
                  onChange={set('guaranteesProof')}
                  placeholder={copy.fields.guaranteesProof.placeholder}
                  rows={3}
                  className={inputCls}
                />
              </FormField>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Control Bar */}
      <div className="sticky bottom-6 z-20 p-4 rounded-[14px] bg-surface/85 backdrop-blur-xl border border-border/80 shadow-luxury flex items-center justify-between gap-4">
        <div>
          {screen > 1 ? (
            <button
              type="button"
              onClick={() => setScreen(screen - 1)}
              className="flex items-center gap-1.5 px-4 py-2 border border-border bg-surface-hover rounded-[10px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{copy.buttons.back}</span>
            </button>
          ) : (
            <span className="text-xs text-text-muted px-2">Step 1 of 3: Core Business Details</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {screen < 3 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-[13px] font-bold shadow-interactive transition-all cursor-pointer"
            >
              <span>{copy.buttons.continue}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSave(values)}
                disabled={saving}
                className="px-4 py-2 border border-border bg-surface-hover rounded-[10px] text-[13px] font-semibold text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                {copy.buttons.skip}
              </button>
              <button
                type="button"
                onClick={() => onSave(values)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-[13px] font-bold shadow-interactive transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{saving ? copy.buttons.saving : submitLabel || 'Save Profile & Launch Studio'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

