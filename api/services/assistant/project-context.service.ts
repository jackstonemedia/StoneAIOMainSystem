/**
 * Project-context injection — Complete-platform item 8.
 *
 * Builds the system-prompt block that lets the assistant answer from a
 * project's own files and instructions, for conversations in that
 * project only. Nothing here ever crosses projects: the project is
 * loaded scoped to the workspace, and the files are loaded scoped to
 * the workspace + project. A conversation whose projectId points at a
 * project in another workspace gets no block at all.
 *
 * Bounds: file text is capped (ASSISTANT_PROJECT_CONTEXT_CHARS, default
 * 12,000 chars, ~3k tokens). Files are added oldest-first until the
 * budget is spent; the file that straddles the budget is cut with a
 * marker, and later files are listed by name only. Project instructions
 * are small and are never trimmed. 'failed' / 'processing' files are
 * never included — a failed file's text does not exist, so its absence
 * is honest, not a gap.
 */

import { db } from '../../../infrastructure/database/client.js';

export const DEFAULT_PROJECT_CONTEXT_CHARS = 12_000;

export interface ProjectContextOptions {
  /** Total characters of file text to include. Defaults to 12,000. */
  maxChars?: number;
}

export async function getProjectContextBlock(
  workspaceId: string,
  projectId: string,
  options: ProjectContextOptions = {},
): Promise<string | null> {
  const envRaw = process.env.ASSISTANT_PROJECT_CONTEXT_CHARS;
  const envChars = envRaw === undefined || envRaw.trim() === '' ? NaN : Number(envRaw);
  const maxChars =
    options.maxChars ?? (Number.isNaN(envChars) ? DEFAULT_PROJECT_CONTEXT_CHARS : envChars);

  const project = await db.assistantProject.findUnique({
    where: { id: projectId, workspaceId },
    select: { id: true, name: true, instructions: true },
  });
  if (!project) return null;

  const files = await db.assistantProjectFile.findMany({
    where: { workspaceId, projectId, status: 'ready' },
    orderBy: { createdAt: 'asc' },
    select: { fileName: true, extractedText: true },
  });

  const instructions = project.instructions?.trim() || null;
  const withText = files.filter((f) => (f.extractedText ?? '').trim().length > 0);

  if (!instructions && withText.length === 0) return null;

  const lines: string[] = [
    `[Project context: the user is chatting in project "${project.name}".`,
  ];
  if (instructions) {
    lines.push(`Project instructions: ${instructions}`);
  }
  if (withText.length > 0) {
    lines.push('Files in this project:');
    let remaining = Math.max(0, maxChars);
    for (const file of withText) {
      const text = (file.extractedText ?? '').trim();
      if (remaining <= 0) {
        lines.push(`— "${file.fileName}": [not included — context budget spent]`);
        continue;
      }
      if (text.length <= remaining) {
        lines.push(`— "${file.fileName}": ${text}`);
        remaining -= text.length;
      } else {
        lines.push(`— "${file.fileName}": ${text.slice(0, remaining)}… [trimmed to fit context budget]`);
        remaining = 0;
      }
    }
  }
  lines.push('Only use these files when the user asks about this project. Do not reveal file contents from any other project.]');
  return lines.join('\n');
}
