/**
 * Create-with-AI M3 — Draft generator, refine controls, consistency check.
 *
 * Spec §12 (Phase 7): generate one email from the profile snapshot, approved
 * style summary + samples, locked Brief and token catalog; 3 subject options,
 * preview ≤90 chars, HTML + plain-text bodies, fact_map. Code validates the
 * draft (fact-validator.ts) — the model never enforces the rules alone.
 * Quality check: the model reviews its own draft against the rubric and
 * silently revises, max 2 rounds. Refine: direct editing, typed instruction
 * box, regenerate whole/section, undo, version history (last 10).
 *
 * Nothing from earlier campaigns is an input. Contact lists and contact-level
 * personal data are NEVER sent to the LLM (spec §20.6); previews use sample
 * data. AI unavailability is an honest 503, never a fabricated draft.
 */

import { db } from '../../../infrastructure/database/client.js';
import {
  buildAllowedClaimSet,
  buildAllowedHosts,
  ensureDraftFooter,
  extractClaims,
  findPlaceholders,
  normalizeClaim,
  validateDraftContent,
  type DraftContent,
  type FactMapEntry,
} from './fact-validator.js';
import { checkAiRateLimit } from './interview.service.js';

export class DraftError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Email statuses in which content must no longer change (spec §13: edits
 * apply to unsent only; pause/resume/cancel are the sanctioned transitions).
 * A scheduled email is already locked for sending; a paused one resumes
 * with the same content; a sent one is history.
 */
export const SEND_LOCKED_EMAIL_STATUSES = new Set(['scheduled', 'sending', 'sent', 'paused']);
/** Campaign statuses that lock their emails, even if an email row disagrees. */
const SEND_LOCKED_CAMPAIGN_STATUSES = new Set(['SCHEDULED', 'SENDING', 'SENT', 'PAUSED']);

/**
 * Pure send-state guard (no DB, unit-testable): throws when the email's own
 * status, or its campaign's status when known, locks it. A null campaign
 * status means the email is not linked to a live campaign — only the email's
 * own status decides then. This is the repair for the M3 status anomaly: a
 * sent email's row must never go back to a changeable state.
 */
export function assertEmailEditable(emailStatus: string, campaignStatus: string | null): void {
  if (SEND_LOCKED_EMAIL_STATUSES.has(String(emailStatus || ''))) {
    throw new DraftError(`This email can no longer be changed because it is ${emailStatus}. Cancel the campaign and start a new one for new content.`, 400);
  }
  if (campaignStatus && SEND_LOCKED_CAMPAIGN_STATUSES.has(campaignStatus)) {
    throw new DraftError('This email belongs to a campaign that has already been scheduled or sent and can no longer be changed.', 400);
  }
}

/** Load a linked campaign's status for the guard (null when unlinked or gone). */
export async function linkedCampaignStatus(workspaceId: string, email: any): Promise<string | null> {
  if (!email.campaignId) return null;
  const camp = await db.campaign.findFirst({ where: { id: email.campaignId, workspaceId }, select: { status: true } });
  return camp ? String(camp.status) : null;
}

/** Full guard for a loaded email row: own status + linked campaign status. */
export async function assertLoadedEmailEditable(workspaceId: string, email: any): Promise<void> {
  assertEmailEditable(String(email.status || ''), await linkedCampaignStatus(workspaceId, email));
}

export const DRAFT_AI_TIMEOUT_MS = 30_000;
export const DRAFT_MAX_REVISE_ROUNDS = 2;
export const DRAFT_VERSIONS_CAP = 10;
/** Shape validation repair retries (spec §16: validate + repair, max 2). */
export const DRAFT_MAX_REPAIRS = 2;

/** The model's JSON failed shape validation — carries the repair context. */
class ShapeError extends Error {
  badOutput: unknown;
  errors: string[];
  constructor(errors: string[], badOutput: unknown) {
    super(`Draft JSON invalid: ${errors.join('; ')}`);
    this.errors = errors;
    this.badOutput = badOutput;
  }
}

export interface GeneratedEmail {
  subjects: string[];
  previewText: string;
  bodyHtml: string;
  bodyText: string;
  factMap: FactMapEntry[];
}

export interface EmailVersion {
  subjects: string[];
  subjectSelected: number;
  previewText: string;
  bodyHtml: string;
  bodyText: string;
  factMap: FactMapEntry[];
  note: string;
  at: string;
}

export interface EmailState {
  id: string;
  draftId: string;
  campaignId: string | null;
  kind: string;
  order: number;
  name: string;
  purpose: string | null;
  subjectVariants: string[];
  subjectSelected: number;
  previewText: string | null;
  bodyHtml: string;
  bodyText: string;
  cta: unknown;
  factMap: FactMapEntry[];
  versions: EmailVersion[];
  status: string;
  scheduledAtUtc: string | null;
  coldAck: boolean;
  recipientCount: number | null;
  /** Placeholders still present — these block sending (spec §12). */
  placeholders: string[];
  /** Claims the validator removed in the latest generation/refine. */
  removedClaims: { claim: string; where: string }[];
  /**
   * New facts the user typed in a direct edit that are not yet in any source
   * (spec §12: ask whether to update the Brief). Kept in the draft, flagged
   * here, until accepted into the Brief via acceptFacts.
   */
  newClaims: string[];
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(msg);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI call timed out')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function parseJsonText(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

function asJsonArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Prisma Json columns need plain JSON values; cast through a JSON round-trip. */
function toJson(v: unknown): any {
  return JSON.parse(JSON.stringify(v ?? null));
}

export function emailToState(row: any): EmailState {
  const subjects = asJsonArray(row.subjectVariants).filter((s) => typeof s === 'string') as string[];
  const bodyHtml = String(row.bodyHtml || '');
  const bodyText = String(row.bodyText || '');
  return {
    id: row.id,
    draftId: row.draftId,
    campaignId: row.campaignId,
    kind: row.kind,
    order: row.order,
    name: row.name,
    purpose: row.purpose,
    subjectVariants: subjects,
    subjectSelected: row.subjectSelected ?? 0,
    previewText: row.previewText,
    bodyHtml,
    bodyText,
    cta: row.cta,
    factMap: asJsonArray(row.factMap) as FactMapEntry[],
    versions: asJsonArray(row.versions) as EmailVersion[],
    status: row.status,
    scheduledAtUtc: row.scheduledAtUtc ? new Date(row.scheduledAtUtc).toISOString() : null,
    coldAck: !!row.coldAck,
    recipientCount: row.recipientCount,
    placeholders: [...new Set(findPlaceholders([subjects.join(' '), row.previewText || '', bodyHtml, bodyText].join('\n')))],
    removedClaims: [],
    newClaims: [],
  };
}

function snapshotOf(draft: any): Record<string, any> {
  const s = draft.profileSnapshot;
  if (typeof s === 'string') {
    try {
      return JSON.parse(s);
    } catch {
      return {};
    }
  }
  return (s || {}) as Record<string, any>;
}

function briefOf(draft: any): Record<string, any> | null {
  const b = draft.brief;
  if (!b) return null;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  return b as Record<string, any>;
}

function userMessages(draft: any): string[] {
  const conv = Array.isArray(draft.conversation) ? draft.conversation : [];
  return conv.filter((m: any) => m && m.role === 'user').map((m: any) => String(m.text || ''));
}

/** Source texts the validator may trace claims to (profile + Brief + user words). */
export function allowedSourcesFor(draft: any): { texts: string[]; hosts: Set<string> } {
  const snap = snapshotOf(draft);
  const brief = briefOf(draft) || {};
  const texts: string[] = [];
  for (const k of ['businessName', 'businessType', 'services', 'serviceArea', 'senderName', 'phone', 'customerType', 'voiceDescription', 'differentiators', 'guaranteesProof', 'websiteUrl', 'bookingLink']) {
    if (snap[k]) texts.push(String(snap[k]));
  }
  // NOTE: writing samples and style summaries are voice inputs only, never
  // fact sources (spec §12 + M1 acceptance: a sample containing a price must
  // never leak that price into a draft). Only the profile, the Brief, and
  // the user's typed messages may validate a claim.
  texts.push(JSON.stringify(brief));
  texts.push(...userMessages(draft));
  const hosts = buildAllowedHosts(
    typeof snap.bookingLink === 'string' ? snap.bookingLink : null,
    typeof snap.websiteUrl === 'string' ? snap.websiteUrl : null,
    userMessages(draft),
  );
  return { texts, hosts };
}

function draftSystemPrompt(snap: Record<string, any>): string {
  const wordsToAvoid = String(snap.wordsToAvoid || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    'You are an experienced email marketer writing one email for a small business.',
    'Hard rules:',
    '- Use ONLY facts from the profile, the Brief, or the user\'s typed messages. Never invent a price, date, percentage, name, credential, review statistic, or guarantee.',
    '- Return a fact_map listing every claim in the draft and its source (profile, Brief, or user message).',
    '- One purpose and one call to action. The opening speaks to what the audience struggles with or wants.',
    '- Subject lines under about 50 characters, specific, not all caps, no misleading urgency.',
    '- No spam-trigger phrasing. Plain reading level (about 6th to 8th grade).',
    '- Never state or imply that an AI wrote this email.',
    wordsToAvoid.length ? `- Words to never use: ${wordsToAvoid.join(', ')}.` : '',
    '- US English. No emojis unless the business samples use them.',
  ].filter(Boolean).join('\n');
}

const CRITIQUE_RUBRIC = [
  'One purpose and one call to action per email.',
  'The opening speaks to what the audience struggles with or wants; the benefit matches what that audience cares about.',
  'Every claim traces to a source.',
  'Length is within target, voice matches the style summary (or voice description, or plain friendly default), and respects "words to never use".',
  'Subject lines under about 50 characters, specific, not all caps, free of misleading urgency.',
  'No spam-trigger phrasing. Plain reading level (about 6th to 8th grade).',
].join('\n- ');

function draftResponseSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      subjects: { type: 'ARRAY', items: { type: 'STRING' } },
      preview_text: { type: 'STRING' },
      body_html: { type: 'STRING' },
      body_text: { type: 'STRING' },
      fact_map: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { claim: { type: 'STRING' }, source: { type: 'STRING' } },
          required: ['claim', 'source'],
        },
      },
    },
    required: ['subjects', 'preview_text', 'body_html', 'body_text', 'fact_map'],
  };
}

function validateGenerated(out: unknown): { ok: boolean; errors: string[]; value: GeneratedEmail | null } {
  const errors: string[] = [];
  const o = out as Record<string, any> | null;
  if (!o || typeof o !== 'object') return { ok: false, errors: ['Output is not an object'], value: null };
  if (!Array.isArray(o.subjects) || o.subjects.length !== 3 || !o.subjects.every((s: unknown) => typeof s === 'string' && s.length > 0)) {
    errors.push('subjects must be exactly 3 non-empty strings');
  }
  if (typeof o.preview_text !== 'string' || o.preview_text.length > 90) errors.push('preview_text must be a string of at most 90 characters');
  if (typeof o.body_html !== 'string' || !o.body_html.trim()) errors.push('body_html must be a non-empty string');
  if (typeof o.body_text !== 'string' || !o.body_text.trim()) errors.push('body_text must be a non-empty string');
  if (!Array.isArray(o.fact_map)) errors.push('fact_map must be an array');
  if (errors.length) return { ok: false, errors, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      subjects: o.subjects,
      previewText: o.preview_text,
      bodyHtml: o.body_html,
      bodyText: o.body_text,
      factMap: (o.fact_map as FactMapEntry[]).filter((f) => f && typeof f.claim === 'string'),
    },
  };
}

/** One Gemini draft-generation attempt (structured output, one transient retry on network errors). */
async function geminiGenerateOnce(
  ai: any,
  model: string,
  systemPrompt: string,
  userText: string,
  repair?: { badOutput: unknown; errors: string[] },
): Promise<GeneratedEmail> {
  const contents = repair
    ? [{ role: 'user', parts: [{ text: `Your previous draft JSON failed validation:\n${repair.errors.join('\n')}\nPrevious output:\n${JSON.stringify(repair.badOutput)}\nFix ONLY those issues and return the full corrected JSON object matching the schema.` }] }]
    : [{ role: 'user', parts: [{ text: userText }] }];
  const call = async (): Promise<GeneratedEmail> => {
    const response = (await withTimeout(
      ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: repair ? 0.3 : 0.65,
          responseMimeType: 'application/json',
          responseSchema: draftResponseSchema(),
        },
      }) as Promise<{ text?: string }>,
      DRAFT_AI_TIMEOUT_MS,
    )) as { text?: string };
    const parsed = parseJsonText((response.text || '').trim());
    const v = validateGenerated(parsed);
    if (!v.ok) throw new ShapeError(v.errors, parsed);
    return v.value as GeneratedEmail;
  };
  try {
    return await call();
  } catch (err) {
    if (err instanceof ShapeError) throw err;
    if (isAuthError(err)) throw new DraftError('AI is not configured or the key is invalid.', 503);
    try {
      return await call();
    } catch (err2) {
      if (err2 instanceof ShapeError) throw err2;
      if (isAuthError(err2)) throw new DraftError('AI is not configured or the key is invalid.', 503);
      throw new DraftError('Draft generation failed. Nothing was saved — try again.', 503);
    }
  }
}

/** Draft generation with shape-validation repair retries (spec §16, max 2). */
async function geminiGenerate(
  ai: any,
  model: string,
  systemPrompt: string,
  userText: string,
): Promise<GeneratedEmail> {
  let repair: { badOutput: unknown; errors: string[] } | undefined;
  for (let attempt = 0; attempt <= DRAFT_MAX_REPAIRS; attempt++) {
    try {
      return await geminiGenerateOnce(ai, model, systemPrompt, userText, repair);
    } catch (err) {
      if (err instanceof ShapeError && attempt < DRAFT_MAX_REPAIRS) {
        repair = { badOutput: err.badOutput, errors: err.errors };
        continue;
      }
      throw err;
    }
  }
  throw new DraftError('Draft generation failed. Nothing was saved — try again.', 503);
}

/** Silent quality check: critique against the rubric, revise, max 2 rounds. */
async function qualityCheck(
  ai: any,
  model: string,
  systemPrompt: string,
  draft: GeneratedEmail,
  briefText: string,
): Promise<GeneratedEmail> {
  let current = draft;
  for (let round = 0; round < DRAFT_MAX_REVISE_ROUNDS; round++) {
    let critique: string;
    try {
      const response = (await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{
            role: 'user',
            parts: [{ text: `Review this email draft against the rubric below. Reply with ONLY "OK" if it passes every item, otherwise list each failing item in one line each.\n\nRubric:\n- ${CRITIQUE_RUBRIC}\n\nBrief: ${briefText}\n\nSubjects: ${JSON.stringify(current.subjects)}\nPreview: ${current.previewText}\nBody (text):\n${current.bodyText}` }],
          }],
          config: { systemInstruction: systemPrompt, temperature: 0.2 },
        }) as Promise<{ text?: string }>,
        DRAFT_AI_TIMEOUT_MS,
      )) as { text?: string };
      critique = (response.text || '').trim();
    } catch {
      break; // Quality check is best-effort; never blocks the draft.
    }
    if (/^ok\b/i.test(critique)) break;
    try {
      current = await geminiGenerate(ai, model, systemPrompt, `Revise this email draft to fix these issues, keeping every claim sourced. Return the full corrected draft JSON.\n\nIssues:\n${critique}\n\nCurrent draft:\n${JSON.stringify(current)}`);
    } catch {
      break;
    }
  }
  return current;
}

async function getDraftOrThrow(workspaceId: string, draftId: string): Promise<any> {
  const draft = await db.campaignDraft.findFirst({ where: { id: draftId, workspaceId } });
  if (!draft) throw new DraftError('Campaign draft not found', 404);
  return draft;
}

export async function getEmailOrThrow(workspaceId: string, emailId: string): Promise<any> {
  const email = await db.campaignEmail.findFirst({ where: { id: emailId, workspaceId } });
  if (!email) throw new DraftError('Draft email not found', 404);
  return email;
}

function applyValidation(
  content: DraftContent,
  draft: any,
  factMap: FactMapEntry[],
  keepClaims?: Set<string>,
  workspaceId?: string,
): { validated: DraftContent; removed: { claim: string; where: string }[]; kept: string[]; allowed: Set<string> } {
  const { texts, hosts } = allowedSourcesFor(draft);
  const allowed = buildAllowedClaimSet(texts);
  const v = validateDraftContent(content, allowed, hosts, factMap, keepClaims);
  // The locked footer is unremovable (spec §17): restored on every save even
  // if it was deleted in the editor. The real per-recipient footer replaces
  // this draft placeholder at send time.
  const withFooter = ensureDraftFooter(v.bodyHtml, v.bodyText, footerDataOf(draft), draftUnsubscribeUrl(workspaceId || ''));
  return {
    validated: { subjects: v.subjects, previewText: v.previewText, bodyHtml: withFooter.bodyHtml, bodyText: withFooter.bodyText },
    removed: v.removed,
    kept: v.kept,
    allowed,
  };
}

function footerDataOf(draft: any): { businessName: string; physicalAddress: string } {
  const snap = snapshotOf(draft);
  return {
    businessName: String(snap.businessName || 'Your business'),
    physicalAddress: String(snap.physicalAddress || ''),
  };
}

function draftUnsubscribeUrl(workspaceId: string): string {
  return `https://example.invalid/unsubscribe/${Buffer.from(`${workspaceId}:draft`).toString('base64url')}`;
}

function snapshotVersion(row: any, note: string): EmailVersion {
  return {
    subjects: asJsonArray(row.subjectVariants).filter((s) => typeof s === 'string') as string[],
    subjectSelected: row.subjectSelected ?? 0,
    previewText: row.previewText,
    bodyHtml: String(row.bodyHtml || ''),
    bodyText: String(row.bodyText || ''),
    factMap: asJsonArray(row.factMap) as FactMapEntry[],
    note,
    at: new Date().toISOString(),
  };
}

function pushVersion(versions: EmailVersion[], v: EmailVersion): EmailVersion[] {
  const next = [...versions, v];
  return next.slice(-DRAFT_VERSIONS_CAP);
}

/**
 * Generate the M3 single email for a brief-confirmed draft. Throws
 * DraftError(503) when AI is unavailable — nothing is fabricated, and the
 * draft keeps its previous state.
 */
export async function generateEmail(
  workspaceId: string,
  draftId: string,
  opts?: { order?: number; purpose?: string; earlierTexts?: string[] },
): Promise<EmailState> {
  const draft = await getDraftOrThrow(workspaceId, draftId);
  if (draft.status !== 'brief_confirmed' && draft.status !== 'drafted' && draft.status !== 'sequence_confirmed' && draft.status !== 'reactions_confirmed') {
    throw new DraftError('Confirm the Brief before drafting (Phase 7 needs a locked Brief).', 400);
  }
  const order = opts?.order ?? 1;
  // Fail fast before spending an AI call: an already-launched email must
  // never be regenerated back to 'draft' (M3 status anomaly repair).
  const existing = await db.campaignEmail.findFirst({
    where: { draftId, workspaceId, ...(order > 1 ? { order } : {}) },
    orderBy: { order: 'asc' },
  });
  if (existing) await assertLoadedEmailEditable(workspaceId, existing);
  if (!checkAiRateLimit(workspaceId)) {
    throw new DraftError('AI call budget for this workspace is exhausted for the hour. Try again later.', 429);
  }
  const { tryGetAIClient, INTERVIEW_MODEL } = await import('../../../packages/ai/client.js');
  const ai = tryGetAIClient();
  if (!ai) throw new DraftError('AI is not configured on this server (GOOGLE_AI_API_KEY is missing).', 503);

  const snap = snapshotOf(draft);
  const brief = briefOf(draft) || {};
  const cold = !!(brief.audience && (brief.audience as Record<string, unknown>).cold_contacts);
  const styleSummaries = Array.isArray(snap.styleSummaries) ? snap.styleSummaries : [];
  const sequence = (draft as { sequence?: Record<string, unknown> | null }).sequence as
    | { emails?: Array<{ order: number; offsetDays: number; purpose: string }> }
    | null
    | undefined;
  const seqEmail = sequence?.emails?.find((e) => e.order === order);
  const userText = [
    `Business Profile: ${JSON.stringify(snap)}`,
    `Approved style summaries: ${JSON.stringify(styleSummaries)}`,
    `Locked Brief: ${JSON.stringify(brief)}`,
    `Token catalog (use only these, each with a fallback, e.g. {{first_name|there}}): first_name, last_name, business_name, sender_name, booking_link, phone.`,
    cold
      ? 'This is cold outreach: plain-text style, 50 to 100 words, no images, no heavy layout. It reads like one person writing to one person.'
      : 'Otherwise: a light branded template (business name, simple layout), 100 to 150 words, one call-to-action button plus a matching text link.',
    order > 1
      ? `This is email ${order} in a sequence. Its purpose: ${opts?.purpose || seqEmail?.purpose || `Follow-up email ${order}`}. Earlier emails in this sequence (full text, for consistency — build on them, do not repeat them):\n${(opts?.earlierTexts || []).join('\n---\n')}`
      : null,
    order > 1
      ? `Write email ${order} of the sequence. Return exactly 3 subject options, preview text (90 characters or fewer), HTML body, plain-text body, and the fact_map.`
      : 'Write the single email for this campaign. Return exactly 3 subject options, preview text (90 characters or fewer), HTML body, plain-text body, and the fact_map.',
  ].filter(Boolean).join('\n\n');

  let generated = await geminiGenerate(ai, INTERVIEW_MODEL, draftSystemPrompt(snap), userText);
  // Repair loop (max 2) is inside geminiGenerate's validation throw path only
  // for shape errors; the quality check below handles rubric failures.
  generated = await qualityCheck(ai, INTERVIEW_MODEL, draftSystemPrompt(snap), generated, typeof brief.text === 'string' ? brief.text : JSON.stringify(brief));

  const { validated, removed } = applyValidation(
    { subjects: generated.subjects, previewText: generated.previewText, bodyHtml: generated.bodyHtml, bodyText: generated.bodyText },
    draft,
    generated.factMap,
    undefined,
    workspaceId,
  );

  const cta = (brief.cta || {}) as Record<string, unknown>;
  const row = existing
    ? await db.campaignEmail.update({
        where: { id: existing.id },
        data: {
          subjectVariants: toJson(validated.subjects),
          subjectSelected: 0,
          previewText: validated.previewText,
          bodyHtml: validated.bodyHtml,
          bodyText: validated.bodyText,
          cta: toJson({ action: cta.action, destination: cta.destination, deadline: cta.deadline }),
          factMap: toJson(generated.factMap),
          versions: toJson(pushVersion(asJsonArray(existing.versions) as EmailVersion[], snapshotVersion(existing, 'Regenerated'))),
          status: 'draft',
        },
      })
    : await db.campaignEmail.create({
        data: {
          workspaceId,
          draftId,
          kind: 'scheduled',
          order,
          name: `Email ${order}`,
          purpose: opts?.purpose || seqEmail?.purpose || (typeof brief.campaign_definition?.summary === 'string' ? brief.campaign_definition.summary : 'Single campaign email'),
          timingRule: {
            type: 'scheduled',
            label:
              order === 1
                ? 'Email 1: sent at the scheduled start'
                : `Email ${order}: ${seqEmail?.offsetDays ?? order - 1} day(s) after Email 1 (per-person timing from each recipient's first send)`,
          },
          receivesRule: { type: 'all_recipients', label: 'Everyone selected in Phase 8' },
          subjectVariants: toJson(validated.subjects),
          subjectSelected: 0,
          previewText: validated.previewText,
          bodyHtml: validated.bodyHtml,
          bodyText: validated.bodyText,
          cta: toJson({ action: cta.action, destination: cta.destination, deadline: cta.deadline }),
          factMap: toJson(generated.factMap),
          versions: [],
          status: 'draft',
        },
      });

  await db.campaignDraft.update({
    where: { id: draftId },
    data: { status: 'drafted', currentPhase: 'draft_refine' },
  });

  const state = emailToState(row);
  state.removedClaims = removed;
  return state;
}

/**
 * Generates every email in a confirmed sequence, in order (M4, spec §12).
 * Each email after the first receives the full text of the earlier sequence
 * emails (spec §12 input) plus its own purpose, so the sequence reads as one
 * conversation, not N disconnected emails. A draft with no sequence uses
 * generateEmail directly (M3 single-email flow, unchanged).
 */
export async function generateSequenceEmails(workspaceId: string, draftId: string): Promise<EmailState[]> {
  const draft = await getDraftOrThrow(workspaceId, draftId);
  const sequence = (draft as { sequence?: Record<string, unknown> | null }).sequence as
    | { count?: number; emails?: Array<{ order: number; purpose: string }> }
    | null
    | undefined;
  if (!sequence || !Array.isArray(sequence.emails) || sequence.emails.length === 0) {
    throw new DraftError('No sequence confirmed for this draft. Confirm a sequence in Phase 4 first.', 400);
  }
  const states: EmailState[] = [];
  for (const seqEmail of [...sequence.emails].sort((a, b) => a.order - b.order)) {
    const earlierRows = await db.campaignEmail.findMany({
      where: { draftId, workspaceId, order: { lt: seqEmail.order } },
      orderBy: { order: 'asc' },
    });
    const earlierTexts = earlierRows.map((r) => String(r.bodyText || ''));
    states.push(
      await generateEmail(workspaceId, draftId, {
        order: seqEmail.order,
        purpose: seqEmail.purpose,
        earlierTexts,
      }),
    );
  }
  return states;
}

/**
 * Generates every planned reaction email (M5, spec §12): one row per
 * send_reaction rule, in priority order, each with the full text of the
 * source email and earlier scheduled emails (spec §12 input) plus its own
 * purpose and facts. Reaction rows carry kind 'reaction' and orders after
 * the sequence (count+1, count+2, …) so the sequence machinery — which
 * filters kind 'scheduled' — never mistakes them for sequence steps.
 * A draft with no send_reaction rules returns an empty list.
 */
export async function generateReactionEmails(workspaceId: string, draftId: string): Promise<EmailState[]> {
  const draft = await getDraftOrThrow(workspaceId, draftId);
  if (draft.status !== 'reactions_confirmed' && draft.status !== 'drafted' && draft.status !== 'sequence_confirmed') {
    throw new DraftError('Confirm reactions in Phase 5 before drafting reaction emails.', 400);
  }
  const rules = await db.reactionRule.findMany({
    where: { workspaceId, draftId, action: 'send_reaction' },
    orderBy: { priority: 'asc' },
  });
  if (rules.length === 0) return [];
  const sequence = (draft as { sequence?: Record<string, unknown> | null }).sequence as { count?: number } | null | undefined;
  const count = Number(sequence?.count || 0);
  const scheduledRows = await db.campaignEmail.findMany({
    where: { draftId, workspaceId, kind: 'scheduled' },
    orderBy: { order: 'asc' },
  });
  const states: EmailState[] = [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const params = (rule.actionParams || {}) as Record<string, unknown>;
    const purpose = String(params.emailPurpose || 'Follow-up email');
    const facts = Array.isArray(params.emailFacts) ? (params.emailFacts as unknown[]).map(String) : [];
    const order = count + 1 + i;
    const existing = await db.campaignEmail.findFirst({ where: { draftId, workspaceId, kind: 'reaction', order } });
    if (!existing) {
      await db.campaignEmail.create({
        data: {
          workspaceId,
          draftId,
          kind: 'reaction',
          order,
          name: `Reaction: ${purpose.slice(0, 60)}`,
          purpose,
          timingRule: { type: 'reaction', label: `Reaction to Email ${rule.sourceOrder} (${rule.condition})` },
          receivesRule: { type: 'reaction', label: rule.readback || `Reaction for Email ${rule.sourceOrder}` },
          subjectVariants: [],
          previewText: '',
          bodyHtml: '',
          bodyText: '',
          factMap: [],
          versions: [],
          status: 'draft',
        },
      });
    }
    const earlierTexts = scheduledRows
      .filter((r) => r.order <= rule.sourceOrder)
      .map((r) => String(r.bodyText || ''))
      .filter(Boolean);
    states.push(
      await generateEmail(workspaceId, draftId, {
        order,
        purpose: facts.length ? `${purpose}. Facts to use: ${facts.join('; ')}` : purpose,
        earlierTexts,
      }),
    );
  }
  return states;
}

/**
 * Refine by typed instruction (spec §12: no suggestion chips). Scope is the
 * whole email or one section: subject | opening | body | cta | signoff.
 * The result is re-validated by code before it is saved.
 */
export async function refineEmail(
  workspaceId: string,
  emailId: string,
  instruction: string,
  scope: 'whole' | 'subject' | 'opening' | 'body' | 'cta' | 'signoff' = 'whole',
): Promise<EmailState> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  await assertLoadedEmailEditable(workspaceId, email);
  if (!instruction || !instruction.trim()) throw new DraftError('Type an instruction to refine the email.', 400);
  if (!checkAiRateLimit(workspaceId)) {
    throw new DraftError('AI call budget for this workspace is exhausted for the hour. Try again later.', 429);
  }
  const draft = await getDraftOrThrow(workspaceId, email.draftId);
  const { tryGetAIClient, INTERVIEW_MODEL } = await import('../../../packages/ai/client.js');
  const ai = tryGetAIClient();
  if (!ai) throw new DraftError('AI is not configured on this server (GOOGLE_AI_API_KEY is missing).', 503);
  const snap = snapshotOf(draft);

  const current: GeneratedEmail = {
    subjects: asJsonArray(email.subjectVariants).filter((s) => typeof s === 'string') as string[],
    previewText: email.previewText || '',
    bodyHtml: String(email.bodyHtml || ''),
    bodyText: String(email.bodyText || ''),
    factMap: asJsonArray(email.factMap) as FactMapEntry[],
  };
  const userText = scope === 'whole'
    ? `Revise this whole email per the user's instruction. Keep every claim sourced. Return the full corrected draft JSON.\n\nInstruction: ${instruction}\n\nCurrent draft:\n${JSON.stringify(current)}`
    : `Revise ONLY the ${scope} of this email per the user's instruction. Keep everything else identical. Keep every claim sourced. Return the full draft JSON with the revised section.\n\nInstruction: ${instruction}\n\nCurrent draft:\n${JSON.stringify(current)}`;
  const revised = await geminiGenerate(ai, INTERVIEW_MODEL, draftSystemPrompt(snap), userText);
  const { validated, removed } = applyValidation(
    { subjects: revised.subjects, previewText: revised.previewText, bodyHtml: revised.bodyHtml, bodyText: revised.bodyText },
    draft,
    revised.factMap,
    undefined,
    workspaceId,
  );
  const row = await db.campaignEmail.update({
    where: { id: emailId },
    data: {
      subjectVariants: toJson(validated.subjects),
      previewText: validated.previewText,
      bodyHtml: validated.bodyHtml,
      bodyText: validated.bodyText,
      factMap: toJson(revised.factMap),
      versions: toJson(pushVersion(asJsonArray(email.versions) as EmailVersion[], snapshotVersion(email, `Refine (${scope}): ${instruction.slice(0, 80)}`))),
    },
  });
  const state = emailToState(row);
  state.removedClaims = removed;
  return state;
}

/**
 * Direct editing (spec §12): the user edits fields; code re-validates.
 * A fact the user types that is not in any source is NOT removed — it is
 * kept and reported as a new claim, with the question whether to update the
 * Brief (acceptFacts). Removing a deliberately typed fact would be wrong;
 * silently keeping an unverified fact would also be wrong.
 */
export async function directEditEmail(
  workspaceId: string,
  emailId: string,
  patch: Partial<{ subjectVariants: string[]; subjectSelected: number; previewText: string; bodyHtml: string; bodyText: string }>,
): Promise<EmailState> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  await assertLoadedEmailEditable(workspaceId, email);
  const draft = await getDraftOrThrow(workspaceId, email.draftId);
  const oldSubjects = asJsonArray(email.subjectVariants).filter((s) => typeof s === 'string') as string[];
  const oldText = [oldSubjects.join(' '), email.previewText || '', String(email.bodyHtml || ''), String(email.bodyText || '')].join('\n');
  const oldClaims = new Set(extractClaims(oldText).map(normalizeClaim));
  const current: DraftContent = {
    subjects: patch.subjectVariants ?? oldSubjects,
    previewText: patch.previewText ?? (email.previewText || ''),
    bodyHtml: patch.bodyHtml ?? String(email.bodyHtml || ''),
    bodyText: patch.bodyText ?? String(email.bodyText || ''),
  };
  const newText = [current.subjects.join(' '), current.previewText, current.bodyHtml, current.bodyText].join('\n');
  const { texts } = allowedSourcesFor(draft);
  const allowed = buildAllowedClaimSet(texts);
  const candidateNew = new Set<string>();
  for (const claim of extractClaims(newText)) {
    const n = normalizeClaim(claim);
    if (!allowed.has(n) && !oldClaims.has(n)) candidateNew.add(n);
  }
  const { validated, removed, kept } = applyValidation(current, draft, asJsonArray(email.factMap) as FactMapEntry[], candidateNew, workspaceId);
  const row = await db.campaignEmail.update({
    where: { id: emailId },
    data: {
      subjectVariants: toJson(validated.subjects),
      subjectSelected: patch.subjectSelected ?? email.subjectSelected ?? 0,
      previewText: validated.previewText,
      bodyHtml: validated.bodyHtml,
      bodyText: validated.bodyText,
      versions: toJson(pushVersion(asJsonArray(email.versions) as EmailVersion[], snapshotVersion(email, 'Direct edit'))),
    },
  });
  const state = emailToState(row);
  state.removedClaims = removed;
  state.newClaims = kept;
  return state;
}

/**
 * Accept user-typed facts into the Brief (spec §12: "ask whether to update
 * the Brief"). The confirmed Brief text is untouched and its version lock
 * stands; the facts land in user_added_facts (and must_include_facts), which
 * the validator reads as a source from then on.
 */
export async function acceptFacts(workspaceId: string, emailId: string, claims: string[]): Promise<EmailState> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  const draft = await getDraftOrThrow(workspaceId, email.draftId);
  const brief = briefOf(draft) || {};
  const clean = [...new Set((claims || []).map((c) => String(c).trim()).filter(Boolean))];
  if (clean.length === 0) throw new DraftError('No facts to accept.', 400);
  const existing = new Set([
    ...(Array.isArray(brief.user_added_facts) ? brief.user_added_facts.map((f: unknown) => normalizeClaim(String(f))) : []),
    ...(Array.isArray(brief.must_include_facts) ? brief.must_include_facts.map((f: unknown) => normalizeClaim(String(f))) : []),
  ]);
  const fresh = clean.filter((c) => !existing.has(normalizeClaim(c)));
  // Drop claims subsumed by a longer fact (e.g. "2026" inside
  // "December 18, 2026") so the Brief stays clean.
  const normAll = [...existing, ...fresh.map((c) => normalizeClaim(c))];
  const kept = fresh.filter((c) => {
    const n = normalizeClaim(c);
    return !normAll.some((o) => o !== n && o.length > n.length && o.includes(n));
  });
  const nextBrief = {
    ...brief,
    must_include_facts: [...(Array.isArray(brief.must_include_facts) ? brief.must_include_facts : []), ...kept],
    user_added_facts: [...(Array.isArray(brief.user_added_facts) ? brief.user_added_facts : []), ...kept],
  };
  await db.campaignDraft.update({ where: { id: draft.id }, data: { brief: toJson(nextBrief) } });
  const row = await getEmailOrThrow(workspaceId, emailId);
  const state = emailToState(row);
  state.newClaims = [];
  return state;
}

/** Undo: restore the most recent saved version (version history, last 10). */
export async function undoEmail(workspaceId: string, emailId: string): Promise<EmailState> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  await assertLoadedEmailEditable(workspaceId, email);
  const versions = asJsonArray(email.versions) as EmailVersion[];
  const prev = versions[versions.length - 1];
  if (!prev) throw new DraftError('Nothing to undo — no earlier version exists.', 400);
  const row = await db.campaignEmail.update({
    where: { id: emailId },
    data: {
      subjectVariants: prev.subjects,
      subjectSelected: prev.subjectSelected,
      previewText: prev.previewText,
      bodyHtml: prev.bodyHtml,
      bodyText: prev.bodyText,
      factMap: toJson(prev.factMap),
      versions: toJson(versions.slice(0, -1)),
    },
  });
  return emailToState(row);
}

/**
 * Consistency check (spec §12): warns when the draft contradicts the Brief
 * (a Brief fact's numbers missing from the draft), when the selected subject
 * is over ~50 chars, or when the CTA is missing. Single email: there are no
 * later emails to contradict yet (M4 sequence check).
 */
export async function consistencyCheck(workspaceId: string, emailId: string): Promise<{ warnings: string[]; ok: boolean }> {
  const email = await getEmailOrThrow(workspaceId, emailId);
  const draft = await getDraftOrThrow(workspaceId, email.draftId);
  const warnings: string[] = [];
  const brief = briefOf(draft) || {};
  const draftText = `${asJsonArray(email.subjectVariants).join(' ')} ${email.previewText || ''} ${email.bodyHtml || ''} ${email.bodyText || ''}`;
  const draftClaims = new Set(extractClaims(draftText).map(normalizeClaim));
  const mustFacts = Array.isArray(brief.must_include_facts) ? brief.must_include_facts : [];
  for (const fact of mustFacts) {
    for (const claim of extractClaims(String(fact))) {
      if (!draftClaims.has(normalizeClaim(claim))) {
        warnings.push(`Brief fact not reflected in the draft: "${fact}"`);
      }
    }
  }
  const subjects = asJsonArray(email.subjectVariants).filter((s) => typeof s === 'string') as string[];
  const selected = subjects[email.subjectSelected ?? 0] || '';
  if (selected.length > 50) warnings.push(`Selected subject is ${selected.length} characters (aim under ~50).`);
  const cta = (email.cta || {}) as Record<string, unknown>;
  if (!cta.action && !/book|call|visit|reply|schedule|sign up/i.test(draftText)) {
    warnings.push('No clear call to action found in the email.');
  }
  if (findPlaceholders(draftText).length > 0) {
    warnings.push(`${findPlaceholders(draftText).length} placeholder(s) still block sending.`);
  }
  return { warnings, ok: warnings.length === 0 };
}
