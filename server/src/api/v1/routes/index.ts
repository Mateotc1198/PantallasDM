import { Router } from 'express';

import authRoutes from './auth.routes.js';
import barbersRoutes from './barbers.routes.js';
import bookingsRoutes from './bookings.routes.js';

/**
 * Router de la versión 1 de la API.
 *
 * Lo que se versiona es el CONTRATO HTTP, no la lógica de negocio: por eso
 * services/ y repositories/ viven fuera de api/v1/. El día que exista una v2
 * con otra forma de respuesta, reutiliza los mismos servicios y solo cambia
 * esta capa de traducción.
 */
const router = Router();

router.use('/auth', authRoutes);
router.use('/barbers', barbersRoutes);
router.use('/bookings', bookingsRoutes);

export default router;
