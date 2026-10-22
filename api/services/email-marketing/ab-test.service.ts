/**
 * M6 — A/B testing + results (spec §11 + §14), Gmail-only.
 *
 * Design notes (locked for M6, see the evidence log):
 * - The winner rule is the SPEC rule (≥20 total unique clicks + ≥10%
 *   relative rate difference, else "no clear winner" → send A). It is
 *   deliberately NOT the pre-existing analytics z-test: that one defaults
 *   to open_rate, and opens are never the winning metric (spec §11).
 *   The old analytics function is left untouched for the old
 *   CampaignBuilder UI; the Create-with-AI path uses evaluateWinner here.
 * - The old auto-rollout in processScheduledCampaigns only fires for
 *   campaigns with abTestConfig.autoRollout. M6 campaigns never set it;
 *   processDueAbWinners below is their tick.
 * - A/B testing applies to Email 1 only in this version (the spec's own
 *   B4 test conversation tests Email 1 only). A plan naming a later email
 *   is a BLOCKING Phase 8 item, not a silent downgrade.
 * - Results are computed live from EmailEvents / CampaignRecipients /
 *   RecipientStates on every read. Nothing is stored for reuse (spec
 *   §14 + §15): no table, field, or cache holds performance history for
 *   later campaigns. The AI summary is generated on read, never saved.
 * - Complaints: under Gmail-only no COMPLAINED events are ever created by
 *   the system (Gmail has no complaint notification equivalent), so the
 *   complaint rate stays 0 and its thresholds cannot fire from real data.
 *   The check is still implemented, so it fires if complaint data ever
 *   exists (e.g. recorded through the app's own abuse path).
 */

export type AbMode = 'none' | 'split' | 'test_then_winner' | 'decide_at_send';

export interface AbTestPlan {
  decision: 'yes' | 'no';
  variable: 'subject' | 'cta' | null;
  testEmailOrder: number;
  variantA: string;
  variantB: string;
  waitHours: number;
  metric: 'clicks' | 'replies';
  estimatedCount: number | null;
  mode: AbMode;
  readback: string;
}

export const AB_MODE_LABELS: Record<AbMode, string> = {
  none: 'No A/B test',
  split: 'Split test for learning (small sample, directional only)',
  test_then_winner: 'Test, then send the winner',
  decide_at_send: 'Mode decided at send time from the real list size',
};

/** Spec §11 test modes by list size. */
export function modeForCount(count: number): 'none' | 'split' | 'test_then_winner' {
  if (count < 500) return 'none';
  if (count < 2000) return 'split';
  return 'test_then_winner';
}

function numOf(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function itemFact(items: Array<Record<string, unknown>>, id: string): string {
  const it = items.find((i) => i.id === id) as { fact?: string; user_words?: string } | undefined;
  return String(it?.fact || it?.user_words || '').trim();
}

function itemComplete(items: Array<Record<string, unknown>>, id: string): boolean {
  const it = items.find((i) => i.id === id) as { status?: string } | undefined;
  return it?.status === 'complete';
}

export interface AssembledAbTest {
  plan: AbTestPlan;
  /** Timeline lines for the Plan confirmation (sequence + reactions + A/B). */
  timeline: string[];
}

/**
 * Lenient assembly from the Phase 6 checklist (mirrors
 * assembleReactionsFromChecklist): a "no test" decision is a valid plan;
 * a "yes" decision with a missing variable, missing/identical variants,
 * an opens/bookings metric, an out-of-range wait, or an out-of-range test
 * email is an error (clarification, stay) — never a guessed plan.
 */
export function assembleAbTestFromChecklist(
  items: Array<Record<string, unknown>>,
  sequenceCount: number,
): { ok: true; assembled: AssembledAbTest } | { ok: false; error: string } {
  const decisionRaw = itemFact(items, 'test_decision').toLowerCase();
  // "Yes, skip it" means NO (B4a): a skip/no-test phrase wins unless the
  // fact affirmatively names testing ("test it", "test two versions").
  const saysNo =
    /\b(skip|no test|don't test|dont test|not test|^no\b)/.test(decisionRaw) &&
    !/\btest (it|this|two|them|the)\b/.test(decisionRaw);
  const saysYes = /\b(yes|test|try)\b/.test(decisionRaw) && !saysNo;
  if (!saysYes && !saysNo && !itemComplete(items, 'test_decision')) {
    return { ok: false, error: 'whether to test at all is not decided yet' };
  }
  if (saysNo && !saysYes) {
    const plan: AbTestPlan = {
      decision: 'no',
      variable: null,
      testEmailOrder: 1,
      variantA: '',
      variantB: '',
      waitHours: 24,
      metric: 'clicks',
      estimatedCount: numOf(itemFact(items, 'audience_size')),
      mode: 'none',
      readback:
        'No A/B test. The campaign sends one version to everyone, and a later email can try a different subject line instead.',
    };
    return { ok: true, assembled: { plan, timeline: ['No A/B test — one version to everyone.'] } };
  }
  const variableRaw = itemFact(items, 'variable').toLowerCase();
  let variable: 'subject' | 'cta' | null = null;
  if (variableRaw.includes('subject')) variable = 'subject';
  else if (variableRaw.includes('call') || variableRaw.includes('cta') || variableRaw.includes('button') || variableRaw.includes('action')) variable = 'cta';
  if (!variable) return { ok: false, error: 'what to test (the subject line or the call-to-action wording) is not decided yet' };

  const variantA = itemFact(items, 'variant_a');
  const variantB = itemFact(items, 'variant_b');
  if (!variantA || !variantB) {
    return { ok: false, error: `both versions of the ${variable === 'subject' ? 'subject line' : 'call-to-action wording'} are needed before the test can be set up` };
  }
  if (variantA.toLowerCase() === variantB.toLowerCase()) {
    return { ok: false, error: 'the two versions must differ in exactly one thing — right now they are identical' };
  }

  const metricRaw = itemFact(items, 'win_metric').toLowerCase();
  if (metricRaw.includes('open')) {
    return { ok: false, error: 'opens are approximate, so they can never pick the winner — clicks or replies instead' };
  }
  if (metricRaw.includes('book')) {
    return { ok: false, error: 'bookings cannot pick the winner because this platform does not track booking events — clicks or replies instead' };
  }
  const metric: 'clicks' | 'replies' = metricRaw.includes('repl') ? 'replies' : 'clicks';

  let waitHours = 24;
  const waitRaw = itemFact(items, 'wait_hours');
  if (waitRaw) {
    const days = waitRaw.match(/(\d+)\s*days?/);
    const hours = waitRaw.match(/(\d+)\s*hours?/);
    if (days) waitHours = parseInt(days[1], 10) * 24;
    else if (hours) waitHours = parseInt(hours[1], 10);
    else {
      const n = numOf(waitRaw);
      if (n !== null) waitHours = n;
    }
    if (waitHours < 4 || waitHours > 72) {
      return { ok: false, error: `the wait must be between 4 and 72 hours (got ${waitHours})` };
    }
  }

  let testEmailOrder = 1;
  const emailRaw = itemFact(items, 'test_email');
  if (emailRaw) {
    const n = numOf(emailRaw);
    if (emailRaw.includes('first') && !n) testEmailOrder = 1;
    else if (n !== null) testEmailOrder = n;
    if (testEmailOrder < 1 || testEmailOrder > Math.max(1, sequenceCount)) {
      return { ok: false, error: `the test email must be one of the ${sequenceCount} sequence emails (got Email ${testEmailOrder})` };
    }
  }

  const estimatedCount = numOf(itemFact(items, 'audience_size'));
  const mode: AbMode = estimatedCount === null ? 'decide_at_send' : modeForCount(estimatedCount);
  const modeSentence =
    mode === 'none'
      ? `With about ${estimatedCount} people, results would mostly be noise, so no test runs — Email 2 already gives a second subject line to learn from.`
      : mode === 'split'
        ? `With about ${estimatedCount} people, the whole send splits 50/50 for learning, with no automatic winner — results are labeled "small sample, directional only".`
        : mode === 'test_then_winner'
          ? `With about ${estimatedCount} people, each version goes to 10% of the list, then the winner goes to the remaining 80% after ${waitHours} hours. About 80% of the list gets Email 1 a day later than the first group.`
          : 'The test mode is decided at send time from the real list size.';
  const readback =
    `A/B test on Email ${testEmailOrder}: two versions of the ${variable === 'subject' ? 'subject line' : 'call-to-action wording'} — A: "${variantA}", B: "${variantB}". ` +
    `The winner is picked by ${metric} after ${waitHours} hours. ${modeSentence}`;
  const timeline = [
    `A/B test on Email ${testEmailOrder} (${variable === 'subject' ? 'subject line' : 'call-to-action wording'}): A "${variantA}" vs B "${variantB}", winner by ${metric} after ${waitHours} hours.`,
    `Test mode: ${AB_MODE_LABELS[mode]}.`,
  ];
  return {
    ok: true,
    assembled: {
      plan: { decision: 'yes', variable, testEmailOrder, variantA, variantB, waitHours, metric, estimatedCount, mode, readback },
      timeline,
    },
  };
}

/** Plain-language readback of a locked plan (sequence + reactions + A/B). */
export function planReadback(plan: Record<string, unknown>): string {
  const ab = plan.ab_test as AbTestPlan | null | undefined;
  const seq = plan.sequence as { count?: number; emails?: Array<{ order?: number; purpose?: string }> } | undefined;
  const lines: string[] = [];
  if (seq?.emails) {
    for (const e of seq.emails) lines.push(`Email ${e.order} (${e.purpose || 'email'}).`);
  } else if (seq?.count) {
    lines.push(`${seq.count} email${seq.count === 1 ? '' : 's'} in the sequence.`);
  }
  const reactions = plan.reactions as { ruleCount?: number } | undefined;
  if (reactions?.ruleCount) lines.push(`${reactions.ruleCount} reaction rule${reactions.ruleCount === 1 ? '' : 's'}.`);
  if (ab && ab.decision === 'yes') lines.push(ab.readback);
  else lines.push('No A/B test.');
  return lines.join(' ');
}

/**
 * Phase 8 re-check (spec §11): the actual list count may differ from the
 * estimate, so the mode is re-selected from the real count. Returns the
 * effective mode plus a plain-words reason (empty when unchanged).
 */
export function effectiveAbMode(
  plan: AbTestPlan,
  realCount: number | null,
): { mode: 'none' | 'split' | 'test_then_winner'; changed: boolean; reason: string } {
  if (plan.decision === 'no') return { mode: 'none', changed: false, reason: '' };
  if (realCount === null) {
    const fallback = plan.mode === 'test_then_winner' ? 'test_then_winner' : plan.mode === 'split' ? 'split' : 'none';
    return { mode: fallback, changed: false, reason: '' };
  }
  const effective = modeForCount(realCount);
  const planned: 'none' | 'split' | 'test_then_winner' =
    plan.mode === 'test_then_winner' ? 'test_then_winner' : plan.mode === 'split' ? 'split' : 'none';
  if (effective === planned && plan.mode !== 'decide_at_send') {
    return { mode: effective, changed: false, reason: '' };
  }
  const est = plan.estimatedCount !== null ? `estimated ${plan.estimatedCount}` : 'an unknown estimate';
  return {
    mode: effective,
    changed: true,
    reason:
      `The real list (${realCount} people) differs from the ${est}, so the test mode changes from ` +
      `${AB_MODE_LABELS[planned]} to ${AB_MODE_LABELS[effective]}.`,
  };
}

/**
 * Builds the Campaign abTestConfig the existing sendCampaign branch
 * understands: splitPercentage 100 → 50/50 full split; 20 → 10/10 sample
 * with the remaining 80% HOLD for the winner rollout. createWithAi marks
 * the campaign for the M6 winner tick (the old auto-rollout never fires:
 * autoRollout is never set).
 */
export function buildAbTestConfig(
  plan: AbTestPlan,
  effective: 'none' | 'split' | 'test_then_winner',
  bodyHtmlA: string,
  bodyHtmlB: string,
  draftId: string,
): Record<string, any> {
  return {
    enabled: effective !== 'none',
    createWithAi: true,
    draftId,
    mode: effective,
    variable: plan.variable,
    testEmailOrder: plan.testEmailOrder,
    subjectA: plan.variable === 'subject' ? plan.variantA : undefined,
    subjectB: plan.variable === 'subject' ? plan.variantB : undefined,
    bodyHtmlA,
    bodyHtmlB,
    testPercentage: effective === 'split' ? 100 : effective === 'test_then_winner' ? 20 : 0,
    evaluationHours: plan.waitHours,
    winnerMetric: plan.metric,
    status: 'pending',
  };
}

/** CTA-variant body: replace every occurrence of the A wording with B's. */
export function buildCtaVariantBody(bodyHtml: string, ctaA: string, ctaB: string): string {
  if (!ctaA || bodyHtml.indexOf(ctaA) === -1) return bodyHtml;
  return bodyHtml.split(ctaA).join(ctaB);
}

/** Spec §11 winner rule, pure (counts are unique contacts per variant). */
export function evaluateWinnerRule(args: {
  clicksA: number;
  clicksB: number;
  sentA: number;
  sentB: number;
}): {
  winner: 'A' | 'B' | 'no_clear_winner';
  totalClicks: number;
  rateA: number;
  rateB: number;
  relDiff: number;
} {
  const { clicksA, clicksB, sentA, sentB } = args;
  const totalClicks = clicksA + clicksB;
  const rateA = sentA > 0 ? clicksA / sentA : 0;
  const rateB = sentB > 0 ? clicksB / sentB : 0;
  const best = Math.max(rateA, rateB);
  const relDiff = best > 0 ? Math.abs(rateA - rateB) / best : 0;
  if (totalClicks < 20 || relDiff < 0.1) {
    return { winner: 'no_clear_winner', totalClicks, rateA, rateB, relDiff };
  }
  return { winner: rateA >= rateB ? 'A' : 'B', totalClicks, rateA, rateB, relDiff };
}

/** Health thresholds (spec §14). Returns warnings + whether to auto-pause. */
export function checkHealth(args: {
  delivered: number;
  bounced: number;
  complaints: number;
}): { warnings: string[]; autoPause: boolean; bounceRate: number; complaintRate: number } {
  const { delivered, bounced, complaints } = args;
  const bounceRate = delivered > 0 ? bounced / delivered : 0;
  const complaintRate = delivered > 0 ? complaints / delivered : 0;
  const warnings: string[] = [];
  let autoPause = false;
  if (bounceRate >= 0.05) {
    warnings.push(`Bounce rate ${(bounceRate * 100).toFixed(1)}% is at or above the 5% auto-pause threshold.`);
    autoPause = true;
  } else if (bounceRate >= 0.02) {
    warnings.push(`Bounce rate ${(bounceRate * 100).toFixed(1)}% is above the 2% warning threshold.`);
  }
  if (complaintRate >= 0.003) {
    warnings.push(`Complaint rate ${(complaintRate * 100).toFixed(2)}% is at or above the 0.3% auto-pause threshold.`);
    autoPause = true;
  } else if (complaintRate >= 0.001) {
    warnings.push(`Complaint rate ${(complaintRate * 100).toFixed(2)}% is above the 0.1% warning threshold.`);
  }
  return { warnings, autoPause, bounceRate, complaintRate };
}

/**
 * Template summary (2–4 sentences, ONLY real numbers). Used when the AI
 * summary call is unavailable; the AI path validates its output against
 * the same rule and falls back here on any foreign number.
 */
export function resultsSummaryText(m: {
  delivered: number;
  bounced: number;
  uniqueClicks: number;
  clickRate: number;
  replies: number;
  unsubscribes: number;
  approximateOpens: number;
  abOutcome: string | null;
}): string {
  const parts = [
    `This campaign reached ${m.delivered} people, with ${m.uniqueClicks} unique clicks (${(m.clickRate * 100).toFixed(1)}% click rate) and ${m.bounced} bounces.`,
  ];
  if (m.replies > 0 || m.unsubscribes > 0) {
    parts.push(`It drew ${m.replies} ${m.replies === 1 ? 'reply' : 'replies'} and ${m.unsubscribes} ${m.unsubscribes === 1 ? 'unsubscribe' : 'unsubscribes'}.`);
  }
  if (m.abOutcome) parts.push(m.abOutcome);
  if (m.approximateOpens > 0) {
    parts.push(`Opens are approximate: about ${m.approximateOpens} people opened at least once.`);
  }
  return parts.join(' ');
}

/* ── DB-bound: winner tick, results, health auto-pause ─────────────────────── */

import { db } from '../../../infrastructure/database/client.js';
import { Prisma } from '@prisma/client';

/** Unique-click counts per variant for one campaign (bots excluded). */
export async function abClickCounts(workspaceId: string, campaignId: string): Promise<{
  clicksA: number;
  clicksB: number;
  sentA: number;
  sentB: number;
}> {
  const recipients = await db.campaignRecipient.findMany({ where: { campaignId }, select: { contactId: true, variant: true, status: true } });
  const byContact = new Map<string, string>();
  for (const r of recipients) byContact.set(r.contactId, r.variant || 'A');
  const sentA = recipients.filter((r) => (r.variant || 'A') === 'A' && r.status === 'SENT').length;
  const sentB = recipients.filter((r) => r.variant === 'B' && r.status === 'SENT').length;
  const clicks = await db.emailEvent.findMany({
    where: { workspaceId, campaignId, eventType: 'CLICKED' },
    select: { contactId: true, metadata: true },
  });
  const clickedA = new Set<string>();
  const clickedB = new Set<string>();
  for (const e of clicks) {
    const meta = (e.metadata as Record<string, unknown> | null) || {};
    if (meta.is_bot_suspected === true) continue;
    const v = byContact.get(e.contactId) || 'A';
    if (v === 'B') clickedB.add(e.contactId);
    else clickedA.add(e.contactId);
  }
  return { clicksA: clickedA.size, clicksB: clickedB.size, sentA, sentB };
}

/**
 * One campaign's winner evaluation + rollout (shared by the tick and the
 * manual evaluate-winner route). Returns null when the campaign is not a
 * testing Create-with-AI campaign (or is PAUSED).
 */
export async function evaluateCampaignWinner(
  workspaceId: string,
  campaignId: string,
  now: Date = new Date(),
): Promise<{
  winner: 'A' | 'B' | 'no_clear_winner';
  counts: { clicksA: number; clicksB: number; sentA: number; sentB: number };
  rolledOut: number;
  failed: number;
  mode: string;
} | null> {
  const camp = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!camp) throw new Error('Campaign not found');
  const ab = (camp.abTestConfig as Record<string, unknown> | null) || {};
  if (ab.createWithAi !== true || ab.status !== 'testing' || ab.winnerVariant) return null;
  if (camp.status === 'PAUSED') return null;
  const { selectABTestWinner } = await import('./campaigns.service.js');
  const counts = await abClickCounts(workspaceId, camp.id);
  const rule = evaluateWinnerRule(counts);
  const mode = String(ab.mode || '');
  let rolledOut = 0;
  let failed = 0;
  if (mode === 'split') {
    await db.campaign.updateMany({
      where: { id: camp.id, workspaceId },
      data: { abTestConfig: { ...ab, status: 'completed', winnerVariant: rule.winner === 'no_clear_winner' ? null : rule.winner, winnerRule: rule.winner, winnerCounts: counts, decidedAt: now.toISOString(), decidedBy: 'auto' } },
    });
  } else {
    const sendVariant = rule.winner === 'no_clear_winner' ? 'A' : rule.winner;
    const result = await selectABTestWinner(workspaceId, camp.id, sendVariant as 'A' | 'B', false);
    rolledOut = (result as { rolledOut?: number }).rolledOut || 0;
    failed = (result as { failed?: number }).failed || 0;
    // selectABTestWinner just wrote winnerVariant + status 'completed' +
    // decidedAt/decidedBy. Re-read so this second write ADDS winnerRule +
    // winnerCounts instead of overwriting the decision with the stale
    // pre-decision config (the old code wiped winnerVariant, left the
    // campaign 'testing', and let the next tick decide twice).
    const fresh = await db.campaign.findFirst({ where: { id: camp.id, workspaceId } });
    const freshAb = (fresh?.abTestConfig as Record<string, unknown> | null) || {};
    await db.campaign.updateMany({
      where: { id: camp.id, workspaceId },
      data: { abTestConfig: { ...freshAb, winnerRule: rule.winner, winnerCounts: counts } },
    });
  }
  await db.notification.create({
    data: {
      workspaceId,
      type: 'EMAIL',
      title: 'A/B test decided',
      body: rule.winner === 'no_clear_winner'
        ? `No clear winner (${counts.clicksA + counts.clicksB} total clicks) — version A goes to the rest of the list.`
        : `Version ${rule.winner} won (${counts.clicksA} vs ${counts.clicksB} unique clicks) and goes to the rest of the list.`,
    },
  }).catch(() => null);
  return { winner: rule.winner, counts, rolledOut, failed, mode };
}

/**
 * Winner tick (30s interval, alongside the reaction + sequence ticks):
 * for each testing Create-with-AI campaign past its wait, evaluate the
 * spec rule and roll the winner out to HOLD recipients (or record
 * "no clear winner" and send A). Split-mode campaigns have no holdout:
 * the outcome is recorded and nothing is sent. PAUSED campaigns are
 * skipped — auto-pause must stop rollouts too.
 */
export async function processDueAbWinners(now: Date = new Date()): Promise<{
  evaluated: number;
  rolledOut: number;
  failed: number;
  skipped: number;
}> {
  const totals = { evaluated: 0, rolledOut: 0, failed: 0, skipped: 0 };
  let campaigns: Array<{ id: string; workspaceId: string; status: string; abTestConfig: unknown }>;
  try {
    campaigns = await db.campaign.findMany({
      where: { status: 'SENT', abTestConfig: { not: Prisma.JsonNull } },
      select: { id: true, workspaceId: true, status: true, abTestConfig: true },
    });
  } catch (err) {
    console.error('[ABWinner] Campaign scan failed:', (err as Error).message);
    return totals;
  }
  for (const camp of campaigns) {
    const ab = (camp.abTestConfig as Record<string, unknown> | null) || {};
    if (ab.createWithAi !== true) continue;
    if (ab.status !== 'testing' || ab.winnerVariant) continue;
    if (camp.status === 'PAUSED') { totals.skipped += 1; continue; }
    const startedAt = ab.startedAt ? new Date(String(ab.startedAt)).getTime() : 0;
    const waitMs = Number(ab.evaluationHours || 24) * 3600_000;
    if (!startedAt || now.getTime() - startedAt < waitMs) continue;
    try {
      const out = await evaluateCampaignWinner(camp.workspaceId, camp.id, now);
      if (!out) continue;
      totals.evaluated += 1;
      totals.rolledOut += out.rolledOut;
      totals.failed += out.failed;
    } catch (err) {
      console.error(`[ABWinner] Campaign ${camp.id} failed:`, (err as Error).message);
      totals.failed += 1;
    }
  }
  return totals;
}

export interface CampaignResults {
  campaignId: string;
  campaignName: string;
  status: string;
  recipients: number;
  sent: number;
  delivered: number;
  bounced: number;
  uniqueClicks: number;
  totalClicks: number;
  clickRate: number;
  replies: number;
  unsubscribes: number;
  complaints: number;
  complaintsUnavailable: boolean;
  approximateOpens: number;
  uniqueOpens: number;
  paths: { receivedOnlyFirst: number; nonClickerFollowup: number; clickReaction: number; exitedReply: number; exitedUnsubscribed: number; exitedBounced: number; completed: number };
  ab: { mode: string; variable: string | null; subjectA: string | null; subjectB: string | null; winner: string | null; winnerRule: string | null; clicksA: number; clicksB: number; sentA: number; sentB: number; testing: boolean; waitEndsAt: string | null } | null;
  health: { warnings: string[]; autoPause: boolean; bounceRate: number; complaintRate: number };
}

/**
 * Live results for one campaign (computed on read, never stored).
 * Replies come from RecipientState exits (Gmail replies are tracked via
 * the poller, not EmailEvents). Complaints are app-recorded only — under
 * Gmail-only the system never creates COMPLAINED events, so the count is
 * 0 and complaintsUnavailable is true.
 */
export async function getCreateWithAiResults(workspaceId: string, campaignId: string): Promise<CampaignResults> {
  const camp = await db.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!camp) throw new Error('Campaign not found');
  const ab = (camp.abTestConfig as Record<string, unknown> | null) || {};
  const recipients = await db.campaignRecipient.findMany({ where: { campaignId }, select: { contactId: true, variant: true, status: true } });
  const events = await db.emailEvent.findMany({
    where: { workspaceId, campaignId },
    select: { contactId: true, eventType: true, metadata: true },
  });
  const byType = (t: string) => events.filter((e) => e.eventType === t);
  const uniq = (evs: typeof events) => new Set(evs.map((e) => e.contactId));
  const sentContacts = uniq(byType('SENT'));
  const bouncedContacts = uniq(byType('BOUNCED'));
  const clickedEvents = byType('CLICKED').filter((e) => ((e.metadata as Record<string, unknown> | null) || {}).is_bot_suspected !== true);
  const clickedContacts = uniq(clickedEvents);
  const openedContacts = uniq(byType('OPENED'));
  const unsubContacts = uniq(byType('UNSUBSCRIBED'));
  const complaintEvents = byType('COMPLAINED');
  const sent = recipients.filter((r) => r.status === 'SENT').length || sentContacts.size;
  const delivered = Math.max(0, sent - bouncedContacts.size);
  const clickRate = delivered > 0 ? clickedContacts.size / delivered : 0;
  // Paths: from the draft's RecipientStates (the campaign's draft link).
  const emailRow = await db.campaignEmail.findFirst({ where: { campaignId }, select: { draftId: true } }).catch(() => null);
  const paths = { receivedOnlyFirst: 0, nonClickerFollowup: 0, clickReaction: 0, exitedReply: 0, exitedUnsubscribed: 0, exitedBounced: 0, completed: 0 };
  let replies = 0;
  if (emailRow?.draftId) {
    const states = await db.recipientState.findMany({ where: { draftId: emailRow.draftId, workspaceId }, select: { status: true, signals: true } });
    const rules = await db.reactionRule.findMany({ where: { draftId: emailRow.draftId, workspaceId }, select: { id: true, action: true } }).catch(() => []);
    const actionById = new Map(rules.map((r) => [r.id, r.action]));
    for (const st of states) {
      const sig = (st.signals as Record<string, unknown> | null) || {};
      const fired = (sig.firedRuleIds as string[] | undefined) || [];
      const actions = fired.map((id) => actionById.get(id)).filter(Boolean);
      if (st.status === 'exited_reply') { paths.exitedReply += 1; replies += 1; }
      else if (st.status === 'exited_unsubscribed') paths.exitedUnsubscribed += 1;
      else if (st.status === 'exited_bounced') paths.exitedBounced += 1;
      else if (actions.includes('send_reaction') || actions.includes('resend')) paths.clickReaction += 1;
      else if (actions.includes('send_next')) paths.nonClickerFollowup += 1;
      else if (st.status === 'completed') paths.completed += 1;
      else paths.receivedOnlyFirst += 1;
    }
  }
  const health = checkHealth({ delivered, bounced: bouncedContacts.size, complaints: complaintEvents.length });
  let abOut: CampaignResults['ab'] = null;
  if (ab.createWithAi === true || ab.enabled) {
    const counts = await abClickCounts(workspaceId, campaignId);
    const startedAt = ab.startedAt ? new Date(String(ab.startedAt)).getTime() : 0;
    const waitEndsAt = startedAt ? new Date(startedAt + Number(ab.evaluationHours || 24) * 3600_000).toISOString() : null;
    abOut = {
      mode: String(ab.mode || (ab.enabled ? 'split' : 'none')),
      variable: (ab.variable as string | null) || null,
      subjectA: (ab.subjectA as string | null) || null,
      subjectB: (ab.subjectB as string | null) || null,
      winner: (ab.winnerVariant as string | null) || null,
      winnerRule: (ab.winnerRule as string | null) || null,
      clicksA: counts.clicksA,
      clicksB: counts.clicksB,
      sentA: counts.sentA,
      sentB: counts.sentB,
      testing: ab.status === 'testing' && !ab.winnerVariant,
      waitEndsAt,
    };
  }
  return {
    campaignId: camp.id,
    campaignName: camp.name,
    status: camp.status,
    recipients: recipients.length,
    sent,
    delivered,
    bounced: bouncedContacts.size,
    uniqueClicks: clickedContacts.size,
    totalClicks: clickedEvents.length,
    clickRate,
    replies,
    unsubscribes: unsubContacts.size,
    complaints: complaintEvents.length,
    complaintsUnavailable: true,
    approximateOpens: openedContacts.size,
    uniqueOpens: openedContacts.size,
    paths,
    ab: abOut,
    health,
  };
}

/**
 * Health auto-pause tick (30s interval): any SENT Create-with-AI campaign
 * whose bounce rate hits 5% (or complaint rate 0.3%, if data ever exists)
 * is PAUSED and the owner is notified. PAUSED campaigns are skipped by
 * the sequence + reaction + winner ticks, so pausing stops all unsent
 * mail; in-flight worker sends are not recalled.
 */
export async function processHealthAutoPause(now: Date = new Date()): Promise<{ paused: number; warned: number }> {
  const out = { paused: 0, warned: 0 };
  const camps = await db.campaign.findMany({
    where: { status: 'SENT', abTestConfig: { not: Prisma.JsonNull } },
    select: { id: true, workspaceId: true, name: true, abTestConfig: true },
  }).catch(() => []);
  for (const camp of camps) {
    const ab = (camp.abTestConfig as Record<string, unknown> | null) || {};
    if (ab.createWithAi !== true) continue;
    try {
      const res = await getCreateWithAiResults(camp.workspaceId, camp.id);
      if (res.health.autoPause) {
        await db.campaign.updateMany({ where: { id: camp.id }, data: { status: 'PAUSED' } });
        await db.notification.create({
          data: {
            workspaceId: camp.workspaceId,
            type: 'EMAIL',
            title: 'Campaign auto-paused',
            body: `Campaign "${camp.name}" was auto-paused: ${res.health.warnings.join(' ')}`,
          },
        }).catch(() => null);
        out.paused += 1;
      } else if (res.health.warnings.length > 0) {
        out.warned += 1;
      }
    } catch (err) {
      console.error(`[HealthAutoPause] Campaign ${camp.id} failed:`, (err as Error).message);
    }
  }
  void now;
  return out;
}

/**
 * AI results summary (spec §14): 2–4 sentences using ONLY real numbers.
 * The AI output is validated: every number it contains must appear in the
 * metrics. Any foreign number, any AI failure, or an unconfigured key
 * falls back to the numbers-only template (source 'template').
 */
export async function aiResultsSummary(
  workspaceId: string,
  campaignId: string,
): Promise<{ summary: string; source: 'ai' | 'template' }> {
  const m = await getCreateWithAiResults(workspaceId, campaignId);
  const abOutcome = m.ab
    ? m.ab.winnerRule === 'no_clear_winner'
      ? `No clear winner (${m.ab.clicksA} vs ${m.ab.clicksB} unique clicks).`
      : m.ab.winner
        ? `Version ${m.ab.winner} won the A/B test (${m.ab.clicksA} vs ${m.ab.clicksB} unique clicks).`
        : m.ab.testing
          ? 'The A/B test is still running.'
          : null
    : null;
  const template = resultsSummaryText({
    delivered: m.delivered,
    bounced: m.bounced,
    uniqueClicks: m.uniqueClicks,
    clickRate: m.clickRate,
    replies: m.replies,
    unsubscribes: m.unsubscribes,
    approximateOpens: m.approximateOpens,
    abOutcome,
  });
  try {
    const { tryGetAIClient, SUMMARY_MODEL } = await import('../../../packages/ai/client.js');
    const ai = tryGetAIClient();
    if (!ai) return { summary: template, source: 'template' };
    const metricsJson = JSON.stringify({
      delivered: m.delivered,
      bounced: m.bounced,
      uniqueClicks: m.uniqueClicks,
      clickRate: m.clickRate,
      replies: m.replies,
      unsubscribes: m.unsubscribes,
      approximateOpens: m.approximateOpens,
      abOutcome,
    });
    const prompt =
      `Write a 2 to 4 sentence plain-language summary of this email campaign's results. ` +
      `Use ONLY the numbers in this data — never invent, round into, or imply any other number: ${metricsJson} ` +
      `Note when samples are small. Call opens "approximate opens".`;
    const response = await ai.models.generateContent({ model: SUMMARY_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = (response.text || '').trim().replace(/\s+/g, ' ');
    if (!text) return { summary: template, source: 'template' };
    // Validate: every number in the output must appear in the metrics.
    const numbers = text.match(/\d[\d,]*(\.\d+)?%?/g) || [];
    const metricsFlat = metricsJson.replace(/[^0-9.%]/g, ' ');
    const foreign = numbers.filter((n) => !metricsFlat.includes(n.replace(/,/g, '')) && !metricsFlat.includes(n));
    if (foreign.length > 0) return { summary: template, source: 'template' };
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length < 2 || sentences.length > 4) return { summary: template, source: 'template' };
    return { summary: text, source: 'ai' };
  } catch {
    return { summary: template, source: 'template' };
  }
}
