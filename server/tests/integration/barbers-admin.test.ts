import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { ADMIN, BARBERO, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import {
  closeDatabase,
  insertBooking,
  resetBarbers,
  resetBookings,
  resetServices,
} from '../helpers/db.js';
import { futureOpenDate, futureSunday, pastDate } from '../helpers/dates.js';

/**
 * Gestión de barberos desde el panel.
 *
 * Vive aparte de barbers.test.ts porque prueba otra cosa: aquel comprueba lo
 * que ve un cliente, este quién puede cambiar la plantilla y qué reglas de
 * negocio lo frenan. Además estos tests alteran la tabla, y tenerlos juntos
 * obligaría a los de lectura a restaurarla sin necesitarlo.
 */

const FOTO = 'https://i.pravatar.cc/240?img=5';

/** El id de un segundo "Camila Ortiz": el nombre limpio más un sufijo al azar. */
const ID_CON_SUFIJO = /^camila-ortiz-[0-9a-f]{4}$/;

let tokenAdmin: string;
let tokenBarbero: string;

beforeAll(async () => {
  await crearUsuariosDePrueba();
  tokenAdmin = await tokenDe(ADMIN);
  tokenBarbero = await tokenDe(BARBERO);
});

beforeEach(async () => {
  await resetBookings();
  await resetBarbers();
});

// El último test puede dejar a alguien de baja: los archivos que corren
// después esperan los dos barberos del seed.
afterAll(async () => {
  await resetBookings();
  await resetBarbers();
  await closeDatabase();
});

function barberoValido(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Camila Ortiz',
    specialty: 'Colorimetría y cortes de tijera.',
    avatar: FOTO,
    ...overrides,
  };
}

/** Crea un barbero como administrador y devuelve su id. */
async function crearBarbero(overrides: Record<string, unknown> = {}): Promise<string> {
  const respuesta = await request(app)
    .post('/api/v1/barbers')
    .set('Authorization', bearer(tokenAdmin))
    .send(barberoValido(overrides));

  if (respuesta.status !== 201) {
    throw new Error(`No se pudo crear el barbero de prueba: ${respuesta.status}`);
  }
  return respuesta.body.id as string;
}

describe('POST /api/v1/barbers', () => {
  it('devuelve 401 sin sesión', async () => {
    const respuesta = await request(app).post('/api/v1/barbers').send(barberoValido());

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 a un barbero: no decide quién más trabaja en el local', async () => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenBarbero))
      .send(barberoValido());

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('crea el barbero y devuelve 201 con la cabecera Location', async () => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido());

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.location).toBe('/api/v1/barbers/camila-ortiz');
    expect(respuesta.body).toMatchObject({
      id: 'camila-ortiz',
      name: 'Camila Ortiz',
      specialty: 'Colorimetría y cortes de tijera.',
      avatar: FOTO,
      rating: 0,
      reviewsCount: 0,
    });
  });

  it('deriva el id del nombre quitando tildes y símbolos', async () => {
    const id = await crearBarbero({ name: '  José Peña-Núñez  ' });

    expect(id).toBe('jose-pena-nunez');
  });

  it('el barbero nuevo aparece en la lista pública', async () => {
    await crearBarbero();

    const lista = await request(app).get('/api/v1/barbers');

    expect(lista.body).toHaveLength(3);
    expect((lista.body as { id: string }[]).map((b) => b.id)).toContain('camila-ortiz');
  });

  it('nace con horario: se le puede reservar sin tocar nada más', async () => {
    const id = await crearBarbero();

    const franjas = await request(app)
      .get(`/api/v1/barbers/${id}/slots`)
      .query({ date: futureOpenDate() });
    const cita = await request(app).post('/api/v1/bookings').send({
      barberId: id,
      date: futureOpenDate(),
      time: '09:00',
      customerName: 'Cliente Nuevo',
      customerPhone: '3001112233',
    });

    expect(franjas.status).toBe(200);
    expect(franjas.body).toHaveLength(24);
    expect(cita.status).toBe(201);
  });

  it('el horario por defecto incluye el domingo', async () => {
    const id = await crearBarbero();

    const franjas = await request(app)
      .get(`/api/v1/barbers/${id}/slots`)
      .query({ date: futureSunday() });

    expect(franjas.body).toHaveLength(24);
  });

  it('cuenta los servicios del catálogo, no un número escrito a mano', async () => {
    await resetServices();
    const id = await crearBarbero();

    const detalle = await request(app).get(`/api/v1/barbers/${id}`);

    expect(detalle.body.servicesCount).toBe(3);
    expect(detalle.body.reviews).toEqual([]);
  });

  it('ignora el id y la calificación que mande el cliente', async () => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ id: 'luis-gomez', rating: 5, reviewsCount: 99 }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toMatchObject({ id: 'camila-ortiz', rating: 0, reviewsCount: 0 });
  });

  it('devuelve 409 si ya hay un barbero con ese nombre, sin distinguir mayúsculas', async () => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'LUIS GOMEZ' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BARBER_NAME_TAKEN');
  });

  it('si el id está ocupado pero el nombre no, prueba con un sufijo', async () => {
    // camila-ortiz queda ocupado por alguien que después cambió de nombre.
    const primero = await crearBarbero();
    await request(app)
      .put(`/api/v1/barbers/${primero}`)
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'Camila O. de Restrepo' }));

    const segundo = await crearBarbero();

    expect(segundo).toMatch(ID_CON_SUFIJO);
  });

  it.each([
    ['un nombre de menos de 3 caracteres', { name: 'Al' }],
    ['una especialidad vacía', { specialty: '   ' }],
    ['una foto que no es una URL', { avatar: 'foto.png' }],
    ['una foto por http sin cifrar', { avatar: 'http://ejemplo.com/foto.png' }],
    ['una "foto" con protocolo javascript:', { avatar: 'javascript:alert(1)' }],
    ['un nombre que no es texto', { name: 12345 }],
  ])('devuelve 400 con %s', async (_caso, overrides) => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido(overrides));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 400 si falta la foto', async () => {
    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send({ name: 'Camila Ortiz', specialty: 'Colorimetría.' });

    expect(respuesta.status).toBe(400);
  });
});

describe('PUT /api/v1/barbers/:id', () => {
  it('devuelve 401 sin sesión', async () => {
    const respuesta = await request(app).put('/api/v1/barbers/luis-gomez').send(barberoValido());

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 a un barbero, incluso sobre su propia ficha', async () => {
    const respuesta = await request(app)
      .put(`/api/v1/barbers/${BARBERO.barberId}`)
      .set('Authorization', bearer(tokenBarbero))
      .send(barberoValido());

    expect(respuesta.status).toBe(403);
  });

  it('actualiza nombre, especialidad y foto', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'Luis F. Gomez' }));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      name: 'Luis F. Gomez',
      specialty: 'Colorimetría y cortes de tijera.',
      avatar: FOTO,
    });
  });

  it('conserva el id aunque cambie el nombre: las citas lo referencian', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'Nombre Totalmente Distinto' }));

    expect(respuesta.body.id).toBe('luis-gomez');
  });

  it('no toca las reseñas ni la calificación', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ rating: 1, reviewsCount: 0 }));

    expect(respuesta.body.rating).toBe(5);
    expect(respuesta.body.reviewsCount).toBe(2);
  });

  it('guardar sin cambiar el nombre no choca consigo mismo', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'Luis Gomez' }));

    expect(respuesta.status).toBe(200);
  });

  it('devuelve 409 si el nombre nuevo ya es de otro barbero', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ name: 'alexander escobar' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BARBER_NAME_TAKEN');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/no-existe')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido());

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 400 con datos inválidos y no cambia nada', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido({ avatar: 'http://ejemplo.com/foto.png' }));
    const detalle = await request(app).get('/api/v1/barbers/luis-gomez');

    expect(respuesta.status).toBe(400);
    expect(detalle.body.name).toBe('Luis Gomez');
  });
});

describe('DELETE /api/v1/barbers/:id', () => {
  it('devuelve 401 sin sesión', async () => {
    const respuesta = await request(app).delete('/api/v1/barbers/luis-gomez');

    expect(respuesta.status).toBe(401);
  });

  it('devuelve 403 a un barbero', async () => {
    const respuesta = await request(app)
      .delete('/api/v1/barbers/alexander-escobar')
      .set('Authorization', bearer(tokenBarbero));

    expect(respuesta.status).toBe(403);
  });

  it('da de baja al barbero y devuelve 204 sin cuerpo', async () => {
    const id = await crearBarbero();

    const respuesta = await request(app)
      .delete(`/api/v1/barbers/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(204);
    expect(respuesta.body).toEqual({});
  });

  it('después de la baja deja de existir para el cliente', async () => {
    const id = await crearBarbero();
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const lista = await request(app).get('/api/v1/barbers');
    const detalle = await request(app).get(`/api/v1/barbers/${id}`);
    const franjas = await request(app)
      .get(`/api/v1/barbers/${id}/slots`)
      .query({ date: futureOpenDate() });

    expect((lista.body as { id: string }[]).map((b) => b.id)).not.toContain(id);
    expect(detalle.status).toBe(404);
    expect(franjas.status).toBe(404);
  });

  it('no se puede reservar con un barbero dado de baja', async () => {
    const id = await crearBarbero();
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const cita = await request(app).post('/api/v1/bookings').send({
      barberId: id,
      date: futureOpenDate(),
      time: '09:00',
      customerName: 'Cliente Tardío',
      customerPhone: '3001112233',
    });

    expect(cita.status).toBe(404);
    expect(cita.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const respuesta = await request(app)
      .delete('/api/v1/barbers/no-existe')
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('BARBER_NOT_FOUND');
  });

  it('darlo de baja dos veces devuelve 404 la segunda', async () => {
    const id = await crearBarbero();
    await request(app).delete(`/api/v1/barbers/${id}`).set('Authorization', bearer(tokenAdmin));

    const segunda = await request(app)
      .delete(`/api/v1/barbers/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(segunda.status).toBe(404);
  });

  it('devuelve 409 si tiene una cita activa pendiente, y el barbero sigue activo', async () => {
    await insertBooking({ barberId: 'luis-gomez', date: futureOpenDate(), time: '10:00' });

    const respuesta = await request(app)
      .delete('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin));
    const detalle = await request(app).get('/api/v1/barbers/luis-gomez');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('BARBER_HAS_BOOKINGS');
    expect(detalle.status).toBe(200);
  });

  it('una vez cancelada la cita pendiente, la baja sí procede', async () => {
    const citaId = await insertBooking({
      barberId: 'luis-gomez',
      date: futureOpenDate(),
      time: '10:00',
    });
    await request(app)
      .delete(`/api/v1/bookings/${citaId}`)
      .set('Authorization', bearer(tokenAdmin));

    const respuesta = await request(app)
      .delete('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(204);
  });

  it('las citas que ya pasaron no impiden la baja y se conservan como historial', async () => {
    const citaId = await insertBooking({
      barberId: 'luis-gomez',
      date: pastDate(),
      time: '10:00',
    });

    const respuesta = await request(app)
      .delete('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin));
    const cita = await request(app).get(`/api/v1/bookings/${citaId}`);

    expect(respuesta.status).toBe(204);
    expect(cita.status).toBe(200);
    expect(cita.body.barberId).toBe('luis-gomez');
  });

  it('las citas de otro barbero no impiden la baja', async () => {
    const id = await crearBarbero();
    await insertBooking({ barberId: 'luis-gomez', date: futureOpenDate(), time: '10:00' });

    const respuesta = await request(app)
      .delete(`/api/v1/barbers/${id}`)
      .set('Authorization', bearer(tokenAdmin));

    expect(respuesta.status).toBe(204);
  });

  it('el nombre queda libre: se puede volver a contratar a alguien que se llame igual', async () => {
    const primero = await crearBarbero();
    await request(app)
      .delete(`/api/v1/barbers/${primero}`)
      .set('Authorization', bearer(tokenAdmin));

    const respuesta = await request(app)
      .post('/api/v1/barbers')
      .set('Authorization', bearer(tokenAdmin))
      .send(barberoValido());

    expect(respuesta.status).toBe(201);
    // El id del primero sigue ocupado por su fila de historial.
    expect(respuesta.body.id).toMatch(ID_CON_SUFIJO);
  });

  it('la cuenta del barbero dado de baja ya no puede iniciar sesión', async () => {
    await request(app)
      .delete(`/api/v1/barbers/${BARBERO.barberId}`)
      .set('Authorization', bearer(tokenAdmin));

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: BARBERO.username, password: BARBERO.password });

    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('la baja de un barbero no afecta la sesión del administrador', async () => {
    await request(app)
      .delete(`/api/v1/barbers/${BARBERO.barberId}`)
      .set('Authorization', bearer(tokenAdmin));

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password });

    expect(login.status).toBe(200);
  });
});
