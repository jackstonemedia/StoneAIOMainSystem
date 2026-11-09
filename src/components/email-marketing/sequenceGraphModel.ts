/**
 * Sequence graph — pure model (round 2, 2026-11-08).
 *
 * Maps the draft's sequence plan + generated emails + reaction rules into a
 * linear chain with branches. No rendering here, so the mapping is unit
 * tested without a DOM. The vocabulary is the engine's own: conditions are
 * NOT_OPENED / NOT_CLICKED / CLICKED / CLICKED_LINK / CLICKED_NOT_REPLIED —
 * there is deliberately no OPENED branch (opens cannot be attributed to one
 * email under Gmail-only tracking; the engine refuses OPENED_NOT_CLICKED).
 */

import type { ReactionRuleState, DraftEmailState } from '../../lib/createWithAiApi';

export type SequencePlanEmail = { order: number; offsetDays: number; purpose: string };

export type GraphEmail = {
  order: number;
  offsetDays: number;
  purpose: string;
  subject: string | null;
  status: string;
};

export type ChainItem =
  | { kind: 'email'; email: GraphEmail }
  | { kind: 'wait'; afterOrder: number; days: number }
  | { kind: 'branch'; rule: ReactionRuleState };

/** Plain-words condition label, from the engine's condition vocabulary. */
export function branchConditionLabel(rule: ReactionRuleState): string {
  const n = rule.sourceOrder;
  switch (rule.condition) {
    case 'NOT_OPENED':
      return `Didn't open Email ${n}`;
    case 'NOT_CLICKED':
      return `Didn't click Email ${n}`;
    case 'CLICKED':
      return `Clicked Email ${n}`;
    case 'CLICKED_LINK': {
      const link = String(rule.conditionParams?.link || '').trim();
      return link ? `Clicked ${link} in Email ${n}` : `Clicked a link in Email ${n}`;
    }
    case 'CLICKED_NOT_REPLIED':
      return `Clicked Email ${n} but didn't reply`;
    default:
      return rule.condition;
  }
}

/** Plain-words action label, from the engine's action vocabulary. */
export function branchActionLabel(rule: ReactionRuleState): string {
  switch (rule.action) {
    case 'send_reaction': {
      const purpose = String(rule.actionParams?.emailPurpose || '').trim();
      return purpose ? `Send a reaction email — ${purpose}` : 'Send a reaction email (not written yet)';
    }
    case 'send_next':
      return 'Send the next email in the sequence';
    case 'resend': {
      const subject = String(rule.actionParams?.newSubject || '').trim();
      return subject ? `Resend with a new subject: "${subject}"` : 'Resend with a new subject';
    }
    case 'notify':
      return 'Notify me';
    case 'tag': {
      const tag = String(rule.actionParams?.tagName || '').trim();
      return tag ? `Tag the contact "${tag}"` : 'Tag the contact';
    }
    case 'stop':
      return 'Stop the sequence for this contact';
    default:
      return rule.action;
  }
}

/**
 * Build the chain: Email 1 → Wait N days → Email 2 … with each rule attached
 * as a branch after the wait that follows its source email (or after the
 * last email when the rule watches it). Rules arrive priority-ordered from
 * getReactionStatus and keep that order within a source email.
 */
export function buildChain(
  sequence: Record<string, unknown> | null | undefined,
  emails: DraftEmailState[],
  rules: ReactionRuleState[],
): ChainItem[] {
  const plan = (Array.isArray(sequence?.emails) ? sequence.emails : []) as SequencePlanEmail[];
  const sorted = [...plan].sort((a, b) => a.order - b.order);
  const byOrder = new Map<number, DraftEmailState>();
  for (const e of emails) {
    if (e.kind === 'scheduled' && !byOrder.has(e.order)) byOrder.set(e.order, e);
  }
  const rulesBySource = new Map<number, ReactionRuleState[]>();
  for (const r of rules) {
    const list = rulesBySource.get(r.sourceOrder) || [];
    list.push(r);
    rulesBySource.set(r.sourceOrder, list);
  }
  const chain: ChainItem[] = [];
  sorted.forEach((p, i) => {
    const generated = byOrder.get(p.order);
    const subject = generated
      ? generated.subjectVariants?.[generated.subjectSelected] || generated.subjectVariants?.[0] || null
      : null;
    chain.push({
      kind: 'email',
      email: {
        order: p.order,
        offsetDays: p.offsetDays,
        purpose: p.purpose,
        subject,
        status: generated ? generated.status : 'not generated yet',
      },
    });
    const next = sorted[i + 1];
    if (next) {
      chain.push({ kind: 'wait', afterOrder: p.order, days: next.offsetDays - p.offsetDays });
    }
    for (const rule of rulesBySource.get(p.order) || []) {
      chain.push({ kind: 'branch', rule });
    }
  });
  return chain;
}
