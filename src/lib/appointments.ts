/**
 * Calendar appointment save — the single place the calendar page writes an
 * appointment to the server.
 *
 * This deliberately throws on a failed POST/PUT. An earlier version caught
 * the failure inside the mutation and returned a local-only id
 * (`apt-local-*`), so the page toasted "Appointment scheduled" and showed a
 * phantom appointment for a save the server never saw. A failed save must
 * reach the mutation's onError (honest error toast, nothing added locally),
 * never masquerade as a success.
 *
 * The create fallback (`apt-${Date.now()}`) only runs when the POST
 * succeeded (2xx) but returned no body: the appointment IS saved
 * server-side, and the list refetches right after, so the stand-in id is
 * replaced by the real record on the next render.
 */
import { apiClient } from './apiClient';
import type { Appointment } from '../types/business';

export async function saveAppointment(payload: any): Promise<Appointment> {
  const isEdit = Boolean(payload.id);
  if (isEdit) {
    const { data } = await apiClient.put(`/business/appointments/${payload.id}`, payload);
    return data || payload;
  }
  const { data } = await apiClient.post('/business/appointments', payload);
  return data || { ...payload, id: `apt-${Date.now()}` };
}
