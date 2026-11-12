import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { leerJsonConFoto } from '../../../middleware/json-body.js';
import * as barbersController from '../controllers/barbers.controller.js';
import * as usersController from '../controllers/users.controller.js';

/**
 * Barberos.
 *
 * Leer es público: es lo primero que ve un cliente al reservar. Crear, editar
 * y dar de baja es solo del administrador. Un barbero con sesión válida
 * recibe 403: no decide quién más trabaja en el local ni edita fichas ajenas.
 */
const router = Router();

router.get('/', barbersController.list);
router.get('/:id', barbersController.getById);
router.get('/:id/photo', barbersController.getPhoto);
router.get('/:id/slots', barbersController.getSlots);
router.get('/:id/availability', barbersController.getMonthAvailability);

// Estas dos pueden llevar la foto: leen su cuerpo con más margen, y solo
// después de saber que quien llama es administrador.
router.post('/', authenticate, authorize('admin'), leerJsonConFoto, barbersController.create);
router.put('/:id', authenticate, authorize('admin'), leerJsonConFoto, barbersController.update);
router.delete('/:id', authenticate, authorize('admin'), barbersController.remove);

// La cuenta con la que un barbero entra al panel. Cuelga de su ficha porque
// es suya y única: no hay "cuentas" sueltas que crear.
router.put('/:id/account', authenticate, authorize('admin'), usersController.setBarberAccount);
router.delete(
  '/:id/account',
  authenticate,
  authorize('admin'),
  usersController.removeBarberAccount,
);

export default router;
