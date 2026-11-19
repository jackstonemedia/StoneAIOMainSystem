/**
 * Automation runner — Email Marketing `Automation` model (complete-platform item 1).
 *
 * Before this file, `Automation` rows were CRUD-only: a business could build
 * a canvas and set it ACTIVE, and nothing ever ran. This runner makes them run:
 *
 * - `evaluateAutomationTrigger` — called from `emitTrigger` (and direct calls)
 *   for every internal event; ACTIVE automations whose trigger matches get an
 *   enrollment for the contact (reentry rules honored).
 * - `advanceEnrollment` — walks the canvas from the entry node, executing
 *   steps in order (SEND_EMAIL, WAIT, CONDITION_BRANCH, ADD_TAG, REMOVE_TAG,
 *   UPDATE_FIELD, WEBHOOK_CALL, GOAL_CHECK, EXIT_AUTOMATION). A WAIT parks
 *   the enrollment with `resumeAt`; the 1-min cron resumes it.
 * - `resumeDueEnrollments` — the 1-min cron entry point (WAIT resumption).
 * - `evaluateDateBasedAutomations` — the daily cron entry point (DATE_BASED
 *   triggers: birthday / contact-created anniversary, month+day match).
 *
 * Honest limits, recorded here so they are not mistaken for bugs:
 * - Tags applied BY an automation do not re-emit tag events (no cascade —
 *   chained automations could loop forever with no cycle guard).
 * - A step that fails (no mailbox, webhook down, unconfigured step) stops
 *   the enrollment at that step with `lastError` set. It is NOT retried
 *   silently and does NOT pretend the step ran.
 * - Automations are a Complete-tier feature: evaluation and resumption
 *   refuse when the workspace plan is below Complete (item 7 — a downgraded
 *   workspace's automations stop, they do not keep running).
 */
import { db } from '../../../infrastructure/database/client.js';
import { assertPlan } from '../../middleware/plan-guard.js';

export interface AutomationTriggerEvent {
  /** StoneAIOEvent string, e.g. 'contact.created', 'campaign.opened'. */
  type: string;
  contactId?: string;
  tag?: string;
  stageId?: string;
  campaignId?: string;
  pageId?: string;
  /** Custom field name for CUSTOM_FIELD_CHANGED. */
  field?: string;
  changedFields?: string[];
  payload?: Record<string, unknown>;
}

const WAIT_MULTIPLIERS: Record<string, number> = {
  seconds: 1000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};
const MAX_WAIT_MS = 30 * 86_400_000;
const MAX_STEPS = 50;

type CanvasNode = {
  id: string;
  data?: { stepType?: string; config?: Record<string, unknown>; label?: string };
};
type CanvasEdge = { source: string; target: string; sourceHandle?: string | null };

const EVENT_TO_TRIGGER: Record<string, string> = {
  'contact.created': 'CONTACT_CREATED',
  'contact.tag_added': 'TAG_ADDED',
  'contact.tag_removed': 'TAG_REMOVED',
  'form.submitted': 'FORM_SUBMITTED',
  'deal.stage_changed': 'DEAL_STAGE_CHANGED',
  'contact.updated': 'CUSTOM_FIELD_CHANGED',
  'campaign.opened': 'EMAIL_OPENED',
  'campaign.clicked': 'EMAIL_LINK_CLICKED',
};

function parseCanvas(canvasJson: unknown): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const raw = (canvasJson as { nodes?: CanvasNode[]; edges?: CanvasEdge[] } | null) ?? {};
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw.edges) ? raw.edges : [];
  return { nodes, edges };
}

/** Nodes with no incoming edge (excluding the TRIGGER node), in canvas order. */
function entryNodes(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const hasIncoming = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => n.data?.stepType !== 'TRIGGER' && !hasIncoming.has(n.id));
}

function successor(nodeId: string, edges: CanvasEdge[], handle?: string | null): CanvasNode | null {
  const edge = edges.find((e) => e.source === nodeId && (handle ? e.sourceHandle === handle : true));
  return edge ? ({ id: edge.target } as CanvasNode) : null;
}

function nodeById(nodes: CanvasNode[], id: string | null | undefined): CanvasNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) ?? null;
}

export async function isAutomationAllowed(workspaceId: string): Promise<boolean> {
  try {
    await assertPlan(workspaceId, 'complete');
    return true;
  } catch {
    return false;
  }
}

function matchesTriggerConfig(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  event: AutomationTriggerEvent,
): boolean {
  switch (triggerType) {
    case 'TAG_ADDED':
    case 'TAG_REMOVED': {
      const want = typeof triggerConfig.tag === 'string' ? triggerConfig.tag.trim() : '';
      return !want || event.tag === want;
    }
    case 'DEAL_STAGE_CHANGED': {
      const want = typeof triggerConfig.stageId === 'string' ? triggerConfig.stageId : '';
      const got = event.stageId ?? (event.payload as any)?.newStage ?? (event.payload as any)?.deal?.stageId;
      return !want || got === want;
    }
    case 'EMAIL_OPENED':
    case 'EMAIL_LINK_CLICKED': {
      const want = typeof triggerConfig.campaignId === 'string' ? triggerConfig.campaignId : '';
      return !want || event.campaignId === want;
    }
    case 'FORM_SUBMITTED': {
      const want = typeof triggerConfig.pageId === 'string' ? triggerConfig.pageId : '';
      return !want || event.pageId === want;
    }
    case 'CUSTOM_FIELD_CHANGED': {
      const want = typeof triggerConfig.field === 'string' ? triggerConfig.field.trim() : '';
      if (!want) return false;
      const changed = event.changedFields ?? (event.field ? [event.field] : []);
      return changed.includes(want);
    }
    default:
      return true;
  }
}

function resolveContactId(event: AutomationTriggerEvent): string | null {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  return (
    event.contactId ??
    (typeof p.contactId === 'string' ? p.contactId : null) ??
    (typeof (p.deal as any)?.contactId === 'string' ? (p.deal as any).contactId : null) ??
    (typeof (p.contact as any)?.id === 'string' ? (p.contact as any).id : null) ??
    null
  );
}

async function exitEnrollment(id: string, reason: string): Promise<void> {
  await db.automationEnrollment.update({
    where: { id },
    data: { exitedAt: new Date(), exitReason: reason as never, currentStepId: null, resumeAt: null },
  });
}

/** Create an enrollment if the reentry rules allow it, then start it. Null when skipped. */
async function maybeEnroll(
  automation: { id: string; workspaceId: string; reentryAllowed: boolean; reentryCooldownDays: number },
  contactId: string,
): Promise<{ id: string } | null> {
  const prior = await db.automationEnrollment.findMany({
    where: { automationId: automation.id, contactId },
    orderBy: { enrolledAt: 'desc' },
    take: 1,
  });
  const latest = prior[0] as
    | { id: string; exitedAt: Date | null }
    | undefined;
  if (latest && !latest.exitedAt) return null; // already active in this automation
  if (latest && !automation.reentryAllowed) return null; // one run per contact, ever
  if (latest?.exitedAt && automation.reentryAllowed && automation.reentryCooldownDays > 0) {
    const daysSinceExit = (Date.now() - new Date(latest.exitedAt).getTime()) / 86_400_000;
    if (daysSinceExit < automation.reentryCooldownDays) return null;
  }

  const enrollment = await db.automationEnrollment.create({
    data: { workspaceId: automation.workspaceId, automationId: automation.id, contactId },
  });
  await advanceEnrollment(enrollment.id);
  return enrollment as { id: string };
}

/**
 * Manual enrollment (Slice 1c) — the "Enroll" button in AutomationsList.
 * Only MANUAL_ENROLLMENT automations accept it: enrolling a contact by
 * hand into a CONTACT_CREATED automation would bypass its trigger, so the
 * route returns a plain-words 400 for that. Returns the enrollment, or
 * null when the reentry guard declines (already active in this automation,
 * or one-run-per-contact and already ran).
 */
export async function enrollContactManually(
  workspaceId: string,
  automationId: string,
  contactId: string,
): Promise<{ id: string } | null> {
  if (!(await isAutomationAllowed(workspaceId))) {
    throw new Error('Automations require the Complete plan.');
  }
  const automation = await db.automation.findFirst({
    where: { id: automationId, workspaceId },
  });
  if (!automation) throw new Error('Automation not found.');
  if (automation.status !== 'ACTIVE') {
    throw new Error(
      `Automation is ${automation.status} — activate it before enrolling contacts.`,
    );
  }
  if (automation.triggerType !== 'MANUAL_ENROLLMENT') {
    throw new Error('Only MANUAL_ENROLLMENT automations accept manual enrollment.');
  }
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  });
  if (!contact) throw new Error('Contact not found.');
  return maybeEnroll(automation, contactId);
}

export async function evaluateAutomationTrigger(
  workspaceId: string,
  event: AutomationTriggerEvent,
): Promise<void> {
  const triggerType = EVENT_TO_TRIGGER[event.type];
  if (!triggerType) return;
  const contactId = resolveContactId(event);
  if (!contactId) return;
  if (!(await isAutomationAllowed(workspaceId))) return;

  const automations = await db.automation.findMany({
    where: { workspaceId, status: 'ACTIVE', triggerType: triggerType as never },
  });
  for (const automation of automations as any[]) {
    const triggerConfig = (automation.triggerConfig ?? {}) as Record<string, unknown>;
    if (!matchesTriggerConfig(triggerType, triggerConfig, event)) continue;
    await maybeEnroll(automation, contactId).catch((err: unknown) => {
      console.error(`[AutomationRunner] enroll failed (${automation.id} / ${contactId}):`, err);
    });
  }
}

/** Render {{firstName}} / {{lastName}} / {{email}} / {{phone}} / {{company}} / {{fullName}}. Unknown keys stay as-is. */
export function renderAutomationTemplate(
  text: string,
  contact: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null },
  companyName?: string | null,
): string {
  const values: Record<string, string> = {
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: companyName ?? '',
  };
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, key: string) =>
    key in values ? values[key] : m,
  );
}

function parseTags(tagsJson: string | null | undefined): string[] {
  try {
    const v = JSON.parse(tagsJson ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseCustomFields(json: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(json ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function evaluateAutomationCondition(
  cfg: Record<string, unknown>,
  contact: {
    tagsJson?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    status?: string | null;
    source?: string | null;
    customFieldsJson?: string | null;
    deals?: { pipelineStage?: { id?: string; name?: string } | null }[];
  },
): boolean {
  const field = typeof cfg.field === 'string' ? cfg.field : 'tag';
  const operator = typeof cfg.operator === 'string' ? cfg.operator : 'contains';
  const value = typeof cfg.value === 'string' ? cfg.value : '';

  let actual: unknown;
  if (field === 'tag') {
    actual = parseTags(contact.tagsJson);
  } else if (field === 'dealStage') {
    actual = (contact.deals ?? []).map((d) => d.pipelineStage?.name ?? '').filter(Boolean);
    const ids = (contact.deals ?? []).map((d) => (d as any).pipelineStageId ?? '').filter(Boolean);
    if (operator === 'equals' || operator === 'not_equals') {
      const hit =
        (actual as string[]).some((s) => s.toLowerCase() === value.toLowerCase()) ||
        ids.some((s) => s === value);
      return operator === 'equals' ? hit : !hit;
    }
  } else if (field === 'customField') {
    const name = typeof cfg.customFieldName === 'string' ? cfg.customFieldName : '';
    actual = name ? parseCustomFields(contact.customFieldsJson)[name] : undefined;
  } else if (field === 'company') {
    actual = (contact as any).companyName ?? '';
  } else {
    actual = (contact as any)[field] ?? '';
  }

  const actualStr = Array.isArray(actual) ? '' : String(actual ?? '');
  switch (operator) {
    case 'exists':
      return Array.isArray(actual) ? actual.length > 0 : actualStr.trim() !== '';
    case 'not_exists':
      return Array.isArray(actual) ? actual.length === 0 : actualStr.trim() === '';
    case 'contains':
      if (Array.isArray(actual)) return actual.some((t) => t.toLowerCase() === value.toLowerCase());
      return actualStr.toLowerCase().includes(value.toLowerCase());
    case 'not_contains':
      if (Array.isArray(actual)) return !actual.some((t) => t.toLowerCase() === value.toLowerCase());
      return !actualStr.toLowerCase().includes(value.toLowerCase());
    case 'equals':
      if (Array.isArray(actual)) return actual.some((t) => t.toLowerCase() === value.toLowerCase());
      return actualStr.toLowerCase() === value.toLowerCase();
    case 'not_equals':
      if (Array.isArray(actual)) return !actual.some((t) => t.toLowerCase() === value.toLowerCase());
      return actualStr.toLowerCase() !== value.toLowerCase();
    default:
      return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendAutomationEmail(
  workspaceId: string,
  automationId: string,
  enrollmentId: string,
  contact: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; phone?: string | null },
  cfg: Record<string, unknown>,
  companyName: string | null,
): Promise<void> {
  const subject = renderAutomationTemplate(String(cfg.subject ?? ''), contact, companyName).trim();
  const body = renderAutomationTemplate(String(cfg.body ?? ''), contact, companyName);
  if (!subject) throw new Error('SEND_EMAIL step has no subject configured.');
  if (!body.trim()) throw new Error('SEND_EMAIL step has no body configured.');
  if (!contact.email) return; // No address: nothing to send, step is a no-op, flow continues.

  const { isEmailSuppressed } = await import('./audience.service.js');
  if (await isEmailSuppressed(workspaceId, contact.email)) {
    await exitEnrollment(enrollmentId, 'UNSUBSCRIBED');
    throw new EnrollmentExitedError();
  }
  const unsub = await db.emailEvent.findFirst({
    where: { workspaceId, contactId: contact.id, eventType: 'UNSUBSCRIBED' },
  });
  if (unsub) {
    await exitEnrollment(enrollmentId, 'UNSUBSCRIBED');
    throw new EnrollmentExitedError();
  }

  const { selectNextMailbox, recordSendSuccess, recordSendAuthError } = await import(
    './mailbox-pool.service.js'
  );
  const mailbox = await selectNextMailbox(workspaceId);
  if (!mailbox) {
    throw new Error(
      'No available outreach mailboxes (Gmail or Outlook) in this workspace. All daily send limits may be reached or no inboxes are connected. Check Settings → Email Outreach.',
    );
  }
  const fromName = typeof cfg.fromName === 'string' && cfg.fromName.trim() ? cfg.fromName.trim() : undefined;
  const plainText = stripHtml(body);

  try {
    if (mailbox.provider === 'gmail') {
      const { sendGmailMessage } = await import('../channels/gmail.service.js');
      const result = await sendGmailMessage(mailbox.id, contact.email, subject, plainText, undefined, body, fromName);
      await recordSendSuccess(mailbox.id);
      await writeAutomationEmailEvents(workspaceId, automationId, enrollmentId, contact, subject, body, result.messageId);
    } else if (mailbox.provider === 'outlook') {
      const { sendOutlookEmail } = await import('../channels/outlook.service.js');
      await sendOutlookEmail(mailbox.id, contact.email, subject, plainText);
      await recordSendSuccess(mailbox.id);
      await writeAutomationEmailEvents(workspaceId, automationId, enrollmentId, contact, subject, body, null);
    } else {
      throw new Error(`Unsupported mailbox provider: ${String((mailbox as any).provider)}`);
    }
  } catch (err: unknown) {
    if (err instanceof EnrollmentExitedError) throw err;
    await recordSendAuthError(mailbox.id, err instanceof Error ? err.message : String(err)).catch(() => undefined);
    throw err;
  }
}

class EnrollmentExitedError extends Error {
  constructor() {
    super('enrollment exited');
    this.name = 'EnrollmentExitedError';
  }
}

async function writeAutomationEmailEvents(
  workspaceId: string,
  automationId: string,
  enrollmentId: string,
  contact: { id: string; email?: string | null },
  subject: string,
  body: string,
  messageId: string | null,
): Promise<void> {
  try {
    await db.emailEvent.create({
      data: {
        workspaceId,
        contactId: contact.id,
        automationEnrollmentId: enrollmentId,
        eventType: 'SENT',
        metadata: { subject, messageId, automationId },
      },
    });
  } catch (err: unknown) {
    console.warn('[AutomationRunner] Failed to write EmailEvent:', err instanceof Error ? err.message : String(err));
  }
  try {
    await db.contactEvent.create({
      data: {
        contactId: contact.id,
        type: 'email_sent',
        title: `Email sent: ${subject}`,
        content: body,
        metadataJson: JSON.stringify({ subject, to: contact.email, source: 'automation', automationId }),
      },
    });
  } catch (err: unknown) {
    console.warn('[AutomationRunner] Failed to write ContactEvent:', err instanceof Error ? err.message : String(err));
  }
}

const UPDATE_FIELD_ALLOWLIST = ['firstName', 'lastName', 'phone', 'location', 'title', 'status', 'source', 'about'];

/**
 * Advance one enrollment through its canvas. Starts at the enrollment's
 * currentStepId (resume) or the first entry node. Stops at a WAIT (parks
 * with resumeAt), at an exit, at the end of the chain, or on a step error
 * (lastError set, no silent retry).
 */
export async function advanceEnrollment(enrollmentId: string, afterWaitId?: string): Promise<void> {
  const enrollment = (await db.automationEnrollment.findUnique({ where: { id: enrollmentId } })) as
    | { id: string; workspaceId: string; automationId: string; contactId: string; currentStepId: string | null; attempts: number }
    | null;
  if (!enrollment) return;

  const automation = (await db.automation.findUnique({ where: { id: enrollment.automationId } })) as
    | { id: string; workspaceId: string; status: string; canvasJson: unknown }
    | null;
  if (!automation) {
    await exitEnrollment(enrollmentId, 'COMPLETED_ALL_STEPS');
    return;
  }
  const contact = (await db.contact.findUnique({
    where: { id: enrollment.contactId },
    include: { deals: { include: { pipelineStage: true } } },
  })) as any;
  if (!contact) {
    await exitEnrollment(enrollmentId, 'CONTACT_DELETED');
    return;
  }
  let companyName: string | null = null;
  if (contact.companyId) {
    const company = (await db.company.findUnique({ where: { id: contact.companyId }, select: { name: true } })) as
      | { name: string | null }
      | null;
    companyName = company?.name ?? null;
  }
  const contactWithCompany = { ...contact, companyName };

  const { nodes, edges } = parseCanvas(automation.canvasJson);
  let current: CanvasNode | null;
  if (afterWaitId) {
    const waitNode = nodeById(nodes, afterWaitId);
    const nextId = waitNode ? successor(waitNode.id, edges)?.id : null;
    current = nodeById(nodes, nextId);
  } else if (enrollment.currentStepId) {
    current = nodeById(nodes, enrollment.currentStepId);
  } else {
    current = entryNodes(nodes, edges)[0] ?? null;
  }
  if (afterWaitId) {
    await db.automationEnrollment.update({ where: { id: enrollmentId }, data: { resumeAt: null } });
  }

  let steps = 0;
  try {
    while (current && steps < MAX_STEPS) {
      steps += 1;
      const stepType = current.data?.stepType ?? '';
      const cfg = (current.data?.config ?? {}) as Record<string, unknown>;
      const next = (handle?: string | null): CanvasNode | null => {
        const edge = edges.find((e) => e.source === current!.id && (handle ? e.sourceHandle === handle : true));
        return edge ? nodeById(nodes, edge.target) : null;
      };

      if (stepType === 'SEND_EMAIL') {
        await sendAutomationEmail(enrollment.workspaceId, automation.id, enrollmentId, contact, cfg, companyName);
        await db.automationEnrollment.update({ where: { id: enrollmentId }, data: { currentStepId: current.id } });
        current = next();
        continue;
      }

      if (stepType === 'WAIT') {
        const amount = typeof cfg.amount === 'number' ? cfg.amount : NaN;
        const unit = typeof cfg.unit === 'string' && WAIT_MULTIPLIERS[cfg.unit] ? cfg.unit : 'days';
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('WAIT step has no duration configured.');
        }
        const durationMs = amount * WAIT_MULTIPLIERS[unit];
        if (durationMs > MAX_WAIT_MS) throw new Error('WAIT step exceeds the 30-day maximum.');
        await db.automationEnrollment.update({
          where: { id: enrollmentId },
          data: { currentStepId: current.id, resumeAt: new Date(Date.now() + durationMs) },
        });
        return; // Parked — the 1-min cron resumes it.
      }

      if (stepType === 'CONDITION_BRANCH') {
        const result = evaluateAutomationCondition(cfg, contactWithCompany);
        current = next(result ? 'TRUE_PATH' : 'FALSE_PATH');
        if (!current) {
          await exitEnrollment(enrollmentId, 'COMPLETED_ALL_STEPS');
          return;
        }
        continue;
      }

      if (stepType === 'GOAL_CHECK') {
        if (evaluateAutomationCondition(cfg, contactWithCompany)) {
          await exitEnrollment(enrollmentId, 'GOAL_MET');
          return;
        }
        current = next();
        continue;
      }

      if (stepType === 'ADD_TAG' || stepType === 'REMOVE_TAG') {
        const tag = typeof cfg.tag === 'string' ? cfg.tag.trim() : '';
        if (!tag) throw new Error(`${stepType} step has no tag configured.`);
        const tags = parseTags(contact.tagsJson);
        const updated = stepType === 'ADD_TAG'
          ? (tags.includes(tag) ? tags : [...tags, tag])
          : tags.filter((t) => t !== tag);
        await db.contact.update({ where: { id: contact.id }, data: { tagsJson: JSON.stringify(updated) } });
        contact.tagsJson = JSON.stringify(updated);
        await db.automationEnrollment.update({ where: { id: enrollmentId }, data: { currentStepId: current.id } });
        current = next();
        continue;
      }

      if (stepType === 'UPDATE_FIELD') {
        const field = typeof cfg.field === 'string' ? cfg.field : '';
        const value = typeof cfg.value === 'string' ? cfg.value : '';
        if (field === 'customField') {
          const name = typeof cfg.customFieldName === 'string' ? cfg.customFieldName.trim() : '';
          if (!name) throw new Error('UPDATE_FIELD step has no custom field name configured.');
          const fields = parseCustomFields(contact.customFieldsJson);
          fields[name] = value;
          await db.contact.update({ where: { id: contact.id }, data: { customFieldsJson: JSON.stringify(fields) } });
          contact.customFieldsJson = JSON.stringify(fields);
        } else if (UPDATE_FIELD_ALLOWLIST.includes(field)) {
          await db.contact.update({ where: { id: contact.id }, data: { [field]: value } as never });
          contact[field] = value;
        } else {
          throw new Error(`UPDATE_FIELD step has an unsupported field: ${field || '(none)'}.`);
        }
        await db.automationEnrollment.update({ where: { id: enrollmentId }, data: { currentStepId: current.id } });
        current = next();
        continue;
      }

      if (stepType === 'WEBHOOK_CALL') {
        const url = typeof cfg.url === 'string' ? cfg.url.trim() : '';
        if (!url) throw new Error('WEBHOOK_CALL step has no URL configured.');
        const method = cfg.method === 'GET' ? 'GET' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'POST'
            ? JSON.stringify({ workspaceId: enrollment.workspaceId, automationId: automation.id, contactId: contact.id, contact: { id: contact.id, email: contact.email, firstName: contact.firstName, lastName: contact.lastName } })
            : undefined,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Webhook call failed with HTTP ${res.status}.`);
        await db.automationEnrollment.update({ where: { id: enrollmentId }, data: { currentStepId: current.id } });
        current = next();
        continue;
      }

      if (stepType === 'EXIT_AUTOMATION') {
        await exitEnrollment(enrollmentId, 'EXITED_BY_STEP');
        return;
      }

      throw new Error(`Unknown automation step type: ${stepType || '(none)'}.`);
    }

    if (steps >= MAX_STEPS) {
      throw new Error(`Automation exceeded ${MAX_STEPS} steps (possible cycle).`);
    }
    // Ran out of steps: the enrollment completed its reachable chain.
    await exitEnrollment(enrollmentId, 'COMPLETED_ALL_STEPS');
  } catch (err: unknown) {
    if (err instanceof EnrollmentExitedError) return; // Already exited (e.g. UNSUBSCRIBED).
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AutomationRunner] enrollment ${enrollmentId} stopped:`, message);
    await db.automationEnrollment.update({
      where: { id: enrollmentId },
      data: { lastError: message.slice(0, 500), attempts: (enrollment.attempts ?? 0) + 1 },
    });
  }
}

/** 1-min cron: resume enrollments whose WAIT finished. Returns the count resumed. */
export async function resumeDueEnrollments(): Promise<number> {
  const due = (await db.automationEnrollment.findMany({
    where: { resumeAt: { lte: new Date() }, exitedAt: null },
  })) as { id: string; workspaceId: string; currentStepId: string | null }[];
  let resumed = 0;
  for (const enrollment of due) {
    if (!(await isAutomationAllowed(enrollment.workspaceId))) continue;
    if (!enrollment.currentStepId) continue;
    await advanceEnrollment(enrollment.id, enrollment.currentStepId).catch((err: unknown) => {
      console.error(`[AutomationRunner] resume failed (${enrollment.id}):`, err);
    });
    resumed += 1;
  }
  return resumed;
}

/** Daily cron: enroll contacts whose DATE_BASED field (birthday / created anniversary) is today. */
export async function evaluateDateBasedAutomations(): Promise<number> {
  let enrolled = 0;
  const automations = (await db.automation.findMany({
    where: { status: 'ACTIVE', triggerType: 'DATE_BASED' as never },
  })) as any[];
  const today = new Date();
  for (const automation of automations) {
    if (!(await isAutomationAllowed(automation.workspaceId))) continue;
    const field = (automation.triggerConfig as any)?.dateField === 'createdAt' ? 'createdAt' : 'dateOfBirth';
    const contacts = (await db.contact.findMany({
      where: { workspaceId: automation.workspaceId },
      select: { id: true, dateOfBirth: true, createdAt: true },
    })) as { id: string; dateOfBirth: Date | null; createdAt: Date }[];
    for (const c of contacts) {
      const d = c[field] ? new Date(c[field] as unknown as string) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate()) {
        const enr = await maybeEnroll(automation, c.id).catch(() => null);
        if (enr) enrolled += 1;
      }
    }
  }
  return enrolled;
}
