/**
 * Utilidades de fecha y hora, puras y sin dependencias.
 *
 * Todas trabajan con fechas CIVILES ('2026-07-14', '09:30'), no con instantes
 * universales. Nunca se usa toISOString(): convierte a UTC y corre el día.
 *
 * Al ser puras, son lo que cubren los tests unitarios sin necesitar base de datos.
 */

const MINUTES_PER_HOUR = 60;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 'HH:mm' o 'HH:mm:ss' -> minutos desde medianoche. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':');
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/** Minutos desde medianoche -> 'HH:mm'. */
export function toTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  return `${pad(hours)}:${pad(totalMinutes % MINUTES_PER_HOUR)}`;
}

/** Postgres devuelve TIME como 'HH:mm:ss'. La API expone 'HH:mm'. */
export function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

/** true si el string tiene forma 'YYYY-MM-DD' Y es una fecha que existe. */
export function isValidISODate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // Descarta '2026-02-31': JavaScript lo desborda al 3 de marzo.
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/** true si el string tiene forma 'HH:mm' válida en 24h. */
export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** Date local -> 'YYYY-MM-DD'. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date local a medianoche. */
export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Día de la semana de una fecha civil. 0 = domingo, 6 = sábado. */
export function weekdayOf(iso: string): number {
  return fromISODate(iso).getDay();
}

/**
 * Genera las franjas reservables de un día.
 *
 * `lastSlotAt` es inclusivo: es la hora de la última cita que se puede tomar,
 * no la hora de cierre del local.
 */
export function generateSlotTimes(
  firstSlotAt: string,
  lastSlotAt: string,
  slotMinutes: number,
): string[] {
  if (slotMinutes <= 0) {
    throw new RangeError('slotMinutes debe ser mayor que cero.');
  }

  const start = toMinutes(firstSlotAt);
  const end = toMinutes(lastSlotAt);
  const times: string[] = [];

  for (let minutes = start; minutes <= end; minutes += slotMinutes) {
    times.push(toTimeString(minutes));
  }
  return times;
}

/**
 * true si `time` cae exactamente en una de las franjas del horario.
 * Rechaza las 9:17 aunque esté dentro del rango de atención.
 */
export function isSlotBoundary(
  time: string,
  firstSlotAt: string,
  lastSlotAt: string,
  slotMinutes: number,
): boolean {
  const target = toMinutes(time);
  const start = toMinutes(firstSlotAt);
  const end = toMinutes(lastSlotAt);

  if (target < start || target > end) {
    return false;
  }
  return (target - start) % slotMinutes === 0;
}

const ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** true si el string tiene forma 'YYYY-MM' con un mes que existe. */
export function isValidISOMonth(value: string): boolean {
  return ISO_MONTH_PATTERN.test(value);
}

/**
 * Todas las fechas civiles de un mes, en orden ascendente.
 *
 * El truco del día 0: new Date(año, mes, 0) es el último día del mes
 * anterior, así que pedir el día 0 del mes siguiente da cuántos días tiene
 * el mes actual. Resuelve febrero y los años bisiestos sin tabla ni reglas.
 */
export function daysOfMonth(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = new Date(year, monthNumber, 0).getDate();

  const days: string[] = [];
  for (let day = 1; day <= total; day += 1) {
    days.push(`${month}-${pad(day)}`);
  }
  return days;
}

/**
 * Minutos que faltan desde `now` hasta una fecha y hora civiles.
 * Negativo si ya pasaron.
 *
 * Recibe el instante en vez de leer el reloj para seguir siendo pura: esa
 * es la diferencia entre poder probar "faltan 90 minutos" con un test
 * determinista y tener que esperar a que den las nueve.
 */
export function minutesUntil(date: string, time: string, now: Date): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const objetivo = new Date(year, month - 1, day, hours, minutes, 0, 0);

  return Math.round((objetivo.getTime() - now.getTime()) / 60_000);
}
