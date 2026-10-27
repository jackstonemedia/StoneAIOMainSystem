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
};

export type AgentMode = 'approve' | 'autonomy' | 'read-only';

export function getToolDef(name: string): ToolDef | undefined {
  return TOOL_REGISTRY[name];
}

/** Only write-class tools can ever be granted. Sends/publishing never. */
export function isGrantable(toolName: string): boolean {
  return TOOL_REGISTRY[toolName]?.kind === 'write';
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
