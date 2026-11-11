import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import {
  ADMIN,
  BARBERO,
  bearer,
  crearUsuariosDePrueba,
  tokenDe,
} from '../helpers/auth.js';
import { closeDatabase, resetServices } from '../helpers/db.js';

/**
 * Catálogo de servicios.
 *
 * Es el primer recurso con escritura completa desde el panel, así que aquí
 * se prueba sobre todo quién puede qué: leer es de cualquiera, escribir es
 * solo del administrador.
 */

const UUID_INEXISTENTE = '11111111-2222-4333-8444-555555555555';

let tokenAdmin: string;
let tokenBarbero: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
  tokenBarbero = await tokenDe(BARBERO);
});

beforeEach(resetServices);
afterAll(closeDatabase);

function servicioValido(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Afeitado clasico',
    description: 'Navaja, toalla caliente y balsamo.',
    priceCop: 32000,
    category: 'Barba',
    ...overrides,
  };
}

describe('GET /api/v1/services', () => {
  it('es público: no hace falta sesión para ver el catálogo', async () => {
    const respuesta = await request(app).get('/api/v1/services');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(3);
  });

  it('devuelve el precio como entero, no como decimal', async () => {
    const respuesta = await request(app).get('/api/v1/services');

    for (const servicio of respuesta.body as { priceCop: number }[]) {
      expect(Number.isInteger(servicio.priceCop)).toBe(true);
    }
  });

  it('ordena por categoría y luego por nombre', async () => {
    const respuesta = await request(app).get('/api/v1/services');
    const claves = (respuesta.body as { category: string; name: string }[]).map(
      (s) => `${s.category}|${s.name}`,
    );

    expect(claves).toEqual([...claves].sort());
  });
});

describe('GET /api/v1/services/:id', () => {
  it('devuelve el detalle de un servicio', async () => {
    const lista = await request(app).get('/api/v1/services');
    const primero = lista.body[0] as { id: string; name: string };

    const respuesta = await request(app).get(`/api/v1/services/${primero.id}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.name).toBe(primero.name);
  });

  it('devuelve 404 si no existe', async () => {
    const respuesta = await request(app).get(`/api/v1/services/${UUID_INEXISTENTE}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('SERVICE_NOT_FOUND');
  });

  it('devuelve 400 si el id no es un UUID', async () => {
    const respuesta = await request(app).get('/api/v1/services/no-es-uuid');

    expect(respuesta.status).toBe(400);
  });
});

describe('POST /api/v1/services', () => {
  it('el admin crea un servicio', async () => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido());

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.location).toMatch(/^\/api\/v1\/services\//);
    expect(respuesta.body).toMatchObject({ name: 'Afeitado clasico', priceCop: 32000 });
  });

  it('devuelve 401 sin token', async () => {
    const respuesta = await request(app).post('/api/v1/services').send(servicioValido());

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 al barbero: el precio lo decide el negocio', async () => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenBarbero))
      .send(servicioValido());

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('devuelve 409 con un nombre repetido', async () => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'Fade' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('SERVICE_NAME_TAKEN');
  });

  it('el nombre repetido no distingue mayúsculas', async () => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'fAdE' }));

    expect(respuesta.status).toBe(409);
  });

  it.each([
    ['nombre muy corto', { name: 'ab' }],
    ['precio negativo', { priceCop: -1 }],
    ['precio decimal', { priceCop: 25000.5 }],
    ['precio disparatado', { priceCop: 99_000_000 }],
    ['categoría vacía', { category: '' }],
    ['imagen que no es URL', { imageUrl: 'no-es-una-url' }],
  ])('devuelve 400 con %s', async (_caso, override) => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido(override));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('la descripción es opcional y queda como cadena vacía', async () => {
    const { description, ...sinDescripcion } = servicioValido();
    expect(description).toBeDefined();

    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(tokenAdmin))
      .send(sinDescripcion);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.description).toBe('');
  });
});

describe('PUT /api/v1/services/:id', () => {
  async function idDeFade(): Promise<string> {
    const lista = await request(app).get('/api/v1/services');
    const fade = (lista.body as { id: string; name: string }[]).find((s) => s.name === 'Fade');
    return fade!.id;
  }

  it('el admin edita un servicio', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .put(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'Fade premium', priceCop: 38000 }));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ id, name: 'Fade premium', priceCop: 38000 });
  });

  it('editar no crea otro servicio', async () => {
    const id = await idDeFade();
    await request(app)
      .put(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'Fade premium' }))
      .expect(200);

    const lista = await request(app).get('/api/v1/services');
    expect(lista.body).toHaveLength(3);
  });

  it('devuelve 409 si el nombre nuevo ya es de otro', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .put(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'Corte clasico' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('SERVICE_NAME_TAKEN');
  });

  it('conservar su propio nombre no es un conflicto', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .put(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido({ name: 'Fade', priceCop: 31000 }));

    expect(respuesta.status).toBe(200);
  });

  it('devuelve 404 si el servicio no existe', async () => {
    const respuesta = await request(app)
      .put(`/api/v1/services/${UUID_INEXISTENTE}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(servicioValido());

    expect(respuesta.status).toBe(404);
  });

  it('devuelve 403 al barbero', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .put(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenBarbero))
      .send(servicioValido());

    expect(respuesta.status).toBe(403);
  });
});

describe('DELETE /api/v1/services/:id', () => {
  async function idDeFade(): Promise<string> {
    const lista = await request(app).get('/api/v1/services');
    return (lista.body as { id: string; name: string }[]).find((s) => s.name === 'Fade')!.id;
  }

  it('el admin elimina un servicio', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .delete(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(204);

    const lista = await request(app).get('/api/v1/services');
    expect(lista.body).toHaveLength(2);
  });

  it('devuelve 404 al eliminarlo dos veces', async () => {
    const id = await idDeFade();
    await request(app)
      .delete(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin))
      .expect(204);

    const segunda = await request(app)
      .delete(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(segunda.status).toBe(404);
  });

  it('devuelve 403 al barbero', async () => {
    const id = await idDeFade();

    const respuesta = await request(app)
      .delete(`/api/v1/services/${id}`)
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(403);
  });

  it('devuelve 401 sin token', async () => {
    const id = await idDeFade();

    const respuesta = await request(app).delete(`/api/v1/services/${id}`);

    expect(respuesta.status).toBe(401);
  });
});
