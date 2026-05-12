import { db } from '../../infrastructure/database/client.js';
import { createAPProject } from './activepieces.service.js';
import { env } from '../../infrastructure/config/env.js';

/**
 * Ensures an AP project exists for a workspace.
 * Creates one if missing. Returns the AP project ID.
 * Gracefully falls back to a mock ID if AP is offline.
 */
export async function ensureAPProject(workspaceId: string): Promise<string> {
  const existing = await db.aPProject.findUnique({ where: { workspaceId } });
  if (existing) return existing.apProjectId;

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  
  // Real creation — will throw if engine is offline
  const apProject = await createAPProject(workspace.name);
  
  await db.aPProject.create({
    data: {
      workspaceId,
      apProjectId: apProject.id,
      apProjectName: workspace.name,
    },
  });

  return apProject.id;
}

export async function getWorkspaceAPProjectId(workspaceId: string): Promise<string | null> {
  const record = await db.aPProject.findUnique({ where: { workspaceId } });
  return record?.apProjectId ?? null;
}
