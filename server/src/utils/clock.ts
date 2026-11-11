import { minutesUntil, toISODate } from './time.js';

/**
 * Acceso al reloj del sistema, aislado del resto.
 *
 * time.ts se mantiene 100% puro (misma entrada, misma salida) y por eso es
 * testeable sin trucos. Todo lo que depende de "ahora" vive aquí, que es la
 * única parte imposible de testear de forma determinista.
 */

/** Fecha de hoy como 'YYYY-MM-DD' en hora local. */
export function today(): string {
  return toISODate(new Date());
}

/** Minutos transcurridos del día actual. */
export function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Minutos que faltan para una cita, según el reloj del sistema. */
export function minutesUntilBooking(date: string, time: string): number {
  return minutesUntil(date, time, new Date());
}
