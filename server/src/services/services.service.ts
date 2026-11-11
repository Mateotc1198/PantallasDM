import { ConflictError, NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as servicesRepository from '../repositories/services.repository.js';
import type { Service, ServiceInput } from '../types/api.js';

/**
 * Catálogo de servicios.
 *
 * El nombre del archivo es redundante y no hay forma de evitarlo: la capa se
 * llama "servicios" y el recurso del negocio también.
 *
 * Es el único recurso con escritura completa desde el panel. Leerlo es
 * público porque alimenta la pantalla de servicios que ve cualquier cliente;
 * crearlo, editarlo y borrarlo es cosa del administrador.
 */

export async function list(): Promise<Service[]> {
  return servicesRepository.findAll();
}

export async function getById(id: string): Promise<Service> {
  const service = await servicesRepository.findById(id);

  if (service === null) {
    throw new NotFoundError(
      ERROR_CODES.SERVICE_NOT_FOUND,
      `No existe un servicio con id "${id}".`,
    );
  }
  return service;
}

/** El nombre duplicado lo decide la base, no una consulta previa. */
function assertEscrito(resultado: servicesRepository.WriteResult): Service {
  if (!resultado.ok) {
    throw new ConflictError(
      ERROR_CODES.SERVICE_NAME_TAKEN,
      'Ya existe un servicio con ese nombre.',
      [{ field: 'name', issue: 'repetido' }],
    );
  }
  return resultado.service;
}

export async function create(input: ServiceInput): Promise<Service> {
  return assertEscrito(await servicesRepository.create(input));
}

export async function update(id: string, input: ServiceInput): Promise<Service> {
  const resultado = await servicesRepository.update(id, input);

  // null y { ok: false } son cosas distintas: la primera es que el servicio
  // no existe (404), la segunda que el nombre nuevo ya lo usa otro (409).
  if (resultado === null) {
    throw new NotFoundError(
      ERROR_CODES.SERVICE_NOT_FOUND,
      `No existe un servicio con id "${id}".`,
    );
  }
  return assertEscrito(resultado);
}

export async function remove(id: string): Promise<void> {
  const borrado = await servicesRepository.remove(id);

  if (!borrado) {
    throw new NotFoundError(
      ERROR_CODES.SERVICE_NOT_FOUND,
      `No existe un servicio con id "${id}".`,
    );
  }
}
