/**
 * Business Profile form — three short screens, all typed inputs.
 * No pick-lists, chips, or dropdowns anywhere (spec §4).
 *
 * Screen 1: Business basics (required) + website prefill shortcut.
 * Screen 2: Sending details (required + booking link and/or phone).
 * Screen 3: Optional extras (all skippable via "Skip for now").
 */

import React, { useState } from 'react';
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
      errors.bookingLink = 'Enter a booking or main action link, or a phone number (at least one is required).';
    }
  }
  return errors;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-main mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-muted mt-1">{hint}</span>}
      {error && <span className="block text-xs text-red-400 mt-1">{error}</span>}
    </label>
  );
}

const inputCls =
  'w-full border border-border bg-surface text-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-text-muted';

export default function ProfileForm({
  initial,
  onSave,
  saving,
  serverErrors,
  submitLabel,
  onCancel,
}: {
  initial: ProfileFormValues;
  onSave: (values: ProfileFormValues) => Promise<void>;
  saving: boolean;
  serverErrors?: Record<string, string>;
  submitLabel?: string;
  onCancel?: () => void;
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
    if (Object.keys(errs).length === 0) setScreen(screen + 1);
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
        setPrefillInfo(`${Object.keys(found).length} suggestion(s) found. Review and apply below — nothing is saved until you save the profile.`);
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
    setPrefillInfo('Suggestions applied to the form. Save the profile to keep them.');
  };

  const screenTitle =
    screen === 1 ? copy.screens.basics.title : screen === 2 ? copy.screens.sending.title : copy.screens.extras.title;
  const screenHint =
    screen === 1 ? copy.screens.basics.hint : screen === 2 ? copy.screens.sending.hint : copy.screens.extras.hint;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-text-main">
          {screenTitle} <span className="text-text-muted font-normal">({screen} of 3)</span>
        </h3>
        <p className="text-sm text-text-muted mt-0.5">{screenHint}</p>
      </div>

      {screen === 1 && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-3 bg-surface/60 space-y-2">
            <p className="text-sm text-text-main">{copy.prefill.prompt}</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={prefillUrl}
                onChange={(e) => setPrefillUrl(e.target.value)}
                placeholder="https://yourbusiness.com"
                className={`${inputCls} flex-1`}
              />
              <button type="button" onClick={runPrefill} disabled={prefillBusy || !prefillUrl.trim()} className="btn-secondary whitespace-nowrap">
                {prefillBusy ? copy.prefill.fetching : copy.prefill.button}
              </button>
            </div>
            {prefillError && <p className="text-xs text-red-400">{prefillError}</p>}
            {prefillInfo && <p className="text-xs text-text-muted">{prefillInfo}</p>}
            {suggestions && (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-bg">
                <p className="text-xs font-semibold text-text-main">
                  {copy.prefill.fromWebsite} — {copy.prefill.confirmHint}
                </p>
                {Object.entries(suggestions).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-text-main">
                      {(copy.fields as unknown as Record<string, { label: string }>)[key]?.label || key}:{' '}
                    </span>
                    <span className="text-text-muted whitespace-pre-line">{value}</span>
                  </div>
                ))}
                <button type="button" onClick={applySuggestions} className="btn-primary text-xs">
                  Apply suggestions
                </button>
              </div>
            )}
          </div>
          <Field label={copy.fields.businessName.label} error={errors.businessName}>
            <input value={values.businessName} onChange={set('businessName')} placeholder={copy.fields.businessName.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.businessType.label} error={errors.businessType}>
            <input value={values.businessType} onChange={set('businessType')} placeholder={copy.fields.businessType.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.services.label} hint={copy.fields.services.hint} error={errors.services}>
            <textarea value={values.services} onChange={set('services')} placeholder={copy.fields.services.placeholder} rows={4} className={inputCls} />
          </Field>
          <Field label={copy.fields.serviceArea.label} error={errors.serviceArea}>
            <input value={values.serviceArea} onChange={set('serviceArea')} placeholder={copy.fields.serviceArea.placeholder} className={inputCls} />
          </Field>
        </div>
      )}

      {screen === 2 && (
        <div className="space-y-4">
          <Field label={copy.fields.senderName.label} error={errors.senderName}>
            <input value={values.senderName} onChange={set('senderName')} placeholder={copy.fields.senderName.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.replyToEmail.label} error={errors.replyToEmail}>
            <input type="email" value={values.replyToEmail} onChange={set('replyToEmail')} placeholder={copy.fields.replyToEmail.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.physicalAddress.label} hint={copy.fields.physicalAddress.hint} error={errors.physicalAddress}>
            <input value={values.physicalAddress} onChange={set('physicalAddress')} placeholder={copy.fields.physicalAddress.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.bookingLink.label} hint={copy.fields.bookingOrPhoneHint} error={errors.bookingLink}>
            <input type="url" value={values.bookingLink} onChange={set('bookingLink')} placeholder={copy.fields.bookingLink.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.phone.label} error={errors.phone}>
            <input type="tel" value={values.phone} onChange={set('phone')} placeholder={copy.fields.phone.placeholder} className={inputCls} />
          </Field>
        </div>
      )}

      {screen === 3 && (
        <div className="space-y-4">
          <Field label={copy.fields.customerType.label} error={errors.customerType}>
            <input value={values.customerType} onChange={set('customerType')} placeholder={copy.fields.customerType.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.voiceDescription.label} error={errors.voiceDescription}>
            <textarea value={values.voiceDescription} onChange={set('voiceDescription')} placeholder={copy.fields.voiceDescription.placeholder} rows={3} className={inputCls} />
          </Field>
          <Field label={copy.fields.wordsToAvoid.label} error={errors.wordsToAvoid}>
            <textarea value={values.wordsToAvoid} onChange={set('wordsToAvoid')} placeholder={copy.fields.wordsToAvoid.placeholder} rows={2} className={inputCls} />
          </Field>
          <Field label={copy.fields.websiteUrl.label} error={errors.websiteUrl}>
            <input type="url" value={values.websiteUrl} onChange={set('websiteUrl')} placeholder={copy.fields.websiteUrl.placeholder} className={inputCls} />
          </Field>
          <Field label={copy.fields.differentiators.label} error={errors.differentiators}>
            <textarea value={values.differentiators} onChange={set('differentiators')} placeholder={copy.fields.differentiators.placeholder} rows={3} className={inputCls} />
          </Field>
          <Field label={copy.fields.guaranteesProof.label} error={errors.guaranteesProof}>
            <textarea value={values.guaranteesProof} onChange={set('guaranteesProof')} placeholder={copy.fields.guaranteesProof.placeholder} rows={3} className={inputCls} />
          </Field>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          {screen > 1 && (
            <button type="button" onClick={() => setScreen(screen - 1)} className="btn-secondary">
              {copy.buttons.back}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
          )}
          {screen < 3 ? (
            <button type="button" onClick={next} className="btn-primary">
              {copy.buttons.continue}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => onSave(values)} disabled={saving} className="btn-secondary">
                {copy.buttons.skip}
              </button>
              <button type="button" onClick={() => onSave(values)} disabled={saving} className="btn-primary">
                {saving ? copy.buttons.saving : submitLabel || copy.buttons.save}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
