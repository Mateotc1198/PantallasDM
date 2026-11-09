import { apiGet, apiPost } from '../api/client';
import type { Booking, CreateBookingInput } from '../types/api';

/**
 * Recurso /bookings.
 *
 * Es la única escritura de toda la aplicación, y por eso la única llamada
 * cuyo fallo no se puede resolver con un botón de "reintentar" a secas: si
 * create devuelve 409, el horario elegido dejó de existir y hay que mandar
 * al usuario a elegir otro. Quien la llame tiene que mirar ese caso.
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
