/**
 * Assistant Projects Service — Stone AIO
 * Spec Section 9 (Claude-style Projects)
 */

import { withTenant } from './rls.js';
import { AppError } from '../../middleware/error.js';
import { extractUploadText } from '../email-marketing/business-profile.service.js';
import type { AssistantProject, AssistantProjectFile, AssistantProjectLink } from '@prisma/client';

/** Project file uploads cap at 25 MB (the client-side limit), enforced server-side too. */
export const PROJECT_FILE_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Extracts readable text from a project file's bytes, server-side.
 * Plain-text formats decode as UTF-8; .docx/.pdf go through the shared
 * extractor (mammoth / pdf-parse). Throws on unsupported types, empty
 * output, or oversize buffers — callers store the file as 'failed' then.
 */
export async function extractProjectFileText(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  if (buffer.length > PROJECT_FILE_MAX_BYTES) {
    throw new Error(`File is too large (max ${PROJECT_FILE_MAX_BYTES / 1024 / 1024} MB).`);
  }
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.json') ||
    mimeType.startsWith('text/')
  ) {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new Error('No readable text found in this file.');
    return text;
  }
  return extractUploadText(fileName, mimeType, buffer, PROJECT_FILE_MAX_BYTES);
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  instructions?: string;
  visibility?: 'private' | 'workspace';
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  instructions?: string;
  visibility?: 'private' | 'workspace';
  archived?: boolean;
}

export class AssistantProjectService {
  /**
   * List projects accessible to the user (own private projects + workspace-shared projects).
   */
  async listProjects(
    workspaceId: string,
    userId: string,
    options: {
      filter?: 'all' | 'mine' | 'shared' | 'archived';
      search?: string;
    } = {}
  ): Promise<AssistantProject[]> {
    const filter = options.filter || 'all';
    const q = options.search?.trim().toLowerCase() || '';

    return await withTenant(workspaceId, async (tx) => {
      let whereClause: any = { workspaceId };

      if (filter === 'archived') {
        whereClause.archivedAt = { not: null };
      } else {
        whereClause.archivedAt = null;

        if (filter === 'mine') {
          whereClause.userId = userId;
        } else if (filter === 'shared') {
          whereClause.visibility = 'workspace';
        } else {
          // 'all': private to this user OR shared with the workspace
          whereClause.OR = [{ userId }, { visibility: 'workspace' }];
        }
      }

      if (q) {
        whereClause.AND = [
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
        ];
      }

      const projects = await tx.assistantProject.findMany({
        where: whereClause,
        include: {
          files: { select: { id: true, fileName: true, mimeType: true, size: true, status: true } },
          links: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      const projectIds = projects.map((p) => p.id);
      const conversationCounts = await tx.assistantConversation.groupBy({
        by: ['projectId'],
        where: {
          workspaceId,
          projectId: { in: projectIds },
        },
        _count: { id: true },
      });

      const countMap = new Map<string, number>();
      for (const item of conversationCounts) {
        if (item.projectId) {
          countMap.set(item.projectId, item._count.id);
        }
      }

      return projects.map((p) => ({
        ...p,
        chatCount: countMap.get(p.id) || 0,
      })) as any;
    });
  }

  /**
   * Get a single project with its files and linked CRM items.
   */
  async getProject(
    workspaceId: string,
    userId: string,
    projectId: string
  ): Promise<(AssistantProject & { files: AssistantProjectFile[]; links: AssistantProjectLink[]; chatCount?: number }) | null> {
    return await withTenant(workspaceId, async (tx) => {
      const project = await tx.assistantProject.findFirst({
        where: {
          id: projectId,
          workspaceId,
          OR: [{ userId }, { visibility: 'workspace' }],
        },
        include: {
          files: true,
          links: true,
        },
      });

      if (!project) return null;

      const chatCount = await tx.assistantConversation.count({
        where: { workspaceId, projectId },
      });

      return {
        ...project,
        chatCount,
      };
    });
  }

  /**
   * Create a new project.
   */
  async createProject(
    workspaceId: string,
    userId: string,
    input: CreateProjectInput
  ): Promise<AssistantProject> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantProject.create({
        data: {
          workspaceId,
          userId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          color: input.color || '#3b82f6',
          icon: input.icon || 'folder',
          instructions: input.instructions?.trim() || null,
          visibility: input.visibility || 'private',
        },
      });
    });
  }

  /**
   * Update an existing project (owner or admin only).
   */
  async updateProject(
    workspaceId: string,
    userId: string,
    userRole: string,
    projectId: string,
    input: UpdateProjectInput
  ): Promise<AssistantProject> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantProject.findFirst({
        where: { id: projectId, workspaceId },
      });

      if (!existing) {
        throw new Error('Project not found');
      }

      if (existing.userId !== userId && userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Insufficient permissions. Only the project creator or an admin can edit this project.');
      }

      return await tx.assistantProject.update({
        where: { id: projectId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions.trim() } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        },
      });
    });
  }

  /**
   * Delete a project.
   */
  async deleteProject(
    workspaceId: string,
    userId: string,
    userRole: string,
    projectId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantProject.findFirst({
        where: { id: projectId, workspaceId },
      });

      if (!existing) return false;

      if (existing.userId !== userId && userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Insufficient permissions to delete this project.');
      }

      // Spec 9.3: chats are kept and become unfiled
      await tx.assistantConversation.updateMany({
        where: { workspaceId, projectId },
        data: { projectId: null },
      });

      await tx.assistantProject.delete({ where: { id: projectId } });
      return true;
    });
  }

  /**
   * Add a file to a project.
   *
   * Text is extracted SERVER-side from `contentBase64` (the route strips any
   * client-supplied `extractedText` — the client never extracts anymore).
   * A file whose text cannot be extracted is still stored, but with
   * status 'failed' and no extracted text, so the UI can report honestly
   * instead of claiming a successful upload the assistant cannot read.
   * Oversize uploads are rejected (400) before anything is stored.
   * When no content is supplied (service-level callers only), a
   * caller-supplied `extractedText` is kept for backward compatibility.
   */
  async addProjectFile(
    workspaceId: string,
    _userId: string,
    projectId: string,
    data: {
      fileName: string;
      mimeType: string;
      size: number;
      storageUrl?: string;
      extractedText?: string;
      contentBase64?: string;
    }
  ): Promise<AssistantProjectFile> {
    let extractedText: string | null = null;
    let status = 'ready';
    if (data.contentBase64) {
      const buffer = Buffer.from(data.contentBase64, 'base64');
      if (buffer.length > PROJECT_FILE_MAX_BYTES) {
        throw new AppError(400, `File is too large (max ${PROJECT_FILE_MAX_BYTES / 1024 / 1024} MB).`);
      }
      try {
        extractedText = await extractProjectFileText(data.fileName, data.mimeType, buffer);
      } catch {
        // Honest failure: keep the file row so the user can see/delete it,
        // but mark it failed — the assistant cannot read it.
        status = 'failed';
        extractedText = null;
      }
    } else if (data.extractedText) {
      extractedText = data.extractedText;
    } else {
      // No content and no text: nothing readable was supplied.
      status = 'failed';
    }
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantProjectFile.create({
        data: {
          workspaceId,
          projectId,
          fileName: data.fileName,
          mimeType: data.mimeType,
          size: data.size,
          storageUrl: data.storageUrl || null,
          extractedText,
          status,
        },
      });
    });
  }

  /**
   * Remove a file from a project.
   */
  async deleteProjectFile(
    workspaceId: string,
    _userId: string,
    projectId: string,
    fileId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantProjectFile.findFirst({
        where: { id: fileId, projectId, workspaceId },
      });
      if (!existing) return false;

      await tx.assistantProjectFile.delete({ where: { id: fileId } });
      return true;
    });
  }

  /**
   * Link a CRM record (contact, deal, campaign, etc.) to a project.
   */
  async addProjectLink(
    workspaceId: string,
    _userId: string,
    projectId: string,
    data: { entityType: string; entityId: string; label?: string }
  ): Promise<AssistantProjectLink> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantProjectLink.create({
        data: {
          workspaceId,
          projectId,
          entityType: data.entityType,
          entityId: data.entityId,
          label: data.label || null,
        },
      });
    });
  }

  /**
   * Remove a CRM record link from a project.
   */
  async deleteProjectLink(
    workspaceId: string,
    _userId: string,
    projectId: string,
    linkId: string
  ): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantProjectLink.findFirst({
        where: { id: linkId, projectId, workspaceId },
      });
      if (!existing) return false;

      await tx.assistantProjectLink.delete({ where: { id: linkId } });
      return true;
    });
  }
}

export const projectService = new AssistantProjectService();
