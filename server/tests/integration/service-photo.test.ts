import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { ADMIN, BARBERO, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import { closeDatabase, resetServices } from '../helpers/db.js';

/**
 * La imagen de un servicio subida desde la galería.
 *
 * Mismo recorrido que la foto de los barberos, más lo que es propio del
 * catálogo: la imagen es opcional, así que hay que poder crear un servicio
 * sin ella y quitársela después.
 */

/** Un PNG de 1x1 píxel completo y válido. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Bytes que empiezan como un JPEG: suficiente para el servidor, que no la redibuja. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString(
  'base64',
);

let tokenAdmin: string;
let tokenBarbero: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
  tokenBarbero = await tokenDe(BARBERO);
});

// resetServices borra los servicios, y con ellos sus imágenes (CASCADE).
beforeEach(resetServices);
afterAll(closeDatabase);

const BASE = { name: 'Afeitado clasico', description: 'Navaja.', priceCop: 32000, category: 'Barba' };

function crear(extra: Record<string, unknown> = {}, token = tokenAdmin) {
  return request(app)
    .post('/api/v1/services')
    .set('Authorization', bearer(token))
    .send({ ...BASE, ...extra });
}

function editar(id: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .put(`/api/v1/services/${id}`)
    .set('Authorization', bearer(tokenAdmin))
    .send({ ...BASE, ...extra });
}

/**
 * La ruta de la imagen, sin el dominio que le pone la respuesta: el dominio
 * sale de cada petición y supertest usa un puerto distinto en cada una.
 */
function rutaDe(url: string): string {
  const { pathname, search } = new URL(url);
  return pathname + search;
}

async function crearConImagen(): Promise<{ id: string; imageUrl: string }> {
  const { body } = await crear({ photo: PNG });
  return { id: body.id as string, imageUrl: body.imageUrl as string };
}

describe('crear un servicio', () => {
  it('con imagen de la galería: la guarda y la sirve como imagen', async () => {
    const { body, status } = await crear({ photo: PNG });
    const imagen = await request(app).get(rutaDe(body.imageUrl as string));

    expect(status).toBe(201);
    expect(body.imageUrl).toMatch(/^http:\/\/[^/]+\/api\/v1\/services\/[0-9a-f-]{36}\/photo\?v=\d+$/);
    expect(body.imageUrl).toContain(body.id as string);
    expect(imagen.status).toBe(200);
    expect(imagen.headers['content-type']).toBe('image/png');
    expect(imagen.headers['cache-control']).toContain('immutable');
    expect(imagen.headers['x-content-type-options']).toBe('nosniff');
  });

  it('el formato se lee de los bytes: un JPEG se sirve como JPEG', async () => {
    const { body } = await crear({ photo: JPEG });

    const imagen = await request(app).get(rutaDe(body.imageUrl as string));

    expect(imagen.headers['content-type']).toBe('image/jpeg');
  });

  it('el catálogo público la muestra, sin sesión', async () => {
    const { id } = await crearConImagen();

    const catalogo = await request(app).get('/api/v1/services');
    const servicio = (catalogo.body as { id: string; imageUrl: string | null }[]).find(
      (s) => s.id === id,
    );

    expect(servicio?.imageUrl).toMatch(/\/api\/v1\/services\/.+\/photo\?v=\d+$/);
  });

  it('sin imagen sigue siendo válido: la imagen de un servicio es opcional', async () => {
    const { body, status } = await crear();

    expect(status).toBe(201);
    expect(body.imageUrl).toBeNull();
  });

  it('con una URL https la guarda tal cual', async () => {
    const { body } = await crear({ imageUrl: 'https://ejemplo.com/afeitado.jpg' });

    expect(body.imageUrl).toBe('https://ejemplo.com/afeitado.jpg');
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['http sin cifrar', 'http://ejemplo.com/afeitado.jpg'],
  ])('SEGURIDAD: rechaza una URL %s, que antes se aceptaba', async (_caso, url) => {
    const respuesta = await crear({ imageUrl: url });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('SEGURIDAD: rechaza un SVG aunque llegue en base64 válido', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    const respuesta = await crear({ photo: svg.toString('base64') });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].issue).toBe('no es una imagen JPEG ni PNG');
  });

  it('una imagen inválida no crea el servicio', async () => {
    await crear({ photo: 'esto no es una imagen' });

    const catalogo = await request(app).get('/api/v1/services');

    expect((catalogo.body as { name: string }[]).map((s) => s.name)).not.toContain(BASE.name);
  });

  it('devuelve 400 con imagen y URL a la vez', async () => {
    const respuesta = await crear({ photo: PNG, imageUrl: 'https://ejemplo.com/a.jpg' });

    expect(respuesta.status).toBe(400);
  });

  it('devuelve 403 a un barbero', async () => {
    const respuesta = await crear({ photo: PNG }, tokenBarbero);

    expect(respuesta.status).toBe(403);
  });

  it('SEGURIDAD: sin sesión responde 401 sin llegar a leer un cuerpo grande', async () => {
    const respuesta = await request(app)
      .post('/api/v1/services')
      .send({ ...BASE, description: 'x'.repeat(20 * 1024) });

    expect(respuesta.status).toBe(401);
  });
});

describe('editar la imagen de un servicio', () => {
  it('sin imagen ni URL en el cuerpo, conserva la que tenía', async () => {
    const antes = await crearConImagen();

    const respuesta = await editar(antes.id, { priceCop: 35000 });
    const imagen = await request(app).get(rutaDe(respuesta.body.imageUrl as string));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.priceCop).toBe(35000);
    expect(rutaDe(respuesta.body.imageUrl as string)).toBe(rutaDe(antes.imageUrl));
    expect(imagen.status).toBe(200);
  });

  it('con imageUrl en null la quita, y la imagen deja de servirse', async () => {
    const antes = await crearConImagen();

    const respuesta = await editar(antes.id, { imageUrl: null });
    const imagen = await request(app).get(rutaDe(antes.imageUrl));

    expect(respuesta.body.imageUrl).toBeNull();
    expect(imagen.status).toBe(404);
    expect(imagen.body.error.code).toBe('SERVICE_PHOTO_NOT_FOUND');
  });

  it('una imagen nueva reemplaza la anterior, y la URL cambia para saltarse la caché', async () => {
    const antes = await crearConImagen();
    // El parámetro v sale de la hora: se espera un instante para que cambie.
    await new Promise((resolver) => setTimeout(resolver, 5));

    const respuesta = await editar(antes.id, { photo: JPEG });
    const imagen = await request(app).get(rutaDe(respuesta.body.imageUrl as string));

    expect(rutaDe(respuesta.body.imageUrl as string)).not.toBe(rutaDe(antes.imageUrl));
    expect(imagen.headers['content-type']).toBe('image/jpeg');
  });

  it('pasar a una URL externa borra la imagen subida', async () => {
    const antes = await crearConImagen();

    const respuesta = await editar(antes.id, { imageUrl: 'https://ejemplo.com/otra.jpg' });
    const vieja = await request(app).get(rutaDe(antes.imageUrl));

    expect(respuesta.body.imageUrl).toBe('https://ejemplo.com/otra.jpg');
    expect(vieja.status).toBe(404);
  });

  it('COMPATIBILIDAD: reenviar la URL de su propia imagen (como la app anterior) no la borra', async () => {
    const antes = await crearConImagen();
    const reenviada = `https://pantallasdm-api.onrender.com${rutaDe(antes.imageUrl)}`;

    const respuesta = await editar(antes.id, { imageUrl: reenviada });
    const imagen = await request(app).get(rutaDe(antes.imageUrl));

    expect(rutaDe(respuesta.body.imageUrl as string)).toBe(rutaDe(antes.imageUrl));
    expect(imagen.status).toBe(200);
  });

  it('se puede subir imagen a un servicio que no tenía', async () => {
    const { body } = await crear();

    const respuesta = await editar(body.id as string, { photo: PNG });
    const imagen = await request(app).get(rutaDe(respuesta.body.imageUrl as string));

    expect(imagen.status).toBe(200);
  });
});

describe('GET /api/v1/services/:id/photo', () => {
  it('devuelve 404 si el servicio no tiene imagen subida', async () => {
    const { body } = await crear();

    const respuesta = await request(app).get(`/api/v1/services/${body.id as string}/photo`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('SERVICE_PHOTO_NOT_FOUND');
  });

  it('devuelve 400 si el id no es un UUID', async () => {
    const respuesta = await request(app).get('/api/v1/services/no-es-uuid/photo');

    expect(respuesta.status).toBe(400);
  });

  it('eliminar el servicio se lleva su imagen', async () => {
    const { id, imageUrl } = await crearConImagen();
    await request(app).delete(`/api/v1/services/${id}`).set('Authorization', bearer(tokenAdmin));

    const imagen = await request(app).get(rutaDe(imageUrl));

    expect(imagen.status).toBe(404);
  });
});
