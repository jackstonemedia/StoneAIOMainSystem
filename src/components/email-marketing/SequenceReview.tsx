/**
 * Create with AI — Sequence Review and Send (Milestone 4, spec §9 + §13).
 *
 * The Phase 8 view for a multi-email sequence: the email list, a CSV
 * recipient picker, automated checks per email, one confirm-all, and — once
 * launched — the campaign status plus per-contact progress from
 * RecipientStates. Later emails send automatically via the sequence runner
 * (the sequence was approved as a whole in Phase 8); pause or cancel stops
 * all unsent steps. An owner can also exit one contact manually.
 */

import React, { useCallback, useEffect, useState } from 'react';
import ReactionPaths from './ReactionPaths';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import {
  resolveRecipients,
  runSendChecks,
  confirmSequenceSend,
  sequenceStatus,
  sequenceExit,
  pauseCampaignAction,
  resumeCampaignAction,
  cancelCampaignAction,
  type BusinessProfile,
  type CampaignDraftState,
  type DraftEmailState,
  type RecipientResolutionState,
  type SendChecksState,
} from '../../lib/createWithAiApi';

export default function SequenceReview({
  draft,
  emails,
  profile,
  onBack,
}: {
  draft: CampaignDraftState;
  emails: DraftEmailState[];
  profile: BusinessProfile;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [csvText, setCsvText] = useState('');
  const [resolution, setResolution] = useState<RecipientResolutionState | null>(null);
  const [checks, setChecks] = useState<Record<string, SendChecksState>>({});
  const [campaignName, setCampaignName] = useState('');
  const [sendNow, setSendNow] = useState(true);
  const [sendAt, setSendAt] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<Awaited<ReturnType<typeof sequenceStatus>> | null>(null);
  const [exitReason, setExitReason] = useState<Record<string, 'replied' | 'booked' | 'unsubscribed'>>({});

  const launched = draft.status === 'scheduled' || !!statusData?.campaign;

  const loadStatus = useCallback(async () => {
    try {
      setStatusData(await sequenceStatus(draft.id));
    } catch {
      /* status is best-effort before launch */
    }
  }, [draft.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleResolve = async () => {
    setBusy(true);
    setError(null);
    try {
      setResolution(await resolveRecipients(draft.id, 'csv', null, csvText));
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleChecks = async (email: DraftEmailState) => {
    setBusy(true);
    setError(null);
    try {
      const result = await runSendChecks(email.id, sendNow ? null : sendAt || null);
      setChecks((prev) => ({ ...prev, [email.id]: result }));
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!resolution || resolution.selected.length === 0) {
      setError('Pick recipients first (CSV) before confirming.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await confirmSequenceSend(draft.id, {
        idempotencyKey,
        campaignName: campaignName || `Create with AI — ${emails[0]?.name || 'Sequence'}`,
        sendNow,
        sendAt: sendNow ? null : sendAt || null,
      });
      toast('success', `Sequence confirmed: ${result.recipientCount} recipients, Email 1 at ${result.sendAtUtc}`);
      await loadStatus();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCampaignAction = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!statusData?.campaign) return;
    setBusy(true);
    try {
      if (action === 'pause') await pauseCampaignAction(statusData.campaign.id);
      if (action === 'resume') await resumeCampaignAction(statusData.campaign.id);
      if (action === 'cancel') await cancelCampaignAction(statusData.campaign.id);
      await loadStatus();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleExit = async (contactId: string) => {
    const reason = exitReason[contactId] || 'replied';
    setBusy(true);
    try {
      await sequenceExit(draft.id, contactId, reason);
      await loadStatus();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="sequence-review">
      {error && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
        <p className="text-sm font-semibold text-text-main">Emails in this sequence</p>
        <ol className="space-y-2">
          {emails.map((e) => {
            const c = checks[e.id];
            return (
              <li key={e.id} className="text-sm">
                <span className="font-semibold text-text-main">Email {e.order}</span>
                <span className="text-text-muted"> — {e.subjectVariants[e.subjectSelected] || e.name} · {e.status}</span>
                {!launched && (
                  <button type="button" onClick={() => handleChecks(e)} className="btn-secondary text-xs ml-2" disabled={busy}>
                    Run checks
                  </button>
                )}
                {c && (
                  <div className="mt-1 ml-4 space-y-1">
                    {c.blocking.map((b, i) => (
                      <p key={i} className="text-xs text-red-400">Blocking: {b}</p>
                    ))}
                    {c.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400">Warning: {w}</p>
                    ))}
                    {c.blocking.length === 0 && c.warnings.length === 0 && (
                      <p className="text-xs text-green-400">Checks pass.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {!launched && (
        <>
          <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
            <p className="text-sm font-semibold text-text-main">Recipients (CSV)</p>
            <p className="text-sm text-text-muted">{createWithAiCopy.review.csvHint}</p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={4}
              className="w-full border border-border rounded-lg p-2 bg-surface text-sm text-text-main"
              aria-label="CSV upload"
              placeholder="email,first_name,last_name"
            />
            <button type="button" onClick={handleResolve} className="btn-secondary text-sm" disabled={busy || !csvText.trim()}>
              Resolve recipients
            </button>
            {resolution && (
              <div className="text-sm space-y-1">
                <p className="text-text-main">Selected: {resolution.selected.length} recipients</p>
                {resolution.excluded.map((x) => (
                  <p key={x.key} className="text-text-muted">
                    Excluded {x.label}: {x.count}
                  </p>
                ))}
                {resolution.csvRejected.length > 0 && (
                  <p className="text-text-muted">
                    CSV rejected rows: {resolution.csvRejected.map((r) => `row ${r.row} (${r.email || 'blank'}): ${r.reason}`).join('; ')}
                  </p>
                )}
                {resolution.csvDuplicates > 0 && <p className="text-text-muted">CSV duplicates removed: {resolution.csvDuplicates}</p>}
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-2">
            <p className="text-sm font-semibold text-text-main">Confirm the whole sequence</p>
            <p className="text-sm text-text-muted">
              Confirming sends Email 1 at the scheduled start; later emails then send automatically per recipient, timed
              from when each person got Email 1. Pause or cancel stops all unsent steps.
            </p>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-surface text-sm text-text-main"
              placeholder="Campaign name (optional)"
              aria-label="Campaign name"
            />
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
              Send now (first in-window slot)
            </label>
            {!sendNow && (
              <input
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
                className="border border-border rounded-lg p-2 bg-surface text-sm text-text-main"
                aria-label="Send at"
              />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirm} className="btn-primary text-sm" disabled={busy || !resolution}>
                Confirm all emails
              </button>
              <button type="button" onClick={onBack} className="btn-secondary text-sm">
                Back to drafts
              </button>
            </div>
          </div>
        </>
      )}

      {launched && statusData && (
        <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3">
          <p className="text-sm font-semibold text-text-main">
            Sequence launched — campaign {statusData.campaign?.status || 'unknown'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleCampaignAction('pause')} className="btn-secondary text-sm" disabled={busy}>
              Pause
            </button>
            <button type="button" onClick={() => handleCampaignAction('resume')} className="btn-secondary text-sm" disabled={busy}>
              Resume
            </button>
            <button type="button" onClick={() => handleCampaignAction('cancel')} className="btn-secondary text-sm" disabled={busy}>
              Cancel
            </button>
            <button type="button" onClick={loadStatus} className="btn-secondary text-sm" disabled={busy}>
              Refresh progress
            </button>
          </div>
          <div className="space-y-2">
            {statusData.states.map((s) => (
              <div key={s.contactId} className="text-sm flex flex-wrap items-center gap-2">
                <span className="text-text-main">{s.email || s.contactId}</span>
                <span className="text-text-muted">
                  {s.status} · next: Email {s.currentEmailOrder}
                  {s.nextSendAt ? ` at ${new Date(s.nextSendAt).toLocaleString()}` : ''}
                </span>
                {s.status === 'active' && (
                  <>
                    <select
                      value={exitReason[s.contactId] || 'replied'}
                      onChange={(e) => setExitReason((prev) => ({ ...prev, [s.contactId]: e.target.value as 'replied' | 'booked' | 'unsubscribed' }))}
                      className="border border-border rounded-lg p-1 bg-surface text-xs text-text-main"
                      aria-label="Exit reason"
                    >
                      <option value="replied">replied</option>
                      <option value="booked">booked</option>
                      <option value="unsubscribed">unsubscribed</option>
                    </select>
                    <button type="button" onClick={() => handleExit(s.contactId)} className="btn-secondary text-xs" disabled={busy}>
                      Exit contact
                    </button>
                  </>
                )}
              </div>
            ))}
            {statusData.states.length === 0 && (
              <p className="text-sm text-text-muted">No recipients enrolled yet — they enroll when Email 1 finishes sending.</p>
            )}
          </div>
          <ReactionPaths draftId={draft.id} emails={emails} />
          <button type="button" onClick={onBack} className="btn-secondary text-sm">
            Back to drafts
          </button>
        </div>
      )}
    </div>
  );
}
