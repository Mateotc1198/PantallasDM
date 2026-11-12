import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import {
  ADMIN,
  BARBERO,
  bearer,
  crearUsuariosDePrueba,
  OTRO_BARBERO,
  tokenDe,
} from '../helpers/auth.js';
import { closeDatabase, insertBooking, resetBookings } from '../helpers/db.js';
import { futureOpenDate, pastDate } from '../helpers/dates.js';

/**
 * Cómo terminó una cita: atendida, o el cliente no vino.
 *
 * Las reglas que importan: solo el panel lo marca, el barbero solo en sus
 * citas, solo cuando ya llegó la hora, y una cita cerrada ya no se puede
 * cancelar ni aplazar.
 */

const UUID_INEXISTENTE = '11111111-2222-4333-8444-555555555555';
const TELEFONO = '3004445566';

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

/** Una cita que ya pasó, de luis-gomez (el barbero de prueba). */
function citaPasada(): Promise<string> {
  return insertBooking({
    barberId: BARBERO.barberId,
    date: pastDate(),
    time: '10:00',
    customerPhone: TELEFONO,
  });
}

function marcar(id: string, status: string, token = tokenAdmin) {
  return request(app)
    .put(`/api/v1/bookings/${id}/status`)
    .set('Authorization', bearer(token))
    .send({ status });
}

describe('PUT /api/v1/bookings/:id/status', () => {
  it('devuelve 401 sin sesión: el cliente no marca su propia cita', async () => {
    const id = await citaPasada();

    const respuesta = await request(app)
      .put(`/api/v1/bookings/${id}/status`)
      .send({ status: 'atendida' });

    expect(respuesta.status).toBe(401);
  });

  it('el barbero marca como atendida una cita suya que ya pasó', async () => {
    const id = await citaPasada();

    const respuesta = await marcar(id, 'atendida', tokenBarbero);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ id, status: 'atendida' });
  });

  it('marca que el cliente no vino', async () => {
    const id = await citaPasada();

    const respuesta = await marcar(id, 'no_asistio');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('no_asistio');
  });

  it('el administrador marca la cita de cualquier barbero', async () => {
    const id = await insertBooking({
      barberId: OTRO_BARBERO.barberId,
      date: pastDate(),
      time: '11:00',
    });

    const respuesta = await marcar(id, 'atendida', tokenAdmin);

    expect(respuesta.status).toBe(200);
  });

  it('devuelve 403 a un barbero que intenta marcar una cita ajena, y no la toca', async () => {
    const id = await citaPasada();

    const respuesta = await marcar(id, 'atendida', tokenOtroBarbero);
    const cita = await request(app).get(`/api/v1/bookings/${id}`);

    expect(respuesta.status).toBe(403);
    expect(cita.body.status).toBe('activa');
  });

  it('devuelve 422 si todavía no es la hora de la cita', async () => {
    const id = await insertBooking({
      barberId: BARBERO.barberId,
      date: futureOpenDate(),
      time: '10:00',
    });

    const respuesta = await marcar(id, 'atendida');
    const cita = await request(app).get(`/api/v1/bookings/${id}`);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BOOKING_NOT_STARTED');
    expect(cita.body.status).toBe('activa');
  });

  it('devuelve 409 si la cita está cancelada', async () => {
    const id = await citaPasada();
    await request(app).delete(`/api/v1/bookings/${id}`).set('Authorization', bearer(tokenAdmin));

    const respuesta = await marcar(id, 'atendida');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
  });

  it('se puede corregir: de atendida a no asistida y de vuelta', async () => {
    const id = await citaPasada();
    await marcar(id, 'atendida');

    const corregida = await marcar(id, 'no_asistio');
    const deVuelta = await marcar(id, 'atendida');

    expect(corregida.body.status).toBe('no_asistio');
    expect(deVuelta.body.status).toBe('atendida');
  });

  it('marcar dos veces lo mismo es idempotente', async () => {
    const id = await citaPasada();
    await marcar(id, 'atendida');

    const otraVez = await marcar(id, 'atendida');

    expect(otraVez.status).toBe(200);
    expect(otraVez.body.status).toBe('atendida');
  });

  it.each([
    ['volver a "activa"', 'activa'],
    ['"cancelada": cancelar tiene su propia ruta', 'cancelada'],
    ['un estado inventado', 'pagada'],
  ])('devuelve 400 al intentar %s', async (_caso, status) => {
    const id = await citaPasada();

    const respuesta = await marcar(id, status);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 404 si la cita no existe', async () => {
    const respuesta = await marcar(UUID_INEXISTENTE, 'atendida');

    expect(respuesta.status).toBe(404);
  });

  it('el cliente ve el estado en su cita', async () => {
    const id = await citaPasada();
    await marcar(id, 'atendida');

    const cita = await request(app).get(`/api/v1/bookings/${id}`);

    expect(cita.body.status).toBe('atendida');
  });
});

describe('una cita cerrada ya no se puede cambiar', () => {
  async function citaAtendida(): Promise<string> {
    const id = await citaPasada();
    await marcar(id, 'atendida');
    return id;
  }

  it('el panel no la puede cancelar', async () => {
    const id = await citaAtendida();

    const respuesta = await request(app)
      .delete(`/api/v1/bookings/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BOOKING_ALREADY_CLOSED');
  });

  it('el cliente no la puede cancelar', async () => {
    const id = await citaAtendida();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: TELEFONO });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BOOKING_ALREADY_CLOSED');
  });

  it('el cliente no la puede aplazar', async () => {
    const id = await citaAtendida();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '15:00' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BOOKING_ALREADY_CLOSED');
  });

  it('con el teléfono equivocado sigue respondiendo 403, sin revelar el estado', async () => {
    const id = await citaAtendida();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: '3009999999' });

    expect(respuesta.status).toBe(403);
  });
});

describe('la agenda con citas cerradas', () => {
  it('muestra las atendidas y las no asistidas con su estado, pero no las canceladas', async () => {
    const fecha = pastDate();
    const atendida = await insertBooking({ barberId: BARBERO.barberId, date: fecha, time: '09:00' });
    const noVino = await insertBooking({ barberId: BARBERO.barberId, date: fecha, time: '10:00' });
    const cancelada = await insertBooking({ barberId: BARBERO.barberId, date: fecha, time: '11:00' });
    const pendiente = await insertBooking({ barberId: BARBERO.barberId, date: fecha, time: '12:00' });
    await marcar(atendida, 'atendida');
    await marcar(noVino, 'no_asistio');
    await request(app)
      .delete(`/api/v1/bookings/${cancelada}`)
      .set('Authorization', bearer(tokenAdmin));

    const agenda = await request(app)
      .get('/api/v1/bookings')
      .query({ date: fecha })
      .set('Authorization', bearer(tokenAdmin));

    const estados = (agenda.body as { id: string; status: string }[]).map((c) => [c.id, c.status]);
    expect(estados).toEqual([
      [atendida, 'atendida'],
      [noVino, 'no_asistio'],
      [pendiente, 'activa'],
    ]);
  });
});
