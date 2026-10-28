// Phase 2 (AI Agent) — tool framework registry.
// Every tool the agent can call declares its kind here. The gate matrix
// in service.ts reads this table — never a per-tool if/else chain — so a
// new tool lands in exactly one class, and the safe default for an
// unregistered tool is rejection (never execution).
import type { PrismaClient } from '@prisma/client';

export type ToolKind = 'read' | 'write' | 'send';
export type GateDecision = 'execute' | 'queue' | 'reject';

export interface ToolDef {
  name: string;
  kind: ToolKind;
  description: string;
}

export const TOOL_REGISTRY: Record<string, ToolDef> = {
  get_crm_dashboard: { name: 'get_crm_dashboard', kind: 'read', description: 'CRM dashboard overview' },
  search_contacts: { name: 'search_contacts', kind: 'read', description: 'Search contacts' },
  get_contact_details: { name: 'get_contact_details', kind: 'read', description: 'Contact details + recent events' },
  list_deals: { name: 'list_deals', kind: 'read', description: 'List deals' },
  list_tasks: { name: 'list_tasks', kind: 'read', description: 'List tasks' },
  list_campaigns: { name: 'list_campaigns', kind: 'read', description: 'List email campaigns' },
  create_contact: { name: 'create_contact', kind: 'write', description: 'Create a contact' },
  update_contact: { name: 'update_contact', kind: 'write', description: 'Update a contact' },
  add_contact_note: { name: 'add_contact_note', kind: 'write', description: 'Add an internal note to a contact' },
  create_deal: { name: 'create_deal', kind: 'write', description: 'Create a deal' },
  create_task: { name: 'create_task', kind: 'write', description: 'Create a task' },
  send_email: { name: 'send_email', kind: 'send', description: 'Send an email via Gmail' },
  send_sms: { name: 'send_sms', kind: 'send', description: 'Send an SMS (no provider — always an honest error)' },
  create_campaign: { name: 'create_campaign', kind: 'send', description: 'Create/publish an email campaign' },
  // Phase 4: Conversations / Inbox (reads + draft text only, no sends)
  list_inbox_conversations: { name: 'list_inbox_conversations', kind: 'read', description: 'List inbox conversations with latest message preview' },
  get_inbox_messages: { name: 'get_inbox_messages', kind: 'read', description: 'Messages of one inbox conversation' },
  list_conversations: { name: 'list_conversations', kind: 'read', description: 'List Conversations-domain threads' },
  get_conversation_messages: { name: 'get_conversation_messages', kind: 'read', description: 'Messages of one Conversations-domain thread' },
  draft_inbox_reply: { name: 'draft_inbox_reply', kind: 'read', description: 'Draft reply text for an inbox conversation (draft only, never sends)' },
  // Phase 4: Email marketing detail + send
  get_campaign_details: { name: 'get_campaign_details', kind: 'read', description: 'Campaign row + recipient counts by status' },
  send_campaign: { name: 'send_campaign', kind: 'send', description: 'Send a campaign (bulk send; an already-SENT campaign re-sends fresh)' },
  // Phase 4: Calendar / Appointments
  list_appointments: { name: 'list_appointments', kind: 'read', description: 'List appointments, optionally filtered' },
  create_appointment: { name: 'create_appointment', kind: 'write', description: 'Create an appointment' },
  // Phase 4: Deals / Pipelines full + Settings read + Reporting
  update_deal: { name: 'update_deal', kind: 'write', description: 'Update a deal (whitelisted fields only)' },
  list_pipelines: { name: 'list_pipelines', kind: 'read', description: 'Pipelines with stages (never auto-creates)' },
  get_workspace_info: { name: 'get_workspace_info', kind: 'read', description: 'Workspace name, plan, agent name/mode, displayed credits (never enforced)' },
  get_pipeline_summary: { name: 'get_pipeline_summary', kind: 'read', description: 'Deals grouped by pipeline stage (counts + values)' },
};

export type AgentMode = 'approve' | 'autonomy' | 'read-only';

export function getToolDef(name: string): ToolDef | undefined {
  return TOOL_REGISTRY[name];
}

/** Only write-class tools can ever be granted. Sends/publishing never. */
export function isGrantable(toolName: string): boolean {
  return TOOL_REGISTRY[toolName]?.kind === 'write';
}

/** Phase 4: update_deal may only change these fields. Anything else
 * the model sends is dropped before it reaches the service. */
export const DEAL_UPDATE_FIELDS = [
  'title', 'amount', 'status', 'pipelineStageId', 'contactId', 'priority', 'closeDate', 'probability',
] as const;

export function whitelistDealUpdate(args: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const k of DEAL_UPDATE_FIELDS) if (args[k] !== undefined) data[k] = args[k];
  return data;
}

/** Phase 4: appointment times must parse, or the tool refuses before
 * any write. Returns parsed dates, or an error string. */
export function validateAppointmentTimes(
  startTime: unknown,
  endTime: unknown,
): { start: Date; end: Date } | { error: string } {
  const start = typeof startTime === 'string' && startTime ? new Date(startTime) : null;
  const end = typeof endTime === 'string' && endTime ? new Date(endTime) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return { error: 'create_appointment needs valid startTime and endTime' };
  }
  return { start, end };
}

/**
 * Pure gate decision: mode × tool × granted set → what happens.
 * - read: always execute.
 * - send: always queue (held edge — exact approval, every mode).
 * - write: approve → queue; read-only → queue (proposal only, grants
 *   ignored, never auto-executed); autonomy → execute if granted,
 *   else queue (approving that queue grants the tool).
 * - unknown tool: reject. Never execute what the registry doesn't know.
 */
export function decideGate(
  mode: AgentMode,
  toolName: string,
  grantedTools: ReadonlySet<string>,
): GateDecision {
  const def = TOOL_REGISTRY[toolName];
  if (!def) return 'reject';
  if (def.kind === 'read') return 'execute';
  if (def.kind === 'send') return 'queue';
  if (mode === 'autonomy' && grantedTools.has(toolName)) return 'execute';
  return 'queue';
}

type Db = PrismaClient;

/**
 * Workspace-ownership check for every record a write/send references.
 * Returns an error string when a referenced record is missing or belongs
 * to another workspace, else null. This runs BEFORE queueing as well as
 * before executing, so a queued action can never smuggle a foreign
 * reference through to approval time.
 */
export async function verifyWriteReferences(
  database: Db,
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<string | null> {
  const refs: [string, string][] = [];
  if (typeof args.contactId === 'string' && args.contactId) refs.push(['contact', args.contactId]);
  if (typeof args.dealId === 'string' && args.dealId) refs.push(['deal', args.dealId]);
  if (typeof args.taskId === 'string' && args.taskId) refs.push(['task', args.taskId]);
  for (const [kind, id] of refs) {
    const found =
      kind === 'contact'
        ? await database.contact.findFirst({ where: { id, workspaceId }, select: { id: true } })
        : kind === 'deal'
          ? await database.deal.findFirst({ where: { id, workspaceId }, select: { id: true } })
          : await database.task.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!found) return `${kind} ${id} not found in this workspace`;
  }
  return null;
}
