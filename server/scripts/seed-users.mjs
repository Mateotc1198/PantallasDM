import bcrypt from 'bcryptjs';
import pg from 'pg';

import 'dotenv/config';

/**
 * Crea o actualiza las cuentas iniciales.
 *
 *   npm run users:seed
 *
 * Las credenciales salen SIEMPRE del entorno, nunca del repositorio: un hash
 * bcrypt commiteado sigue siendo una credencial publicada, y basta con un
 * diccionario y tiempo para romperlo.
 *
 * Es idempotente: se ejecuta en cada despliegue y, si la cuenta ya existe,
 * actualiza su contraseña en vez de fallar.
 *
 * JavaScript plano y no TypeScript porque corre en el arranque, donde tsx es
 * una dependencia de desarrollo que puede no estar instalada.
 */
const BCRYPT_ROUNDS = 12;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Falta DATABASE_URL en el entorno.');
  process.exit(1);
}

const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const cuentas = [
  {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    barberId: null,
  },
  {
    username: process.env.BARBERO_USERNAME,
    password: process.env.BARBERO_PASSWORD,
    role: 'barbero',
    barberId: process.env.BARBERO_BARBER_ID,
  },
];

const pendientes = cuentas.filter((cuenta) => cuenta.username && cuenta.password);

if (pendientes.length === 0) {
  // No es un error: en un entorno sin estas variables simplemente no hay
  // cuentas que sembrar, y el arranque debe continuar.
  console.log('Sin cuentas que sembrar: no hay credenciales en el entorno.');
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl });

try {
  await client.connect();

  for (const cuenta of pendientes) {
    if (cuenta.role === 'barbero' && !cuenta.barberId) {
      console.error(`  omitida "${cuenta.username}": un barbero necesita BARBERO_BARBER_ID.`);
      continue;
    }

    const hash = await bcrypt.hash(cuenta.password, BCRYPT_ROUNDS);

    await client.query(
      `INSERT INTO users (username, password_hash, role, barber_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role          = EXCLUDED.role,
             barber_id     = EXCLUDED.barber_id`,
      [cuenta.username.trim().toLowerCase(), hash, cuenta.role, cuenta.barberId ?? null],
    );

    console.log(`  cuenta lista: ${cuenta.username} (${cuenta.role})`);
  }
} catch (error) {
  console.error('Error sembrando las cuentas:');
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
