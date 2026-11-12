import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { ADMIN, BARBERO, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import { closeDatabase, insertBooking, resetBarbers, resetBookings } from '../helpers/db.js';
import { futureOpenDate } from '../helpers/dates.js';

/**
 * Cuentas de acceso de los barberos.
 *
 * Aquí lo que importa es la seguridad: quién puede crear una cuenta, que una
 * cuenta nueva no pueda pisar otra (sobre todo la del administrador), y que
 * la contraseña no salga nunca en una respuesta.
 *
 * Los tests trabajan sobre barberos creados para la ocasión, no sobre los del
 * seed: las cuentas de aquellos las usa el resto de la suite para iniciar
 * sesión, y cambiarles el usuario rompería archivos que no tienen nada que ver.
 */

const CLAVE = 'clave-segura-2026';

let tokenAdmin: string;
let tokenBarbero: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
  tokenBarbero = await tokenDe(BARBERO);
});

// Borrar un barbero de prueba se lleva su cuenta (ON DELETE CASCADE), así que
// restaurar los barberos deja también las cuentas como estaban.
beforeEach(async () => {
  await resetBookings();
  await resetBarbers();
});

afterAll(async () => {
  await resetBookings();
  await resetBarbers();
  await closeDatabase();
});

/** Crea un barbero nuevo, sin cuenta, y devuelve su id. */
async function crearBarbero(name = 'Camila Ortiz'): Promise<string> {
  const respuesta = await request(app)
    .post('/api/v1/barbers')
    .set('Authorization', bearer(tokenAdmin))
    .send({ name, specialty: 'Colorimetría.', avatar: 'https://i.pravatar.cc/240?img=5' });
  return respuesta.body.id as string;
}

function darAcceso(barberId: string, cuerpo: Record<string, unknown>, token = tokenAdmin) {
  return request(app)
    .put(`/api/v1/barbers/${barberId}/account`)
    .set('Authorization', bearer(token))
    .send(cuerpo);
}

function iniciarSesion(username: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ username, password });
}

describe('PUT /api/v1/barbers/:id/account', () => {
  it('devuelve 401 sin sesión', async () => {
    const id = await crearBarbero();

    const respuesta = await request(app)
      .put(`/api/v1/barbers/${id}/account`)
      .send({ username: 'camila', password: CLAVE });

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 a un barbero: no reparte accesos, ni siquiera el suyo', async () => {
    const respuesta = await darAcceso(
      BARBERO.barberId,
      { username: 'otro-nombre', password: CLAVE },
      tokenBarbero,
    );

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('crea la cuenta y el barbero puede iniciar sesión con ella', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: 'camila', password: CLAVE });
    const login = await iniciarSesion('camila', CLAVE);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ username: 'camila', role: 'barbero', barberId: id });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ role: 'barbero', barberId: id });
  });

  it('la respuesta no lleva la contraseña ni su hash', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: 'camila', password: CLAVE });

    expect(Object.keys(respuesta.body).sort()).toEqual(['barberId', 'id', 'role', 'username']);
    expect(JSON.stringify(respuesta.body)).not.toContain(CLAVE);
  });

  it('la cuenta nueva solo ve la agenda de su barbero', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });
    await insertBooking({ barberId: id, date: futureOpenDate(), time: '10:00' });
    await insertBooking({ barberId: 'luis-gomez', date: futureOpenDate(), time: '11:00' });
    const { body } = await iniciarSesion('camila', CLAVE);

    const agenda = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', bearer(body.token as string));

    expect(agenda.body).toHaveLength(1);
    expect(agenda.body[0].barberId).toBe(id);
  });

  it('normaliza el usuario igual que el login: mayúsculas y espacios no cuentan', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: '  Camila.Ortiz ', password: CLAVE });
    const login = await iniciarSesion('CAMILA.ORTIZ', CLAVE);

    expect(respuesta.body.username).toBe('camila.ortiz');
    expect(login.status).toBe(200);
  });

  it('repetirlo reemplaza usuario y contraseña: la cuenta vieja deja de servir', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });

    const respuesta = await darAcceso(id, { username: 'camila2', password: 'otra-clave-2026' });
    const conLaVieja = await iniciarSesion('camila', CLAVE);
    const conLaNueva = await iniciarSesion('camila2', 'otra-clave-2026');

    expect(respuesta.status).toBe(200);
    expect(conLaVieja.status).toBe(401);
    expect(conLaNueva.status).toBe(200);
  });

  it('un barbero sigue teniendo una sola cuenta después de cambiarla', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });
    await darAcceso(id, { username: 'camila2', password: CLAVE });

    const cuentas = await request(app).get('/api/v1/users').set('Authorization', bearer(tokenAdmin));

    expect((cuentas.body as { barberId: string }[]).filter((c) => c.barberId === id)).toHaveLength(1);
  });

  it('SEGURIDAD: pedir el usuario del administrador devuelve 409 y no toca su cuenta', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: ADMIN.username, password: CLAVE });
    const admin = await iniciarSesion(ADMIN.username, ADMIN.password);
    const intruso = await iniciarSesion(ADMIN.username, CLAVE);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('USERNAME_TAKEN');
    // El administrador entra con SU contraseña y sigue siendo administrador.
    expect(admin.status).toBe(200);
    expect(admin.body.user.role).toBe('admin');
    expect(intruso.status).toBe(401);
  });

  it('devuelve 409 si el usuario ya es de otro barbero, y este conserva el suyo', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: BARBERO.username, password: CLAVE });
    const dueno = await iniciarSesion(BARBERO.username, BARBERO.password);

    expect(respuesta.status).toBe(409);
    expect(dueno.status).toBe(200);
    expect(dueno.body.user.barberId).toBe(BARBERO.barberId);
  });

  it('SEGURIDAD: no se puede crear un administrador mandando el rol', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, {
      username: 'camila',
      password: CLAVE,
      role: 'admin',
      barberId: null,
    });

    expect(respuesta.body.role).toBe('barbero');
    expect(respuesta.body.barberId).toBe(id);
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const respuesta = await darAcceso('no-existe', { username: 'camila', password: CLAVE });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 404 para un barbero dado de baja', async () => {
    const id = await crearBarbero();
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const respuesta = await darAcceso(id, { username: 'camila', password: CLAVE });

    expect(respuesta.status).toBe(404);
  });

  it.each([
    ['una contraseña de menos de 8 caracteres', { username: 'camila', password: '1234567' }],
    ['una contraseña de más de 72 bytes', { username: 'camila', password: 'a'.repeat(73) }],
    ['un usuario de menos de 3 caracteres', { username: 'ca', password: CLAVE }],
    ['un usuario con espacios', { username: 'camila ortiz', password: CLAVE }],
    ['un usuario con símbolos raros', { username: 'camila<script>', password: CLAVE }],
    ['un cuerpo sin contraseña', { username: 'camila' }],
  ])('devuelve 400 con %s', async (_caso, cuerpo) => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('un error de validación no devuelve la contraseña enviada', async () => {
    const id = await crearBarbero();

    const respuesta = await darAcceso(id, { username: 'ca', password: 'secreto-que-no-debe-salir' });

    expect(JSON.stringify(respuesta.body)).not.toContain('secreto-que-no-debe-salir');
  });
});

describe('DELETE /api/v1/barbers/:id/account', () => {
  it('devuelve 401 sin sesión y 403 a un barbero', async () => {
    const sinSesion = await request(app).delete(`/api/v1/barbers/${BARBERO.barberId}/account`);
    const comoBarbero = await request(app)
      .delete(`/api/v1/barbers/${BARBERO.barberId}/account`)
      .set('Authorization', bearer(tokenBarbero));

    expect(sinSesion.status).toBe(401);
    expect(comoBarbero.status).toBe(403);
  });

  it('quita el acceso: la cuenta deja de poder iniciar sesión', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });

    const respuesta = await request(app)
      .delete(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin));
    const login = await iniciarSesion('camila', CLAVE);

    expect(respuesta.status).toBe(204);
    expect(login.status).toBe(401);
  });

  it('quitar el acceso no da de baja al barbero', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });
    await request(app)
      .delete(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin));

    const ficha = await request(app).get(`/api/v1/barbers/${id}`);

    expect(ficha.status).toBe(200);
  });

  it('devuelve 404 si el barbero no tenía cuenta', async () => {
    const id = await crearBarbero();

    const respuesta = await request(app)
      .delete(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const respuesta = await request(app)
      .delete('/api/v1/barbers/no-existe/account')
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.body.error.code).toBe('BARBER_NOT_FOUND');
  });
});

describe('GET /api/v1/users', () => {
  it('devuelve 401 sin sesión y 403 a un barbero', async () => {
    const sinSesion = await request(app).get('/api/v1/users');
    const comoBarbero = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(tokenBarbero));

    expect(sinSesion.status).toBe(401);
    expect(comoBarbero.status).toBe(403);
  });

  it('lista las cuentas con su barbero, sin ningún dato de la contraseña', async () => {
    const respuesta = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(tokenAdmin));

    const cuentas = respuesta.body as Record<string, unknown>[];
    expect(respuesta.status).toBe(200);
    expect(cuentas.map((c) => c.username)).toEqual(
      expect.arrayContaining([ADMIN.username, BARBERO.username]),
    );
    for (const cuenta of cuentas) {
      expect(Object.keys(cuenta).sort()).toEqual(['barberId', 'id', 'role', 'username']);
    }
  });

  it('no lista la cuenta de un barbero dado de baja', async () => {
    const id = await crearBarbero();
    await darAcceso(id, { username: 'camila', password: CLAVE });
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const respuesta = await request(app)
      .get('/api/v1/users')
      .set('Authorization', bearer(tokenAdmin));

    expect((respuesta.body as { username: string }[]).map((c) => c.username)).not.toContain(
      'camila',
    );
  });
});
