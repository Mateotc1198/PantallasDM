import type { Request, Response } from 'express';

import { requireUser } from '../../../middleware/authenticate.js';
import * as bookingsService from '../../../services/bookings.service.js';
import {
  agendaQuerySchema,
  bookingOutcomeSchema,
  bookingIdParamsSchema,
  createBookingSchema,
  customerActionSchema,
  rescheduleSchema,
} from '../dto/bookings.dto.js';

/**
 * GET /api/v1/bookings?date=&barberId=
 *
 * Agenda del panel. Requiere sesión: admin ve todo, barbero solo lo suyo.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const filtros = agendaQuerySchema.parse(req.query);
  const agenda = await bookingsService.getAgenda(requireUser(req), filtros);
  res.status(200).json(agenda);
}

/** POST /api/v1/bookings */
export async function create(req: Request, res: Response): Promise<void> {
  const input = createBookingSchema.parse(req.body);
  const booking = await bookingsService.create(input);

  // 201 + Location: el estándar para "creé un recurso y vive en esta URL".
  res.status(201).location(`/api/v1/bookings/${booking.id}`).json(booking);
}

/** GET /api/v1/bookings/:id */
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = bookingIdParamsSchema.parse(req.params);
  const booking = await bookingsService.getById(id);
  res.status(200).json(booking);
}

/** DELETE /api/v1/bookings/:id */
export async function cancel(req: Request, res: Response): Promise<void> {
  const { id } = bookingIdParamsSchema.parse(req.params);
  await bookingsService.cancel(id, requireUser(req));

  // 204: operación exitosa que no tiene nada que devolver. Sin cuerpo.
  res.status(204).end();
}

/**
 * PUT /api/v1/bookings/:id/status
 *
 * PUT sobre el subrecurso "estado": dice cómo quedó, y repetirlo deja lo
 * mismo. Devuelve la cita entera para que el panel la pinte sin otra
 * petición.
 */
export async function setStatus(req: Request, res: Response): Promise<void> {
  const { id } = bookingIdParamsSchema.parse(req.params);
  const { status } = bookingOutcomeSchema.parse(req.body);

  const booking = await bookingsService.setOutcome(id, status, requireUser(req));
  res.status(200).json(booking);
}

/**
 * POST /api/v1/bookings/:id/cancel
 *
 * Cancelación del propio cliente. Es POST y no DELETE porque necesita
 * cuerpo: el teléfono que acompaña al código de la cita. DELETE con cuerpo
 * está mal soportado, y llevarlo en la query lo dejaría escrito en los logs.
 */
export async function cancelByCustomer(req: Request, res: Response): Promise<void> {
  const { id } = bookingIdParamsSchema.parse(req.params);
  const { customerPhone } = customerActionSchema.parse(req.body);

  await bookingsService.cancelByCustomer(id, customerPhone);
  res.status(204).end();
}

/** POST /api/v1/bookings/:id/reschedule */
export async function reschedule(req: Request, res: Response): Promise<void> {
  const { id } = bookingIdParamsSchema.parse(req.params);
  const { customerPhone, date, time } = rescheduleSchema.parse(req.body);

  const booking = await bookingsService.rescheduleByCustomer(id, customerPhone, date, time);
  res.status(200).json(booking);
}
