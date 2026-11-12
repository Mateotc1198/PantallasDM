import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import type { Barber, BarberInput, BarberSummary } from '../types/api';

/**
 * Recurso /barbers.
 *
 * Las pantallas siguen llamando a estas funciones y no a fetch: la capa de
 * datos es la frontera. Cuando esto eran arreglos en memoria, las firmas eran
 * las mismas salvo por el async, y ese detalle es justamente el que obligó a
 * que las pantallas aprendieran a esperar.
 *
 * Leer es público. Crear, editar y dar de baja exige una sesión de
 * administrador: a un barbero con sesión válida el servidor le responde 403.
 */

/** GET /barbers — sin reseñas: la lista no necesita los hijos de cada ficha. */
export function getBarbers(): Promise<BarberSummary[]> {
  return apiGet<BarberSummary[]>('/api/v1/barbers');
}

/**
 * GET /barbers/:id — la ficha completa, con reseñas.
 *
 * Lanza ApiError 404 si no existe, en vez de devolver null: desde la app solo
 * se piden barberos que vinieron de la lista, así que un id desconocido no es
 * un caso normal que haya que contemplar en cada pantalla, es un fallo.
 */
export function getBarberById(id: string): Promise<Barber> {
  return apiGet<Barber>(`/api/v1/barbers/${encodeURIComponent(id)}`);
}

/**
 * POST /barbers — admin.
 *
 * El id no se manda: el servidor lo deriva del nombre. El barbero nace ya con
 * horario, así que en cuanto esto responde se le puede reservar.
 */
export function createBarber(input: BarberInput): Promise<BarberSummary> {
  return apiPost<BarberSummary>('/api/v1/barbers', input);
}

/** PUT /barbers/:id — admin. Reemplazo completo de la ficha; el id no cambia. */
export function updateBarber(id: string, input: BarberInput): Promise<BarberSummary> {
  return apiPut<BarberSummary>(`/api/v1/barbers/${encodeURIComponent(id)}`, input);
}

/**
 * DELETE /barbers/:id — admin.
 *
 * Es una baja, no un borrado: sus citas pasadas se conservan. El servidor
 * responde 409 si todavía tiene citas activas por atender.
 */
export function deleteBarber(id: string): Promise<void> {
  return apiDelete(`/api/v1/barbers/${encodeURIComponent(id)}`);
}
