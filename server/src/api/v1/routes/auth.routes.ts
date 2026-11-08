import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../../../config/env.js';
import { ERROR_CODES } from '../../../errors/codes.js';
import { authenticate } from '../../../middleware/authenticate.js';
import type { ApiErrorBody } from '../../../types/api.js';
import * as authController from '../controllers/auth.controller.js';

/**
 * Límite estricto en el login: es la puerta por la que se prueban
 * contraseñas por fuerza bruta. Diez intentos por minuto frenan un ataque
 * automatizado sin estorbar a quien simplemente se equivocó al teclear.
 */
const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (_req, res) => {
    const body: ApiErrorBody = {
      error: {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: 'Demasiados intentos de inicio de sesión. Espera un minuto.',
      },
    };
    res.status(429).json(body);
  },
});

const router = Router();

router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.me);

export default router;
