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
  /**
   * Secreto de firma de los JWT. Mínimo 32 caracteres: un secreto corto se
   * rompe por fuerza bruta y cualquiera podría fabricar tokens de admin.
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  /** Duración del token en segundos. Por defecto 8 horas. */
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(28_800),
  /** Las bases gestionadas exigen TLS; en local no hay. */
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  /**
   * Antelación mínima con la que un cliente puede cancelar o aplazar su
   * cita, en horas.
   *
   * Es una política de negocio, no una constante del código: la barbería
   * puede querer dos horas hoy y veinticuatro mañana, y eso no debería
   * exigir recompilar y volver a desplegar.
   */
  BOOKING_CHANGE_WINDOW_HOURS: z.coerce.number().int().min(0).max(168).default(2),
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
  jwtSecret: raw.JWT_SECRET,
  /** El servicio razona en minutos; la configuración se escribe en horas. */
  bookingChangeWindowMinutes: raw.BOOKING_CHANGE_WINDOW_HOURS * 60,
  bookingChangeWindowHours: raw.BOOKING_CHANGE_WINDOW_HOURS,
  jwtExpiresInSeconds: raw.JWT_EXPIRES_IN_SECONDS,
  /** Lista blanca de CORS. Vacía = no se permite ningún origen del navegador. */
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
} as const;
