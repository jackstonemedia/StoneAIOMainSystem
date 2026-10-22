/**
 * Create with AI — Phase 7 Draft and Refine editor (Milestone 3, spec §12).
 *
 * The user refines by typing or editing directly: direct editing (rich text
 * for branded emails via contentEditable, plain text for the text version),
 * a typed instruction box, regenerate whole/section buttons, undo, version
 * history (last 10), and a consistency check. Placeholders {{NEEDS: …}} are
 * highlighted in the preview and block sending (Phase 8 enforces that).
 * The locked footer is displayed, never editable.
 */

import React, { useMemo, useState } from 'react';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import {
  acceptFactsDraftEmail,
  consistencyCheckDraftEmail,
  editDraftEmail,
  refineDraftEmail,
  undoDraftEmail,
  type BusinessProfile,
  type DraftEmailState,
} from '../../lib/createWithAiApi';

const copy = createWithAiCopy.draft;

type Scope = 'whole' | 'subject' | 'opening' | 'body' | 'cta' | 'signoff';
const SCOPES: { key: Scope; label: string }[] = [
  { key: 'whole', label: 'Whole email' },
  { key: 'subject', label: 'Subject' },
  { key: 'opening', label: 'Opening' },
  { key: 'body', label: 'Body' },
  { key: 'cta', label: 'Call to action' },
  { key: 'signoff', label: 'Sign-off' },
];

/** Fill {{token|fallback}} tokens with a sample contact (preview only). */
function fillSampleTokens(text: string, profile: BusinessProfile): string {
  const values: Record<string, string> = {
    first_name: 'Alex',
    last_name: 'Rivera',
    business_name: profile.businessName,
    sender_name: profile.senderName,
    booking_link: profile.bookingLink || 'https://example.com/book',
    phone: profile.phone || '(408) 555-0132',
  };
  return text.replace(/\{\{\s*([a-z_]+)(?:\|([^}]*))?\s*\}\}/g, (m, name: string, fallback: string | undefined) => {
    const v = values[name];
    if (v) return v;
    if (fallback !== undefined) return fallback;
    return m;
  });
}

/** Highlight {{NEEDS: …}} placeholders for the preview. */
function highlightPlaceholders(html: string): string {
  return html.replace(/\{\{NEEDS:[^}]+\}\}/g, (m) => `<mark style="background:#f59e0b;color:#111;padding:0 2px;border-radius:2px;">${m}</mark>`);
}

export default function DraftEditor({
  email,
  profile,
  onChanged,
  onContinue,
}: {
  email: DraftEmailState;
  profile: BusinessProfile;
  onChanged: (email: DraftEmailState) => void;
  onContinue: () => void;
}) {
  const [view, setView] = useState<'desktop' | 'mobile' | 'text'>('desktop');
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [scope, setScope] = useState<Scope>('whole');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consistency, setConsistency] = useState<{ warnings: string[]; ok: boolean } | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  const selectedSubject = email.subjectVariants[email.subjectSelected] ?? '';
  const previewHtml = useMemo(() => {
    const filled = fillSampleTokens(email.bodyHtml, profile);
    return highlightPlaceholders(filled);
  }, [email.bodyHtml, profile]);
  const previewText = useMemo(() => fillSampleTokens(email.bodyText, profile), [email.bodyText, profile]);

  const run = async (fn: () => Promise<{ email: DraftEmailState }>) => {
    setBusy(true);
    setError(null);
    try {
      const { email: next } = await fn();
      onChanged(next);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectSubject = (idx: number) => {
    void run(() => editDraftEmail(email.id, { subjectSelected: idx }));
  };

  const handlePreviewText = (value: string) => {
    void run(() => editDraftEmail(email.id, { previewText: value }));
  };

  const handleBodyBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    if (html !== email.bodyHtml) void run(() => editDraftEmail(email.id, { bodyHtml: html }));
  };

  const handleTextBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text !== email.bodyText) void run(() => editDraftEmail(email.id, { bodyText: text }));
  };

  const handleRefine = () => {
    if (!instruction.trim()) return;
    void run(() => refineDraftEmail(email.id, instruction.trim(), scope));
    setInstruction('');
  };

  const handleUndo = () => {
    void run(() => undoDraftEmail(email.id));
  };

  const handleConsistency = async () => {
    setBusy(true);
    setError(null);
    try {
      setConsistency(await consistencyCheckDraftEmail(email.id));
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="draft-editor">
      <div className="border border-border rounded-lg p-3 bg-surface/40">
        <p className="text-sm font-semibold text-text-main">{copy.opening}</p>
        <p className="text-sm text-text-muted mt-1">{email.name} · {email.purpose || 'Single campaign email'}</p>
      </div>

      {error && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {email.placeholders.length > 0 && (
        <div className="border border-amber-500/50 rounded-lg p-3 bg-amber-500/10">
          <p className="text-sm text-amber-300">{copy.placeholderNote}</p>
          <p className="text-xs text-text-muted mt-1">{email.placeholders.join(', ')}</p>
        </div>
      )}

      {email.newClaims.length > 0 && (
        <div className="border border-amber-500/50 rounded-lg p-3 bg-amber-500/10 space-y-2">
          <p className="text-sm text-amber-300">
            You typed new facts that are not in the profile or Brief yet: {email.newClaims.join(', ')}. Add them to the Brief so they
            validate, or they will stay flagged.
          </p>
          <button
            type="button"
            onClick={() => run(() => acceptFactsDraftEmail(email.id, email.newClaims))}
            className="btn-primary text-xs"
            disabled={busy}
          >
            Add to Brief
          </button>
        </div>
      )}

      {email.removedClaims.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-surface/30">
          <p className="text-sm text-text-main">{copy.removedNote}</p>
          <ul className="text-xs text-text-muted mt-1 list-disc pl-4">
            {email.removedClaims.map((r, i) => (
              <li key={i}>{r.claim} ({r.where})</li>
            ))}
          </ul>
        </div>
      )}

      {/* Subject options */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <p className="text-sm font-semibold text-text-main">{copy.subjectLabel}</p>
        {email.subjectVariants.map((s, i) => (
          <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`subject-${email.id}`}
              checked={email.subjectSelected === i}
              onChange={() => handleSelectSubject(i)}
              disabled={busy}
              className="mt-1"
            />
            <span className="text-text-main">{s}</span>
            <span className="text-xs text-text-muted">({s.length} chars)</span>
          </label>
        ))}
        <label className="block text-sm mt-2">
          <span className="text-text-muted">{copy.previewLabel}</span>
          <input
            type="text"
            defaultValue={email.previewText || ''}
            onBlur={(e) => handlePreviewText(e.target.value)}
            maxLength={90}
            className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
          />
        </label>
      </div>

      {/* Preview toggles */}
      <div className="flex gap-2 items-center">
        <button type="button" onClick={() => setView('desktop')} className={view === 'desktop' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
          {copy.desktop}
        </button>
        <button type="button" onClick={() => setView('mobile')} className={view === 'mobile' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
          {copy.mobile}
        </button>
        <button type="button" onClick={() => setView('text')} className={view === 'text' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
          {copy.plainText}
        </button>
        <button type="button" onClick={() => setEditing((v) => !v)} className="btn-secondary text-xs">
          {editing ? 'Done editing' : 'Edit directly'}
        </button>
      </div>

      {/* Preview / edit area */}
      <div className="border border-border rounded-lg p-3 bg-surface/30">
        <p className="text-xs text-text-muted mb-2">{copy.samplePreview}</p>
        {view === 'text' ? (
          editing ? (
            <textarea
              defaultValue={email.bodyText}
              onBlur={handleTextBlur}
              rows={12}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main font-mono"
              aria-label="Plain-text email body"
            />
          ) : (
            <pre className="text-sm text-text-main whitespace-pre-wrap font-sans">{previewText}</pre>
          )
        ) : editing ? (
          <div
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBodyBlur}
            className="text-sm text-text-main bg-bg border border-border rounded-lg p-3 min-h-[200px]"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            aria-label="Email body editor"
          />
        ) : (
          <div
            className={view === 'mobile' ? 'max-w-[380px] mx-auto border border-border rounded-lg p-3 bg-bg' : 'bg-bg border border-border rounded-lg p-3'}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
        {/* Locked footer (display only — never editable, spec §17). */}
        <div className="mt-4 border-t border-border pt-3 text-xs text-text-muted" data-testid="locked-footer">
          <p>{copy.footerLocked}</p>
          <p className="mt-1">
            {profile.businessName} · {profile.physicalAddress}
          </p>
          <p className="mt-1 underline">Unsubscribe</p>
        </div>
      </div>

      {/* Refine controls (typed instruction + action buttons, spec §12). */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={copy.refinePlaceholder}
          rows={2}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
          aria-label="Refine instruction"
        />
        <div className="flex flex-wrap gap-2 items-center">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={scope === s.key ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
            >
              {s.label}
            </button>
          ))}
          <button type="button" onClick={handleRefine} className="btn-primary text-xs" disabled={!instruction.trim() || busy}>
            {copy.refine}
          </button>
          <button type="button" onClick={handleUndo} className="btn-secondary text-xs" disabled={busy || email.versions.length === 0}>
            {copy.undo}
          </button>
          <button type="button" onClick={handleConsistency} className="btn-secondary text-xs" disabled={busy}>
            {copy.consistencyCheck}
          </button>
          <button type="button" onClick={() => setShowVersions((v) => !v)} className="btn-secondary text-xs">
            {copy.versions} ({email.versions.length})
          </button>
          <button type="button" onClick={() => setShowFacts((v) => !v)} className="btn-secondary text-xs">
            {copy.factMapLabel}
          </button>
        </div>
        {consistency && (
          <div className="text-sm">
            {consistency.ok ? (
              <p className="text-green-400">Consistency check passed — no warnings.</p>
            ) : (
              <ul className="text-amber-300 list-disc pl-4">
                {consistency.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {showVersions && (
          <div className="text-xs text-text-muted space-y-1">
            {email.versions.length === 0 && <p>No earlier versions yet.</p>}
            {email.versions.map((v, i) => (
              <p key={i}>
                {new Date(v.at).toLocaleString()} — {v.note}
              </p>
            ))}
          </div>
        )}
        {showFacts && (
          <div className="text-xs text-text-muted space-y-1">
            {email.factMap.length === 0 && <p>No fact map recorded for this draft.</p>}
            {email.factMap.map((f, i) => (
              <p key={i}>
                {f.claim} → {f.source}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onContinue} className="btn-primary text-sm" disabled={busy}>
          Continue to Review and Send
        </button>
      </div>
    </div>
  );
}
