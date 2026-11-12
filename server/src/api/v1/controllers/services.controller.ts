import type { Request, Response } from 'express';

import * as servicesService from '../../../services/services.service.js';
import { serviceIdParamsSchema, serviceInputSchema } from '../dto/services.dto.js';
import { sendPhoto, withAbsoluteImage } from '../serializers/media-url.serializer.js';

/**
 * Controladores del catálogo de servicios.
 *
 * Valida la entrada, llama al servicio y escribe la respuesta. Sin try/catch:
 * Express 5 propaga las promesas rechazadas al manejador global, que es quien
 * decide el código HTTP.
 */

/** GET /api/v1/services */
export async function list(req: Request, res: Response): Promise<void> {
  const services = await servicesService.list();
  res.status(200).json(services.map((service) => withAbsoluteImage(req, service)));
}

/** GET /api/v1/services/:id */
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  const service = await servicesService.getById(id);
  res.status(200).json(withAbsoluteImage(req, service));
}

/**
 * GET /api/v1/services/:id/photo
 *
 * La imagen subida, como imagen. Pública, como el catálogo.
 */
export async function getPhoto(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  sendPhoto(res, await servicesService.getPhoto(id));
}

/** POST /api/v1/services */
export async function create(req: Request, res: Response): Promise<void> {
  const input = serviceInputSchema.parse(req.body);
  const service = await servicesService.create(input);

  res
    .status(201)
    .location(`/api/v1/services/${service.id}`)
    .json(withAbsoluteImage(req, service));
}

/**
 * PUT /api/v1/services/:id
 *
 * Reemplazo completo de la ficha, con una excepción: la imagen. "No viene"
 * la conserva y null la quita, porque reenviar una foto en base64 en cada
 * edición sería absurdo.
 */
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  const input = serviceInputSchema.parse(req.body);

  const service = await servicesService.update(id, input);
  res.status(200).json(withAbsoluteImage(req, service));
}

/** DELETE /api/v1/services/:id */
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = serviceIdParamsSchema.parse(req.params);
  await servicesService.remove(id);

  res.status(204).end();
}
