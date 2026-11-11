import pg from 'pg';
import type { QueryResultRow } from 'pg';

import { env } from './env.js';

/**
 * OIDs de los tipos de Postgres cuyo parser por defecto no nos sirve.
 * (Ver `select oid, typname from pg_type`.)
 */
const PG_OID = {
  DATE: 1082,
  TIME: 1083,
  NUMERIC: 1700,
} as const;

/**
 * Por defecto el driver convierte DATE y TIME a objetos Date de JavaScript,
 * y al hacerlo les aplica la zona horaria del proceso. Resultado: guardas
 * '2026-07-14' y lees '2026-07-13T19:00:00-05:00'. El día se corre.
 *
 * Los dejamos como el string crudo que manda Postgres y los normalizamos
 * nosotros. Las fechas de este dominio son civiles ("el 14 de julio a las
 * 9:00"), no instantes universales: no tienen zona horaria.
 */
pg.types.setTypeParser(PG_OID.DATE, (value: string) => value);
pg.types.setTypeParser(PG_OID.TIME, (value: string) => value);

/** NUMERIC llega como string para no perder precisión; nuestros AVG caben en un number. */
pg.types.setTypeParser(PG_OID.NUMERIC, (value: string) => Number(value));

/**
 * TLS hacia la base.
 *
 * rejectUnauthorized en false cifra la conexión pero no verifica la identidad
 * del servidor: los proveedores gestionados firman con CA propias que Node no
 * trae. Es el modo que documentan Render y Neon para conexiones externas.
 * Conectando por la URL interna del proveedor (misma red privada) no hace
 * falta activarlo.
 */
const ssl = env.databaseSsl ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * Único punto por el que pasa SQL.
 *
 * `params` siempre viaja aparte del texto: es lo que hace imposible la
 * inyección SQL. Nunca se concatena un valor dentro del string de la query.
 */
export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

/** Cierra el pool en el apagado ordenado del servidor. */
export async function closePool(): Promise<void> {
  await pool.end();
}
