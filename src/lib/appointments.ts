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

/**
 * Delete an appointment — throws on failure (Tranche A fix 19).
 *
 * The calendar page's delete mutation used to catch the DELETE error inside
 * mutationFn ("ignore delete failure in optimistic cleanup") and return the
 * id anyway, so onSuccess always ran: the appointment vanished from the
 * local lists and "Appointment deleted" toasted for a delete the server
 * never performed. A failed delete must reach the mutation's onError
 * (honest error toast, appointment stays listed), never masquerade as a
 * success. Same rule as saveAppointment above.
 */
export async function deleteAppointment(id: string): Promise<string> {
  await apiClient.delete(`/business/appointments/${id}`);
  return id;
}
