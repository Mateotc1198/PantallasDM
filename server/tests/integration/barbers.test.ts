import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { weekdayOf } from '../../src/utils/time.js';
import { closeDatabase, fillDay, resetBarbers, resetBookings } from '../helpers/db.js';
import {
  futureMonth,
  futureOpenDate,
  futureSunday,
  openDayInFutureMonth,
  pastDate,
  pastMonth,
} from '../helpers/dates.js';

/**
 * Tests de integración de barberos y disponibilidad.
 *
 * Van contra la app completa (rutas + servicios + base de datos real), que es
 * donde de verdad se comprueba que el código HTTP y la forma de la respuesta
 * son los correctos.
 */

/**
 * Estos tests cuentan barberos ("hay dos"), así que parten de los del seed
 * en vez de fiarse de que el archivo anterior limpiara lo suyo. Si a ese
 * archivo lo interrumpen a mitad (en Windows pasa de vez en cuando con los
 * procesos de prueba), su afterAll no llega a ejecutarse.
 */
beforeAll(resetBarbers);
beforeEach(resetBookings);
afterAll(closeDatabase);

describe('GET /api/v1/barbers', () => {
  it('devuelve 200 con la lista de barberos', async () => {
    const response = await request(app).get('/api/v1/barbers');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      specialty: expect.any(String),
      rating: expect.any(Number),
      reviewsCount: expect.any(Number),
    });
  });

  it('no arrastra las reseñas en la colección', () => {
    // La lista es un resumen: las reseñas solo llegan en el detalle.
    return request(app)
      .get('/api/v1/barbers')
      .expect(200)
      .then((response) => {
        expect(response.body[0]).not.toHaveProperty('reviews');
      });
  });
});

describe('GET /api/v1/barbers/:id', () => {
  it('devuelve 200 con el detalle y sus reseñas', async () => {
    const response = await request(app).get('/api/v1/barbers/luis-gomez');

    expect(response.status).toBe(200);
    expect(response.body.id).toBe('luis-gomez');
    expect(response.body.reviews).toHaveLength(2);
    expect(response.body.reviewsCount).toBe(2);
    expect(response.body.rating).toBe(5);
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const response = await request(app).get('/api/v1/barbers/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BARBER_NOT_FOUND');
  });
});

describe('GET /api/v1/barbers/:id/slots', () => {
  it('devuelve 400 si falta el parámetro date', async () => {
    const response = await request(app).get('/api/v1/barbers/luis-gomez/slots');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('date');
  });

  it('devuelve 400 si la fecha está mal formada', async () => {
    const response = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date: '14-07-2026' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 400 si la fecha tiene formato válido pero no existe', async () => {
    const response = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date: '2026-02-31' });

    expect(response.status).toBe(400);
  });

  it('devuelve 422 si la fecha ya pasó', async () => {
    const response = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date: pastDate() });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DATE_IN_PAST');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const response = await request(app)
      .get('/api/v1/barbers/no-existe/slots')
      .query({ date: futureOpenDate() });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 200 con lista vacía el día que el barbero no atiende', async () => {
    // Un día cerrado no es un error: es una pregunta válida sin resultados.
    // El domingo lo descansa alexander-escobar, no la barbería entera.
    const response = await request(app)
      .get('/api/v1/barbers/alexander-escobar/slots')
      .query({ date: futureSunday() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('devuelve las 24 franjas de un día hábil, todas libres', async () => {
    const response = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date: futureOpenDate() });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(24);
    expect(response.body[0].time).toBe('09:00');
    // La última franja reservable, no la hora de cierre: esa cita acaba a las 21:00.
    expect(response.body.at(-1).time).toBe('20:30');
    expect(response.body.every((slot: { status: string }) => slot.status === 'libre')).toBe(true);
  });

  it('marca como ocupada la franja ya reservada', async () => {
    const date = futureOpenDate();
    await request(app).post('/api/v1/bookings').send({
      barberId: 'luis-gomez',
      date,
      time: '11:00',
      customerName: 'Mateo Torres',
      customerPhone: '3001112233',
    });

    const response = await request(app)
      .get('/api/v1/barbers/luis-gomez/slots')
      .query({ date });

    const slot = response.body.find((item: { time: string }) => item.time === '11:00');
    expect(slot.status).toBe('ocupado');
  });

  it('no mezcla la agenda de un barbero con la de otro', async () => {
    const date = futureOpenDate();
    await request(app).post('/api/v1/bookings').send({
      barberId: 'luis-gomez',
      date,
      time: '12:00',
      customerName: 'Mateo Torres',
      customerPhone: '3001112233',
    });

    const response = await request(app)
      .get('/api/v1/barbers/alexander-escobar/slots')
      .query({ date });

    const slot = response.body.find((item: { time: string }) => item.time === '12:00');
    expect(slot.status).toBe('libre');
  });
});

describe('rutas inexistentes', () => {
  it('devuelve 404 con la misma forma de error que el resto de la API', async () => {
    const response = await request(app).get('/api/v1/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('GET /api/v1/barbers/:id/availability', () => {
  const BARBERO = 'luis-gomez';

  function pedirMes(barberId: string, month: string) {
    return request(app).get(`/api/v1/barbers/${barberId}/availability`).query({ month });
  }

  it('devuelve 200 con el mes consultado y sus días con cupo', async () => {
    const month = futureMonth();
    const response = await pedirMes(BARBERO, month);

    expect(response.status).toBe(200);
    expect(response.body.month).toBe(month);
    expect(Array.isArray(response.body.days)).toBe(true);
    expect(response.body.days.length).toBeGreaterThan(0);
  });

  it('todas las fechas devueltas pertenecen al mes pedido', async () => {
    const month = futureMonth();
    const response = await pedirMes(BARBERO, month);

    for (const day of response.body.days as string[]) {
      expect(day.startsWith(month)).toBe(true);
    }
  });

  it('incluye los domingos de quien atiende los siete días', async () => {
    const response = await pedirMes(BARBERO, futureMonth());
    const domingos = (response.body.days as string[]).filter((day) => weekdayOf(day) === 0);

    expect(domingos.length).toBeGreaterThan(0);
  });

  it('excluye los domingos de quien ese día descansa', async () => {
    // La prueba de que el horario es dato por barbero y no una constante de
    // la barbería: misma consulta, mismo mes, respuesta distinta.
    const response = await pedirMes('alexander-escobar', futureMonth());
    const domingos = (response.body.days as string[]).filter((day) => weekdayOf(day) === 0);

    expect(domingos).toEqual([]);
  });

  it('un día con todas sus franjas ocupadas desaparece de la lista', async () => {
    const date = openDayInFutureMonth();
    const month = date.slice(0, 7);

    const antes = await pedirMes(BARBERO, month);
    expect(antes.body.days).toContain(date);

    await fillDay(BARBERO, date);

    const despues = await pedirMes(BARBERO, month);
    expect(despues.body.days).not.toContain(date);
  });

  it('llenar la agenda de un barbero no afecta la del otro', async () => {
    const date = openDayInFutureMonth();
    await fillDay(BARBERO, date);

    const otro = await pedirMes('alexander-escobar', date.slice(0, 7));
    expect(otro.body.days).toContain(date);
  });

  it('un mes que ya terminó devuelve lista vacía, no un error', async () => {
    const response = await pedirMes(BARBERO, pastMonth());

    expect(response.status).toBe(200);
    expect(response.body.days).toEqual([]);
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const response = await pedirMes('no-existe', futureMonth());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 400 si falta el parámetro month', async () => {
    const response = await request(app).get(`/api/v1/barbers/${BARBERO}/availability`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each(['2026-13', '2026-00', '2026-1', '11-2026', '2026-11-09', 'noviembre'])(
    'devuelve 400 con un month inválido: %s',
    async (month) => {
      const response = await pedirMes(BARBERO, month);

      expect(response.status).toBe(400);
    },
  );
});
