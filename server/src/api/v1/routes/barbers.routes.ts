import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import * as barbersController from '../controllers/barbers.controller.js';

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
router.get('/:id/slots', barbersController.getSlots);
router.get('/:id/availability', barbersController.getMonthAvailability);

router.post('/', authenticate, authorize('admin'), barbersController.create);
router.put('/:id', authenticate, authorize('admin'), barbersController.update);
router.delete('/:id', authenticate, authorize('admin'), barbersController.remove);

export default router;
