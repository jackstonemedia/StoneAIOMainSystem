/**
 * Create with AI — Campaign results (Milestone 6, spec §14).
 *
 * Computed live on every load (nothing stored for reuse): delivered,
 * bounced, unique clicks, click rate, replies, unsubscribes, complaints
 * (unavailable under Gmail-only), approximate opens (secondary), paths,
 * the A/B outcome, health alerts, and a 2–4 sentence AI summary using
 * only real numbers (template fallback when AI is unconfigured).
 */
import React, { useEffect, useState } from 'react';
import {
  addSamplePaste,
  evaluateWinner,
  getCampaignResults,
  getResultsSummary,
  type CampaignResultsState,
} from '../../lib/createWithAiApi';

export default function CampaignResults({
  campaignId,
  sampleTitle,
  sampleContent,
}: {
  campaignId: string;
  /** Sent-email body for "Save as a good example" (spec §14, the only
   * campaign→profile path). Hidden when absent. */
  sampleTitle?: string;
  sampleContent?: string;
}) {
  const [results, setResults] = useState<CampaignResultsState | null>(null);
  const [summary, setSummary] = useState<{ summary: string; source: 'ai' | 'template' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [r, s] = await Promise.all([getCampaignResults(campaignId), getResultsSummary(campaignId)]);
      setResults(r);
      setSummary(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load results.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  if (error) {
    return (
      <div className="border border-border rounded-lg p-3">
        <p className="text-sm text-red-400">{error}</p>
        <button type="button" onClick={load} className="btn-secondary text-xs mt-2">
          Retry
        </button>
      </div>
    );
  }
  if (!results) return <p className="text-sm text-text-muted">Loading results…</p>;

  const abOutcome = results.ab
    ? results.ab.winnerRule === 'no_clear_winner'
      ? `No clear winner (${results.ab.clicksA} vs ${results.ab.clicksB} unique clicks) — version A went to the rest.`
      : results.ab.winner
        ? `Version ${results.ab.winner} won (${results.ab.clicksA} vs ${results.ab.clicksB} unique clicks).`
        : results.ab.testing
          ? `Test running — winner picked after the wait${results.ab.waitEndsAt ? ` (ends ${new Date(results.ab.waitEndsAt).toLocaleString()})` : ''}.`
          : 'No test ran.'
    : null;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <p className="text-sm font-semibold text-text-main">Results — {results.campaignName}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <p className="text-text-muted">Delivered: <span className="text-text-main">{results.delivered}</span></p>
        <p className="text-text-muted">Bounced: <span className="text-text-main">{results.bounced}</span></p>
        <p className="text-text-muted">Unique clicks: <span className="text-text-main">{results.uniqueClicks}</span></p>
        <p className="text-text-muted">Click rate: <span className="text-text-main">{(results.clickRate * 100).toFixed(1)}%</span></p>
        <p className="text-text-muted">Replies: <span className="text-text-main">{results.replies}</span></p>
        <p className="text-text-muted">Unsubscribes: <span className="text-text-main">{results.unsubscribes}</span></p>
        <p className="text-text-muted">
          Complaints: <span className="text-text-main">{results.complaints}</span>
          {results.complaintsUnavailable && <span className="text-xs"> (unavailable under Gmail-only — Gmail does not notify senders of spam complaints)</span>}
        </p>
        <p className="text-text-muted">Approximate opens: <span className="text-text-main">{results.approximateOpens}</span></p>
      </div>
      <div className="text-sm text-text-muted space-y-1">
        <p className="font-semibold text-text-main">Paths</p>
        <p>Received only the first email: {results.paths.receivedOnlyFirst}</p>
        <p>Non-clicker follow-up: {results.paths.nonClickerFollowup}</p>
        <p>Clicked and got a reaction email: {results.paths.clickReaction}</p>
        <p>Replied and exited: {results.paths.exitedReply}</p>
        <p>Unsubscribed and exited: {results.paths.exitedUnsubscribed}</p>
        <p>Bounced and exited: {results.paths.exitedBounced}</p>
      </div>
      {abOutcome && (
        <div className="text-sm">
          <p className="font-semibold text-text-main">A/B result</p>
          <p className="text-text-muted">{abOutcome}</p>
          {results.ab?.testing && (
            <button
              type="button"
              className="btn-secondary text-xs mt-2"
              onClick={async () => {
                await evaluateWinner(campaignId);
                await load();
              }}
            >
              Evaluate winner now
            </button>
          )}
        </div>
      )}
      {results.health.warnings.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold text-text-main">Health alerts</p>
          {results.health.warnings.map((w, i) => (
            <p key={i} className="text-amber-300">{w}</p>
          ))}
          {results.health.autoPause && <p className="text-red-400">This campaign was auto-paused at the threshold.</p>}
        </div>
      )}
      {summary && (
        <div className="text-sm">
          <p className="font-semibold text-text-main">Summary</p>
          <p className="text-text-muted">{summary.summary}</p>
          {summary.source === 'template' && <p className="text-xs text-text-muted">Template summary (AI unavailable) — numbers only, from this campaign's real data.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={load} className="btn-secondary text-xs">
          Refresh results
        </button>
        {sampleContent && (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={saving || saved}
            onClick={async () => {
              setSaving(true);
              try {
                await addSamplePaste(sampleTitle || results.campaignName, sampleContent);
                setSaved(true);
              } catch {
                setError('Could not save as an example.');
              } finally {
                setSaving(false);
              }
            }}
          >
            {saved ? 'Saved as an example' : 'Save as a good example'}
          </button>
        )}
      </div>
    </div>
  );
}
