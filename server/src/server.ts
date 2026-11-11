import type { Server } from 'node:http';

import app from './app.js';
import { closePool, pool } from './config/database.js';
import { env } from './config/env.js';

/**
 * Punto de entrada: arranque y apagado ordenado.
 *
 * Comprobar la conexión ANTES de escuchar evita el peor escenario: un
 * servidor que acepta peticiones y las falla todas con 500 porque la base
 * nunca estuvo disponible.
 */
async function start(): Promise<void> {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('[arranque] No se pudo conectar a PostgreSQL.');
    console.error('[arranque] ¿Está levantado? Prueba: docker compose up -d');
    console.error(error);
    process.exit(1);
  }

  const server: Server = app.listen(env.port, () => {
    console.log(`API escuchando en http://localhost:${env.port}`);
    console.log(`Entorno: ${env.nodeEnv}`);
  });

  /**
   * Apagado ordenado: se deja de aceptar conexiones nuevas, se esperan las
   * que están en curso y después se cierra el pool. Matar el proceso de golpe
   * corta peticiones a medias y deja conexiones colgadas en Postgres.
   */
  const shutdown = (signal: string): void => {
    console.log(`\n${signal} recibido, cerrando...`);

    server.close(() => {
      void closePool().then(() => {
        console.log('Cerrado correctamente.');
        process.exit(0);
      });
    });

    // Red de seguridad: si algo se queda colgado, no esperamos para siempre.
    setTimeout(() => {
      console.error('Cierre forzado tras 10s.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void start();
