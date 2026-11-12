import type { Request, Response } from 'express';

import * as barbersService from '../../../services/barbers.service.js';
import * as slotsService from '../../../services/slots.service.js';
import {
  barberIdParamsSchema,
  barberInputSchema,
  barberUpdateSchema,
  monthQuerySchema,
  slotsQuerySchema,
} from '../dto/barbers.dto.js';
import { sendPhoto, withAbsoluteAvatar } from '../serializers/media-url.serializer.js';

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
export async function list(req: Request, res: Response): Promise<void> {
  const barbers = await barbersService.list();
  res.status(200).json(barbers.map((barber) => withAbsoluteAvatar(req, barber)));
}

/** GET /api/v1/barbers/:id */
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const barber = await barbersService.getById(id);
  res.status(200).json(withAbsoluteAvatar(req, barber));
}

/**
 * GET /api/v1/barbers/:id/photo
 *
 * La foto subida, como imagen. Pública, como la ficha: la ve cualquier
 * cliente al elegir barbero.
 */
export async function getPhoto(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  sendPhoto(res, await barbersService.getPhoto(id));
}

/** POST /api/v1/barbers */
export async function create(req: Request, res: Response): Promise<void> {
  const input = barberInputSchema.parse(req.body);
  const barber = await barbersService.create(input);

  res
    .status(201)
    .location(`/api/v1/barbers/${barber.id}`)
    .json(withAbsoluteAvatar(req, barber));
}

/**
 * PUT /api/v1/barbers/:id
 *
 * Reemplazo completo, igual que en servicios: el formulario envía todos los
 * campos, y así no hay que distinguir "no lo envié" de "quiero vaciarlo".
 */
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const input = barberUpdateSchema.parse(req.body);

  const barber = await barbersService.update(id, input);
  res.status(200).json(withAbsoluteAvatar(req, barber));
}

/** DELETE /api/v1/barbers/:id */
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  await barbersService.remove(id);

  res.status(204).end();
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
