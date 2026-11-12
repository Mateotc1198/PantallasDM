import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import type { Booking, BookingOutcome, CreateBookingInput } from '../types/api';

/**
 * Recurso /bookings.
 *
 * Mezcla dos niveles de acceso a propósito, porque así los expone la API:
 * crear y consultar una cita es público (el cliente no tiene cuenta), pero
 * ver la agenda o cancelar exige una sesión del panel.
 */

/**
 * Una cita tal como puede llegar de la red: sin el campo `service`.
 *
 * El tipo Booking promete que `service` siempre está (con el servicio o con
 * null). Pero eso es lo que promete ESTA versión del servidor, y la app
 * instalada en un teléfono no se actualiza a la vez que él: un servidor
 * anterior, o uno al que se haya revertido un despliegue, responde citas sin
 * ese campo.
 */
type BookingDeLaApi = Omit<Booking, 'service'> & { service?: Booking['service'] };

/**
 * Deja la cita en la forma que el resto de la app da por sentada.
 *
 * Sin esto, un `service` ausente llega como undefined, pasa la comprobación
 * `service !== null` de las pantallas y la app se cae al leer su nombre. Pasó
 * de verdad, al probar la app nueva contra el servidor todavía sin desplegar.
 *
 * Se resuelve aquí y no en cada pantalla porque esta capa es la frontera con
 * la red: lo que la cruza ya cumple el tipo, y ninguna pantalla tiene que
 * acordarse de desconfiar.
 */
function normalizar(cita: BookingDeLaApi): Booking {
  return { ...cita, service: cita.service ?? null };
}

/**
 * POST /bookings
 *
 * El 409 no es un fallo del cliente ni del servidor: es la carrera que el
 * índice único parcial de la base está ahí para ganar. Entre que el usuario
 * eligió las 10:00 y escribió su nombre, otra persona pudo reservarlas.
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  return normalizar(await apiPost<BookingDeLaApi>('/api/v1/bookings', input));
}

/** GET /bookings/:id — consulta pública, para que el cliente verifique su cita. */
export async function getBooking(id: string): Promise<Booking> {
  return normalizar(await apiGet<BookingDeLaApi>(`/api/v1/bookings/${encodeURIComponent(id)}`));
}

/**
 * POST /bookings/:id/cancel — cancelación hecha por el propio cliente.
 *
 * Sin sesión: la credencial es el código de la cita más el teléfono con el
 * que se reservó. Responde 403 si el teléfono no coincide y 422 si la cita
 * está demasiado cerca para tocarla.
 */
export function cancelBookingAsCustomer(id: string, customerPhone: string): Promise<void> {
  return apiPost<void>(`/api/v1/bookings/${encodeURIComponent(id)}/cancel`, {
    customerPhone,
  });
}

/**
 * POST /bookings/:id/reschedule — aplazamiento hecho por el propio cliente.
 *
 * Devuelve la cita con su MISMO id: aplazar mueve la que hay, no crea otra.
 * El destino pasa las mismas reglas que una reserva nueva, así que puede
 * responder 409 si alguien tomó esa franja mientras tanto.
 */
export async function rescheduleBooking(
  id: string,
  customerPhone: string,
  date: string,
  time: string,
): Promise<Booking> {
  const cita = await apiPost<BookingDeLaApi>(
    `/api/v1/bookings/${encodeURIComponent(id)}/reschedule`,
    { customerPhone, date, time },
  );
  return normalizar(cita);
}

/**
 * GET /bookings — la agenda. Requiere sesión.
 *
 * El filtro por barbero es una comodidad de la interfaz, no un control de
 * acceso: el servidor ignora el barberId que recibe de un barbero y fuerza
 * el suyo. Mandarlo o no desde aquí no cambia lo que ve.
 */
export async function getAgenda(filtros: {
  date?: string;
  barberId?: string;
}): Promise<Booking[]> {
  const citas = await apiGet<BookingDeLaApi[]>('/api/v1/bookings', {
    date: filtros.date,
    barberId: filtros.barberId,
  });
  return citas.map(normalizar);
}

/**
 * PUT /bookings/:id/status — marca cómo terminó la cita. Requiere sesión.
 *
 * Solo desde la hora de la cita: antes el servidor responde 422. Se puede
 * repetir para corregir entre atendida y no asistida.
 */
export async function setBookingStatus(id: string, status: BookingOutcome): Promise<Booking> {
  const cita = await apiPut<BookingDeLaApi>(`/api/v1/bookings/${encodeURIComponent(id)}/status`, {
    status,
  });
  return normalizar(cita);
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
