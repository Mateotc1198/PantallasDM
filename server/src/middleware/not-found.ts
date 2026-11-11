import type { Request, Response } from 'express';

import { ERROR_CODES } from '../errors/codes.js';
import type { ApiErrorBody } from '../types/api.js';

/**
 * Cualquier ruta que no exista responde con la MISMA forma de error que el
 * resto de la API. Un 404 de ruta en HTML suelto rompe a cualquier cliente
 * que espere JSON.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: {
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      message: `La ruta ${req.method} ${req.originalUrl} no existe.`,
    },
  };
  res.status(404).json(body);
}
