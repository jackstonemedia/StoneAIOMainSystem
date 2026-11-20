/**
 * Complete-platform item 8 — project-context injection.
 *
 * getProjectContextBlock builds the system-prompt block from a project's
 * instructions + ready file text, for that project only. These tests pin
 * the isolation (never another project's data), the readiness filter,
 * and the character budget.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjectContextBlock } from '../services/assistant/project-context.service.js';

const mockProjects: Record<string, any> = {};
const mockFiles: Record<string, any[]> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    assistantProject: {
      findUnique: vi.fn(async ({ where }: any) => {
        const p = mockProjects[where.id];
        return p && p.workspaceId === where.workspaceId ? p : null;
      }),
    },
    assistantProjectFile: {
      findMany: vi.fn(async ({ where }: any) => {
        const rows = (mockFiles[where.projectId] ?? []).filter(
          (f) => f.workspaceId === where.workspaceId && (!where.status || f.status === where.status),
        );
        return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }),
    },
  },
}));

function setProject(id: string, workspaceId: string, extra: Record<string, any> = {}) {
  mockProjects[id] = { id, workspaceId, name: extra.name ?? 'Project', instructions: extra.instructions ?? null };
}

function setFiles(projectId: string, workspaceId: string, files: Array<Record<string, any>>) {
  mockFiles[projectId] = files.map((f, i) => ({
    workspaceId,
    fileName: f.fileName ?? `file-${i}.txt`,
    extractedText: f.extractedText ?? null,
    status: f.status ?? 'ready',
    createdAt: new Date(Date.now() + i * 1000),
  }));
}

beforeEach(() => {
  for (const k of Object.keys(mockProjects)) delete mockProjects[k];
  for (const k of Object.keys(mockFiles)) delete mockFiles[k];
});

describe('getProjectContextBlock', () => {
  it('returns null when the project does not exist', async () => {
    expect(await getProjectContextBlock('ws', 'nope')).toBeNull();
  });

  it('returns null when the project belongs to another workspace — never cross-project data', async () => {
    setProject('proj-a', 'ws-other', { instructions: 'Secret instructions' });
    setFiles('proj-a', 'ws-other', [{ extractedText: 'Secret file text' }]);
    expect(await getProjectContextBlock('ws', 'proj-a')).toBeNull();
  });

  it('returns null when the project has neither instructions nor ready file text', async () => {
    setProject('proj-a', 'ws');
    setFiles('proj-a', 'ws', [{ status: 'failed', extractedText: null }]);
    expect(await getProjectContextBlock('ws', 'proj-a')).toBeNull();
  });

  it('includes instructions with no files section when there are no files', async () => {
    setProject('proj-a', 'ws', { name: 'Pricing', instructions: 'You are the pricing analyst.' });
    const block = await getProjectContextBlock('ws', 'proj-a');
    expect(block).toContain('Pricing');
    expect(block).toContain('You are the pricing analyst.');
    expect(block).not.toContain('Files in this project');
  });

  it('includes ready file text and skips failed / processing / empty files', async () => {
    setProject('proj-a', 'ws', { name: 'Handbook' });
    setFiles('proj-a', 'ws', [
      { fileName: 'policy.txt', extractedText: 'Refunds within 30 days.' },
      { fileName: 'broken.pdf', status: 'failed', extractedText: null },
      { fileName: 'uploading.txt', status: 'processing', extractedText: 'not yet' },
      { fileName: 'empty.txt', extractedText: '   ' },
    ]);
    const block = await getProjectContextBlock('ws', 'proj-a');
    expect(block).toContain('policy.txt');
    expect(block).toContain('Refunds within 30 days.');
    expect(block).not.toContain('broken.pdf');
    expect(block).not.toContain('uploading.txt');
    expect(block).not.toContain('empty.txt');
  });

  it('trims a long file at the budget with a marker and lists later files as not included', async () => {
    setProject('proj-a', 'ws', { name: 'Docs' });
    setFiles('proj-a', 'ws', [
      { fileName: 'long.txt', extractedText: 'A'.repeat(100) },
      { fileName: 'second.txt', extractedText: 'B'.repeat(100) },
    ]);
    const block = await getProjectContextBlock('ws', 'proj-a', { maxChars: 50 });
    expect(block).toContain('A'.repeat(50));
    expect(block).toContain('[trimmed to fit context budget]');
    expect(block).not.toContain('A'.repeat(51));
    expect(block).toContain('second.txt');
    expect(block).toContain('[not included — context budget spent]');
  });

  it('includes files oldest-first within the budget', async () => {
    setProject('proj-a', 'ws', { name: 'Docs' });
    setFiles('proj-a', 'ws', [
      { fileName: 'first.txt', extractedText: 'FIRST' },
      { fileName: 'second.txt', extractedText: 'SECOND' },
    ]);
    const block = await getProjectContextBlock('ws', 'proj-a', { maxChars: 100 });
    expect(block!.indexOf('first.txt')).toBeLessThan(block!.indexOf('second.txt'));
    expect(block).toContain('FIRST');
    expect(block).toContain('SECOND');
  });

  it('names the project and warns against revealing other projects', async () => {
    setProject('proj-a', 'ws', { name: 'Acme Handbook', instructions: 'Be concise.' });
    setFiles('proj-a', 'ws', [{ fileName: 'a.txt', extractedText: 'hello' }]);
    const block = await getProjectContextBlock('ws', 'proj-a');
    expect(block).toContain('Acme Handbook');
    expect(block).toContain('Do not reveal file contents from any other project');
  });
});
