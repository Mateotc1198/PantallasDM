import { apiGet } from '../api/client';
import type { Barber, BarberSummary } from '../types/api';

/**
 * Recurso /barbers.
 *
 * Las pantallas siguen llamando a estas funciones y no a fetch: la capa de
 * datos es la frontera. Cuando esto eran arreglos en memoria, las firmas eran
 * las mismas salvo por el async, y ese detalle es justamente el que obligó a
 * que las pantallas aprendieran a esperar.
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
