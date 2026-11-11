import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import * as servicesController from '../controllers/services.controller.js';

/**
 * Catálogo de servicios.
 *
 * Leer es público: alimenta la pantalla que ve cualquier cliente antes de
 * reservar. Escribir es solo del administrador, no del barbero: el precio de
 * un corte es una decisión del negocio, no de quien lo ejecuta.
 */
const router = Router();

router.get('/', servicesController.list);
router.get('/:id', servicesController.getById);

router.post('/', authenticate, authorize('admin'), servicesController.create);
router.put('/:id', authenticate, authorize('admin'), servicesController.update);
router.delete('/:id', authenticate, authorize('admin'), servicesController.remove);

export default router;
