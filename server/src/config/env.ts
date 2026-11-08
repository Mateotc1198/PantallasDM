import 'dotenv/config';
import { z } from 'zod';

/**
 * Validación de variables de entorno en el arranque.
 *
 * Falla rápido y ruidoso: si falta DATABASE_URL preferimos que el proceso
 * muera en el segundo 0 con un mensaje claro, y no que reviente a las dos
 * horas en medio de una petición con un error incomprensible.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default(''),
  /** Las bases gestionadas exigen TLS; en local no hay. */
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  process.stderr.write(`Variables de entorno inválidas:\n${detalle}\n`);
  process.exit(1);
}

const raw = parsed.data;
const isTest = raw.NODE_ENV === 'test';

if (isTest && raw.DATABASE_URL_TEST === undefined) {
  process.stderr.write('NODE_ENV=test requiere DATABASE_URL_TEST para no tocar la base de desarrollo.\n');
  process.exit(1);
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,
  isTest,
  isProduction: raw.NODE_ENV === 'production',
  /** En test apunta a la base aislada: los tests nunca borran datos reales. */
  databaseUrl: isTest && raw.DATABASE_URL_TEST !== undefined ? raw.DATABASE_URL_TEST : raw.DATABASE_URL,
  databaseSsl: raw.DATABASE_SSL === 'true',
  /** Lista blanca de CORS. Vacía = no se permite ningún origen del navegador. */
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
} as const;
