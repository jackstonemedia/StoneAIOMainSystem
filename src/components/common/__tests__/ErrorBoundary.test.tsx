import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { extractApiError, apiFetch } from '../../../lib/apiClient';
import { captureClientError } from '../../../lib/sentry.ts';

vi.mock('../../../lib/sentry.ts', () => ({
  captureClientError: vi.fn(() => 'mock-event-id'),
}));

const ProblemChild = () => {
  throw new Error('Test render crash');
};

describe('ErrorBoundary & API Error Standardization (#8)', () => {
  it('catches render errors and presents the fallback UI with reset button', () => {
    // Suppress console.error output during intentional error boundary throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('reports render errors to Sentry via captureClientError (B-2)', () => {
    // Suppress console.error output during intentional error boundary throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(captureClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test render crash' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );

    consoleSpy.mockRestore();
  });

  it('extractApiError normalizes Error objects and error text', () => {
    expect(extractApiError(new Error('Custom API Error'))).toBe('Custom API Error');
    expect(extractApiError({ error: 'Server payload error' })).toBe('Server payload error');
    expect(extractApiError({ message: 'Fallback message' })).toBe('Fallback message');
    expect(extractApiError(null)).toBe('An unexpected error occurred');
  });

  it('apiFetch throws normalized Error on non-2xx HTTP responses', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      clone: () => ({
        json: async () => ({ error: 'Invalid input payload' }),
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse as any);

    await expect(apiFetch('/api/test-route')).rejects.toThrow('Invalid input payload');
  });
});
