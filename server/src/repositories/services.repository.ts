import { query } from '../config/database.js';
import type { Service } from '../types/api.js';
import type { DecodedImage } from '../utils/image.js';

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
/**
 * Lo que se escribe de un servicio, ya resuelto por el servicio de dominio.
 *
 * imageUrl distingue tres casos: undefined es "no tocar la imagen" (solo al
 * editar), null es "sin imagen" y una cadena es esa URL. Con una foto subida,
 * es la ruta de esta API que la sirve.
 */
export interface ServiceWrite {
  name: string;
  description: string;
  priceCop: number;
  category: string;
  imageUrl: string | null | undefined;
  photo: DecodedImage | null;
}

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

/**
 * El id llega hecho: la URL de una foto subida lo lleva dentro, así que tiene
 * que conocerse antes del INSERT.
 *
 * El servicio y su foto entran en una sola sentencia: si algo falla no queda
 * un servicio apuntando a una imagen que no llegó a guardarse.
 */
export async function create(id: string, input: ServiceWrite): Promise<WriteResult> {
  try {
    const rows = await query<ServiceRow>(
      `WITH nuevo AS (
         INSERT INTO services (id, name, description, price_cop, category, image_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}
       ),
       foto AS (
         INSERT INTO service_photos (service_id, content, content_type)
         SELECT nuevo.id, $7::bytea, $8::text
         FROM nuevo
         WHERE $7::bytea IS NOT NULL
       )
       SELECT ${COLUMNS} FROM nuevo`,
      [
        id,
        input.name,
        input.description,
        input.priceCop,
        input.category,
        input.imageUrl ?? null,
        input.photo?.content ?? null,
        input.photo?.contentType ?? null,
      ],
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
export async function update(id: string, input: ServiceWrite): Promise<WriteResult | null> {
  try {
    // Una sola sentencia para que la ficha y la imagen no puedan quedar
    // desacompasadas:
    //   - llega una foto: se guarda (o reemplaza) e image_url apunta a ella;
    //   - llega una URL externa o null: se usa, y la foto subida que hubiera
    //     se borra para no dejar bytes que ya nadie va a pedir;
    //   - no llega nada: image_url se queda como estaba ($7 en false).
    const cambiaImagen = input.imageUrl !== undefined;
    const rows = await query<ServiceRow>(
      `WITH actualizado AS (
         UPDATE services
         SET name = $2, description = $3, price_cop = $4, category = $5,
             image_url = CASE WHEN $7::boolean THEN $6::text ELSE image_url END,
             updated_at = now()
         WHERE id = $1
         RETURNING ${COLUMNS}
       ),
       foto AS (
         INSERT INTO service_photos (service_id, content, content_type)
         SELECT actualizado.id, $8::bytea, $9::text
         FROM actualizado
         WHERE $8::bytea IS NOT NULL
         ON CONFLICT (service_id) DO UPDATE
           SET content      = EXCLUDED.content,
               content_type = EXCLUDED.content_type,
               updated_at   = now()
       ),
       limpieza AS (
         DELETE FROM service_photos
         WHERE service_id IN (SELECT id FROM actualizado)
           AND $8::bytea IS NULL
           AND $7::boolean
       )
       SELECT ${COLUMNS} FROM actualizado`,
      [
        id,
        input.name,
        input.description,
        input.priceCop,
        input.category,
        input.imageUrl ?? null,
        cambiaImagen,
        input.photo?.content ?? null,
        input.photo?.contentType ?? null,
      ],
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

/** La imagen subida de un servicio. null si no tiene. */
export async function findPhoto(id: string): Promise<DecodedImage | null> {
  const rows = await query<{ content: Buffer; content_type: DecodedImage['contentType'] }>(
    'SELECT content, content_type FROM service_photos WHERE service_id = $1',
    [id],
  );
  const row = rows[0];
  return row === undefined ? null : { content: row.content, contentType: row.content_type };
}

/** false cuando no había nada que borrar. */
export async function remove(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(`DELETE FROM services WHERE id = $1 RETURNING id`, [
    id,
  ]);
  return rows.length > 0;
}
