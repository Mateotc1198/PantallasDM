import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import 'dotenv/config';

/**
 * Prepara la base de tests una sola vez antes de toda la suite.
 *
 * Usa DATABASE_URL_TEST, una base distinta de la de desarrollo: los tests
 * borran tablas, y hacerlo sobre los datos reales sería inaceptable.
 */
export default async function setup(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_TEST;

  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('Falta DATABASE_URL_TEST en el .env para correr los tests.');
  }

  const dbDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'db');
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // reset primero: los tests exigen un esquema conocido, no uno heredado
    // de una version anterior del schema.
    for (const file of ['reset.sql', 'schema.sql', 'seed.sql']) {
      await client.query(await readFile(join(dbDirectory, file), 'utf8'));
    }
  } finally {
    await client.end();
  }
}
