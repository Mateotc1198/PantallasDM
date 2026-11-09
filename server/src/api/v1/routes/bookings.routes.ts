import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../../../config/env.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { ERROR_CODES } from '../../../errors/codes.js';
import type { ApiErrorBody } from '../../../types/api.js';
import * as bookingsController from '../controllers/bookings.controller.js';

/**
 * Crear citas es la única operación que escribe desde fuera y sin
 * autenticación: sin límite, cualquiera puede llenar la agenda con basura.
 * Lectura y cancelación no se limitan porque necesitan conocer un UUID.
 */
const createBookingLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // En los tests el límite provocaría fallos intermitentes.
  skip: () => env.isTest,
  handler: (_req, res) => {
    const body: ApiErrorBody = {
      error: {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: 'Demasiadas reservas seguidas. Espera un minuto.',
      },
    };
    res.status(429).json(body);
  },
});

const router = Router();

// Agenda del panel: solo con sesión iniciada.
router.get('/', authenticate, authorize('admin', 'barbero'), bookingsController.list);

// Reservar es público: el cliente no necesita cuenta, como en el diseño.
router.post('/', createBookingLimiter, bookingsController.create);

// El recibo del cliente. Público, protegido por un UUID no adivinable.
router.get('/:id', bookingsController.getById);

// Cancelar sí exige sesión. Dentro, el servicio comprueba que la cita sea tuya.
router.delete('/:id', authenticate, authorize('admin', 'barbero'), bookingsController.cancel);

export default router;
