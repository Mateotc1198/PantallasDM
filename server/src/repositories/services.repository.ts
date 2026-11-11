import { query } from '../config/database.js';
import type { Service, ServiceInput } from '../types/api.js';

/** Código de Postgres para violación de restricción UNIQUE. */
const UNIQUE_VIOLATION = '23505';

interface ServiceRow {
  id: string;
  name: string;
  description: string;
  price_cop: number;
  category: string;
  image_url: string | null;
}

/**
 * Resultado explícito de escribir un servicio.
 *
 * Igual que en bookings: el repositorio no lanza errores HTTP, devuelve qué
 * pasó y el servicio decide cómo traducirlo. La capa de datos no sabe que
 * existe el 409.
 */
export type WriteResult =
  | { ok: true; service: Service }
  | { ok: false; reason: 'name_taken' };

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCop: row.price_cop,
    category: row.category,
    imageUrl: row.image_url,
  };
}

const COLUMNS = 'id, name, description, price_cop, category, image_url';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/**
 * Catálogo completo, agrupable por categoría.
 *
 * El orden se decide aquí y no en el cliente: así las tres pantallas que lo
 * muestran coinciden sin ponerse de acuerdo.
 */
export async function findAll(): Promise<Service[]> {
  const rows = await query<ServiceRow>(
    `SELECT ${COLUMNS} FROM services ORDER BY category, name`,
  );
  return rows.map(toService);
}

export async function findById(id: string): Promise<Service | null> {
  const rows = await query<ServiceRow>(`SELECT ${COLUMNS} FROM services WHERE id = $1`, [id]);
  const row = rows[0];
  return row === undefined ? null : toService(row);
}

export async function create(input: ServiceInput): Promise<WriteResult> {
  try {
    const rows = await query<ServiceRow>(
      `INSERT INTO services (name, description, price_cop, category, image_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [input.name, input.description, input.priceCop, input.category, input.imageUrl],
    );

    const row = rows[0];
    if (row === undefined) {
      throw new Error('El INSERT de services no devolvió ninguna fila.');
    }
    return { ok: true, service: toService(row) };
  } catch (error) {
    // El nombre duplicado lo detecta services_nombre_unico, no una consulta
    // previa: dos administradores creando a la vez pasarían ambos el control.
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'name_taken' };
    }
    throw error;
  }
}

/** null cuando no existe ese id. */
export async function update(id: string, input: ServiceInput): Promise<WriteResult | null> {
  try {
    const rows = await query<ServiceRow>(
      `UPDATE services
       SET name = $2, description = $3, price_cop = $4, category = $5,
           image_url = $6, updated_at = now()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [id, input.name, input.description, input.priceCop, input.category, input.imageUrl],
    );

    const row = rows[0];
    return row === undefined ? null : { ok: true, service: toService(row) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'name_taken' };
    }
    throw error;
  }
}

/** false cuando no había nada que borrar. */
export async function remove(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM services WHERE id = $1 RETURNING id`, [
    id,
  ]);
  return rows.length > 0;
}
