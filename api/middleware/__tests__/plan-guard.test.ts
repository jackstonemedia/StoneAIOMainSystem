// Billing Core — plan guard middleware unit tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../infrastructure/database/client.js', () => {
  return {
    db: {
      workspace: { findUnique: vi.fn() },
    },
  };
});

import { db } from '../../../infrastructure/database/client.js';
import { requirePlan, assertPlan } from '../plan-guard.js';

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('requirePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a Complete workspace into Complete features', async () => {
    (db.workspace.findUnique as any).mockResolvedValue({ plan: 'complete' });
    const req: any = { workspaceId: 'ws_1' };
    const res = mockRes();
    const next = vi.fn();
    await requirePlan('complete')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a Plus workspace from Complete features with PLAN_REQUIRED', async () => {
    (db.workspace.findUnique as any).mockResolvedValue({ plan: 'plus' });
    const req: any = { workspaceId: 'ws_1' };
    const res = mockRes();
    const next = vi.fn();
    await requirePlan('complete')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PLAN_REQUIRED', requiredPlan: 'complete' }));
  });

  it('rejects without workspace context', async () => {
    const req: any = {};
    const res = mockRes();
    const next = vi.fn();
    await requirePlan('complete')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('assertPlan throws with PLAN_REQUIRED for gated workspaces', async () => {
    (db.workspace.findUnique as any).mockResolvedValue({ plan: 'free' });
    await expect(assertPlan('ws_1', 'complete')).rejects.toThrow('PLAN_REQUIRED');
  });
});
