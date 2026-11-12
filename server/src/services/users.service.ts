import { ConflictError, NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as usersRepository from '../repositories/users.repository.js';
import type { AuthUser } from '../types/api.js';

import * as authService from './auth.service.js';
import * as barbersService from './barbers.service.js';

/**
 * Cuentas de acceso al panel.
 *
 * Hasta ahora la única cuenta de barbero salía de variables de entorno, así
 * que un barbero creado desde el panel no podía entrar a ver su agenda. Aquí
 * el administrador le da (o le quita) el acceso.
 *
 * Todo esto es solo para el administrador: lo imponen las rutas.
 */

/** Las cuentas existentes, sin contraseñas. */
export async function list(): Promise<AuthUser[]> {
  return usersRepository.findAll();
}

/**
 * Da acceso a un barbero, o le cambia el usuario y la contraseña si ya lo
 * tenía. Un barbero tiene como mucho una cuenta.
 *
 * La contraseña se guarda solo como hash bcrypt, con el mismo camino que usa
 * el resto de la aplicación. La contraseña en claro no sale de esta función.
 */
export async function setBarberAccount(
  barberId: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  await barbersService.assertExists(barberId);

  const passwordHash = await authService.hashPassword(password);
  const resultado = await usersRepository.setBarberAccount(barberId, username, passwordHash);

  // El usuario repetido lo decide el índice único de la base, no una
  // consulta previa. Y es un rechazo, nunca un reemplazo: si "admin" ya
  // existe, pedir ese nombre para un barbero no puede pisar esa cuenta.
  if (!resultado.ok) {
    throw new ConflictError(ERROR_CODES.USERNAME_TAKEN, 'Ese nombre de usuario ya está en uso.', [
      { field: 'username', issue: 'repetido' },
    ]);
  }
  return resultado.user;
}

/** Quita el acceso al panel de un barbero. Su ficha y sus citas no se tocan. */
export async function removeBarberAccount(barberId: string): Promise<void> {
  await barbersService.assertExists(barberId);

  const borrada = await usersRepository.deleteByBarber(barberId);
  if (!borrada) {
    throw new NotFoundError(
      ERROR_CODES.ACCOUNT_NOT_FOUND,
      'Ese barbero no tiene cuenta de acceso al panel.',
    );
  }
}
