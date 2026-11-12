import { env } from '../config/env.js';

import { minutesBetween, wallClockIn, type WallClock } from './time.js';

/**
 * Acceso al reloj del sistema, aislado del resto.
 *
 * time.ts se mantiene 100% puro (misma entrada, misma salida) y por eso es
 * testeable sin trucos. Todo lo que depende de "ahora" vive aquí, que es la
 * única parte imposible de testear de forma determinista.
 *
 * "Ahora" es siempre la hora de la BARBERÍA, no la del servidor. Las fechas y
 * horas de este dominio son civiles: "el 14 a las 9:00" significa las nueve
 * en el local. El servidor de producción corre en UTC, cinco horas por delante
 * de Colombia; leyendo su reloj a pelo, a las 7 de la tarde ya era "mañana",
 * se rechazaban como pasadas las horas de la tarde, y el plazo de cambios de
 * dos horas se convertía en siete.
 */
function ahora(): WallClock {
  return wallClockIn(new Date(), env.businessTimezone);
}

/** Fecha de hoy en la barbería, 'YYYY-MM-DD'. */
export function today(): string {
  return ahora().date;
}

/** Minutos transcurridos del día actual, en la barbería. */
export function currentMinutes(): number {
  return ahora().minutes;
}

/** Minutos que faltan para una cita. Negativo si ya pasó. */
export function minutesUntilBooking(date: string, time: string): number {
  return minutesBetween(ahora(), date, time);
}
