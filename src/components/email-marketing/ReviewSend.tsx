/**
 * Create with AI — Phase 8 Review and Send (Milestone 3, spec §13).
 *
 * Recipient picker (saved segment, smart list, list, CSV upload), exclusion
 * counts with per-group views, mismatch warning, token coverage, automated
 * checks (blocking + warnings), test send, path simulator, schedule
 * (send now / schedule, send window respected), final confirmation with an
 * idempotency key, and pause/resume/cancel after launch.
 */

import React, { useEffect, useState } from 'react';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import {
  cancelCampaignAction,
  confirmSendDraftEmail,
  getCampaignStatus,
  getRecipientSources,
  pauseCampaignAction,
  resolveRecipients,
  resumeCampaignAction,
  runSendChecks,
  simulatePath,
  suggestFilter,
  testSendDraftEmail,
  recommendedStart,
  type BusinessProfile,
  type CampaignDraftState,
  type DraftEmailState,
  type RecipientResolutionState,
  type SendChecksState,
} from '../../lib/createWithAiApi';

const copy = createWithAiCopy.review;

type SourceType = 'segment' | 'smartList' | 'list' | 'csv';
const SOURCE_LABELS: Record<SourceType, string> = {
  segment: copy.segment,
  smartList: copy.smartList,
  list: copy.list,
  csv: copy.csv,
};
const SCENARIOS = ['did_not_open', 'opened_no_click', 'clicked', 'clicked_link', 'clicked_not_booked', 'replied', 'booked'];

function apiError(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || e?.message || 'Something went wrong.';
}

export default function ReviewSend({
  draft,
  email,
  profile,
  onBack,
}: {
  draft: CampaignDraftState;
  email: DraftEmailState;
  profile: BusinessProfile;
  onBack: () => void;
}) {
  const [sources, setSources] = useState<{ segments: { id: string; name: string }[]; smartLists: { id: string; name: string }[]; lists: { id: string; name: string }[] } | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>('list');
  const [sourceId, setSourceId] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [suggestion, setSuggestion] = useState<{ suggestion: string; mapped: { hint: string; field: string }[]; unmapped: string[] } | null>(null);
  const [resolution, setResolution] = useState<RecipientResolutionState | null>(null);
  const [checks, setChecks] = useState<SendChecksState | null>(null);
  const [testAddresses, setTestAddresses] = useState(profile.replyToEmail);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [scenario, setScenario] = useState('clicked');
  const [simResult, setSimResult] = useState<{ scenario: string; emails: { name: string; when: string; trigger: string }[]; note: string } | null>(null);
  const [sendNow, setSendNow] = useState(true);
  const [sendAt, setSendAt] = useState('');
  const [recommended, setRecommended] = useState<{ atUtc: string; reason: string; timeZone: string } | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [coldAck, setColdAck] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmResult, setConfirmResult] = useState<{ campaignId: string; sendAtUtc: string; recipientCount: number; idempotentReplay: boolean; note: string } | null>(null);
  const [campaignState, setCampaignState] = useState<Awaited<ReturnType<typeof getCampaignStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coldContacts = !!((draft.brief as Record<string, any> | null)?.audience?.cold_contacts);
  const launched = email.status === 'scheduled' || email.status === 'sending' || email.status === 'sent' || !!confirmResult;

  useEffect(() => {
    getRecipientSources().then(setSources).catch(() => undefined);
    suggestFilter(draft.id).then(setSuggestion).catch(() => undefined);
    recommendedStart(draft.id).then(setRecommended).catch(() => undefined);
    if (email.campaignId) {
      getCampaignStatus(email.campaignId).then(setCampaignState).catch(() => undefined);
    }
  }, [draft.id, email.campaignId]);

  const sourceOptions = sources
    ? sourceType === 'segment'
      ? sources.segments
      : sourceType === 'smartList'
        ? sources.smartLists
        : sources.lists
    : [];

  const handleResolve = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await resolveRecipients(draft.id, sourceType, sourceType === 'csv' ? null : sourceId || null, sourceType === 'csv' ? csvText : null);
      setResolution(res);
      setChecks(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleChecks = async () => {
    setBusy(true);
    setError(null);
    try {
      setChecks(await runSendChecks(email.id, sendNow ? null : sendAt || null));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTestSend = async () => {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const addresses = testAddresses.split(',').map((a) => a.trim()).filter(Boolean);
      const res = await testSendDraftEmail(email.id, addresses);
      setTestResult(`Test send delivered to ${res.to.join(', ')} — subject: ${res.subject}. ${res.note}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = async (s: string) => {
    setScenario(s);
    try {
      setSimResult(await simulatePath(email.id, s));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await confirmSendDraftEmail(email.id, {
        idempotencyKey,
        campaignName: campaignName.trim() || 'Create with AI campaign',
        sendNow,
        sendAt: sendNow ? null : sendAt || null,
        coldAck,
      });
      setConfirmResult(res);
      const st = await getCampaignStatus(res.campaignId);
      setCampaignState(st);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCampaignAction = async (action: 'pause' | 'resume' | 'cancel') => {
    const campaignId = confirmResult?.campaignId || email.campaignId;
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'pause') await pauseCampaignAction(campaignId);
      if (action === 'resume') await resumeCampaignAction(campaignId);
      if (action === 'cancel') await cancelCampaignAction(campaignId);
      setCampaignState(await getCampaignStatus(campaignId));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const refreshCampaign = async () => {
    const campaignId = confirmResult?.campaignId || email.campaignId;
    if (!campaignId) return;
    try {
      setCampaignState(await getCampaignStatus(campaignId));
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="space-y-4" data-testid="review-send">
      <div className="border border-border rounded-lg p-3 bg-surface/40">
        <p className="text-sm font-semibold text-text-main">{copy.opening}</p>
        <p className="text-sm text-text-muted mt-1">
          Subject: {email.subjectVariants[email.subjectSelected] ?? ''} · Preview: {email.previewText || '(none)'}
        </p>
      </div>

      {error && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {launched && campaignState ? (
        <div className="border border-border rounded-lg p-3 space-y-2">
          <p className="text-sm font-semibold text-text-main">Campaign: {campaignState.campaign.name}</p>
          <p className="text-sm text-text-muted">
            Status: {campaignState.campaign.status} · Recipients: {campaignState.campaign.recipientCount ?? 0} · Scheduled:{' '}
            {campaignState.campaign.scheduledAtUtc ? new Date(campaignState.campaign.scheduledAtUtc).toLocaleString() : '—'}
          </p>
          {confirmResult && <p className="text-sm text-text-muted">{confirmResult.note}</p>}
          <p className="text-sm text-text-muted">
            Events: {Object.entries(campaignState.counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none yet'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleCampaignAction('pause')} className="btn-secondary text-xs" disabled={busy}>
              {copy.pause}
            </button>
            <button type="button" onClick={() => handleCampaignAction('resume')} className="btn-secondary text-xs" disabled={busy}>
              {copy.resume}
            </button>
            <button type="button" onClick={() => handleCampaignAction('cancel')} className="btn-secondary text-xs" disabled={busy}>
              {copy.cancel}
            </button>
            <button type="button" onClick={refreshCampaign} className="btn-secondary text-xs" disabled={busy}>
              Refresh status
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Recipient picker */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-text-main">{copy.recipientLabel}</p>
            {suggestion && (
              <div className="text-sm text-text-muted">
                <p>AI-suggested filter: {suggestion.suggestion}</p>
                {suggestion.unmapped.map((u, i) => (
                  <p key={i} className="text-xs">Note: {u}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              {(Object.keys(SOURCE_LABELS) as SourceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSourceType(t);
                    setSourceId('');
                    setResolution(null);
                  }}
                  className={sourceType === t ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                >
                  {SOURCE_LABELS[t]}
                </button>
              ))}
            </div>
            {sourceType === 'csv' ? (
              <div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={'email,first_name,last_name,phone,company\njane@example.com,Jane,Rivera,,'}
                  rows={4}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main font-mono"
                  aria-label="CSV upload"
                />
                <p className="text-xs text-text-muted mt-1">{copy.csvHint}</p>
              </div>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
                aria-label="Recipient source"
              >
                <option value="">Choose…</option>
                {sourceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleResolve}
              className="btn-primary text-xs"
              disabled={busy || (sourceType !== 'csv' && !sourceId) || (sourceType === 'csv' && !csvText.trim())}
            >
              Resolve recipients
            </button>
          </div>

          {/* Resolution: counts, exclusions, mismatch, token coverage */}
          {resolution && (
            <div className="border border-border rounded-lg p-3 space-y-2">
              <p className="text-sm text-text-main">
                {resolution.sourceName} · {resolution.totalCandidates} candidates · {resolution.selected.length} selected
              </p>
              <p className="text-sm font-semibold text-text-main">{copy.exclusionLabel}</p>
              <ul className="text-sm text-text-muted space-y-1">
                {resolution.excluded.map((g) => (
                  <li key={g.key}>
                    {g.label}: {g.count}
                    {g.count > 0 && <span className="text-xs"> — {g.contacts.slice(0, 5).map((c) => c.email).join(', ')}{g.count > 5 ? `, +${g.count - 5} more` : ''}</span>}
                  </li>
                ))}
              </ul>
              {resolution.phase2ExclusionsNote && (
                <p className="text-xs text-text-muted">You also said to exclude in Phase 2: {resolution.phase2ExclusionsNote}</p>
              )}
              {resolution.mismatch.applicable && (
                <p className={resolution.mismatch.warned ? 'text-sm text-amber-300' : 'text-sm text-text-muted'}>
                  {resolution.mismatch.warned ? copy.mismatchWarn + ' ' : ''}{resolution.mismatch.detail}
                </p>
              )}
              {resolution.csvRejected.length > 0 && (
                <p className="text-sm text-text-muted">
                  CSV rejected rows: {resolution.csvRejected.map((r) => `row ${r.row} (${r.email || 'blank'}): ${r.reason}`).join('; ')}
                </p>
              )}
              {resolution.csvDuplicates > 0 && <p className="text-sm text-text-muted">CSV duplicates removed: {resolution.csvDuplicates}</p>}
              <p className="text-sm font-semibold text-text-main">{copy.tokenCoverageLabel}</p>
              <ul className="text-sm text-text-muted">
                {Object.entries(resolution.tokenCoverage).map(([token, cov]) => (
                  <li key={token}>
                    {token}: {cov.missing} of {cov.total} lack a value (fallback applies)
                  </li>
                ))}
                {Object.keys(resolution.tokenCoverage).length === 0 && <li>No contact tokens used in this email.</li>}
              </ul>
            </div>
          )}

          {/* Automated checks */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-text-main">{copy.checksLabel}</p>
            <button type="button" onClick={handleChecks} className="btn-secondary text-xs" disabled={busy}>
              Run checks
            </button>
            {checks && (
              <div className="text-sm space-y-1">
                {checks.blocking.length === 0 ? (
                  <p className="text-green-400">No blocking issues.</p>
                ) : (
                  <ul className="text-red-400 list-disc pl-4">
                    {checks.blocking.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                {checks.warnings.map((w, i) => (
                  <p key={i} className="text-amber-300">{w}</p>
                ))}
                <p className="text-text-muted text-xs">{checks.domainAuth.note}</p>
                {checks.links.map((l, i) => (
                  <p key={i} className="text-text-muted text-xs">
                    {l.url} — {l.ok ? `OK (${l.status})` : 'unreachable'}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Test send */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-text-main">{copy.testSendLabel}</p>
            <input
              type="text"
              value={testAddresses}
              onChange={(e) => setTestAddresses(e.target.value)}
              placeholder="owner@example.com"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
              aria-label="Test send addresses"
            />
            <button type="button" onClick={handleTestSend} className="btn-secondary text-xs" disabled={busy || !testAddresses.trim()}>
              {copy.testSend}
            </button>
            {testResult && <p className="text-sm text-green-400">{testResult}</p>}
          </div>

          {/* Path simulator */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-text-main">{copy.simulatorLabel}</p>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSimulate(s)}
                  className={scenario === s ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {simResult && (
              <div className="text-sm text-text-muted">
                <p>Scenario: {simResult.scenario}</p>
                {simResult.emails.map((e, i) => (
                  <p key={i}>
                    {e.name} — {e.when} ({e.trigger})
                  </p>
                ))}
                <p>{simResult.note}</p>
              </div>
            )}
          </div>

          {/* Schedule + final confirmation */}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-text-main">{copy.confirmTitle}</p>
            {recommended && (
              <p className="text-sm text-text-muted">
                {copy.recommendedStart}: {new Date(recommended.atUtc).toLocaleString()} ({recommended.timeZone}) — {recommended.reason}
              </p>
            )}
            <label className="block text-sm">
              <span className="text-text-muted">{copy.campaignNameLabel}</span>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Create with AI campaign"
                className="mt-1 w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
              />
            </label>
            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} /> {copy.sendNow}
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} /> {copy.scheduleFor}
              </label>
              {!sendNow && (
                <input
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-bg text-text-main"
                  aria-label="Scheduled send time"
                />
              )}
            </div>
            {coldContacts && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={coldAck} onChange={(e) => setColdAck(e.target.checked)} className="mt-1" />
                <span>{copy.coldAck}</span>
              </label>
            )}
            <p className="text-xs text-text-muted">{copy.idempotencyNote} Key: {idempotencyKey}</p>
            <button
              type="button"
              onClick={handleConfirm}
              className="btn-primary text-sm"
              disabled={busy || !resolution || resolution.selected.length === 0 || (checks !== null && checks.blocking.length > 0) || (!sendNow && !sendAt) || (coldContacts && !coldAck)}
            >
              {sendNow ? copy.send : copy.schedule}
            </button>
            {checks === null && <p className="text-xs text-text-muted">Run the automated checks first to enable sending.</p>}
          </div>
        </>
      )}

      <button type="button" onClick={onBack} className="btn-secondary text-xs">
        Back to draft
      </button>
    </div>
  );
}
