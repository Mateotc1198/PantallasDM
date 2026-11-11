import type { Request, Response } from 'express';

import * as barbersService from '../../../services/barbers.service.js';
import * as slotsService from '../../../services/slots.service.js';
import { barberIdParamsSchema, monthQuerySchema, slotsQuerySchema } from '../dto/barbers.dto.js';

/**
 * Controladores de barberos.
 *
 * Un controlador hace tres cosas y ninguna más: valida la entrada, llama al
 * servicio y escribe la respuesta. Cero SQL, cero reglas de negocio.
 *
 * No hay try/catch: Express 5 propaga automáticamente las promesas rechazadas
 * al manejador de errores global, que es quien decide el código HTTP.
 */

/** GET /api/v1/barbers */
export async function list(_req: Request, res: Response): Promise<void> {
  const barbers = await barbersService.list();
  res.status(200).json(barbers);
}

/** GET /api/v1/barbers/:id */
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const barber = await barbersService.getById(id);
  res.status(200).json(barber);
}

/** GET /api/v1/barbers/:id/slots?date=YYYY-MM-DD */
export async function getSlots(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const { date } = slotsQuerySchema.parse(req.query);

  const slots = await slotsService.getAvailability(id, date);
  res.status(200).json(slots);
}

/** GET /api/v1/barbers/:id/availability?month=YYYY-MM */
export async function getMonthAvailability(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const { month } = monthQuerySchema.parse(req.query);

  const availability = await slotsService.getMonthAvailability(id, month);
  res.status(200).json(availability);
}
