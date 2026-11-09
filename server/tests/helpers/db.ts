import { pool } from '../../src/config/database.js';

/**
 * Deja la tabla de citas vacía.
 *
 * Se llama antes de cada test para que ninguno dependa de lo que dejó el
 * anterior: un test que solo pasa si corre en cierto orden no sirve de nada.
 * No se tocan barbers ni barber_schedules: son datos de referencia.
 */
export async function resetBookings(): Promise<void> {
  await pool.query('TRUNCATE TABLE bookings');
}

/** Cierra el pool al terminar el archivo, si no vitest se queda colgado. */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

/**
 * Ocupa todas las franjas de un día para un barbero.
 *
 * Se insertan por SQL y no por la API a propósito: lo que se prueba aquí es
 * la disponibilidad, no la creación de citas. Veintidós peticiones HTTP para
 * montar el escenario serían veintidós formas de que falle algo que no es el
 * objeto del test.
 *
 * El generate_series reproduce el horario del seed: de 09:00 a 20:30 cada 30
 * minutos, veinticuatro franjas.
 */
export async function fillDay(barberId: string, date: string): Promise<void> {
  await pool.query(
    `INSERT INTO bookings (barber_id, booking_date, booking_time, customer_name, customer_phone)
     SELECT $1, $2::date, (TIME '09:00' + (n * INTERVAL '30 minutes'))::time,
            'Cliente Lleno', '3001112233'
     FROM generate_series(0, 23) AS n`,
    [barberId, date],
  );
}
