/**
 * Projects Service & Tenancy Tests — Stone AI Assistant
 * Spec Section 9 & 14 (Phase 6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssistantProjectService } from '../services/assistant/project.service.js';

const mockProjects: Record<string, any> = {};
const mockFiles: Record<string, any> = {};
const mockLinks: Record<string, any> = {};
const mockConversations: Record<string, any> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation((cb) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantProject: {
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `proj_${Date.now()}_${Math.random()}`;
            const proj = { id, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, ...data };
            mockProjects[id] = proj;
            return Promise.resolve(proj);
          }),
          findMany: vi.fn().mockImplementation(({ where }) => {
            let list = Object.values(mockProjects).filter((p) => {
              if (where.workspaceId && p.workspaceId !== where.workspaceId) return false;
              if (where.archivedAt?.not === null && p.archivedAt === null) return false;
              if (where.archivedAt === null && p.archivedAt !== null) return false;
              if (where.userId && p.userId !== where.userId) return false;
              if (where.visibility && p.visibility !== where.visibility) return false;
              if (where.OR) {
                const orMatch = where.OR.some((clause: any) => {
                  if (clause.userId && p.userId === clause.userId) return true;
                  if (clause.visibility && p.visibility === clause.visibility) return true;
                  return false;
                });
                if (!orMatch) return false;
              }
              return true;
            });

            return Promise.resolve(
              list.map((p) => ({
                ...p,
                files: Object.values(mockFiles).filter((f) => f.projectId === p.id),
                links: Object.values(mockLinks).filter((l) => l.projectId === p.id),
              }))
            );
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const p = Object.values(mockProjects).find((item) => {
              if (where.id && item.id !== where.id) return false;
              if (where.workspaceId && item.workspaceId !== where.workspaceId) return false;
              if (where.OR) {
                const orMatch = where.OR.some((clause: any) => {
                  if (clause.userId && item.userId === clause.userId) return true;
                  if (clause.visibility && item.visibility === clause.visibility) return true;
                  return false;
                });
                if (!orMatch) return false;
              }
              return true;
            });
            if (!p) return Promise.resolve(null);
            return Promise.resolve({
              ...p,
              files: Object.values(mockFiles).filter((f) => f.projectId === p.id),
              links: Object.values(mockLinks).filter((l) => l.projectId === p.id),
            });
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const p = mockProjects[where.id];
            if (!p) throw new Error('Not found');
            Object.assign(p, data, { updatedAt: new Date() });
            return Promise.resolve(p);
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockProjects[where.id];
            // Cascade delete files and links
            Object.keys(mockFiles).forEach((fid) => {
              if (mockFiles[fid].projectId === where.id) delete mockFiles[fid];
            });
            Object.keys(mockLinks).forEach((lid) => {
              if (mockLinks[lid].projectId === where.id) delete mockLinks[lid];
            });
            return Promise.resolve({ id: where.id });
          }),
        },
        assistantProjectFile: {
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `file_${Date.now()}_${Math.random()}`;
            const file = { id, createdAt: new Date(), ...data };
            mockFiles[id] = file;
            return Promise.resolve(file);
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const f = Object.values(mockFiles).find(
              (item) => item.id === where.id && item.projectId === where.projectId
            );
            return Promise.resolve(f || null);
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockFiles[where.id];
            return Promise.resolve({ id: where.id });
          }),
        },
        assistantProjectLink: {
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `link_${Date.now()}_${Math.random()}`;
            const link = { id, createdAt: new Date(), ...data };
            mockLinks[id] = link;
            return Promise.resolve(link);
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const l = Object.values(mockLinks).find(
              (item) => item.id === where.id && item.projectId === where.projectId
            );
            return Promise.resolve(l || null);
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockLinks[where.id];
            return Promise.resolve({ id: where.id });
          }),
        },
        assistantConversation: {
          count: vi.fn().mockImplementation(({ where }) => {
            const matching = Object.values(mockConversations).filter(
              (c) => c.workspaceId === where.workspaceId && c.projectId === where.projectId
            );
            return Promise.resolve(matching.length);
          }),
          groupBy: vi.fn().mockImplementation(({ where }) => {
            const counts: Record<string, number> = {};
            Object.values(mockConversations).forEach((c) => {
              if (c.workspaceId === where.workspaceId && where.projectId?.in?.includes(c.projectId)) {
                counts[c.projectId] = (counts[c.projectId] || 0) + 1;
              }
            });
            return Promise.resolve(
              Object.entries(counts).map(([projectId, count]) => ({
                projectId,
                _count: { id: count },
              }))
            );
          }),
          updateMany: vi.fn().mockImplementation(({ where, data }) => {
            let count = 0;
            Object.values(mockConversations).forEach((c) => {
              if (c.workspaceId === where.workspaceId && c.projectId === where.projectId) {
                Object.assign(c, data);
                count++;
              }
            });
            return Promise.resolve({ count });
          }),
        },
      };
      return cb(tx);
    }),
  },
}));

describe('AssistantProjectService', () => {
  const service = new AssistantProjectService();
  const ws1 = 'ws_alpha';
  const ws2 = 'ws_beta';
  const userA = 'user_alice';
  const userB = 'user_bob';

  beforeEach(() => {
    Object.keys(mockProjects).forEach((k) => delete mockProjects[k]);
    Object.keys(mockFiles).forEach((k) => delete mockFiles[k]);
    Object.keys(mockLinks).forEach((k) => delete mockLinks[k]);
    Object.keys(mockConversations).forEach((k) => delete mockConversations[k]);
  });

  it('creates project with private visibility by default', async () => {
    const project = await service.createProject(ws1, userA, {
      name: 'Q4 Strategy',
      description: 'Strategic planning',
      instructions: 'Always use concise bullet points',
    });

    expect(project).toBeDefined();
    expect(project.name).toBe('Q4 Strategy');
    expect(project.visibility).toBe('private');
    expect(project.workspaceId).toBe(ws1);
    expect(project.userId).toBe(userA);
  });

  it('lists only private projects of the caller plus shared projects within workspace', async () => {
    // Alice's private project in ws1
    const pAlice = await service.createProject(ws1, userA, {
      name: "Alice Private",
      visibility: 'private',
    });

    // Bob's private project in ws1
    const pBob = await service.createProject(ws1, userB, {
      name: "Bob Private",
      visibility: 'private',
    });

    // Bob's shared project in ws1
    const pShared = await service.createProject(ws1, userB, {
      name: "Workspace Shared",
      visibility: 'workspace',
    });

    // Cross-tenant project in ws2
    await service.createProject(ws2, userA, {
      name: "Alice in WS2",
      visibility: 'workspace',
    });

    // Alice lists projects in ws1
    const aliceList = await service.listProjects(ws1, userA, { filter: 'all' });
    const aliceIds = aliceList.map((p) => p.id);

    expect(aliceIds).toContain(pAlice.id);
    expect(aliceIds).toContain(pShared.id);
    expect(aliceIds).not.toContain(pBob.id); // Bob's private project is hidden from Alice
    expect(aliceList.every((p) => p.workspaceId === ws1)).toBe(true); // No cross-tenant leak
  });

  it('enforces role authorization on update', async () => {
    const project = await service.createProject(ws1, userA, {
      name: 'Alpha Plan',
      visibility: 'workspace',
    });

    // Bob (regular member) cannot edit Alice's project
    await expect(
      service.updateProject(ws1, userB, 'member', project.id, {
        name: 'Hacked Alpha Plan',
      })
    ).rejects.toThrow('Insufficient permissions');

    // Bob (admin) CAN edit Alice's project
    const adminUpdated = await service.updateProject(ws1, userB, 'admin', project.id, {
      name: 'Admin Updated Plan',
    });
    expect(adminUpdated.name).toBe('Admin Updated Plan');

    // Alice (creator) CAN edit her own project
    const ownerUpdated = await service.updateProject(ws1, userA, 'member', project.id, {
      instructions: 'New instructions for project',
    });
    expect(ownerUpdated.instructions).toBe('New instructions for project');
  });

  it('attaches and removes files within project limits', async () => {
    const project = await service.createProject(ws1, userA, {
      name: 'Doc Analysis',
    });

    const file = await service.addProjectFile(ws1, userA, project.id, {
      fileName: 'whitepaper.pdf',
      mimeType: 'application/pdf',
      size: 1024 * 50,
      extractedText: 'Full extracted text of whitepaper',
    });

    expect(file).toBeDefined();
    expect(file.fileName).toBe('whitepaper.pdf');
    expect(file.status).toBe('ready');

    const fetched = await service.getProject(ws1, userA, project.id);
    expect(fetched?.files.length).toBe(1);
    expect(fetched?.files[0].fileName).toBe('whitepaper.pdf');

    await service.deleteProjectFile(ws1, userA, project.id, file.id);
    const fetchedAfter = await service.getProject(ws1, userA, project.id);
    expect(fetchedAfter?.files.length).toBe(0);
  });

  it('links and unlinks live CRM entities', async () => {
    const project = await service.createProject(ws1, userA, {
      name: 'Account Review',
    });

    const link = await service.addProjectLink(ws1, userA, project.id, {
      entityType: 'contact',
      entityId: 'contact_123',
      label: 'Jane Doe',
    });

    expect(link).toBeDefined();
    expect(link.entityType).toBe('contact');
    expect(link.label).toBe('Jane Doe');

    const fetched = await service.getProject(ws1, userA, project.id);
    expect(fetched?.links.length).toBe(1);
    expect(fetched?.links[0].label).toBe('Jane Doe');

    await service.deleteProjectLink(ws1, userA, project.id, link.id);
    const fetchedAfter = await service.getProject(ws1, userA, project.id);
    expect(fetchedAfter?.links.length).toBe(0);
  });

  it('unfiles associated chats and removes files on project deletion', async () => {
    const project = await service.createProject(ws1, userA, {
      name: 'Temporary Project',
    });

    // Add a file
    await service.addProjectFile(ws1, userA, project.id, {
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      size: 500,
    });

    // Create a chat filed under this project
    const chatId = 'chat_123';
    mockConversations[chatId] = {
      id: chatId,
      workspaceId: ws1,
      projectId: project.id,
      title: 'Project Discussion',
    };

    // Delete the project
    const deleted = await service.deleteProject(ws1, userA, 'owner', project.id);
    expect(deleted).toBe(true);

    // Verify project is removed
    expect(mockProjects[project.id]).toBeUndefined();

    // Verify files were cleaned up
    expect(Object.values(mockFiles).some((f) => f.projectId === project.id)).toBe(false);

    // Verify conversation was unfiled (projectId became null, chat preserved)
    expect(mockConversations[chatId]).toBeDefined();
    expect(mockConversations[chatId].projectId).toBeNull();
  });
});
