import { query } from '../config/database.js';
import { normalizeTime } from '../utils/time.js';

/** Horario de atención de un barbero para un día de la semana. */
export interface BarberSchedule {
  barberId: string;
  /** 0 = domingo, 6 = sábado. */
  weekday: number;
  /** 'HH:mm' */
  firstSlotAt: string;
  /** 'HH:mm' de la última franja reservable, no la hora de cierre. */
  lastSlotAt: string;
  slotMinutes: number;
}

interface ScheduleRow {
  barber_id: string;
  weekday: number;
  first_slot_at: string;
  last_slot_at: string;
  slot_minutes: number;
}

function toSchedule(row: ScheduleRow): BarberSchedule {
  return {
    barberId: row.barber_id,
    weekday: row.weekday,
    firstSlotAt: normalizeTime(row.first_slot_at),
    lastSlotAt: normalizeTime(row.last_slot_at),
    slotMinutes: row.slot_minutes,
  };
}

/**
 * null significa que ese barbero no atiende ese día de la semana.
 * La ausencia de fila ES el dato: no hace falta una columna "cerrado".
 */
export async function findByBarberAndWeekday(
  barberId: string,
  weekday: number,
): Promise<BarberSchedule | null> {
  const rows = await query<ScheduleRow>(
    `SELECT barber_id, weekday, first_slot_at, last_slot_at, slot_minutes
     FROM barber_schedules
     WHERE barber_id = $1 AND weekday = $2`,
    [barberId, weekday],
  );
  const row = rows[0];
  return row === undefined ? null : toSchedule(row);
}

/**
 * Todas las reglas de horario de un barbero: como mucho siete filas.
 *
 * Se trae la semana completa de una vez porque quien calcula un mes entero
 * necesita los siete días, y siete consultas de una fila cada una serían
 * siete viajes a la base para traer lo mismo.
 */
export async function findByBarber(barberId: string): Promise<BarberSchedule[]> {
  const rows = await query<ScheduleRow>(
    `SELECT barber_id, weekday, first_slot_at, last_slot_at, slot_minutes
     FROM barber_schedules
     WHERE barber_id = $1`,
    [barberId],
  );
  return rows.map(toSchedule);
}
