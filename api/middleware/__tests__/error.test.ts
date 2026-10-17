/**
 * Central error handler tests — Sentry funnel behavior (B-2).
 *
 * True 500s reach Sentry; expected AppError 4xx do NOT (no alert noise).
 * Sentry is mocked — no SDK, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler, AppError } from '../error.js';
import { captureServerError } from '../../utils/sentry.js';

vi.mock('../../utils/sentry.js', () => ({
  captureServerError: vi.fn(() => 'mock-event-id'),
}));

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('errorHandler + Sentry funnel (B-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('plain Error → 500 + captureServerError called with method/path context', () => {
    const err = new Error('kaboom');
    const req = { method: 'GET', path: '/api/crm/contacts' } as never;
    const res = mockRes();
    errorHandler(err, req, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error' }),
    );
    expect(captureServerError).toHaveBeenCalledTimes(1);
    expect(captureServerError).toHaveBeenCalledWith(
      err,
      { method: 'GET', path: '/api/crm/contacts' },
    );
  });

  it('AppError(400) → 400 + captureServerError NOT called', () => {
    const err = new AppError(400, 'Bad input', 'VALIDATION');
    const req = { method: 'POST', path: '/api/crm/contacts' } as never;
    const res = mockRes();
    errorHandler(err, req, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bad input', code: 'VALIDATION' });
    expect(captureServerError).not.toHaveBeenCalled();
  });

  it('AppError(404) → 404 + captureServerError NOT called', () => {
    const err = new AppError(404, 'Not found');
    const req = { method: 'GET', path: '/api/nope' } as never;
    const res = mockRes();
    errorHandler(err, req, res as never, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(captureServerError).not.toHaveBeenCalled();
  });
});
