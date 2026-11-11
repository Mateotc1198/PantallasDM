import type { Request, RequestHandler } from 'express';

import { UnauthorizedError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as authService from '../services/auth.service.js';
import type { AuthUser } from '../types/api.js';

const PREFIJO_BEARER = 'Bearer ';

/**
 * Exige un token válido y deja la identidad en req.user.
 *
 * Lanza en vez de responder: el manejador global de errores es el único sitio
 * que decide códigos HTTP, y así el 401 tiene la misma forma que el resto.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const cabecera = req.headers.authorization;

  if (cabecera === undefined || !cabecera.startsWith(PREFIJO_BEARER)) {
    throw new UnauthorizedError(
      ERROR_CODES.UNAUTHORIZED,
      'Falta la cabecera Authorization con el token Bearer.',
    );
  }

  req.user = authService.verifyToken(cabecera.slice(PREFIJO_BEARER.length).trim());
  next();
};

/**
 * Devuelve el usuario autenticado o lanza 401.
 *
 * req.user es opcional porque en las rutas públicas no hay nadie. Este helper
 * evita repetir la comprobación en cada controlador y, sobre todo, evita la
 * tentación de castear el tipo para silenciar al compilador.
 */
export function requireUser(req: Request): AuthUser {
  if (req.user === undefined) {
    throw new UnauthorizedError(
      ERROR_CODES.UNAUTHORIZED,
      'Esta ruta requiere iniciar sesión.',
    );
  }
  return req.user;
}
