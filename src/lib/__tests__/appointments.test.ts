/**
 * Calendar appointment save — Tier 2 follow-ups (Fix B).
 * A failed POST/PUT must throw so the mutation's onError fires (honest
 * error toast, nothing added). It must never return a local-only id for a
 * save the server never saw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }));

import { saveAppointment, deleteAppointment } from '../appointments';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saveAppointment', () => {
  it('create returns the server record', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { id: 'apt_1', title: 'Intro call' } });
    const saved = await saveAppointment({ title: 'Intro call' });
    expect(saved).toEqual({ id: 'apt_1', title: 'Intro call' });
    expect(mockApiClient.post).toHaveBeenCalledWith('/business/appointments', { title: 'Intro call' });
  });

  it('edit PUTs to the appointment id and returns the server record', async () => {
    mockApiClient.put.mockResolvedValueOnce({ data: { id: 'apt_1', title: 'Moved' } });
    const saved = await saveAppointment({ id: 'apt_1', title: 'Moved' });
    expect(saved).toEqual({ id: 'apt_1', title: 'Moved' });
    expect(mockApiClient.put).toHaveBeenCalledWith('/business/appointments/apt_1', { id: 'apt_1', title: 'Moved' });
  });

  it('a failed create throws — no local id, no swallowed error', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    await expect(saveAppointment({ title: 'Intro call' })).rejects.toThrow('500');
  });

  it('a failed edit throws and the original is untouched by this function', async () => {
    mockApiClient.put.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    await expect(saveAppointment({ id: 'apt_1', title: 'Moved' })).rejects.toThrow('500');
  });

  it('a successful create with no body still returns a stand-in id (server saved it)', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: null });
    const saved = await saveAppointment({ title: 'Intro call' });
    expect(saved.id).toMatch(/^apt-/);
    expect(saved.title).toBe('Intro call');
  });
});

describe('deleteAppointment (Tranche A fix 19)', () => {
  it('a successful delete returns the id', async () => {
    mockApiClient.delete.mockResolvedValueOnce({ data: { success: true } });
    await expect(deleteAppointment('apt_1')).resolves.toBe('apt_1');
    expect(mockApiClient.delete).toHaveBeenCalledWith('/business/appointments/apt_1');
  });

  it('a failed delete throws — the page must NOT remove the appointment or toast success', async () => {
    mockApiClient.delete.mockRejectedValueOnce(new Error('Request failed with status code 500'));
    await expect(deleteAppointment('apt_1')).rejects.toThrow('500');
  });
});
