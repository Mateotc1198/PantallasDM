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

/**
 * Inserta una cita saltándose la API.
 *
 * Hace falta para montar escenarios que la API no permite crear a
 * propósito: una cita de ayer, por ejemplo, que es justo lo que necesita el
 * test del plazo de cambios. Crearla por POST /bookings devolvería 422, que
 * es exactamente el comportamiento correcto.
 */
export async function insertBooking(datos: {
  barberId: string;
  date: string;
  time: string;
  customerName?: string;
  customerPhone?: string;
}): Promise<string> {
  const filas = await pool.query<{ id: string }>(
    `INSERT INTO bookings (barber_id, booking_date, booking_time, customer_name, customer_phone)
     VALUES ($1, $2::date, $3::time, $4, $5)
     RETURNING id`,
    [
      datos.barberId,
      datos.date,
      datos.time,
      datos.customerName ?? 'Cliente Directo',
      datos.customerPhone ?? '3001112233',
    ],
  );
  return filas.rows[0].id;
}

/**
 * Deja el catálogo con tres servicios conocidos.
 *
 * No se apoya en el seed: los tests que crean y borran servicios cambiarían
 * lo que ve el siguiente, y un test que solo pasa según el orden no sirve.
 */
export async function resetServices(): Promise<void> {
  // DELETE y no TRUNCATE: bookings referencia a services, y Postgres no deja
  // truncar una tabla referenciada (TRUNCATE ... CASCADE vaciaría también las
  // citas). Con DELETE las citas conservan su foto del servicio.
  await pool.query('DELETE FROM services');
  await pool.query(
    `INSERT INTO services (name, description, price_cop, category) VALUES
       ('Corte clasico', 'Tijera y maquina.', 25000, 'Cortes'),
       ('Fade', 'Degradado a maquina.', 30000, 'Cortes'),
       ('Arreglo de barba', 'Perfilado y aceite.', 20000, 'Barba')`,
  );
}

/** Los dos barberos del seed, que el resto de la suite da por sentados. */
const BARBEROS_DEL_SEED = ['luis-gomez', 'alexander-escobar'];

/**
 * Deja la tabla de barberos como la dejó el seed.
 *
 * Los tests del panel crean, renombran y dan de baja barberos. Sin esto, el
 * archivo siguiente se encontraría con tres barberos donde espera dos, o con
 * luis-gomez de baja.
 *
 * Aquí sí se borran filas de verdad (la aplicación nunca lo hace): es la
 * única forma de volver a un estado conocido. Las citas de los barberos de
 * prueba se van primero porque bookings los referencia con RESTRICT.
 */
export async function resetBarbers(): Promise<void> {
  await pool.query('DELETE FROM bookings WHERE barber_id <> ALL($1)', [BARBEROS_DEL_SEED]);
  await pool.query('DELETE FROM barbers WHERE id <> ALL($1)', [BARBEROS_DEL_SEED]);

  // Se quita la baja y se restauran los datos por si un test los editó.
  await pool.query(
    `UPDATE barbers AS b
     SET deleted_at = NULL,
         name       = original.name,
         specialty  = original.specialty,
         avatar_url = original.avatar_url
     FROM (VALUES
       ('luis-gomez', 'Luis Gomez',
        'Especialista en fades y cortes modernos.',
        'https://i.pravatar.cc/240?img=12'),
       ('alexander-escobar', 'Alexander Escobar',
        'Experto en barba y tratamientos de hidratación capilar.',
        'https://i.pravatar.cc/240?img=33')
     ) AS original(id, name, specialty, avatar_url)
     WHERE b.id = original.id`,
  );
}
