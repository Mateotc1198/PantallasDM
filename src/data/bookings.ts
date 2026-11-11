import { apiDelete, apiGet, apiPost } from '../api/client';
import type { Booking, CreateBookingInput } from '../types/api';

/**
 * Recurso /bookings.
 *
 * Mezcla dos niveles de acceso a propósito, porque así los expone la API:
 * crear y consultar una cita es público (el cliente no tiene cuenta), pero
 * ver la agenda o cancelar exige una sesión del panel.
 */

/**
 * POST /bookings
 *
 * El 409 no es un fallo del cliente ni del servidor: es la carrera que el
 * índice único parcial de la base está ahí para ganar. Entre que el usuario
 * eligió las 10:00 y escribió su nombre, otra persona pudo reservarlas.
 */
export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return apiPost<Booking>('/api/v1/bookings', input);
}

/** GET /bookings/:id — consulta pública, para que el cliente verifique su cita. */
export function getBooking(id: string): Promise<Booking> {
  return apiGet<Booking>(`/api/v1/bookings/${encodeURIComponent(id)}`);
}

/**
 * GET /bookings — la agenda. Requiere sesión.
 *
 * El filtro por barbero es una comodidad de la interfaz, no un control de
 * acceso: el servidor ignora el barberId que recibe de un barbero y fuerza
 * el suyo. Mandarlo o no desde aquí no cambia lo que ve.
 */
export function getAgenda(filtros: { date?: string; barberId?: string }): Promise<Booking[]> {
  return apiGet<Booking[]>('/api/v1/bookings', {
    date: filtros.date,
    barberId: filtros.barberId,
  });
}

/**
 * DELETE /bookings/:id — cancelar. Requiere sesión.
 *
 * Responde 204 sin cuerpo. Un barbero que intente cancelar una cita ajena
 * recibe 403 y no 404: la cita existe, lo que falta es permiso.
 */
export function cancelBooking(id: string): Promise<void> {
  return apiDelete(`/api/v1/bookings/${encodeURIComponent(id)}`);
}
