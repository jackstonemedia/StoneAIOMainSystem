import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  scopedFindOrThrow,
  findScopedStageOrThrow,
  requireRole,
} from '../tenant-guard.js';
import { AppError, errorHandler } from '../error.js';

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockStageFindFirst = vi.fn();

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    workspaceMember: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
    },
    workspace: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
    pipelineStage: {
      findFirst: (...args: any[]) => mockStageFindFirst(...args),
    },
  },
}));

describe('Tenant Guard & Scoped Queries (C3 & C8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scopedFindOrThrow', () => {
    it('returns record when it exists in the workspace', async () => {
      const mockModel = {
        findFirst: vi.fn().mockResolvedValue({ id: 'deal-1', workspaceId: 'ws-1', name: 'Deal One' }),
      };

      const result = await scopedFindOrThrow(mockModel, 'deal-1', 'ws-1');
      expect(result).toEqual({ id: 'deal-1', workspaceId: 'ws-1', name: 'Deal One' });
      expect(mockModel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'deal-1', workspaceId: 'ws-1' },
        })
      );
    });

    it('throws 404 AppError when record does not exist or belongs to another workspace', async () => {
      const mockModel = {
        findFirst: vi.fn().mockResolvedValue(null),
      };

      await expect(
        scopedFindOrThrow(mockModel, 'deal-foreign', 'ws-1')
      ).rejects.toThrowError(AppError);

      try {
        await scopedFindOrThrow(mockModel, 'deal-foreign', 'ws-1');
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe('Resource not found');
      }
    });
  });

  describe('findScopedStageOrThrow', () => {
    it('returns stage when pipeline belongs to caller workspace', async () => {
      mockStageFindFirst.mockResolvedValue({
        id: 'stage-1',
        name: 'Discovery',
        pipelineId: 'pipe-1',
      });

      const result = await findScopedStageOrThrow('stage-1', 'ws-1');
      expect(result.id).toBe('stage-1');
      expect(mockStageFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'stage-1',
            pipeline: { workspaceId: 'ws-1' },
          },
        })
      );
    });

    it('throws 404 when stage belongs to another tenant pipeline', async () => {
      mockStageFindFirst.mockResolvedValue(null);

      await expect(
        findScopedStageOrThrow('stage-foreign', 'ws-1')
      ).rejects.toThrowError(AppError);
    });
  });

  describe('requireRole middleware', () => {
    function createRoleTestApp(allowedRoles: string[], reqUser: { workspaceId?: string; userId?: string }) {
      const app = express();
      app.use((req, res, next) => {
        (req as any).workspaceId = reqUser.workspaceId;
        (req as any).userId = reqUser.userId;
        next();
      });
      app.post('/admin-only', requireRole(...allowedRoles), (req, res) => {
        res.json({ ok: true, role: (req as any).userRole });
      });
      app.use(errorHandler);
      return app;
    }

    it('returns 401 if workspace context or userId is missing', async () => {
      const app = createRoleTestApp(['admin'], {});
      const res = await request(app).post('/admin-only');
      expect(res.status).toBe(401);
    });

    it('returns 403 if user has insufficient role (member vs admin)', async () => {
      mockFindFirst.mockResolvedValue({ role: 'member' });
      const app = createRoleTestApp(['admin'], { workspaceId: 'ws-1', userId: 'user-member' });

      const res = await request(app).post('/admin-only');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden — insufficient permissions');
    });

    it('allows access if user has exact required role (admin)', async () => {
      mockFindFirst.mockResolvedValue({ role: 'admin' });
      const app = createRoleTestApp(['admin'], { workspaceId: 'ws-1', userId: 'user-admin' });

      const res = await request(app).post('/admin-only');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.role).toBe('admin');
    });

    it('allows access for workspace owner even when endpoint specifies admin', async () => {
      mockFindFirst.mockResolvedValue({ role: 'owner' });
      const app = createRoleTestApp(['admin'], { workspaceId: 'ws-1', userId: 'user-owner' });

      const res = await request(app).post('/admin-only');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.role).toBe('owner');
    });
  });
});
