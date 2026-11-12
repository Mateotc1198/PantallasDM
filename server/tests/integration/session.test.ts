import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { ADMIN, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import { closeDatabase, resetBarbers, resetBookings } from '../helpers/db.js';

/**
 * Una sesión abierta no sobrevive a los cambios de su cuenta.
 *
 * Antes la identidad salía solo del token: después de quitarle el acceso a un
 * barbero, darlo de baja o cambiarle la contraseña, su sesión seguía valiendo
 * hasta 8 horas. Cada test de aquí era un 200 antes del arreglo.
 *
 * Trabajan sobre barberos creados para la ocasión: las cuentas del seed las
 * usan otros archivos para iniciar sesión.
 */

const CLAVE = 'clave-segura-2026';

let tokenAdmin: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
});

beforeEach(async () => {
  await resetBookings();
  await resetBarbers();
});

afterAll(async () => {
  await resetBookings();
  await resetBarbers();
  await closeDatabase();
});

/** Crea un barbero con su cuenta e inicia sesión con ella. */
async function barberoConSesion(): Promise<{ id: string; token: string }> {
  const creado = await request(app)
    .post('/api/v1/barbers')
    .set('Authorization', bearer(tokenAdmin))
    .send({ name: 'Camila Ortiz', specialty: 'Colorimetría.', avatar: 'https://i.pravatar.cc/240?img=5' });
  const id = creado.body.id as string;

  await request(app)
    .put(`/api/v1/barbers/${id}/account`)
    .set('Authorization', bearer(tokenAdmin))
    .send({ username: 'camila', password: CLAVE });

  return { id, token: await tokenDe({ username: 'camila', password: CLAVE }) };
}

/** Una petición cualquiera del panel con ese token. */
function agenda(token: string) {
  return request(app).get('/api/v1/bookings').set('Authorization', bearer(token));
}

describe('la sesión se comprueba contra la base en cada petición', () => {
  it('una sesión vigente funciona', async () => {
    const { token } = await barberoConSesion();

    const respuesta = await agenda(token);

    expect(respuesta.status).toBe(200);
  });

  it('quitarle el acceso cierra la sesión que tenía abierta', async () => {
    const { id, token } = await barberoConSesion();

    await request(app)
      .delete(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin));
    const respuesta = await agenda(token);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('SESSION_REVOKED');
  });

  it('darlo de baja cierra su sesión', async () => {
    const { id, token } = await barberoConSesion();

    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));
    const respuesta = await agenda(token);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('SESSION_REVOKED');
  });

  it('cambiarle la contraseña cierra la sesión vieja, y la nueva clave sí entra', async () => {
    const { id, token } = await barberoConSesion();

    await request(app)
      .put(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin))
      .send({ username: 'camila', password: 'otra-clave-2026' });
    const conLaVieja = await agenda(token);
    const tokenNuevo = await tokenDe({ username: 'camila', password: 'otra-clave-2026' });
    const conLaNueva = await agenda(tokenNuevo);

    expect(conLaVieja.status).toBe(401);
    expect(conLaVieja.body.error.code).toBe('SESSION_REVOKED');
    expect(conLaNueva.status).toBe(200);
  });

  it('una sesión cerrada tampoco puede escribir: no cancela citas', async () => {
    const { id, token } = await barberoConSesion();
    await request(app)
      .delete(`/api/v1/barbers/${id}/account`)
      .set('Authorization', bearer(tokenAdmin));

    const respuesta = await request(app)
      .delete('/api/v1/bookings/11111111-2222-4333-8444-555555555555')
      .set('Authorization', bearer(token));

    expect(respuesta.status).toBe(401);
  });

  it('lo que le pasa a un barbero no toca la sesión del administrador', async () => {
    const { id } = await barberoConSesion();
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const respuesta = await agenda(tokenAdmin);

    expect(respuesta.status).toBe(200);
  });

  it('/auth/me devuelve la identidad que hay en la base', async () => {
    const { id, token } = await barberoConSesion();

    const respuesta = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(token));

    expect(respuesta.body).toMatchObject({ username: 'camila', role: 'barbero', barberId: id });
  });
});

describe('tokens auténticos que ya no valen', () => {
  /** Firma un token con el secreto real, como lo haría el servidor. */
  function firmar(payload: Record<string, unknown>): string {
    return jwt.sign(payload, env.jwtSecret, { expiresIn: 3600 });
  }

  it('un token del formato anterior, sin versión de sesión, se rechaza', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password });
    const antiguo = firmar({
      sub: login.body.user.id,
      username: ADMIN.username,
      role: 'admin',
      barberId: null,
    });

    const respuesta = await agenda(antiguo);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('SESSION_REVOKED');
  });

  it('un token de una cuenta que no existe se rechaza aunque la firma sea buena', async () => {
    const huerfano = firmar({
      sub: '11111111-2222-4333-8444-555555555555',
      username: 'fantasma',
      role: 'admin',
      barberId: null,
      sv: 0,
    });

    const respuesta = await agenda(huerfano);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('SESSION_REVOKED');
  });

  it('SEGURIDAD: el rol sale de la base, no del token', async () => {
    // Un token auténtico de barbero al que alguien le cambiara el rol: con la
    // firma rota no llega aquí, pero aunque llegara, manda la base.
    const { token } = await barberoConSesion();
    // Sin exp ni iat: firmar() pone los suyos.
    const datos = { ...(jwt.decode(token) as Record<string, unknown>) };
    delete datos.exp;
    delete datos.iat;
    const ascendido = firmar({ ...datos, role: 'admin', barberId: null });

    const respuesta = await request(app)
      .post('/api/v1/services')
      .set('Authorization', bearer(ascendido))
      .send({ name: 'Servicio intruso', priceCop: 1000, category: 'Cortes' });

    expect(respuesta.status).toBe(403);
  });
});
