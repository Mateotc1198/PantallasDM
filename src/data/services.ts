import { apiDelete, apiGet, apiPost, apiPut } from '../api/client';
import type { Service, ServiceInput } from '../types/api';

/**
 * Recurso /services.
 *
 * Leer es público: alimenta la pantalla de servicios que ve cualquier
 * cliente. Escribir exige una sesión de administrador, y el servidor
 * responde 403 a un barbero con sesión válida: el precio de un corte es una
 * decisión del negocio, no de quien lo ejecuta.
 */

/** GET /services — ya viene ordenado por categoría y nombre. */
export function getServices(): Promise<Service[]> {
  return apiGet<Service[]>('/api/v1/services');
}

/** POST /services — admin. */
export function createService(input: ServiceInput): Promise<Service> {
  return apiPost<Service>('/api/v1/services', input);
}

/**
 * PUT /services/:id — admin.
 *
 * Reemplazo completo, no parcial: el formulario manda todos los campos de
 * todas formas, y así no hay que distinguir "no lo envié" de "quiero
 * dejarlo vacío".
 */
export function updateService(id: string, input: ServiceInput): Promise<Service> {
  return apiPut<Service>(`/api/v1/services/${encodeURIComponent(id)}`, input);
}

/** DELETE /services/:id — admin. */
export function deleteService(id: string): Promise<void> {
  return apiDelete(`/api/v1/services/${encodeURIComponent(id)}`);
}
