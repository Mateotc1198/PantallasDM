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
 * Cancela la cita solo si está activa.
 *
 * El WHERE status = 'activa' hace la operación segura ante llamadas
 * simultáneas: la segunda no encuentra fila que actualizar y devuelve null,
 * en vez de sobrescribir la fecha de cancelación de la primera.
 */
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
