import { apiGet } from '../api/client';
import type { MonthAvailability, Slot } from '../types/api';

/**
 * Recurso de disponibilidad.
 *
 * Hay dos preguntas distintas y por eso hay dos funciones:
 *
 *   getSlots            ¿qué horas tiene libres este día?
 *   getMonthAvailability ¿qué días de este mes tienen alguna hora libre?
 *
 * La segunda existe porque un calendario pinta más de treinta días a la vez.
 * Resolverla preguntando día por día serían más de treinta peticiones para
 * dibujar una sola pantalla.
 */

/** GET /barbers/:id/slots?date=YYYY-MM-DD */
export function getSlots(barberId: string, date: string): Promise<Slot[]> {
  return apiGet<Slot[]>(`/api/v1/barbers/${encodeURIComponent(barberId)}/slots`, { date });
}

/** GET /barbers/:id/availability?month=YYYY-MM */
export function getMonthAvailability(
  barberId: string,
  month: string,
): Promise<MonthAvailability> {
  return apiGet<MonthAvailability>(
    `/api/v1/barbers/${encodeURIComponent(barberId)}/availability`,
    { month },
  );
}
