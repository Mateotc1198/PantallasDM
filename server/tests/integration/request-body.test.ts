import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import app from '../../src/app.js';
import { closeDatabase } from '../helpers/db.js';

/**
 * Cuerpos que el servidor ni siquiera puede leer.
 *
 * Fallan en express.json, antes de llegar a ningún controlador, así que no
 * los cubre ningún test de recurso. Salieron de la validación en producción:
 * un JSON roto respondía 500, como si el fallo fuera del servidor.
 */

afterAll(closeDatabase);

describe('cuerpo de la petición ilegible', () => {
  it('un JSON mal formado devuelve 400, no 500', async () => {
    const respuesta = await request(app)
      .post('/api/v1/bookings')
      .set('Content-Type', 'application/json')
      .send('{roto');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('MALFORMED_JSON');
  });

  it('responde con la misma forma que el resto de errores, sin detalles internos', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');

    expect(Object.keys(respuesta.body)).toEqual(['error']);
    expect(Object.keys(respuesta.body.error).sort()).toEqual(['code', 'message']);
    // Ni el texto del parser ni la posición del error: eso es del servidor.
    expect(JSON.stringify(respuesta.body)).not.toMatch(/position|Unexpected|stack/i);
  });

  it('no lo registra como error del servidor: es culpa de la petición', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await request(app)
      .post('/api/v1/bookings')
      .set('Content-Type', 'application/json')
      .send('{roto');

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('un cuerpo que supera el límite de tamaño devuelve 413', async () => {
    const respuesta = await request(app)
      .post('/api/v1/bookings')
      .send({ customerName: 'x'.repeat(20_000) });

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('un JSON válido con datos malos sigue siendo un error de validación', async () => {
    const respuesta = await request(app).post('/api/v1/bookings').send({ barberId: 123 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

/**
 * El origen permitido lo fija vitest.config.ts (CORS_ORIGINS), no el .env de
 * cada máquina: estos tests dan lo mismo en local y en el CI.
 */
const ORIGEN_PERMITIDO = 'https://app.ejemplo.test';

describe('CORS', () => {
  it('el preflight de un origen permitido anuncia PUT', async () => {
    // PUT lo usan la edición de servicios y la de barberos.
    const respuesta = await request(app)
      .options('/api/v1/barbers/luis-gomez')
      .set('Origin', ORIGEN_PERMITIDO)
      .set('Access-Control-Request-Method', 'PUT');

    expect(respuesta.headers['access-control-allow-origin']).toBe(ORIGEN_PERMITIDO);
    expect(respuesta.headers['access-control-allow-methods']).toContain('PUT');
  });

  it('un origen fuera de la lista blanca no recibe permiso', async () => {
    const respuesta = await request(app)
      .options('/api/v1/barbers/luis-gomez')
      .set('Origin', 'https://sitio-ajeno.test')
      .set('Access-Control-Request-Method', 'PUT');

    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });
});
