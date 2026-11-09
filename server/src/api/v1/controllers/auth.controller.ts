import type { Request, Response } from 'express';

import { UnauthorizedError } from '../../../errors/app-error.js';
import { ERROR_CODES } from '../../../errors/codes.js';
import * as authService from '../../../services/auth.service.js';
import { loginSchema } from '../dto/auth.dto.js';

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = loginSchema.parse(req.body);
  const resultado = await authService.login(username, password);
  res.status(200).json(resultado);
}

/**
 * GET /api/v1/auth/me
 *
 * Deja que la app sepa quién es el dueño del token sin guardar ese dato
 * aparte: tras un reinicio le basta con preguntar.
 */
export function me(req: Request, res: Response): void {
  if (req.user === undefined) {
    throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Esta ruta requiere iniciar sesión.');
  }
  res.status(200).json(req.user);
}
