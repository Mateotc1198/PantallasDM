import { query } from '../config/database.js';
import type { Barber, BarberSummary, Review } from '../types/api.js';

/**
 * Único lugar del backend donde vive SQL.
 *
 * El repositorio no conoce reglas de negocio ni códigos HTTP: recibe
 * parámetros, consulta y traduce filas (snake_case) a tipos de dominio
 * (camelCase). Si mañana se cambia Postgres por otra cosa, solo cambia esto.
 */

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

/**
 * rating y reviewsCount se agregan aquí en vez de guardarse como columnas:
 * así nunca pueden quedar desincronizados con la tabla reviews.
 * Los casts explícitos evitan que COUNT (bigint) y AVG (numeric) lleguen
 * como string al código.
 */
const SELECT_BARBER = `
  SELECT b.id,
         b.name,
         b.specialty,
         b.avatar_url,
         b.services_count,
         COALESCE(AVG(r.rating), 0)::numeric(2,1) AS rating,
         COUNT(r.id)::int                         AS reviews_count
  FROM barbers b
  LEFT JOIN reviews r ON r.barber_id = b.id
`;

export async function findAll(): Promise<BarberSummary[]> {
  const rows = await query<BarberRow>(`${SELECT_BARBER} GROUP BY b.id ORDER BY b.name`);
  return rows.map(toBarberSummary);
}

export async function findSummaryById(id: string): Promise<BarberSummary | null> {
  const rows = await query<BarberRow>(`${SELECT_BARBER} WHERE b.id = $1 GROUP BY b.id`, [id]);
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
    'SELECT EXISTS (SELECT 1 FROM barbers WHERE id = $1) AS exists',
    [id],
  );
  return rows[0]?.exists ?? false;
}
