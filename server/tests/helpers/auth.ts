import request from 'supertest';

import app from '../../src/app.js';
import * as usersRepository from '../../src/repositories/users.repository.js';
import * as authService from '../../src/services/auth.service.js';

/**
 * Cuentas de prueba.
 *
 * Se crean con el mismo camino que usa la aplicación (hash bcrypt + upsert del
 * repositorio) en vez de insertarlas a mano con SQL: si mañana cambia la forma
 * de guardar contraseñas, estos tests se enteran.
 */
export const ADMIN = {
  username: 'admin-test',
  password: 'clave-de-admin-2026',
};

export const BARBERO = {
  username: 'barbero-test',
  password: 'clave-de-barbero-2026',
  barberId: 'luis-gomez',
};

/** Segundo barbero, para comprobar que no ve la agenda del primero. */
export const OTRO_BARBERO = {
  username: 'otro-barbero-test',
  password: 'clave-del-otro-2026',
  barberId: 'alexander-escobar',
};

export async function crearUsuariosDePrueba(): Promise<void> {
  await usersRepository.upsert({
    username: ADMIN.username,
    passwordHash: await authService.hashPassword(ADMIN.password),
    role: 'admin',
    barberId: null,
  });

  for (const barbero of [BARBERO, OTRO_BARBERO]) {
    await usersRepository.upsert({
      username: barbero.username,
      passwordHash: await authService.hashPassword(barbero.password),
      role: 'barbero',
      barberId: barbero.barberId,
    });
  }
}

/** Inicia sesión de verdad contra la API y devuelve el token. */
export async function tokenDe(cuenta: { username: string; password: string }): Promise<string> {
  const respuesta = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: cuenta.username, password: cuenta.password });

  if (respuesta.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como ${cuenta.username}: ${respuesta.status}`);
  }
  return respuesta.body.token as string;
}

/** Azúcar para no repetir la cabecera en cada petición. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
