/**
 * Utilidades de fecha en español, sin dependencias.
 *
 * Todo se maneja con fechas locales: los ISO son 'YYYY-MM-DD' construidos a
 * mano, nunca con toISOString(), que desplaza el día según la zona horaria.
 */

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

/** Cabecera de columnas del calendario. */
export const WEEKDAY_COLUMNS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const DAYS_PER_WEEK = 7;

function pad(value: number): string {
  return String(value).padStart(2, '0');
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

/** Hoy a medianoche, para comparar días sin que la hora interfiera. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** true si el día ya pasó (hoy no cuenta como pasado). */
export function isPastDate(iso: string): boolean {
  return fromISODate(iso).getTime() < startOfToday().getTime();
}

/** 'Julio 2026' */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** 'Mar 14 de Jul' */
export function formatShortDate(iso: string): string {
  const date = fromISODate(iso);
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  const monthShort = MONTHS_SHORT[date.getMonth()];
  return `${weekday} ${date.getDate()} de ${monthShort}`;
}

/** '14/07/2026' */
export function formatDayMonthYear(iso: string): string {
  const date = fromISODate(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** 'HH:mm' 24h -> '9:00 am' */
export function formatTime12h(time: string): string {
  const [hoursRaw, minutes] = time.split(':');
  const hours24 = Number(hoursRaw);
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${suffix}`;
}

/**
 * Semanas del mes como matriz de 7 columnas empezando en domingo.
 * Las celdas vacías de relleno son null.
 */
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = new Array<null>(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(year, month, day)));
  }
  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_PER_WEEK));
  }
  return weeks;
}

/** Mes siguiente/anterior sin desbordar el año. */
export function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const shifted = new Date(year, month + offset, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

/** Compara dos meses: negativo si a es anterior a b. */
export function compareMonths(
  a: { year: number; month: number },
  b: { year: number; month: number },
): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/**
 * Claves de mes 'YYYY-MM'.
 *
 * El mes visible del calendario dejó de ser un detalle interno del componente
 * y pasó a ser lo que determina qué disponibilidad hay que pedirle a la API,
 * así que necesita un formato estable que viaje bien en una URL.
 *
 * Cuidado con el desfase: Date usa meses 0-11 y la clave usa 1-12, como el
 * resto del mundo.
 */

/** 'YYYY-MM' del mes al que pertenece una fecha ISO. */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Año y mes de Date (0-11) -> 'YYYY-MM'. */
export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' -> año y mes con el mes 0-11 que espera Date. */
export function fromMonthKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number);
  return { year, month: month - 1 };
}

/** 'YYYY-MM' del mes en curso. */
export function currentMonthKey(): string {
  const today = startOfToday();
  return toMonthKey(today.getFullYear(), today.getMonth());
}
