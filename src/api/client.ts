import type { ApiErrorBody } from '../types/api';

/**
 * Cliente HTTP de la API.
 *
 * Es el único archivo del frontend que sabe que existe la red. Todo lo demás
 * trabaja con funciones que devuelven promesas de tipos de dominio y con un
 * único tipo de error, ApiError. Centralizarlo aquí tiene una consecuencia
 * concreta: la decisión de "qué es un fallo y cómo se llama" se toma en un
 * solo sitio, igual que en el backend la toma el manejador global de errores.
 */

/**
 * URL por defecto: el despliegue de producción.
 *
 * Se incrusta en el código en vez de exigir configuración porque no es un
 * secreto (las variables EXPO_PUBLIC_* viajan dentro del APK de todas formas)
 * y porque así el proyecto funciona recién clonado, sin un .env que nadie
 * recuerda crear. Para desarrollo local se sobrescribe con EXPO_PUBLIC_API_URL.
 */
const DEFAULT_BASE_URL = 'https://pantallasdm-api.onrender.com';

/**
 * Un minuto de espera, que parece una barbaridad y no lo es: el plan gratuito
 * de Render duerme el servicio tras un rato sin tráfico y la primera petición
 * paga el arranque en frío. Medido contra el despliegue real: 21 segundos.
 * Un timeout de 10 segundos convertiría ese arranque en un error permanente.
 */
const TIMEOUT_MS = 60_000;

/**
 * Quita las barras del final recorriendo la cadena, sin expresión regular.
 *
 * La versión con /\/+$/ es de tiempo superlineal: ante una entrada con
 * muchas barras seguidas que no terminan la cadena, el motor reintenta el
 * emparejamiento desde cada una. Aquí la entrada viene de configuración y no
 * de un usuario, pero un bucle es igual de legible y no tiene ese caso malo.
 */
function sinBarrasFinales(valor: string): string {
  let fin = valor.length;
  while (fin > 0 && valor[fin - 1] === '/') {
    fin -= 1;
  }
  return valor.slice(0, fin);
}

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  const url =
    configured !== undefined && configured.length > 0 ? configured : DEFAULT_BASE_URL;
  const limpia = sinBarrasFinales(url);

  // En una compilación de release no se habla por HTTP: el tráfico incluiría
  // datos personales del cliente en claro. En desarrollo sí, porque un
  // servidor local no tiene certificado.
  if (!__DEV__ && !limpia.startsWith('https://')) {
    return DEFAULT_BASE_URL;
  }
  return limpia;
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Token de la sesión activa.
 *
 * Vive aquí, en el módulo, y no se pasa por parámetro a cada llamada: si
 * cada función de src/data/ tuviera que recibirlo, la firma de todas ellas
 * dependería de la autenticación y las pantallas tendrían que acarrearlo.
 * El contexto de sesión lo deposita al entrar y lo borra al salir.
 */
let authToken: string | null = null;

/** Lo llama AuthContext: null al cerrar sesión. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

type ManejadorNoAutorizado = () => void;

let alPerderLaSesion: ManejadorNoAutorizado | null = null;

/**
 * Qué hacer cuando el servidor rechaza un token que creíamos válido.
 *
 * El token dura ocho horas; cuando caduca, todas las peticiones empiezan a
 * responder 401 y el usuario se queda mirando errores sin entender por qué.
 * Esto permite que la sesión se cierre sola y lo devuelva al login.
 */
export function setUnauthorizedHandler(manejador: ManejadorNoAutorizado | null): void {
  alPerderLaSesion = manejador;
}

/** Códigos que genera el cliente, no el servidor. */
export const CLIENT_ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const;

/**
 * Error único de la capa de red.
 *
 * `status` 0 significa que la petición nunca llegó a obtener respuesta: sin
 * conexión, DNS caído o timeout. Distinguirlo de un 500 importa, porque el
 * mensaje que merece el usuario es distinto.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** No hubo respuesta del servidor. */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** El horario se ocupó entre que se eligió y que se confirmó. */
  get isConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

/** Convierte cualquier cosa lanzada en un ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return new ApiError(message, 0, CLIENT_ERROR_CODES.UNKNOWN);
}

const MENSAJES_POR_ESTADO: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Necesitas iniciar sesión.',
  403: 'No tienes permiso para hacer eso.',
  404: 'No encontramos lo que buscabas.',
  409: 'Ese horario acaba de ocuparse.',
  422: 'Esa operación no se puede completar.',
  429: 'Demasiados intentos. Espera un momento.',
};

/**
 * Lee el cuerpo tolerando que no sea JSON.
 *
 * Importa de verdad: cuando Render reinicia el servicio devuelve una página
 * HTML de error, no el JSON del contrato. Un JSON.parse sin red de seguridad
 * convertiría ese 502 en un error incomprensible del parser.
 */
async function leerCuerpo(response: Response): Promise<unknown> {
  const texto = await response.text();
  if (texto.length === 0) {
    return null;
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

function esCuerpoDeError(valor: unknown): valor is ApiErrorBody {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'error' in valor &&
    typeof (valor as ApiErrorBody).error?.message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  // Se recuerda si ESTA petición llevaba token: el 401 del propio login
  // (credenciales equivocadas) no debe cerrar una sesión que no existe.
  const conToken = authToken !== null;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(conToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
    // abort() y "sin internet" llegan aquí igual; solo el flag los separa,
    // así que el error en sí no aporta nada y no se vincula.
  } catch {
    if (controlador.signal.aborted) {
      throw new ApiError(
        'El servidor tardó demasiado en responder.',
        0,
        CLIENT_ERROR_CODES.TIMEOUT,
      );
    }
    throw new ApiError(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
      0,
      CLIENT_ERROR_CODES.NETWORK,
    );
  } finally {
    clearTimeout(temporizador);
  }

  // 204 no trae cuerpo: intentar leerlo daría null y confundiría al que llama.
  if (response.status === 204) {
    return undefined as T;
  }

  const cuerpo = await leerCuerpo(response);

  if (!response.ok) {
    const detalle = esCuerpoDeError(cuerpo) ? cuerpo.error : null;

    // Mandamos un token y lo rechazaron: caducó o lo revocaron. No tiene
    // sentido seguir intentando con él.
    if (response.status === 401 && conToken) {
      alPerderLaSesion?.();
    }
    throw new ApiError(
      detalle?.message ?? MENSAJES_POR_ESTADO[response.status] ?? 'Error del servidor.',
      response.status,
      detalle?.code ?? 'HTTP_ERROR',
    );
  }
  return cuerpo as T;
}

/** Añade los parámetros de consulta, ya codificados. */
function conQuery(path: string, params?: Record<string, string | undefined>): string {
  if (params === undefined) {
    return path;
  }
  const pares = Object.entries(params).filter(
    (entrada): entrada is [string, string] => entrada[1] !== undefined,
  );
  if (pares.length === 0) {
    return path;
  }
  const consulta = pares
    .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`)
    .join('&');
  return `${path}?${consulta}`;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  return request<T>(conQuery(path, params));
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}
