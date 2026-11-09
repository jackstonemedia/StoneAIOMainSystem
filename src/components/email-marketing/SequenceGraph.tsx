/**
 * Sequence graph (round 2, 2026-11-08) — visual graph/workflow-style builder
 * for the Create-with-AI sequence step.
 *
 * Defaults to the simple linear chain (Email 1 → Wait → Email 2 …) from the
 * draft's sequence plan. Branching is opt-in per wait: a branch splits on
 * recipient behavior using ONLY the reaction engine's vocabulary (Clicked /
 * Didn't click / Didn't open / Clicked but didn't reply / a specific link).
 * There is deliberately no "Opened" branch — opens cannot be attributed to
 * one email under Gmail-only tracking, and the engine refuses it.
 *
 * The graph only plans — it never sends. Branches become ReactionRule rows
 * (validated by the engine, priority assigned server-side); the live
 * reaction tick already evaluates them. Wait edits PATCH the draft sequence
 * and re-validate with the same sequence rules. After launch the graph is
 * read-only.
 *
 * Styling follows the AI assistant's thread: #1E1E1E background, #242426
 * panels, #343437 borders, #8A8A8D muted text, primary #52677D as the one
 * quiet accent. Text-first, no decorative icons.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildChain, branchConditionLabel, branchActionLabel } from './sequenceGraphModel';
import OverflowMenu from './OverflowMenu';
import {
  createReactionRule,
  deleteReactionRule,
  updateDraftSequence,
  getPathSimulator,
  type CampaignDraftState,
  type DraftEmailState,
  type ReactionRuleState,
  type PathScenarioState,
} from '../../lib/createWithAiApi';
import { extractApiError } from '../../lib/apiClient';

const SCENARIOS = [
  { id: 'did_not_open', label: "Didn't open" },
  { id: 'opened_no_click', label: "Opened but didn't click" },
  { id: 'clicked', label: 'Clicked' },
  { id: 'clicked_link', label: 'Clicked a link' },
  { id: 'clicked_not_replied', label: "Clicked but didn't reply" },
  { id: 'replied', label: 'Replied' },
  { id: 'bounced', label: 'Bounced' },
];

const CONDITIONS = [
  {
    id: 'NOT_CLICKED',
    label: "Didn't click",
    hint: 'No click on the email within the window — works for everyone, opened or not.',
  },
  { id: 'CLICKED', label: 'Clicked', hint: 'Clicked anything in the email.' },
  { id: 'CLICKED_LINK', label: 'Clicked a specific link', hint: 'Clicked one link you name below.' },
  { id: 'NOT_OPENED', label: "Didn't open", hint: 'No open recorded within the window.' },
  {
    id: 'CLICKED_NOT_REPLIED',
    label: "Clicked but didn't reply",
    hint: 'Clicked, but no reply within the window.',
  },
];

const ACTIONS = [
  { id: 'send_next', label: 'Send the next email' },
  { id: 'send_reaction', label: 'Send a reaction email' },
  { id: 'resend', label: 'Resend with a new subject' },
  { id: 'notify', label: 'Notify me' },
  { id: 'tag', label: 'Tag the contact' },
  { id: 'stop', label: 'Stop the sequence' },
];

export default function SequenceGraph({
  draft,
  emails,
  rules,
  readOnly,
  generating,
  onGenerateAll,
  onRulesChange,
  onSequenceChange,
  onBack,
  onReview,
}: {
  draft: CampaignDraftState;
  emails: DraftEmailState[];
  rules: ReactionRuleState[];
  readOnly: boolean;
  generating: boolean;
  onGenerateAll: () => void;
  onRulesChange: (rules: ReactionRuleState[]) => void;
  onSequenceChange: (sequence: Record<string, unknown>) => void;
  onBack: () => void;
  onReview: () => void;
}) {
  const plan = (draft.sequence || {}) as {
    count?: number;
    emails?: { order: number; offsetDays: number; purpose: string }[];
  };
  const planEmails = useMemo(
    () => [...(plan.emails || [])].sort((a, b) => a.order - b.order),
    [plan.emails],
  );
  const chain = useMemo(() => buildChain(draft.sequence, emails, rules), [draft.sequence, emails, rules]);
  const scheduledEmails = emails.filter((e) => e.kind === 'scheduled');
  const reactionEmails = emails.filter((e) => e.kind === 'reaction');
  const spanDays = planEmails.length > 0 ? planEmails[planEmails.length - 1].offsetDays : 0;

  const [addingBranchFor, setAddingBranchFor] = useState<number | null>(null);
  const [condition, setCondition] = useState('NOT_CLICKED');
  const [link, setLink] = useState('');
  const [action, setAction] = useState('send_next');
  const [emailPurpose, setEmailPurpose] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [tagName, setTagName] = useState('');
  const [windowHours, setWindowHours] = useState('72');
  const [delayMinutes, setDelayMinutes] = useState('60');
  const [editingWait, setEditingWait] = useState<number | null>(null);
  const [waitDays, setWaitDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewScenario, setPreviewScenario] = useState<string>('');
  const [preview, setPreview] = useState<PathScenarioState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // The branch editor renders below the chain — bring it into view when it
  // opens so the user sees it without hunting for it.
  const branchEditorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (addingBranchFor !== null) {
      branchEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [addingBranchFor]);

  const previewHighlights = useMemo(() => {
    if (!preview) return null;
    const fired = new Set(
      preview.steps
        .filter((s) => s.what.startsWith('Rule fired: '))
        .map((s) => s.what.slice('Rule fired: '.length)),
    );
    const reached = new Set<number>();
    for (const s of preview.steps) {
      const m = s.what.match(/^Email (\d+) sent\./);
      if (m) reached.add(Number(m[1]));
    }
    return { fired, reached };
  }, [preview]);

  const resetBranchForm = () => {
    setAddingBranchFor(null);
    setCondition('NOT_CLICKED');
    setLink('');
    setAction('send_next');
    setEmailPurpose('');
    setNewSubject('');
    setTagName('');
    setWindowHours('72');
    setDelayMinutes('60');
  };

  const handleSaveBranch = async () => {
    if (addingBranchFor === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { rules: next } = await createReactionRule(draft.id, {
        sourceOrder: addingBranchFor,
        condition,
        conditionParams: condition === 'CLICKED_LINK' ? { link: link.trim() } : {},
        action,
        actionParams:
          action === 'send_reaction'
            ? { emailPurpose: emailPurpose.trim() }
            : action === 'resend'
              ? { newSubject: newSubject.trim() }
              : action === 'tag'
                ? { tagName: tagName.trim() }
                : {},
        decisionWindowHours: Number(windowHours) || 72,
        delayMinutes: Number(delayMinutes) || 60,
      });
      onRulesChange(next);
      resetBranchForm();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveBranch = async (ruleId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { rules: next } = await deleteReactionRule(draft.id, ruleId);
      onRulesChange(next);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWait = async (afterOrder: number, days: number) => {
    if (busy) return;
    const idx = planEmails.findIndex((e) => e.order === afterOrder);
    if (idx < 0) return;
    const currentDays = (planEmails[idx + 1]?.offsetDays ?? 0) - planEmails[idx].offsetDays;
    const delta = days - currentDays;
    if (delta === 0) {
      setEditingWait(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextEmails = planEmails.map((e, i) =>
        i > idx ? { order: e.order, offsetDays: e.offsetDays + delta, purpose: e.purpose } : e,
      );
      const { sequence } = await updateDraftSequence(draft.id, nextEmails);
      onSequenceChange(sequence);
      setEditingWait(null);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async (scenario: string) => {
    setPreviewScenario(scenario);
    setPreview(null);
    if (!scenario) return;
    const first = scheduledEmails[0];
    if (!first) return;
    setPreviewLoading(true);
    try {
      const out = await getPathSimulator(first.id, scenario);
      setPreview(out.scenarios[0] || null);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const conditionHint = CONDITIONS.find((c) => c.id === condition)?.hint || '';
  const dimmed = (on: boolean) => (previewHighlights && !on ? 'opacity-45' : '');

  return (
    <div className="space-y-5" data-testid="sequence-graph">
      <div>
        <p className="text-sm font-semibold text-[#ECECEC]">
          Sequence — {planEmails.length} email{planEmails.length === 1 ? '' : 's'}
          {spanDays > 0 ? ` over ${spanDays} day${spanDays === 1 ? '' : 's'}` : ''}
        </p>
        <p className="text-xs text-[#8A8A8D] leading-relaxed mt-0.5">
          Simple by default: each email goes out after its wait. Add a branch after any wait to split on what the
          recipient does — the live send follows the same rules.
        </p>
      </div>

      {error && (
        <div className="border border-red-500/50 rounded-lg p-3 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {readOnly && (
        <p className="text-xs text-[#8A8A8D]">
          This sequence launched — the graph is read-only now. Waits and branches are locked.
        </p>
      )}

      {planEmails.length === 0 && (
        <div className="border border-[#343437] rounded-lg p-4 bg-[#242426] space-y-2">
          <p className="text-sm text-[#ECECEC]">No sequence plan yet.</p>
          <p className="text-sm text-[#8A8A8D]">
            Plan the sequence in the interview first — the graph draws the plan once it exists.
          </p>
        </div>
      )}

      {scheduledEmails.length === 0 && planEmails.length > 0 && (
        <div className="border border-[#343437] rounded-lg p-4 bg-[#242426] space-y-2">
          <p className="text-sm text-[#ECECEC]">Your sequence is planned. Generate all {planEmails.length} emails to see them on the graph.</p>
          <button type="button" onClick={onGenerateAll} className="btn-primary text-sm" disabled={generating}>
            {generating ? 'Generating…' : `Generate all ${planEmails.length} emails`}
          </button>
        </div>
      )}

      {/* Chain */}
      {chain.length > 0 && (
        <div className="relative pl-0">
          <ol className="space-y-0">
            {chain.map((item, i) => {
              if (item.kind === 'email') {
                const highlighted = previewHighlights ? previewHighlights.reached.has(item.email.order) : true;
                return (
                  <li key={`email-${item.email.order}`} className="relative flex gap-3 pb-0">
                    <div className="flex flex-col items-center shrink-0 w-6">
                      <span
                        className={`mt-4 w-3 h-3 rounded-full border-2 ${
                          highlighted ? 'bg-[#52677D] border-[#52677D]' : 'bg-[#1E1E1E] border-[#343437]'
                        }`}
                      />
                      {i < chain.length - 1 && <span className="w-px flex-1 bg-[#343437] min-h-[28px]" />}
                    </div>
                    <div
                      className={`flex-1 mb-3 rounded-xl border p-4 bg-[#242426] ${dimmed(highlighted)} ${
                        previewHighlights && highlighted ? 'border-[#52677D]' : 'border-[#343437]'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#ECECEC]">
                        Email {item.email.order}
                        <span className="font-normal text-[#8A8A8D]"> · Day {item.email.offsetDays}</span>
                      </p>
                      <p className="text-sm text-[#ECECEC] mt-1">
                        {item.email.subject || item.email.purpose}
                      </p>
                      {!item.email.subject && (
                        <p className="text-xs text-[#8A8A8D] mt-0.5">{item.email.purpose}</p>
                      )}
                      <p className="text-[11px] text-[#8A8A8D] mt-1">{item.email.status}</p>
                    </div>
                  </li>
                );
              }
              if (item.kind === 'wait') {
                return (
                  <li key={`wait-${item.afterOrder}`} className="relative flex gap-3 pb-0">
                    <div className="flex flex-col items-center shrink-0 w-6">
                      <span className="w-px flex-1 bg-[#343437] min-h-[10px]" />
                      {i < chain.length - 1 && <span className="w-px flex-1 bg-[#343437] min-h-[10px]" />}
                    </div>
                    <div className="flex-1 mb-3 flex items-center gap-2 flex-wrap">
                      {editingWait === item.afterOrder ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-[#343437] bg-[#242426] px-3 py-1.5">
                          <label className="text-xs text-[#8A8A8D]" htmlFor={`wait-${item.afterOrder}`}>
                            Wait
                          </label>
                          <input
                            id={`wait-${item.afterOrder}`}
                            type="number"
                            min={1}
                            value={waitDays}
                            onChange={(e) => setWaitDays(e.target.value)}
                            className="w-16 bg-transparent text-xs text-[#ECECEC] outline-none"
                            disabled={busy}
                          />
                          <span className="text-xs text-[#8A8A8D]">days</span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#ECECEC] underline underline-offset-2"
                            disabled={busy}
                            onClick={() => handleSaveWait(item.afterOrder, Number(waitDays))}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[#8A8A8D]"
                            onClick={() => setEditingWait(null)}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center rounded-full border border-[#343437] bg-[#242426] px-3 py-1.5 text-xs text-[#8A8A8D]">
                            Wait {item.days} day{item.days === 1 ? '' : 's'}
                          </span>
                          {!readOnly && (
                            <OverflowMenu
                              ariaLabel={`Options for wait after Email ${item.afterOrder}`}
                              align="left"
                              items={[
                                {
                                  label: 'Change wait',
                                  onClick: () => {
                                    setEditingWait(item.afterOrder);
                                    setWaitDays(String(item.days));
                                    setError(null);
                                  },
                                },
                                {
                                  label: 'Add a branch',
                                  onClick: () => {
                                    setAddingBranchFor(item.afterOrder);
                                    setError(null);
                                  },
                                },
                              ]}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              }
              // branch
              const r = item.rule;
              const fired = previewHighlights ? previewHighlights.fired.has(r.readback) : true;
              return (
                <li key={`branch-${r.id}`} className="relative flex gap-3 pb-0">
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <span className="w-px flex-1 bg-[#343437] min-h-[10px]" />
                    {i < chain.length - 1 && <span className="w-px flex-1 bg-[#343437] min-h-[10px]" />}
                  </div>
                  <div className={`flex-1 mb-3 ml-6 rounded-xl border p-4 bg-[#1E1E1E] ${dimmed(fired)} ${
                    previewHighlights && fired ? 'border-[#52677D]' : 'border-[#343437]'
                  }`}>
                    <p className="text-xs font-semibold text-[#ECECEC]">If {branchConditionLabel(r)}</p>
                    {r.readback && <p className="text-xs text-[#8A8A8D] mt-0.5">{r.readback}</p>}
                    <p className="text-sm text-[#ECECEC] mt-1.5">{branchActionLabel(r)}</p>
                    <p className="text-[11px] text-[#8A8A8D] mt-1">
                      Decides within {r.decisionWindowHours} hours
                      {r.delayMinutes ? ` · acts ${r.delayMinutes} minutes after the click` : ''}
                    </p>
                    {!readOnly && (
                      <div className="mt-2">
                        <OverflowMenu
                          ariaLabel={`Options for branch after Email ${r.sourceOrder}`}
                          align="left"
                          items={[
                            {
                              label: 'Remove branch',
                              disabled: busy,
                              onClick: () => handleRemoveBranch(r.id),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Add-a-branch editor */}
      {addingBranchFor !== null && !readOnly && (
        <div ref={branchEditorRef} className="rounded-xl border border-[#343437] bg-[#242426] p-4 space-y-3" data-testid="branch-editor">
          <p className="text-sm font-semibold text-[#ECECEC]">Add a branch after Email {addingBranchFor}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">When the recipient…</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-[#8A8A8D] leading-relaxed">{conditionHint}</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">Then…</span>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none"
              >
                {ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {condition === 'CLICKED_LINK' && (
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">Which link?</span>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/pricing"
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none placeholder:text-[#8A8A8D]"
              />
            </label>
          )}
          {action === 'send_reaction' && (
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">What should the reaction email say and do?</span>
              <input
                type="text"
                value={emailPurpose}
                onChange={(e) => setEmailPurpose(e.target.value)}
                placeholder="e.g. Nudge them with the customer story"
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none placeholder:text-[#8A8A8D]"
              />
              <span className="block text-[11px] text-[#8A8A8D] leading-relaxed">
                After saving, generate the reaction email in the email step — it won’t send until it exists.
                {reactionEmails.length === 0 ? ' None written yet.' : ` ${reactionEmails.length} written.`}
              </span>
            </label>
          )}
          {action === 'resend' && (
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">New subject line</span>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Still thinking it over?"
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none placeholder:text-[#8A8A8D]"
              />
            </label>
          )}
          {action === 'tag' && (
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">Tag name</span>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. engaged"
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none placeholder:text-[#8A8A8D]"
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">Decide within (hours)</span>
              <input
                type="number"
                min={1}
                max={168}
                value={windowHours}
                onChange={(e) => setWindowHours(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[#8A8A8D]">Act after (minutes)</span>
              <input
                type="number"
                min={0}
                max={10080}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSaveBranch} className="btn-primary text-sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save branch'}
            </button>
            <button type="button" onClick={resetBranchForm} className="btn-secondary text-sm" disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Path preview */}
      {scheduledEmails.length > 0 && (
        <div className="rounded-xl border border-[#343437] bg-[#242426] p-4 space-y-3" data-testid="path-preview">
          <p className="text-sm font-semibold text-[#ECECEC]">Preview a path</p>
          <p className="text-xs text-[#8A8A8D] leading-relaxed">
            Pick what a recipient does — the simulator runs the real rules and shows the path they take. Branches
            that fire and emails that send are highlighted on the graph.
          </p>
          <select
            value={previewScenario}
            onChange={(e) => handlePreview(e.target.value)}
            className="w-full sm:w-auto bg-[#1E1E1E] border border-[#343437] rounded-lg px-3 py-2 text-sm text-[#ECECEC] outline-none"
            disabled={previewLoading}
          >
            <option value="">Choose a scenario…</option>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {previewLoading && <p className="text-xs text-[#8A8A8D]">Running the simulator…</p>}
          {preview && (
            <div className="space-y-1.5">
              <p className="text-xs text-[#8A8A8D]">Final state: {preview.finalState}</p>
              <ol className="space-y-1">
                {preview.steps.map((s, i) => (
                  <li key={i} className="text-sm text-[#ECECEC]">
                    <span className="text-[#8A8A8D]">{i + 1}. </span>
                    {s.what}
                    {s.reason ? <span className="text-[#8A8A8D]"> ({s.reason})</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {scheduledEmails.length > 0 && (
        <div className="flex gap-2">
          <button type="button" onClick={onReview} className="btn-primary text-sm">
            Continue to Review and Send
          </button>
          <button type="button" onClick={onBack} className="btn-secondary text-sm">
            Back to email
          </button>
        </div>
      )}
    </div>
  );
}
