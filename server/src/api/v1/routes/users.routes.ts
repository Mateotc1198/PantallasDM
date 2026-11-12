import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import * as usersController from '../controllers/users.controller.js';

/**
 * Cuentas de acceso al panel.
 *
 * Solo lectura y solo para el administrador: saber qué usuarios existen ya es
 * información útil para quien quiera adivinar contraseñas. Crear y quitar el
 * acceso de un barbero cuelga de /barbers/:id/account, porque la cuenta es
 * una propiedad de ese barbero.
 */
const router = Router();

router.get('/', authenticate, authorize('admin'), usersController.list);

export default router;
