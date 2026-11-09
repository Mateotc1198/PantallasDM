/**
 * Fechas relativas a hoy.
 *
 * Los tests no pueden llevar fechas fijas: '2026-07-14' hoy es futuro y en
 * dos años es pasado, y la suite empezaría a fallar sola.
 */

function toISO(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Fecha futura en la que atienden TODOS los barberos.
 *
 * Evita el domingo a propósito: la mayoría trabaja ese día, pero
 * alexander-escobar descansa, y un helper que a veces cae en su día libre
 * haría fallar tests que no tienen nada que ver con los horarios.
 */
export function futureOpenDate(daysAhead = 7): string {
  const date = shiftDays(daysAhead);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return toISO(date);
}

/** Próximo domingo: el día que descansa alexander-escobar. */
export function futureSunday(): string {
  const date = shiftDays(1);
  while (date.getDay() !== 0) {
    date.setDate(date.getDate() + 1);
  }
  return toISO(date);
}

/** Una fecha que ya pasó. */
export function pastDate(): string {
  return toISO(shiftDays(-3));
}

/** 'YYYY-MM' del mes siguiente: siempre tiene todos sus días por delante. */
export function futureMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  return toISO(date).slice(0, 7);
}

/** 'YYYY-MM' de un mes que ya terminó entero. */
export function pastMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return toISO(date).slice(0, 7);
}

/** Un día del mes siguiente en el que atienden todos (nunca domingo). */
export function openDayInFutureMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  date.setDate(10);
  while (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  return toISO(date);
}
