import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import {
  ADMIN,
  BARBERO,
  OTRO_BARBERO,
  bearer,
  crearUsuariosDePrueba,
  tokenDe,
} from '../helpers/auth.js';
import { closeDatabase, resetBookings } from '../helpers/db.js';
import { futureOpenDate } from '../helpers/dates.js';

let tokenAdmin: string;
let tokenBarbero: string;
let tokenOtroBarbero: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
  tokenBarbero = await tokenDe(BARBERO);
  tokenOtroBarbero = await tokenDe(OTRO_BARBERO);
});

beforeEach(resetBookings);
afterAll(closeDatabase);

/** Crea una cita para el barbero indicado y devuelve su id. */
async function reservar(barberId: string, time: string): Promise<string> {
  const respuesta = await request(app).post('/api/v1/bookings').send({
    barberId,
    date: futureOpenDate(),
    time,
    customerName: 'Cliente Prueba',
    customerPhone: '3001112233',
  });
  expect(respuesta.status).toBe(201);
  return respuesta.body.id as string;
}

describe('POST /api/v1/auth/login', () => {
  it('devuelve token y usuario con credenciales correctas', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toEqual(expect.any(String));
    expect(respuesta.body.expiresIn).toEqual(expect.any(Number));
    expect(respuesta.body.user).toMatchObject({
      username: ADMIN.username,
      role: 'admin',
      barberId: null,
    });
  });

  it('nunca devuelve el hash de la contraseña', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password });

    expect(JSON.stringify(respuesta.body)).not.toContain('$2');
    expect(respuesta.body.user).not.toHaveProperty('passwordHash');
    expect(respuesta.body.user).not.toHaveProperty('password_hash');
  });

  it('acepta el usuario sin distinguir mayúsculas', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username.toUpperCase(), password: ADMIN.password });

    expect(respuesta.status).toBe(200);
  });

  it('devuelve 401 con la contraseña incorrecta', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: 'no-es-la-clave' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('da el MISMO error si el usuario no existe: no filtra cuáles son válidos', async () => {
    const inexistente = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'no-existe-nadie', password: 'cualquiera' });

    const claveMala = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: 'no-es-la-clave' });

    expect(inexistente.status).toBe(claveMala.status);
    expect(inexistente.body.error.code).toBe(claveMala.body.error.code);
    expect(inexistente.body.error.message).toBe(claveMala.body.error.message);
  });

  it('devuelve 400 si falta la contraseña', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('devuelve la identidad del dueño del token', async () => {
    const respuesta = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      username: BARBERO.username,
      role: 'barbero',
      barberId: BARBERO.barberId,
    });
  });

  it('devuelve 401 sin cabecera Authorization', async () => {
    const respuesta = await request(app).get('/api/v1/auth/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHORIZED');
  });

  it('devuelve 401 si el esquema no es Bearer', async () => {
    const respuesta = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Basic ${tokenAdmin}`);

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 401 con un token manipulado', async () => {
    const manipulado = `${tokenAdmin.slice(0, -4)}aaaa`;

    const respuesta = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(manipulado));

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 401 con un token firmado con otro secreto', async () => {
    // El caso que de verdad importa: alguien fabrica su propio token de admin.
    const falsificado = jwt.sign(
      { sub: 'x', username: 'intruso', role: 'admin', barberId: null },
      'secreto-del-atacante-que-no-es-el-nuestro',
      { expiresIn: 3600 },
    );

    const respuesta = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(falsificado));

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 401 con un token expirado', async () => {
    const expirado = jwt.sign(
      { sub: 'x', username: ADMIN.username, role: 'admin', barberId: null },
      process.env.JWT_SECRET as string,
      { expiresIn: -10 },
    );

    const respuesta = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(expirado));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('GET /api/v1/bookings (agenda)', () => {
  it('devuelve 401 sin token', async () => {
    const respuesta = await request(app).get('/api/v1/bookings');

    expect(respuesta.status).toBe(401);
  });

  it('el admin ve las citas de todos los barberos', async () => {
    await reservar('luis-gomez', '10:00');
    await reservar('alexander-escobar', '11:00');

    const respuesta = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(2);
  });

  it('el barbero solo ve las suyas', async () => {
    await reservar('luis-gomez', '10:00');
    await reservar('alexander-escobar', '11:00');

    const respuesta = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0].barberId).toBe('luis-gomez');
  });

  it('un barbero NO puede espiar otra agenda cambiando el filtro', async () => {
    // El filtro de la interfaz no es seguridad: el servidor ignora el
    // barberId recibido y fuerza el del token.
    await reservar('alexander-escobar', '11:00');

    const respuesta = await request(app)
      .get('/api/v1/bookings')
      .query({ barberId: 'alexander-escobar' })
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });

  it('el admin sí puede filtrar por barbero', async () => {
    await reservar('luis-gomez', '10:00');
    await reservar('alexander-escobar', '11:00');

    const respuesta = await request(app)
      .get('/api/v1/bookings')
      .query({ barberId: 'alexander-escobar' })
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.body).toHaveLength(1);
    expect(respuesta.body[0].barberId).toBe('alexander-escobar');
  });

  it('devuelve 400 si la fecha del filtro está mal formada', async () => {
    const respuesta = await request(app)
      .get('/api/v1/bookings')
      .query({ date: '14-07-2026' })
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(400);
  });
});

describe('DELETE /api/v1/bookings/:id con roles', () => {
  it('devuelve 401 sin token', async () => {
    const id = await reservar('luis-gomez', '10:00');

    const respuesta = await request(app).delete(`/api/v1/bookings/${id}`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHORIZED');
  });

  it('el admin cancela cualquier cita', async () => {
    const id = await reservar('alexander-escobar', '11:00');

    const respuesta = await request(app)
      .delete(`/api/v1/bookings/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(204);
  });

  it('el barbero cancela las suyas', async () => {
    const id = await reservar('luis-gomez', '10:00');

    const respuesta = await request(app)
      .delete(`/api/v1/bookings/${id}`)
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(204);
  });

  it('devuelve 403 si el barbero intenta cancelar una cita ajena', async () => {
    const id = await reservar('luis-gomez', '10:00');

    const respuesta = await request(app)
      .delete(`/api/v1/bookings/${id}`)
      .set('Authorization', bearer(tokenOtroBarbero));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('403 y no 404: la cita existe, lo que falta es permiso', async () => {
    const id = await reservar('luis-gomez', '10:00');

    await request(app)
      .delete(`/api/v1/bookings/${id}`)
      .set('Authorization', bearer(tokenOtroBarbero))
      .expect(403);

    // Y sigue viva: el intento fallido no la tocó.
    const consulta = await request(app).get(`/api/v1/bookings/${id}`);
    expect(consulta.body.status).toBe('activa');
  });
});
