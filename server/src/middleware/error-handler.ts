import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, type ErrorDetail } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import type { ApiErrorBody } from '../types/api.js';

/**
 * Manejador de errores global: el único sitio del backend que decide un
 * código HTTP de error.
 *
 * Gracias a esto los controladores no llevan try/catch y todas las respuestas
 * de error de la API tienen exactamente la misma forma.
 */

function zodIssuesToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(raíz)',
    issue: issue.message,
  }));
}

/**
 * Errores del lector de cuerpos (express.json), que fallan ANTES de llegar a
 * ningún controlador.
 *
 * No son instancias de AppError porque los lanza la librería, y sin este
 * mapeo caían en el 500 genérico: se le decía "fallo nuestro" a quien mandó
 * un JSON roto, y cada petición así dejaba un stack trace en el log.
 *
 * Se identifican por el campo `type`, que es el contrato documentado de
 * body-parser, y no por el texto del mensaje.
 */
const ERRORES_DEL_CUERPO: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': {
    status: 400,
    code: ERROR_CODES.MALFORMED_JSON,
    message: 'El cuerpo de la petición no es un JSON válido.',
  },
  'entity.too.large': {
    status: 413,
    code: ERROR_CODES.PAYLOAD_TOO_LARGE,
    message: 'El cuerpo de la petición es demasiado grande.',
  },
};

function errorDelCuerpo(error: unknown): (typeof ERRORES_DEL_CUERPO)[string] | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return undefined;
  }

  const { type } = error as { type?: unknown };
  // Object.hasOwn: `type` viene de fuera, y sin la comprobación un valor
  // como "constructor" encontraría una propiedad heredada del objeto.
  return typeof type === 'string' && Object.hasOwn(ERRORES_DEL_CUERPO, type)
    ? ERRORES_DEL_CUERPO[type]
    : undefined;
}

// Express identifica el manejador de errores por tener cuatro parámetros:
// aunque `next` no se use, quitarlo lo convertiría en middleware normal.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // 400 — la petición no cumple el esquema de entrada.
  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'La petición tiene datos inválidos.',
        details: zodIssuesToDetails(error),
      },
    };
    res.status(400).json(body);
    return;
  }

  // Errores que nosotros mismos lanzamos: ya traen su código y su estado.
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined && { details: error.details }),
      },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  // 400 / 413 — el cuerpo no se pudo leer. Es culpa de la petición.
  const delCuerpo = errorDelCuerpo(error);
  if (delCuerpo !== undefined) {
    const body: ApiErrorBody = {
      error: { code: delCuerpo.code, message: delCuerpo.message },
    };
    res.status(delCuerpo.status).json(body);
    return;
  }

  // Cualquier otra cosa es un fallo nuestro, no del cliente.
  //
  // Seguridad: al cliente le llega un mensaje genérico. El stack trace y el
  // detalle de Postgres se quedan en el log del servidor; filtrarlos revela
  // estructura interna, nombres de tablas y rutas del sistema de archivos.
  console.error('[error-no-controlado]', error);

  const body: ApiErrorBody = {
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Ocurrió un error inesperado en el servidor.',
    },
  };
  res.status(500).json(body);
};
