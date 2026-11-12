import { apiDelete, apiGet, apiPut } from '../api/client';
import type { AuthUser, BarberAccountInput } from '../types/api';

/**
 * Cuentas de acceso al panel.
 *
 * Todo esto exige sesión de administrador. Ninguna respuesta trae la
 * contraseña: el servidor no la devuelve, ni en claro ni cifrada.
 */

/** GET /users — las cuentas que existen, cada una con el barbero al que pertenece. */
export function getUsers(): Promise<AuthUser[]> {
  return apiGet<AuthUser[]>('/api/v1/users');
}

/**
 * PUT /barbers/:id/account — le da acceso al panel a un barbero.
 *
 * Si ya tenía cuenta, la reemplaza: sirve igual para crearla que para
 * cambiarle el usuario o la contraseña. El servidor responde 409 si el
 * usuario ya lo tiene otra cuenta.
 */
export function setBarberAccount(barberId: string, input: BarberAccountInput): Promise<AuthUser> {
  return apiPut<AuthUser>(`/api/v1/barbers/${encodeURIComponent(barberId)}/account`, input);
}

/** DELETE /barbers/:id/account — le quita el acceso. Su ficha no se toca. */
export function removeBarberAccount(barberId: string): Promise<void> {
  return apiDelete(`/api/v1/barbers/${encodeURIComponent(barberId)}/account`);
}
