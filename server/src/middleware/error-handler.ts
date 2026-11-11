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
