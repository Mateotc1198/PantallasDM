import { ERROR_CODES } from '../errors/codes.js';
import { NotFoundError } from '../errors/app-error.js';
import * as barbersRepository from '../repositories/barbers.repository.js';
import type { Barber, BarberSummary } from '../types/api.js';

/**
 * Lógica de negocio de barberos.
 *
 * El servicio no sabe nada de Express (no toca req ni res) ni de SQL. Decide
 * qué significa que algo no exista y lanza el error de dominio adecuado.
 */

export async function list(): Promise<BarberSummary[]> {
  return barbersRepository.findAll();
}

export async function getById(id: string): Promise<Barber> {
  const barber = await barbersRepository.findById(id);

  if (barber === null) {
    throw new NotFoundError(
      ERROR_CODES.BARBER_NOT_FOUND,
      `No existe un barbero con id "${id}".`,
    );
  }
  return barber;
}

/** Lanza 404 si el barbero no existe. Reutilizado por los demás servicios. */
export async function assertExists(id: string): Promise<void> {
  const found = await barbersRepository.exists(id);

  if (!found) {
    throw new NotFoundError(
      ERROR_CODES.BARBER_NOT_FOUND,
      `No existe un barbero con id "${id}".`,
    );
  }
}
