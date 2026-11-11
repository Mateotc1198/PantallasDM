import { query } from '../config/database.js';
import type { Booking, BookingStatus, CreateBookingInput } from '../types/api.js';
import { normalizeTime } from '../utils/time.js';

/** Código de Postgres para violación de restricción UNIQUE. */
const UNIQUE_VIOLATION = '23505';

interface BookingRow {
  id: string;
  barber_id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  status: BookingStatus;
  created_at: Date;
}

/**
 * Resultado explícito de crear una cita.
 *
 * El repositorio NO lanza errores HTTP: devuelve qué pasó y el servicio
 * decide cómo traducirlo. Así la capa de datos no sabe que existe el 409,
 * y la regla de negocio queda donde debe estar.
 */
export type CreateResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'slot_taken' };

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    barberId: row.barber_id,
    date: row.booking_date,
    time: normalizeTime(row.booking_time),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

const RETURNING_COLUMNS = `
  id, barber_id, booking_date, booking_time,
  customer_name, customer_phone, status, created_at
`;

/** Error del driver de Postgres, acotado a lo que necesitamos leer. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * Inserta la cita y deja que la base decida si el horario estaba libre.
 *
 * No se consulta "¿está ocupado?" antes de insertar porque entre la consulta
 * y el INSERT otra petición puede colarse (condición de carrera TOCTOU).
 * El índice único parcial bookings_slot_unico es la garantía real: si choca,
 * Postgres responde 23505 y lo traducimos a un resultado de negocio.
 */
export async function create(input: CreateBookingInput): Promise<CreateResult> {
  try {
    const rows = await query<BookingRow>(
      `INSERT INTO bookings (barber_id, booking_date, booking_time, customer_name, customer_phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${RETURNING_COLUMNS}`,
      [input.barberId, input.date, input.time, input.customerName, input.customerPhone],
    );

    const row = rows[0];
    if (row === undefined) {
      throw new Error('El INSERT de bookings no devolvió ninguna fila.');
    }
    return { ok: true, booking: toBooking(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'slot_taken' };
    }
    throw error;
  }
}

export async function findById(id: string): Promise<Booking | null> {
  const rows = await query<BookingRow>(
    `SELECT ${RETURNING_COLUMNS} FROM bookings WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row === undefined ? null : toBooking(row);
}

/** Horas 'HH:mm' ya reservadas de un barbero en un día concreto. */
export async function findActiveTimes(barberId: string, date: string): Promise<string[]> {
  const rows = await query<{ booking_time: string }>(
    `SELECT booking_time
     FROM bookings
     WHERE barber_id = $1 AND booking_date = $2 AND status = 'activa'`,
    [barberId, date],
  );
  return rows.map((row) => normalizeTime(row.booking_time));
}

/**
 * Agenda: citas activas, con filtros opcionales por día y por barbero.
 *
 * Los filtros se resuelven dentro del SQL con "$1 IS NULL OR ..." en vez de
 * ir concatenando trozos de consulta según los parámetros recibidos. Así la
 * consulta es siempre la misma, siempre parametrizada, y no hay por dónde
 * inyectar nada.
 */
export async function findAgenda(filtros: {
  date: string | null;
  barberId: string | null;
}): Promise<Booking[]> {
  const rows = await query<BookingRow>(
    `SELECT ${RETURNING_COLUMNS}
     FROM bookings
     WHERE status = 'activa'
       AND ($1::date IS NULL OR booking_date = $1::date)
       AND ($2::text IS NULL OR barber_id = $2::text)
     ORDER BY booking_date, booking_time`,
    [filtros.date, filtros.barberId],
  );
  return rows.map(toBooking);
}

/**
 * Cancela la cita solo si está activa.
 *
 * El WHERE status = 'activa' hace la operación segura ante llamadas
 * simultáneas: la segunda no encuentra fila que actualizar y devuelve null,
 * en vez de sobrescribir la fecha de cancelación de la primera.
 */
export async function cancel(id: string): Promise<Booking | null> {
  const rows = await query<BookingRow>(
    `UPDATE bookings
     SET status = 'cancelada', cancelled_at = now()
     WHERE id = $1 AND status = 'activa'
     RETURNING ${RETURNING_COLUMNS}`,
    [id],
  );
  const row = rows[0];
  return row === undefined ? null : toBooking(row);
}

/**
 * Cuántas citas activas tiene un barbero en cada día de un rango.
 *
 * Devuelve solo los días que tienen alguna: la ausencia de clave significa
 * cero. Agrupar en Postgres y no en memoria evita traerse todas las filas
 * del mes para contarlas aquí.
 */
export async function countActiveByDate(
  barberId: string,
  from: string,
  to: string,
): Promise<Map<string, number>> {
  const rows = await query<{ booking_date: string; total: number }>(
    `SELECT booking_date, COUNT(*)::int AS total
     FROM bookings
     WHERE barber_id = $1
       AND status = 'activa'
       AND booking_date BETWEEN $2::date AND $3::date
     GROUP BY booking_date`,
    [barberId, from, to],
  );
  return new Map(rows.map((row) => [row.booking_date, row.total]));
}

/**
 * Mueve una cita activa a otra fecha y hora.
 *
 * El mismo índice único parcial que protege la creación protege esto: un
 * UPDATE hacia una franja ya ocupada choca contra bookings_slot_unico igual
 * que lo haría un INSERT. No hace falta comprobar nada antes, y por eso no
 * hay ventana entre la comprobación y el cambio.
 *
 * Devuelve null cuando no hay fila activa que mover: o no existe, o ya
 * estaba cancelada. El servicio decide cuál de las dos cosas es.
 */
export async function reschedule(
  id: string,
  date: string,
  time: string,
): Promise<CreateResult | null> {
  try {
    const rows = await query<BookingRow>(
      `UPDATE bookings
       SET booking_date = $2::date, booking_time = $3::time
       WHERE id = $1 AND status = 'activa'
       RETURNING ${RETURNING_COLUMNS}`,
      [id, date, time],
    );

    const row = rows[0];
    return row === undefined ? null : { ok: true, booking: toBooking(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'slot_taken' };
    }
    throw error;
  }
}
