import type { Request, Response } from 'express';

import * as usersService from '../../../services/users.service.js';
import { barberIdParamsSchema } from '../dto/barbers.dto.js';
import { barberAccountSchema } from '../dto/users.dto.js';

/**
 * Controladores de las cuentas de acceso.
 *
 * Ninguna respuesta lleva la contraseña ni su hash: los tipos que maneja el
 * servicio (AuthUser) no los contienen, así que no hay forma de filtrarlos
 * por descuido.
 */

/** GET /api/v1/users */
export async function list(_req: Request, res: Response): Promise<void> {
  const users = await usersService.list();
  res.status(200).json(users);
}

/**
 * PUT /api/v1/barbers/:id/account
 *
 * PUT y no POST porque es idempotente y el recurso es único por barbero:
 * "que la cuenta de este barbero sea esta". Si no la tenía se crea; si la
 * tenía, se reemplazan usuario y contraseña. Siempre 200: quien llama no
 * necesita distinguir los dos casos.
 */
export async function setBarberAccount(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  const { username, password } = barberAccountSchema.parse(req.body);

  const user = await usersService.setBarberAccount(id, username, password);
  res.status(200).json(user);
}

/** DELETE /api/v1/barbers/:id/account */
export async function removeBarberAccount(req: Request, res: Response): Promise<void> {
  const { id } = barberIdParamsSchema.parse(req.params);
  await usersService.removeBarberAccount(id);

  res.status(204).end();
}
