import { query } from '../config/database.js';
import type { Barber, BarberInput, BarberSummary, Review } from '../types/api.js';

/**
 * Único lugar del backend donde vive SQL.
 *
 * El repositorio no conoce reglas de negocio ni códigos HTTP: recibe
 * parámetros, consulta y traduce filas (snake_case) a tipos de dominio
 * (camelCase). Si mañana se cambia Postgres por otra cosa, solo cambia esto.
 *
 * BORRADO LÓGICO: un barbero dado de baja conserva su fila con deleted_at
 * puesto. Todas las lecturas de este archivo lo filtran, así que para el
 * resto de la aplicación un barbero de baja simplemente no existe.
 */

/** Código de Postgres para violación de restricción UNIQUE. */
const UNIQUE_VIOLATION = '23505';

/** Nombre de la clave primaria de barbers, tal como lo genera Postgres. */
const CONSTRAINT_ID = 'barbers_pkey';

interface BarberRow {
  id: string;
  name: string;
  specialty: string;
  avatar_url: string;
  services_count: number;
  rating: number;
  reviews_count: number;
}

interface ReviewRow {
  id: string;
  author_name: string;
  comment: string;
  rating: number;
}

/** La regla de horario con la que nace un barbero nuevo. */
export interface DefaultSchedule {
  /** 'HH:mm' de la primera franja reservable. */
  firstSlotAt: string;
  /** 'HH:mm' de la última franja reservable, no la hora de cierre. */
  lastSlotAt: string;
  slotMinutes: number;
}

/**
 * Resultado explícito de escribir un barbero.
 *
 * El repositorio no lanza errores HTTP: cuenta qué pasó y el servicio decide.
 * Las dos razones se distinguen porque se resuelven distinto: un id repetido
 * se arregla probando otro id, un nombre repetido solo lo arregla el usuario.
 */
export type WriteResult =
  | { ok: true; barber: BarberSummary }
  | { ok: false; reason: 'id_taken' | 'name_taken' };

function toBarberSummary(row: BarberRow): BarberSummary {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    avatar: row.avatar_url,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    servicesCount: row.services_count,
  };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    authorName: row.author_name,
    comment: row.comment,
    rating: row.rating,
  };
}

/** Traduce un 23505 a la razón de negocio; null si el error es otra cosa. */
function uniqueViolationReason(error: unknown): 'id_taken' | 'name_taken' | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== UNIQUE_VIOLATION) {
    return null;
  }
  return constraint === CONSTRAINT_ID ? 'id_taken' : 'name_taken';
}

/**
 * rating y reviewsCount se agregan aquí en vez de guardarse como columnas:
 * así nunca pueden quedar desincronizados con la tabla reviews.
 *
 * servicesCount sigue la misma idea: el catálogo es global (todos los
 * barberos ofrecen lo mismo), así que el número sale de contar services y no
 * de una columna que el administrador tendría que acordarse de mantener.
 *
 * Los casts explícitos evitan que COUNT (bigint) y AVG (numeric) lleguen
 * como string al código.
 */
const SELECT_BARBER = `
  SELECT b.id,
         b.name,
         b.specialty,
         b.avatar_url,
         (SELECT COUNT(*) FROM services)::int     AS services_count,
         COALESCE(AVG(r.rating), 0)::numeric(2,1) AS rating,
         COUNT(r.id)::int                         AS reviews_count
  FROM barbers b
  LEFT JOIN reviews r ON r.barber_id = b.id
  WHERE b.deleted_at IS NULL
`;

export async function findAll(): Promise<BarberSummary[]> {
  const rows = await query<BarberRow>(`${SELECT_BARBER} GROUP BY b.id ORDER BY b.name`);
  return rows.map(toBarberSummary);
}

export async function findSummaryById(id: string): Promise<BarberSummary | null> {
  const rows = await query<BarberRow>(`${SELECT_BARBER} AND b.id = $1 GROUP BY b.id`, [id]);
  const row = rows[0];
  return row === undefined ? null : toBarberSummary(row);
}

/**
 * Detalle con reseñas.
 *
 * Son dos consultas, no un JOIN con json_agg, porque se lee mejor y se
 * depura mejor. No es un problema N+1: son dos viajes fijos para un
 * recurso, no uno por cada reseña.
 */
export async function findById(id: string): Promise<Barber | null> {
  const summary = await findSummaryById(id);
  if (summary === null) {
    return null;
  }

  const reviewRows = await query<ReviewRow>(
    `SELECT id, author_name, comment, rating
     FROM reviews
     WHERE barber_id = $1
     ORDER BY created_at DESC`,
    [id],
  );

  return { ...summary, reviews: reviewRows.map(toReview) };
}

export async function exists(id: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM barbers WHERE id = $1 AND deleted_at IS NULL
     ) AS exists`,
    [id],
  );
  return rows[0]?.exists ?? false;
}

/**
 * Crea el barbero y su horario en una sola sentencia.
 *
 * Un barbero sin filas en barber_schedules existe pero no se puede reservar:
 * aparecería en la app con el calendario vacío. Por eso el horario nace con
 * él. Va todo en un único INSERT con CTE y no en dos consultas porque una
 * sentencia es atómica por sí sola: o quedan el barbero y sus siete días, o
 * no queda nada, sin necesidad de abrir una transacción a mano.
 */
export async function create(
  id: string,
  input: BarberInput,
  schedule: DefaultSchedule,
): Promise<WriteResult> {
  try {
    await query(
      `WITH nuevo AS (
         INSERT INTO barbers (id, name, specialty, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id
       )
       INSERT INTO barber_schedules
         (barber_id, weekday, first_slot_at, last_slot_at, slot_minutes)
       SELECT nuevo.id, weekday, $5::time, $6::time, $7
       FROM nuevo
       CROSS JOIN generate_series(0, 6) AS weekday`,
      [
        id,
        input.name,
        input.specialty,
        input.avatar,
        schedule.firstSlotAt,
        schedule.lastSlotAt,
        schedule.slotMinutes,
      ],
    );
  } catch (error) {
    // La unicidad la deciden la clave primaria y barbers_nombre_unico, no una
    // consulta previa: dos administradores creando a la vez la pasarían ambos.
    const reason = uniqueViolationReason(error);
    if (reason !== null) {
      return { ok: false, reason };
    }
    throw error;
  }

  const barber = await findSummaryById(id);
  if (barber === null) {
    throw new Error('El barbero recién creado no aparece al leerlo.');
  }
  return { ok: true, barber };
}

/**
 * Reemplaza los datos de la ficha. El id no cambia nunca: viaja en URLs y lo
 * referencian las citas. null cuando no existe (o está de baja).
 */
export async function update(id: string, input: BarberInput): Promise<WriteResult | null> {
  try {
    const rows = await query<{ id: string }>(
      `UPDATE barbers
       SET name = $2, specialty = $3, avatar_url = $4
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, input.name, input.specialty, input.avatar],
    );

    if (rows.length === 0) {
      return null;
    }
  } catch (error) {
    if (uniqueViolationReason(error) !== null) {
      return { ok: false, reason: 'name_taken' };
    }
    throw error;
  }

  const barber = await findSummaryById(id);
  return barber === null ? null : { ok: true, barber };
}

/**
 * Da de baja al barbero, salvo que tenga citas activas de hoy en adelante.
 *
 * La condición va DENTRO del UPDATE y no en una consulta previa para que
 * comprobar y borrar sean un solo paso. Devuelve false tanto si no existe
 * como si tiene citas: el servicio distingue los dos casos.
 *
 * No se borra la fila: sus citas pasadas la referencian (ON DELETE RESTRICT)
 * y son el historial del negocio.
 */
export async function softDelete(id: string, today: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE barbers
     SET deleted_at = now()
     WHERE id = $1
       AND deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE barber_id = $1
           AND status = 'activa'
           AND booking_date >= $2::date
       )
     RETURNING id`,
    [id, today],
  );
  return rows.length > 0;
}
