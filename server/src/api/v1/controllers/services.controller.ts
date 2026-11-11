import type { Request, Response } from 'express';

import * as servicesService from '../../../services/services.service.js';
import { serviceIdParamsSchema, serviceInputSchema } from '../dto/services.dto.js';

/**
 * Controladores del catálogo de servicios.
 *
 * Valida la entrada, llama al servicio y escribe la respuesta. Sin try/catch:
 * Express 5 propaga las promesas rechazadas al manejador global, que es quien
 * decide el código HTTP.
 */

/** GET /api/v1/services */
export async function list(_req: Request, res: Response): Promise<void> {
  const services = await servicesService.list();
  res.status(200).json(services);
}

/** GET /api/v1/services/:id */
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  const service = await servicesService.getById(id);
  res.status(200).json(service);
}

/** POST /api/v1/services */
export async function create(req: Request, res: Response): Promise<void> {
  const input = serviceInputSchema.parse(req.body);
  const service = await servicesService.create(input);

  res.status(201).location(`/api/v1/services/${service.id}`).json(service);
}

/**
 * PUT /api/v1/services/:id
 *
 * PUT y no PATCH: el cuerpo lleva el servicio completo. Un formulario de
 * edición envía todos los campos de todas formas, y el reemplazo total evita
 * la ambigüedad de "campo ausente" contra "campo que quiero vaciar".
 */
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  const input = serviceInputSchema.parse(req.body);

  const service = await servicesService.update(id, input);
  res.status(200).json(service);
}

/** DELETE /api/v1/services/:id */
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  await servicesService.remove(id);

  res.status(204).end();
}
