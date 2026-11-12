import { randomUUID } from 'node:crypto';

import { ConflictError, NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as servicesRepository from '../repositories/services.repository.js';
import type { Service, ServiceInput } from '../types/api.js';
import type { DecodedImage } from '../utils/image.js';

import { pointsToRoute, readUploadedPhoto, versionedPhotoPath } from './photos.js';

/** Ruta de esta API que sirve la imagen subida de un servicio. */
function photoRoute(id: string): string {
  return `/api/v1/services/${encodeURIComponent(id)}/photo`;
}

/**
 * Qué hacer con la imagen al editar: undefined es "no tocarla".
 *
 * Una URL que apunta a la propia imagen subida no es una imagen nueva: la
 * versión anterior de la app la reenvía al editar, y tomarla como externa
 * borraría la guardada.
 */
function imagenAlEditar(
  id: string,
  input: ServiceInput,
  photo: DecodedImage | null,
): string | null | undefined {
  if (photo !== null) {
    return versionedPhotoPath(photoRoute(id));
  }
  if (input.imageUrl === undefined) {
    return undefined;
  }
  if (input.imageUrl !== null && pointsToRoute(input.imageUrl, photoRoute(id))) {
    return undefined;
  }
  return input.imageUrl;
}

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
  // Se valida antes de tocar la base: una foto inválida no crea nada.
  const photo = readUploadedPhoto(input.photo);
  // El id se genera aquí y no en la base porque la URL de la foto lo lleva.
  const id = randomUUID();

  return assertEscrito(
    await servicesRepository.create(id, {
      name: input.name,
      description: input.description,
      priceCop: input.priceCop,
      category: input.category,
      imageUrl: photo !== null ? versionedPhotoPath(photoRoute(id)) : (input.imageUrl ?? null),
      photo,
    }),
  );
}

export async function update(id: string, input: ServiceInput): Promise<Service> {
  const photo = readUploadedPhoto(input.photo);

  const resultado = await servicesRepository.update(id, {
    name: input.name,
    description: input.description,
    priceCop: input.priceCop,
    category: input.category,
    imageUrl: imagenAlEditar(id, input, photo),
    photo,
  });

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

/** La imagen subida de un servicio, para servirla. 404 si no tiene. */
export async function getPhoto(id: string): Promise<DecodedImage> {
  const photo = await servicesRepository.findPhoto(id);

  if (photo === null) {
    throw new NotFoundError(
      ERROR_CODES.SERVICE_PHOTO_NOT_FOUND,
      `El servicio "${id}" no tiene una imagen subida.`,
    );
  }
  return photo;
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
