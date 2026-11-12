import { Router } from 'express';

import { authenticate } from '../../../middleware/authenticate.js';
import { authorize } from '../../../middleware/authorize.js';
import { leerJsonConFoto } from '../../../middleware/json-body.js';
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
router.get('/:id/photo', servicesController.getPhoto);

// Estas dos pueden llevar la imagen: leen su cuerpo con más margen, y solo
// después de saber que quien llama es administrador.
router.post('/', authenticate, authorize('admin'), leerJsonConFoto, servicesController.create);
router.put('/:id', authenticate, authorize('admin'), leerJsonConFoto, servicesController.update);
router.delete('/:id', authenticate, authorize('admin'), servicesController.remove);

export default router;
