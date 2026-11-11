import { apiGet, apiPost } from '../api/client';
import type { AuthUser, LoginResponse } from '../types/api';

/**
 * Recurso /auth.
 *
 * El login es la única petición de toda la aplicación que viaja con una
 * contraseña, y la única cuyo 401 es una respuesta esperada y no un fallo:
 * significa "esas credenciales no son correctas", no "tu sesión caducó".
 */

/** POST /auth/login */
export function login(username: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/api/v1/auth/login', { username, password });
}

/**
 * GET /auth/me
 *
 * Devuelve la identidad del dueño del token. Sirve para comprobar que una
 * sesión guardada sigue siendo válida contra el servidor.
 */
export function me(): Promise<AuthUser> {
  return apiGet<AuthUser>('/api/v1/auth/me');
}
