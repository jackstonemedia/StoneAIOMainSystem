/**
 * Tier 2 fix 16 — project file text is extracted server-side.
 *
 * A PDF used to upload "successfully" with extractedText undefined: the
 * client only extracted text-like files and the server stored whatever the
 * client sent. Now the client uploads the bytes as base64 and the server
 * extracts (pdf-parse / mammoth / plain text). A file whose text cannot be
 * extracted is stored with status 'failed' and no extracted text, so the
 * UI reports honestly instead of claiming a success the assistant cannot
 * read. Oversize uploads are rejected (400) before anything is stored.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssistantProjectService,
  extractProjectFileText,
  PROJECT_FILE_MAX_BYTES,
} from '../services/assistant/project.service.js';

const mockProjects: Record<string, any> = {};
const mockFiles: Record<string, any> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation((cb: any) => {
      const tx = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantProject: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            const id = `proj_${Date.now()}_${Math.random()}`;
            const proj = { id, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, ...data };
            mockProjects[id] = proj;
            return Promise.resolve(proj);
          }),
        },
        assistantProjectFile: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            const id = `file_${Date.now()}_${Math.random()}`;
            const file = { id, createdAt: new Date(), ...data };
            mockFiles[id] = file;
            return Promise.resolve(file);
          }),
        },
      };
      return cb(tx);
    }),
  },
}));

const ws = 'ws-test';
const user = 'user-test';

/** Builds a minimal but VALID one-page PDF containing the given text. */
function buildPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 100 700 Td (${text}) Tj ET`;
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

describe('Tier 2 fix 16 — server-side project file extraction', () => {
  const service = new AssistantProjectService();

  beforeEach(() => {
    Object.keys(mockProjects).forEach((k) => delete mockProjects[k]);
    Object.keys(mockFiles).forEach((k) => delete mockFiles[k]);
  });

  it('extracts text from a real PDF and stores it ready', async () => {
    const project = await service.createProject(ws, user, { name: 'Docs' });
    const pdf = buildPdf('Hello Stone AIO');
    const file = await service.addProjectFile(ws, user, project.id, {
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      size: pdf.length,
      contentBase64: pdf.toString('base64'),
    });
    expect(file.status).toBe('ready');
    expect(file.extractedText).toContain('Hello Stone AIO');
  });

  it('extracts plain text and markdown server-side', async () => {
    const project = await service.createProject(ws, user, { name: 'Docs' });
    const txt = await service.addProjectFile(ws, user, project.id, {
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      size: 11,
      contentBase64: Buffer.from('hello world', 'utf-8').toString('base64'),
    });
    expect(txt.status).toBe('ready');
    expect(txt.extractedText).toBe('hello world');

    const md = await service.addProjectFile(ws, user, project.id, {
      fileName: 'readme.md',
      mimeType: 'text/markdown',
      size: 9,
      contentBase64: Buffer.from('# Title\n\nbody', 'utf-8').toString('base64'),
    });
    expect(md.status).toBe('ready');
    expect(md.extractedText).toContain('Title');
  });

  it('stores an unsupported type as failed, never as ready-with-no-text', async () => {
    const project = await service.createProject(ws, user, { name: 'Docs' });
    const file = await service.addProjectFile(ws, user, project.id, {
      fileName: 'photo.png',
      mimeType: 'image/png',
      size: 100,
      contentBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
    });
    expect(file.status).toBe('failed');
    expect(file.extractedText).toBeNull();
  });

  it('stores a corrupt PDF as failed instead of a silent empty read', async () => {
    const project = await service.createProject(ws, user, { name: 'Docs' });
    const file = await service.addProjectFile(ws, user, project.id, {
      fileName: 'broken.pdf',
      mimeType: 'application/pdf',
      size: 20,
      contentBase64: Buffer.from('this is not a pdf at all', 'utf-8').toString('base64'),
    });
    expect(file.status).toBe('failed');
    expect(file.extractedText).toBeNull();
  });

  it('stores an empty text file as failed', async () => {
    const project = await service.createProject(ws, user, { name: 'Docs' });
    const file = await service.addProjectFile(ws, user, project.id, {
      fileName: 'empty.txt',
      mimeType: 'text/plain',
      size: 3,
      contentBase64: Buffer.from('   ', 'utf-8').toString('base64'),
    });
    expect(file.status).toBe('failed');
    expect(file.extractedText).toBeNull();
  });

  it('rejects oversize buffers before anything is stored', async () => {
    const big = Buffer.alloc(PROJECT_FILE_MAX_BYTES + 1);
    await expect(extractProjectFileText('big.pdf', 'application/pdf', big)).rejects.toThrow(
      /too large/i,
    );
    const project = await service.createProject(ws, user, { name: 'Docs' });
    await expect(
      service.addProjectFile(ws, user, project.id, {
        fileName: 'big.pdf',
        mimeType: 'application/pdf',
        size: big.length,
        contentBase64: big.toString('base64'),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Object.keys(mockFiles)).toHaveLength(0);
  });
});
