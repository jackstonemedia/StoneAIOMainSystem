// Phase 2 (AI Agent) — modes, grants, audit.
// Mode is a workspace property, not a route property, so both the new
// agent route and the shared approval route read the same source.
import type { PrismaClient } from '@prisma/client';
import { isGrantable, type AgentMode } from './tools.js';

type Db = PrismaClient;

export const AGENT_MODES: AgentMode[] = ['approve', 'autonomy', 'read-only'];

export function isAgentMode(value: unknown): value is AgentMode {
  return typeof value === 'string' && (AGENT_MODES as string[]).includes(value);
}

export interface AgentSettings {
  mode: AgentMode;
  name: string;
}

/** Reads the workspace's agent settings (schema defaults cover new rows). */
export async function getAgentSettings(database: Db, workspaceId: string): Promise<AgentSettings> {
  const ws = await database.workspace.findUnique({
    where: { id: workspaceId },
    select: { agentMode: true, agentName: true },
  });
  return {
    mode: isAgentMode(ws?.agentMode) ? ws.agentMode : 'approve',
    name: typeof ws?.agentName === 'string' && ws.agentName.trim() ? ws.agentName : 'AI Agent',
  };
}

export async function setAgentSettings(
  database: Db,
  workspaceId: string,
  patch: { mode?: string; name?: string },
): Promise<AgentSettings> {
  const data: { agentMode?: string; agentName?: string } = {};
  if (patch.mode !== undefined) {
    if (!isAgentMode(patch.mode)) throw new Error(`Unknown agent mode: ${patch.mode}`);
    data.agentMode = patch.mode;
  }
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('Agent name must not be empty');
    data.agentName = patch.name.trim();
  }
  await database.workspace.update({ where: { id: workspaceId }, data });
  return getAgentSettings(database, workspaceId);
}

/** Live (unrevoked) grants for the workspace, oldest first. */
export async function listGrants(database: Db, workspaceId: string) {
  return database.agentAutonomyGrant.findMany({
    where: { workspaceId, revokedAt: null },
    orderBy: { grantedAt: 'asc' },
  });
}

export async function listGrantedToolNames(database: Db, workspaceId: string): Promise<Set<string>> {
  const grants = await listGrants(database, workspaceId);
  return new Set(grants.map((g) => g.toolName));
}

/**
 * Grants a tool after an approval in Autonomy mode. Re-activates a
 * revoked grant instead of duplicating it. Sends/publishing are never
 * grantable — calling this for one is a no-op that reports why.
 */
export async function grantTool(
  database: Db,
  workspaceId: string,
  toolName: string,
  grantedBy: string,
): Promise<{ granted: boolean; reason?: string }> {
  if (!isGrantable(toolName)) {
    return { granted: false, reason: `${toolName} is never grantable (sends/publishing always need exact approval)` };
  }
  const existing = await database.agentAutonomyGrant.findFirst({
    where: { workspaceId, toolName },
    orderBy: { grantedAt: 'desc' },
  });
  if (existing && !existing.revokedAt) return { granted: true };
  if (existing) {
    await database.agentAutonomyGrant.update({
      where: { id: existing.id },
      data: { revokedAt: null, grantedAt: new Date(), grantedBy },
    });
    return { granted: true };
  }
  await database.agentAutonomyGrant.create({
    data: { workspaceId, toolName, grantedBy },
  });
  return { granted: true };
}

export async function revokeGrant(database: Db, workspaceId: string, grantId: string): Promise<boolean> {
  const res = await database.agentAutonomyGrant.updateMany({
    where: { id: grantId, workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function writeAudit(
  database: Db,
  entry: {
    workspaceId: string;
    userId: string;
    toolName: string;
    args: unknown;
    result?: unknown;
    mode: AgentMode;
    granted: boolean;
  },
): Promise<void> {
  await database.agentAuditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      toolName: entry.toolName,
      args: (entry.args ?? {}) as object,
      // JSON round-trip keeps this a plain JSON value; null/undefined
      // becomes SQL NULL (Prisma rejects a literal null here).
      result:
        entry.result === undefined || entry.result === null
          ? undefined
          : JSON.parse(JSON.stringify(entry.result)),
      mode: entry.mode,
      granted: entry.granted,
    },
  });
}

/** Chat mode-switch commands, handled before any LLM call. */
export function parseModeSwitch(message: string): AgentMode | null {
  const m = message
    .trim()
    .toLowerCase()
    .match(/^switch to (read-only|readonly|autonomy|autonomous|approve|approval mode)[.!]?$/);
  if (!m) return null;
  if (m[1] === 'read-only' || m[1] === 'readonly') return 'read-only';
  if (m[1] === 'autonomy' || m[1] === 'autonomous') return 'autonomy';
  return 'approve';
}
