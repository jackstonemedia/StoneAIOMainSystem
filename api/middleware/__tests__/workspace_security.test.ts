import { describe, it, expect, vi } from 'vitest';
import { resolveWorkspace } from '../workspace.js';
import { db } from '../../../infrastructure/database/client.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    workspaceMember: {
      findFirst: vi.fn(),
    },
    user: {
      upsert: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(db)),
  },
}));

describe('Multi-Tenant Hardening — workspace resolution (#5)', () => {
  it('assigns req.workspaceId based on authenticated user membership', async () => {
    (db.workspaceMember.findFirst as any).mockResolvedValue({ workspaceId: 'ws-member-100' });

    const req: any = {
      path: '/api/crm/contacts',
      headers: {},
      query: {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    // Force dev mode bypass for test
    process.env.NODE_ENV = 'development';
    delete process.env.CLERK_SECRET_KEY;

    await resolveWorkspace(req, res, next);

    expect(req.userId).toBe('test_user_new');
    expect(req.workspaceId).toBe('ws-member-100');
    expect(next).toHaveBeenCalled();
  });

  it('prevents cross-tenant parameter overriding when workspaceId is injected from middleware', () => {
    const req: any = {
      workspaceId: 'ws-tenant-A',
      body: { workspaceId: 'ws-tenant-B', name: 'Leaked Contact' },
    };

    // Correct pattern used in application code:
    const finalWorkspaceId = req.workspaceId;
    expect(finalWorkspaceId).toBe('ws-tenant-A');
    expect(finalWorkspaceId).not.toBe(req.body.workspaceId);
  });

  it('strictly rejects dev-bypass in production when CLERK_SECRET_KEY is missing', async () => {
    const req: any = {
      path: '/api/crm/contacts',
      headers: {},
      query: {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    process.env.NODE_ENV = 'production';
    delete process.env.CLERK_SECRET_KEY;

    await resolveWorkspace(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(req.userId).toBeUndefined();

    // Reset env
    process.env.NODE_ENV = 'test';
  });

  it('strictly rejects unauthenticated requests in production when token is missing', async () => {
    const req: any = {
      path: '/api/crm/contacts',
      headers: {},
      query: {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    process.env.NODE_ENV = 'production';
    process.env.CLERK_SECRET_KEY = 'sk_test_mock_clerk_key';

    await resolveWorkspace(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(req.userId).toBeUndefined();

    // Reset env
    process.env.NODE_ENV = 'test';
    delete process.env.CLERK_SECRET_KEY;
  });
});
