import type { RequestHandler } from 'express';

import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import type { UserRole } from '../types/api.js';

/**
 * Restringe una ruta a ciertos roles. Se usa siempre después de authenticate.
 *
 * Separar autenticación de autorización no es ceremonia: son dos preguntas
 * distintas con dos respuestas HTTP distintas. 401 es "identifícate",
 * 403 es "ya sé quién eres y aun así no puedes".
 */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (req.user === undefined) {
      throw new UnauthorizedError(
        ERROR_CODES.UNAUTHORIZED,
        'Esta ruta requiere iniciar sesión.',
      );
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        ERROR_CODES.FORBIDDEN,
        'Tu rol no tiene permiso para esta operación.',
      );
    }

    next();
  };
}
