import {
  ApiError,
  API_BASE_URL,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  CLIENT_ERROR_CODES,
  setAuthToken,
  setUnauthorizedHandler,
  toApiError,
} from '../../src/api/client';

/**
 * El cliente HTTP es el único archivo que sabe que existe la red, así que
 * aquí se sustituye fetch y se comprueba qué manda y cómo traduce lo que
 * recibe. Nada de esto toca un servidor real.
 */

const fetchMock = jest.fn();

/** Respuesta mínima con la forma que el cliente consume. */
function respuesta(status: number, cuerpo?: unknown, crudo = false) {
  let texto = '';
  if (cuerpo !== undefined) {
    texto = crudo ? String(cuerpo) : JSON.stringify(cuerpo);
  }
  return { ok: status >= 200 && status < 300, status, text: async () => texto };
}

/** Lo que el cliente le pasó a fetch en la última llamada. */
function ultimaLlamada(): { url: string; init: RequestInit & { headers: Record<string, string> } } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init: init as RequestInit & { headers: Record<string, string> } };
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setAuthToken(null);
  setUnauthorizedHandler(null);
});

describe('construcción de la petición', () => {
  it('antepone la URL base a la ruta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/api/v1/barbers');

    expect(ultimaLlamada().url).toBe(`${API_BASE_URL}/api/v1/barbers`);
  });

  it('la URL base no termina en barra: la ruta ya la trae', () => {
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });

  it('añade los parámetros de consulta codificados', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/slots', { date: '2026-11-10', nombre: 'José Pérez & hijos' });

    expect(ultimaLlamada().url).toBe(
      `${API_BASE_URL}/slots?date=2026-11-10&nombre=Jos%C3%A9%20P%C3%A9rez%20%26%20hijos`,
    );
  });

  it('omite los parámetros undefined en vez de mandar "undefined"', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/bookings', { date: '2026-11-10', barberId: undefined });

    expect(ultimaLlamada().url).toBe(`${API_BASE_URL}/bookings?date=2026-11-10`);
  });

  it('sin ningún parámetro definido no deja un "?" colgando', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/bookings', { date: undefined });

    expect(ultimaLlamada().url).toBe(`${API_BASE_URL}/bookings`);
  });

  it('GET no declara Content-Type: no lleva cuerpo', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/x');

    expect(ultimaLlamada().init.headers).toEqual({ Accept: 'application/json' });
  });

  it('POST manda el cuerpo como JSON y lo declara', async () => {
    fetchMock.mockResolvedValue(respuesta(201, { id: '1' }));

    await apiPost('/bookings', { time: '10:00' });

    const { init } = ultimaLlamada();
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"time":"10:00"}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('PUT usa su propio método', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { id: '1' }));

    await apiPut('/services/1', { name: 'Fade' });

    expect(ultimaLlamada().init.method).toBe('PUT');
  });

  it('DELETE no lleva cuerpo', async () => {
    fetchMock.mockResolvedValue(respuesta(204));

    await apiDelete('/services/1');

    const { init } = ultimaLlamada();
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });
});

describe('lectura de la respuesta', () => {
  it('devuelve el cuerpo ya interpretado', async () => {
    fetchMock.mockResolvedValue(respuesta(200, [{ id: 'luis-gomez' }]));

    await expect(apiGet('/barbers')).resolves.toEqual([{ id: 'luis-gomez' }]);
  });

  it('204 devuelve undefined sin intentar leer un cuerpo que no existe', async () => {
    const sinCuerpo = { ok: true, status: 204, text: jest.fn() };
    fetchMock.mockResolvedValue(sinCuerpo);

    await expect(apiDelete('/x')).resolves.toBeUndefined();
    expect(sinCuerpo.text).not.toHaveBeenCalled();
  });

  it('un 200 con cuerpo vacío devuelve null en vez de reventar', async () => {
    fetchMock.mockResolvedValue(respuesta(200));

    await expect(apiGet('/x')).resolves.toBeNull();
  });
});

describe('traducción de errores', () => {
  it('usa el code y el message que manda la API', async () => {
    fetchMock.mockResolvedValue(
      respuesta(409, { error: { code: 'BOOKING_SLOT_TAKEN', message: 'Ese horario ya está reservado.' } }),
    );

    const error = await apiPost('/bookings', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'BOOKING_SLOT_TAKEN',
      message: 'Ese horario ya está reservado.',
    });
  });

  it('sobrevive a un cuerpo que no es JSON', async () => {
    // Lo que devuelve Render mientras reinicia el servicio: una página HTML.
    fetchMock.mockResolvedValue(respuesta(502, '<html>Bad Gateway</html>', true));

    const error = await apiGet('/x').catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, code: 'HTTP_ERROR', message: 'Error del servidor.' });
  });

  it('sin cuerpo de error usa un mensaje propio del código HTTP', async () => {
    fetchMock.mockResolvedValue(respuesta(403));

    const error = await apiGet('/x').catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 403, message: 'No tienes permiso para hacer eso.' });
  });

  it('un JSON válido que no tiene forma de error no se toma por uno', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { detalle: 'algo' }));

    const error = await apiGet('/x').catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 500, code: 'HTTP_ERROR' });
  });

  it('sin conexión produce un error de red con status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = (await apiGet('/x').catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(0);
    expect(error.code).toBe(CLIENT_ERROR_CODES.NETWORK);
    expect(error.isNetwork).toBe(true);
  });

  it('pasado el tiempo límite aborta y lo distingue de "sin conexión"', async () => {
    jest.useFakeTimers();
    // Un servidor que nunca contesta: solo se rinde cuando lo abortan.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolver, rechazar) => {
          init.signal?.addEventListener('abort', () => rechazar(new Error('abortado')));
        }),
    );

    const pendiente = apiGet('/x').catch((e: unknown) => e);
    jest.advanceTimersByTime(60_000);
    const error = (await pendiente) as ApiError;

    expect(error.code).toBe(CLIENT_ERROR_CODES.TIMEOUT);
    expect(error.isNetwork).toBe(true);
    jest.useRealTimers();
  });
});

describe('sesión', () => {
  it('sin token no manda cabecera Authorization', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));

    await apiGet('/barbers');

    expect(ultimaLlamada().init.headers).not.toHaveProperty('Authorization');
  });

  it('con token lo manda como Bearer', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));
    setAuthToken('abc.def.ghi');

    await apiGet('/bookings');

    expect(ultimaLlamada().init.headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('tras cerrar sesión deja de mandarlo', async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));
    setAuthToken('abc.def.ghi');
    setAuthToken(null);

    await apiGet('/bookings');

    expect(ultimaLlamada().init.headers).not.toHaveProperty('Authorization');
  });

  it('un 401 CON token avisa de que la sesión se perdió', async () => {
    const alPerderla = jest.fn();
    setUnauthorizedHandler(alPerderla);
    setAuthToken('caducado');
    fetchMock.mockResolvedValue(respuesta(401, { error: { code: 'TOKEN_EXPIRED', message: 'x' } }));

    await apiGet('/bookings').catch(() => undefined);

    expect(alPerderla).toHaveBeenCalledTimes(1);
  });

  it('un 401 SIN token no cierra nada: es el login rechazando credenciales', async () => {
    const alPerderla = jest.fn();
    setUnauthorizedHandler(alPerderla);
    fetchMock.mockResolvedValue(
      respuesta(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } }),
    );

    await apiPost('/auth/login', {}).catch(() => undefined);

    expect(alPerderla).not.toHaveBeenCalled();
  });

  it('un 403 con token no cierra la sesión: sabemos quién es, solo no le alcanza', async () => {
    const alPerderla = jest.fn();
    setUnauthorizedHandler(alPerderla);
    setAuthToken('valido');
    fetchMock.mockResolvedValue(respuesta(403, { error: { code: 'FORBIDDEN', message: 'x' } }));

    await apiGet('/services').catch(() => undefined);

    expect(alPerderla).not.toHaveBeenCalled();
  });
});

describe('ApiError', () => {
  it('reconoce el conflicto de horario', () => {
    expect(new ApiError('x', 409, 'BOOKING_SLOT_TAKEN').isConflict).toBe(true);
    expect(new ApiError('x', 422, 'OTRO').isConflict).toBe(false);
  });

  it('reconoce el no encontrado', () => {
    expect(new ApiError('x', 404, 'BOOKING_NOT_FOUND').isNotFound).toBe(true);
  });

  it('un 500 no es un error de red: el servidor sí respondió', () => {
    expect(new ApiError('x', 500, 'INTERNAL_ERROR').isNetwork).toBe(false);
  });

  it('se identifica por nombre, útil al registrar errores', () => {
    expect(new ApiError('x', 400, 'Y').name).toBe('ApiError');
  });
});

describe('toApiError', () => {
  it('deja pasar un ApiError sin envolverlo de nuevo', () => {
    const original = new ApiError('x', 409, 'Y');

    expect(toApiError(original)).toBe(original);
  });

  it('envuelve un Error cualquiera conservando su mensaje', () => {
    const error = toApiError(new Error('se rompió'));

    expect(error).toMatchObject({
      message: 'se rompió',
      status: 0,
      code: CLIENT_ERROR_CODES.UNKNOWN,
    });
  });

  it('envuelve algo que ni siquiera es un Error', () => {
    expect(toApiError('una cadena suelta').message).toBe('Ocurrió un error inesperado.');
  });
});

describe('URL base', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = original;
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  });

  /** Vuelve a evaluar el módulo con el entorno que tenga en ese momento. */
  function cargarBase(): string {
    let base = '';
    jest.isolateModules(() => {
      base = (require('../../src/api/client') as { API_BASE_URL: string }).API_BASE_URL;
    });
    return base;
  }

  it('sin variable de entorno apunta al despliegue de producción', () => {
    delete process.env.EXPO_PUBLIC_API_URL;

    expect(cargarBase()).toBe('https://pantallasdm-api.onrender.com');
  });

  it('quita las barras finales de la URL configurada', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.ejemplo.com///';

    expect(cargarBase()).toBe('https://api.ejemplo.com');
  });

  it('una variable vacía cuenta como no definida', () => {
    process.env.EXPO_PUBLIC_API_URL = '   ';

    expect(cargarBase()).toBe('https://pantallasdm-api.onrender.com');
  });

  it('en desarrollo acepta HTTP: un servidor local no tiene certificado', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.20:3000';

    expect(cargarBase()).toBe('http://192.168.1.20:3000');
  });

  it('en release rechaza HTTP y vuelve a la URL segura', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.20:3000';
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(cargarBase()).toBe('https://pantallasdm-api.onrender.com');
  });
});
