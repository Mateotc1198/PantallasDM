import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { ADMIN, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import { closeDatabase, insertBooking, resetBookings } from '../helpers/db.js';
import { futureOpenDate, futureSunday, pastDate } from '../helpers/dates.js';

const UUID_INEXISTENTE = '11111111-2222-4333-8444-555555555555';

interface BookingPayload {
  barberId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
}

function validPayload(overrides: Partial<BookingPayload> = {}): BookingPayload {
  return {
    barberId: 'luis-gomez',
    date: futureOpenDate(),
    time: '10:30',
    customerName: 'Mateo Torres',
    customerPhone: '3001112233',
    ...overrides,
  };
}

/** Cancelar dejó de ser público: estos tests necesitan una sesión de admin. */
let tokenAdmin: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
});

beforeEach(resetBookings);
afterAll(closeDatabase);

describe('POST /api/v1/bookings', () => {
  it('crea la cita y devuelve 201 con la cabecera Location', async () => {
    const response = await request(app).post('/api/v1/bookings').send(validPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/v1/bookings/${response.body.id}`);
    expect(response.body).toMatchObject({
      barberId: 'luis-gomez',
      time: '10:30',
      customerName: 'Mateo Torres',
      status: 'activa',
    });
  });

  it('recorta los espacios del nombre antes de guardarlo', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ customerName: '   Mateo Torres   ' }));

    expect(response.status).toBe(201);
    expect(response.body.customerName).toBe('Mateo Torres');
  });

  it('devuelve 409 si el horario ya está reservado', async () => {
    const payload = validPayload();
    await request(app).post('/api/v1/bookings').send(payload);

    const response = await request(app)
      .post('/api/v1/bookings')
      .send({ ...payload, customerName: 'Otra Persona', customerPhone: '3009998877' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BOOKING_SLOT_TAKEN');
  });

  it('devuelve 400 si el teléfono no tiene 10 dígitos', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ customerPhone: '300111' }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('customerPhone');
  });

  it('devuelve 400 si el nombre tiene menos de 3 caracteres', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ customerName: 'Ab' }));

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].field).toBe('customerName');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ barberId: 'no-existe' }));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 422 si la fecha ya pasó', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ date: pastDate() }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DATE_IN_PAST');
  });

  it('devuelve 422 si el barbero no atiende ese día', async () => {
    // alexander-escobar descansa los domingos; luis-gomez no.
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ barberId: 'alexander-escobar', date: futureSunday() }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('BARBER_CLOSED_THAT_DAY');
  });

  it('devuelve 422 si la hora no cae en una franja real', async () => {
    // 09:17 está dentro del horario pero no es un bloque de 30 minutos.
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ time: '09:17' }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TIME_NOT_IN_SCHEDULE');
  });

  it('devuelve 422 si la hora está fuera del horario de atención', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ time: '21:00' }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TIME_NOT_IN_SCHEDULE');
  });

  it('devuelve 400 si la hora está mal formada', async () => {
    const response = await request(app)
      .post('/api/v1/bookings')
      .send(validPayload({ time: '25:00' }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/bookings/:id', () => {
  it('devuelve 200 con la cita creada', async () => {
    const created = await request(app).post('/api/v1/bookings').send(validPayload());

    const response = await request(app).get(`/api/v1/bookings/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(created.body.id);
    expect(response.body.status).toBe('activa');
  });

  it('devuelve 404 si la cita no existe', async () => {
    const response = await request(app).get(`/api/v1/bookings/${UUID_INEXISTENTE}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('devuelve 400 si el id no es un UUID', async () => {
    const response = await request(app).get('/api/v1/bookings/abc');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/v1/bookings/:id', () => {
  it('devuelve 204 sin cuerpo', async () => {
    const created = await request(app).post('/api/v1/bookings').send(validPayload());

    const response = await request(app).delete(`/api/v1/bookings/${created.body.id}`).set('Authorization', bearer(tokenAdmin));

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });

  it('deja la cita en estado cancelada', async () => {
    const created = await request(app).post('/api/v1/bookings').send(validPayload());
    await request(app).delete(`/api/v1/bookings/${created.body.id}`).set('Authorization', bearer(tokenAdmin));

    const response = await request(app).get(`/api/v1/bookings/${created.body.id}`);

    expect(response.body.status).toBe('cancelada');
  });

  it('devuelve 409 al cancelar dos veces', async () => {
    const created = await request(app).post('/api/v1/bookings').send(validPayload());
    await request(app).delete(`/api/v1/bookings/${created.body.id}`).set('Authorization', bearer(tokenAdmin));

    const response = await request(app).delete(`/api/v1/bookings/${created.body.id}`).set('Authorization', bearer(tokenAdmin));

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
  });

  it('devuelve 404 si la cita no existe', async () => {
    const response = await request(app).delete(`/api/v1/bookings/${UUID_INEXISTENTE}`).set('Authorization', bearer(tokenAdmin));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('libera la franja: el índice único es parcial sobre status activa', async () => {
    const payload = validPayload();
    const created = await request(app).post('/api/v1/bookings').send(payload);
    await request(app).delete(`/api/v1/bookings/${created.body.id}`).set('Authorization', bearer(tokenAdmin));

    const response = await request(app).post('/api/v1/bookings').send(payload);

    expect(response.status).toBe(201);
  });
});

describe('POST /api/v1/bookings/:id/cancel', () => {
  const TELEFONO = '3001112233';

  async function reservar(): Promise<string> {
    const respuesta = await request(app).post('/api/v1/bookings').send(validPayload());
    expect(respuesta.status).toBe(201);
    return respuesta.body.id as string;
  }

  it('el cliente cancela su cita con el teléfono correcto', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: TELEFONO });

    expect(respuesta.status).toBe(204);
  });

  it('cancelar libera el horario', async () => {
    const id = await reservar();
    await request(app).post(`/api/v1/bookings/${id}/cancel`).send({ customerPhone: TELEFONO });

    // La prueba de que quedó libre: se puede volver a reservar.
    const segunda = await request(app).post('/api/v1/bookings').send(validPayload());
    expect(segunda.status).toBe(201);
  });

  it('devuelve 403 si el teléfono no es el de la cita', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: '3009998877' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('BOOKING_PHONE_MISMATCH');
  });

  it('sigue activa tras un intento con el teléfono equivocado', async () => {
    const id = await reservar();
    await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: '3009998877' })
      .expect(403);

    const consulta = await request(app).get(`/api/v1/bookings/${id}`);
    expect(consulta.body.status).toBe('activa');
  });

  it('devuelve 422 si la cita está fuera del plazo de cambios', async () => {
    // Una cita de una fecha pasada se inserta por SQL: la API no deja
    // crearla, que es precisamente el comportamiento correcto.
    const id = await insertBooking({
      barberId: 'luis-gomez',
      date: pastDate(),
      time: '10:00',
      customerPhone: TELEFONO,
    });

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: TELEFONO });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BOOKING_CHANGE_TOO_LATE');
  });

  it('comprueba el teléfono ANTES que el plazo: no filtra citas ajenas', async () => {
    const id = await insertBooking({
      barberId: 'luis-gomez',
      date: pastDate(),
      time: '10:00',
      customerPhone: TELEFONO,
    });

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: '3009998877' });

    expect(respuesta.status).toBe(403);
  });

  it('devuelve 409 al cancelar dos veces', async () => {
    const id = await reservar();
    await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: TELEFONO })
      .expect(204);

    const segunda = await request(app)
      .post(`/api/v1/bookings/${id}/cancel`)
      .send({ customerPhone: TELEFONO });

    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('BOOKING_ALREADY_CANCELLED');
  });

  it('devuelve 404 si la cita no existe', async () => {
    const respuesta = await request(app)
      .post(`/api/v1/bookings/${UUID_INEXISTENTE}/cancel`)
      .send({ customerPhone: TELEFONO });

    expect(respuesta.status).toBe(404);
  });

  it('devuelve 400 si falta el teléfono', async () => {
    const id = await reservar();

    const respuesta = await request(app).post(`/api/v1/bookings/${id}/cancel`).send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/bookings/:id/reschedule', () => {
  const TELEFONO = '3001112233';

  async function reservar(): Promise<string> {
    const respuesta = await request(app).post('/api/v1/bookings').send(validPayload());
    expect(respuesta.status).toBe(201);
    return respuesta.body.id as string;
  }

  it('mueve la cita a otra hora del mismo día', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '15:00' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ id, time: '15:00', status: 'activa' });
  });

  it('el horario viejo queda libre y el nuevo ocupado', async () => {
    const id = await reservar();
    await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '15:00' })
      .expect(200);

    const franjas = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date: futureOpenDate() });

    const porHora = new Map(
      (franjas.body as { time: string; status: string }[]).map((f) => [f.time, f.status]),
    );
    expect(porHora.get('10:30')).toBe('libre');
    expect(porHora.get('15:00')).toBe('ocupado');
  });

  it('conserva el id: aplazar no crea una cita nueva', async () => {
    const id = await reservar();
    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '16:00' });

    expect(respuesta.body.id).toBe(id);
  });

  it('devuelve 409 si la franja de destino ya está ocupada', async () => {
    const id = await reservar();
    await insertBooking({ barberId: 'luis-gomez', date: futureOpenDate(), time: '15:00' });

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '15:00' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BOOKING_SLOT_TAKEN');
  });

  it('devuelve 403 con el teléfono equivocado', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: '3009998877', date: futureOpenDate(), time: '15:00' });

    expect(respuesta.status).toBe(403);
  });

  it('el destino pasa las mismas reglas que una reserva nueva', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '09:17' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('TIME_NOT_IN_SCHEDULE');
  });

  it('no se puede aplazar al pasado', async () => {
    const id = await reservar();

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: pastDate(), time: '10:00' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('DATE_IN_PAST');
  });

  it('devuelve 422 si la cita original está fuera del plazo', async () => {
    const id = await insertBooking({
      barberId: 'luis-gomez',
      date: pastDate(),
      time: '10:00',
      customerPhone: TELEFONO,
    });

    const respuesta = await request(app)
      .post(`/api/v1/bookings/${id}/reschedule`)
      .send({ customerPhone: TELEFONO, date: futureOpenDate(), time: '15:00' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BOOKING_CHANGE_TOO_LATE');
  });
});
