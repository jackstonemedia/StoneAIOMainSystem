// Phase 3 (AI Agent) — memory curation + injection.
// Rule-based v1: deterministic, unit-testable, works with no key.
// Only distilled statements are stored — never raw conversation — and
// the agent never auto-updates a memory; only the user edits/deletes.
import type { PrismaClient } from '@prisma/client';

type Db = PrismaClient;

export const MEMORY_KINDS = ['correction', 'preference', 'fact', 'decision', 'rule'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export function isMemoryKind(value: unknown): value is MemoryKind {
  return typeof value === 'string' && (MEMORY_KINDS as readonly string[]).includes(value);
}

export const MEMORY_PROMPT_CAP = 50;
export const MEMORY_CONTENT_CAP = 500;

/**
 * Explicit remember command: "remember that X" / "remember: X".
 * Returns the distilled content X, or null. Case-insensitive on the
 * marker; the content keeps the user's own wording.
 */
export function parseRememberCommand(message: string): string | null {
  const m = message.trim().match(/^remember\s*(?:that\s+|:)\s*(.+)$/is);
  if (!m) return null;
  const content = m[1].trim();
  return content ? content : null;
}

// Comma-gated markers only: bare "no " / "actually " false-fire on
// ordinary phrases ("No worries", "Actually this is…"), and a false
// memory actively steers future answers — worse than a missed one.
const CORRECTION_MARKERS = ['correction:', 'actually,', 'i meant ', 'wrong,', 'no,'] as const;

/**
 * Correction capture: a message starting with a correction marker
 * records a correction memory. Returns the marker-stripped distilled
 * content, or null. Markers are tried longest-first so "actually,"
 * wins over "actually " and "correction:" is unambiguous.
 */
export function parseCorrection(message: string): string | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const markers = [...CORRECTION_MARKERS].sort((a, b) => b.length - a.length);
  for (const marker of markers) {
    if (lower.startsWith(marker)) {
      const content = trimmed.slice(marker.length).trim();
      return content ? content : null;
    }
  }
  return null;
}

export interface MemoryRow {
  kind: string;
  content: string;
  createdAt: Date;
}

/**
 * Formats memories for the system instruction: corrections first
 * (newest first), then everything else newest first, capped. The
 * header states the recency rule so conflicts resolve visibly.
 * Returns an empty string when there is nothing to inject.
 */
export function formatMemoriesForPrompt(memories: MemoryRow[]): string {
  if (memories.length === 0) return '';
  const sorted = [...memories].sort((a, b) => {
    const aCorr = a.kind === 'correction' ? 0 : 1;
    const bCorr = b.kind === 'correction' ? 0 : 1;
    if (aCorr !== bCorr) return aCorr - bCorr;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const lines = sorted.slice(0, MEMORY_PROMPT_CAP).map((m) => {
    const content = m.content.length > MEMORY_CONTENT_CAP
      ? `${m.content.slice(0, MEMORY_CONTENT_CAP)}…`
      : m.content;
    return `- [${m.kind}] ${content}`;
  });
  return (
    'What you know about this workspace (from past corrections and saved facts — later corrections override earlier ones):\n' +
    lines.join('\n')
  );
}

/** Workspace-scoped list, newest first. Never serves another workspace. */
export async function listMemories(database: Db, workspaceId: string) {
  return database.agentMemory.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createMemory(
  database: Db,
  workspaceId: string,
  userId: string,
  kind: string,
  content: string,
) {
  if (!isMemoryKind(kind)) throw new Error(`Unknown memory kind: ${kind}`);
  if (!content.trim()) throw new Error('Memory content must not be empty');
  return database.agentMemory.create({
    data: { workspaceId, userId, kind, content: content.trim() },
  });
}

export async function updateMemory(
  database: Db,
  workspaceId: string,
  memoryId: string,
  patch: { content?: string; kind?: string },
) {
  const data: { content?: string; kind?: string } = {};
  if (patch.content !== undefined) {
    if (!patch.content.trim()) throw new Error('Memory content must not be empty');
    data.content = patch.content.trim();
  }
  if (patch.kind !== undefined) {
    if (!isMemoryKind(patch.kind)) throw new Error(`Unknown memory kind: ${patch.kind}`);
    data.kind = patch.kind;
  }
  const existing = await database.agentMemory.findFirst({ where: { id: memoryId, workspaceId } });
  if (!existing) return null;
  return database.agentMemory.update({ where: { id: memoryId }, data });
}

export async function deleteMemory(database: Db, workspaceId: string, memoryId: string): Promise<boolean> {
  const res = await database.agentMemory.deleteMany({ where: { id: memoryId, workspaceId } });
  return res.count > 0;
}
