import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import 'dotenv/config';

/**
 * Prepara la base de datos.
 *
 *   npm run db:setup         esquema + datos, SIN borrar nada (seguro en produccion)
 *   npm run db:reset         borra todo y vuelve a crear (solo desarrollo)
 *   npm run db:setup:test    lo mismo que db:setup, sobre la base de tests
 *   npm run db:reset:test    borra y recrea la base de tests
 *
 * Es JavaScript plano y no TypeScript a proposito: corre en el despliegue,
 * donde tsx es una dependencia de desarrollo que puede no estar instalada.
 * Una herramienta de arranque no debe depender del toolchain de build.
 */
const usarBaseDeTests = process.argv.includes('--test');
const borrarPrimero = process.argv.includes('--reset');

const connectionString = usarBaseDeTests
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error(`Falta ${usarBaseDeTests ? 'DATABASE_URL_TEST' : 'DATABASE_URL'} en el entorno.`);
  process.exit(1);
}

/**
 * Las bases gestionadas (Render, Neon, Supabase) exigen TLS; en local no hay.
 * Se activa con DATABASE_SSL=true en vez de adivinarlo a partir de la URL.
 */
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

const dbDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'db');
const archivos = borrarPrimero
  ? ['reset.sql', 'schema.sql', 'seed.sql']
  : ['schema.sql', 'seed.sql'];

const client = new pg.Client({ connectionString, ssl });

try {
  await client.connect();
  for (const archivo of archivos) {
    await client.query(await readFile(join(dbDirectory, archivo), 'utf8'));
    console.log(`  aplicado ${archivo}`);
  }
  const destino = usarBaseDeTests ? 'de tests' : 'de desarrollo';
  console.log(`Base ${destino} lista${borrarPrimero ? ' (recreada desde cero)' : ''}.`);
} catch (error) {
  console.error('Error preparando la base de datos:');
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
