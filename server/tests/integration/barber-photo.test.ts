import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../../src/app.js';
import { ADMIN, BARBERO, bearer, crearUsuariosDePrueba, tokenDe } from '../helpers/auth.js';
import { closeDatabase, resetBarbers, resetBookings } from '../helpers/db.js';

/**
 * La foto de un barbero subida desde la galería.
 *
 * Se prueba el recorrido completo: que se guarde, que se sirva como imagen y
 * no como otra cosa, que cambiarla no deje la vieja en caché, y que solo
 * entren imágenes de verdad y solo las suba un administrador.
 */

/** Un PNG de 1x1 píxel completo y válido. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Bytes que empiezan como un JPEG: suficiente para el servidor, que no la redibuja. */
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG = JPEG_BYTES.toString('base64');

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

afterAll(async () => {
  await resetBookings();
  await resetBarbers();
  await closeDatabase();
});

function crear(cuerpo: Record<string, unknown>, token = tokenAdmin) {
  return request(app)
    .post('/api/v1/barbers')
    .set('Authorization', bearer(token))
    .send({ name: 'Camila Ortiz', specialty: 'Colorimetría.', ...cuerpo });
}

function editar(id: string, cuerpo: Record<string, unknown>) {
  return request(app)
    .put(`/api/v1/barbers/${id}`)
    .set('Authorization', bearer(tokenAdmin))
    .send({ name: 'Camila Ortiz', specialty: 'Colorimetría.', ...cuerpo });
}

/**
 * La ruta de la foto, sin el dominio que le pone la respuesta.
 *
 * El dominio sale de cada petición (es justo lo que hace que funcione igual
 * en local y en producción), y supertest abre un puerto nuevo en cada una:
 * comparar URLs completas entre dos peticiones fallaría sin motivo.
 */
function rutaDe(avatar: string): string {
  return new URL(avatar).pathname + new URL(avatar).search;
}

describe('subir la foto al crear un barbero', () => {
  it('crea el barbero y su avatar apunta a la foto, como URL absoluta', async () => {
    const respuesta = await crear({ photo: PNG });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.avatar).toMatch(
      /^http:\/\/[^/]+\/api\/v1\/barbers\/camila-ortiz\/photo\?v=\d+$/,
    );
  });

  it('la foto se sirve con su tipo real y los mismos bytes que se subieron', async () => {
    const { body } = await crear({ photo: PNG });

    const foto = await request(app).get(rutaDe(body.avatar));

    expect(foto.status).toBe(200);
    expect(foto.headers['content-type']).toBe('image/png');
    expect(Buffer.from(foto.body as Buffer).equals(Buffer.from(PNG, 'base64'))).toBe(true);
  });

  it('el tipo sale de los bytes: un JPEG se sirve como JPEG', async () => {
    const { body } = await crear({ photo: JPEG });

    const foto = await request(app).get(rutaDe(body.avatar));

    expect(foto.headers['content-type']).toBe('image/jpeg');
  });

  it('es pública: el cliente la ve sin sesión al elegir barbero', async () => {
    const { body } = await crear({ photo: PNG });

    const lista = await request(app).get('/api/v1/barbers');
    const camila = (lista.body as { id: string; avatar: string }[]).find(
      (barbero) => barbero.id === 'camila-ortiz',
    );
    const foto = await request(app).get(rutaDe(camila?.avatar ?? ''));

    // Se compara la ruta y no la URL entera: el dominio sale de cada
    // petición, y supertest usa un puerto distinto en cada una.
    expect(rutaDe(camila?.avatar ?? '')).toBe(rutaDe(body.avatar as string));
    expect(foto.status).toBe(200);
  });

  it('se sirve con caché larga y sin que el navegador pueda reinterpretarla', async () => {
    const { body } = await crear({ photo: PNG });

    const foto = await request(app).get(rutaDe(body.avatar));

    expect(foto.headers['cache-control']).toContain('immutable');
    expect(foto.headers['x-content-type-options']).toBe('nosniff');
    expect(foto.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('crear con una URL https sigue funcionando como antes', async () => {
    const respuesta = await crear({ avatar: 'https://i.pravatar.cc/240?img=5' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.avatar).toBe('https://i.pravatar.cc/240?img=5');
  });

  it('devuelve 400 sin foto ni URL: un barbero nuevo necesita foto', async () => {
    const respuesta = await crear({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 400 con foto y URL a la vez', async () => {
    const respuesta = await crear({ photo: PNG, avatar: 'https://i.pravatar.cc/240?img=5' });

    expect(respuesta.status).toBe(400);
  });

  it('una foto inválida devuelve 400 y no crea al barbero', async () => {
    const respuesta = await crear({ photo: 'esto no es una foto' });
    const ficha = await request(app).get('/api/v1/barbers/camila-ortiz');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([
      { field: 'photo', issue: 'no es base64 válido' },
    ]);
    expect(ficha.status).toBe(404);
  });

  it('SEGURIDAD: rechaza un SVG aunque llegue en base64 válido', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    const respuesta = await crear({ photo: svg.toString('base64') });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].issue).toBe('no es una imagen JPEG ni PNG');
  });

  it('devuelve 400 si la foto pasa del tamaño máximo', async () => {
    const enorme = Buffer.concat([JPEG_BYTES, Buffer.alloc(310 * 1024)]);

    const respuesta = await crear({ photo: enorme.toString('base64') });

    expect(respuesta.status).toBe(400);
  });

  it('devuelve 413 si el cuerpo entero pasa del límite de las rutas con foto', async () => {
    const respuesta = await crear({ photo: 'A'.repeat(500 * 1024) });

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('devuelve 403 a un barbero', async () => {
    const respuesta = await crear({ photo: PNG }, tokenBarbero);

    expect(respuesta.status).toBe(403);
  });
});

describe('cambiar la foto al editar', () => {
  async function crearConFoto(): Promise<{ id: string; avatar: string }> {
    const { body } = await crear({ photo: PNG });
    return { id: body.id as string, avatar: body.avatar as string };
  }

  it('una foto nueva reemplaza la anterior, y la URL cambia para saltarse la caché', async () => {
    const antes = await crearConFoto();
    // El parámetro v sale de la hora: se espera un instante para que cambie.
    await new Promise((resolver) => setTimeout(resolver, 5));

    const respuesta = await editar(antes.id, { photo: JPEG });
    const foto = await request(app).get(rutaDe(respuesta.body.avatar));

    expect(respuesta.status).toBe(200);
    expect(rutaDe(respuesta.body.avatar as string)).not.toBe(rutaDe(antes.avatar));
    expect(foto.headers['content-type']).toBe('image/jpeg');
  });

  it('editar sin foto ni URL conserva la foto que tenía', async () => {
    const antes = await crearConFoto();

    const respuesta = await editar(antes.id, { specialty: 'Especialidad nueva.' });
    const foto = await request(app).get(rutaDe(respuesta.body.avatar));

    expect(respuesta.status).toBe(200);
    expect(rutaDe(respuesta.body.avatar as string)).toBe(rutaDe(antes.avatar));
    expect(respuesta.body.specialty).toBe('Especialidad nueva.');
    expect(foto.status).toBe(200);
  });

  it('COMPATIBILIDAD: reenviar la URL de su propia foto (como la app anterior) no la borra', async () => {
    const antes = await crearConFoto();
    // La app ya instalada manda de vuelta el avatar que recibió. En
    // producción esa URL es https; aquí se simula con el mismo camino.
    const reenviada = `https://pantallasdm-api.onrender.com${rutaDe(antes.avatar)}`;

    const respuesta = await editar(antes.id, { avatar: reenviada, specialty: 'Otra especialidad.' });
    const foto = await request(app).get(rutaDe(respuesta.body.avatar as string));

    expect(respuesta.status).toBe(200);
    expect(rutaDe(respuesta.body.avatar as string)).toBe(rutaDe(antes.avatar));
    expect(foto.status).toBe(200);
  });

  it('la URL de la foto de OTRO barbero sí cuenta como URL externa', async () => {
    const camila = await crearConFoto();
    const deOtro = `https://pantallasdm-api.onrender.com${rutaDe(camila.avatar)}`;

    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send({ name: 'Luis Gomez', specialty: 'Fades.', avatar: deOtro });

    expect(respuesta.body.avatar).toBe(deOtro);
  });

  it('pasar a una URL externa borra la foto subida, que ya nadie va a pedir', async () => {
    const antes = await crearConFoto();

    const respuesta = await editar(antes.id, { avatar: 'https://i.pravatar.cc/240?img=7' });
    const fotoVieja = await request(app).get(rutaDe(antes.avatar));

    expect(respuesta.body.avatar).toBe('https://i.pravatar.cc/240?img=7');
    expect(fotoVieja.status).toBe(404);
    expect(fotoVieja.body.error.code).toBe('BARBER_PHOTO_NOT_FOUND');
  });

  it('se puede subir foto a un barbero del seed que tenía URL', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez')
      .set('Authorization', bearer(tokenAdmin))
      .send({ name: 'Luis Gomez', specialty: 'Fades.', photo: PNG });

    const foto = await request(app).get(rutaDe(respuesta.body.avatar));

    expect(respuesta.body.avatar).toContain('/api/v1/barbers/luis-gomez/photo');
    expect(foto.status).toBe(200);
  });
});

describe('GET /api/v1/barbers/:id/photo', () => {
  it('devuelve 404 si el barbero usa una URL externa y no tiene foto subida', async () => {
    const respuesta = await request(app).get('/api/v1/barbers/luis-gomez/photo');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('BARBER_PHOTO_NOT_FOUND');
  });

  it('devuelve 404 si el barbero no existe', async () => {
    const respuesta = await request(app).get('/api/v1/barbers/no-existe/photo');

    expect(respuesta.status).toBe(404);
  });

  it('deja de servirse cuando el barbero se da de baja', async () => {
    const { body } = await crear({ photo: PNG });
    await request(app)
      .delete(`/api/v1/barbers/${body.id as string}`)
      .set('Authorization', bearer(tokenAdmin));

    const foto = await request(app).get(rutaDe(body.avatar as string));

    expect(foto.status).toBe(404);
  });
});

describe('el cuerpo grande solo lo lee un administrador', () => {
  /** Más que el límite general de 10 KB, menos que el de las fotos. */
  const CUERPO_MEDIANO = { name: 'Camila Ortiz', specialty: 'x'.repeat(20 * 1024) };

  it('SEGURIDAD: sin sesión se responde 401 sin llegar a leer el cuerpo', async () => {
    const respuesta = await request(app).post('/api/v1/barbers').send(CUERPO_MEDIANO);

    // Un 413 aquí diría que el cuerpo se leyó antes de comprobar la sesión.
    expect(respuesta.status).toBe(401);
  });

  it('la cuenta de acceso no lleva foto y sigue con el límite general de 10 KB', async () => {
    const respuesta = await request(app)
      .put('/api/v1/barbers/luis-gomez/account')
      .set('Authorization', bearer(tokenAdmin))
      .send({ username: 'luis', password: 'x'.repeat(20 * 1024) });

    expect(respuesta.status).toBe(413);
  });

  it('el resto de la API también conserva el límite de 10 KB', async () => {
    const respuesta = await request(app)
      .post('/api/v1/bookings')
      .send({ customerName: 'x'.repeat(20 * 1024) });

    expect(respuesta.status).toBe(413);
  });
});
