import { randomBytes } from 'node:crypto';

import { BadRequestError, ConflictError, NotFoundError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as barbersRepository from '../repositories/barbers.repository.js';
import type { Barber, BarberInput, BarberSummary } from '../types/api.js';
import { today } from '../utils/clock.js';
import { decodeImage, type DecodedImage } from '../utils/image.js';
import { slugify } from '../utils/slug.js';

/**
 * Lógica de negocio de barberos.
 *
 * El servicio no sabe nada de Express (no toca req ni res) ni de SQL. Decide
 * qué significa que algo no exista y lanza el error de dominio adecuado.
 */

/**
 * Horario con el que nace un barbero: de 9:00 a 21:00 los siete días, en
 * bloques de 30 minutos (la última cita empieza a las 20:30).
 *
 * El administrador no edita horarios desde el panel; es la misma regla que
 * db/seed.sql aplica en cada arranque. Si cambia allí, cambia aquí.
 */
const HORARIO_POR_DEFECTO: barbersRepository.DefaultSchedule = {
  firstSlotAt: '09:00',
  lastSlotAt: '20:30',
  slotMinutes: 30,
};

/**
 * Cuántos identificadores se prueban antes de rendirse. El primero es el
 * nombre limpio; los demás llevan un sufijo al azar, así que agotar los
 * intentos exigiría acertar varias veces seguidas un sufijo ya usado.
 */
const MAX_INTENTOS_DE_ID = 5;

/**
 * Sufijo que distingue dos ids nacidos del mismo nombre: 'luis-gomez-3fa2'.
 *
 * Al azar y no un contador (-2, -3...) porque las bajas son lógicas: cada
 * barbero dado de baja conserva su id para siempre, y un contador obligaría
 * a consultar cuántos hay o a recorrerlos uno a uno. Con 65.536 sufijos
 * posibles por nombre, repetir uno es rarísimo, y si pasa se reintenta.
 *
 * randomBytes y no Math.random por costumbre sana: no es un secreto, pero
 * así nadie tiene que pararse a comprobar que no lo es.
 */
function sufijoAlAzar(): string {
  return randomBytes(2).toString('hex');
}

/**
 * Ruta de esta API que sirve la foto subida de un barbero.
 *
 * El servicio conoce esta ruta porque es lo que se guarda como avatar del
 * barbero: es un dato, no una decisión de enrutado. Va sin dominio; el
 * dominio lo pone la capa HTTP al responder, que es quien sabe por dónde
 * llegó la petición.
 *
 * El parámetro v cambia en cada subida. La imagen se sirve con caché de un
 * año, así que sin él un teléfono seguiría enseñando la foto vieja después
 * de cambiarla: con una URL distinta, es para él una imagen distinta.
 */
function photoPath(id: string): string {
  return `${photoRoute(id)}?v=${Date.now()}`;
}

function photoRoute(id: string): string {
  return `/api/v1/barbers/${encodeURIComponent(id)}/photo`;
}

/**
 * ¿Es esta URL la de la foto subida de este mismo barbero?
 *
 * Una versión anterior de la app, al editar, reenvía siempre la URL que
 * recibió como avatar. Si el barbero tiene foto subida, esa URL es la de esta
 * API, y tomarla como "foto externa nueva" haría borrar la imagen guardada:
 * la ficha quedaría apuntando a una foto que ya no existe. Reconocerla y
 * tratarla como "sin cambios" mantiene compatible la app ya instalada.
 *
 * Se compara solo la ruta: el dominio con el que llegó depende de por dónde
 * se conectó cada cliente.
 */
function esSuPropiaFoto(id: string, avatar: string): boolean {
  try {
    return new URL(avatar).pathname === photoRoute(id);
  } catch {
    return false;
  }
}

/** Decodifica la foto que llegó en la petición, o lanza 400 con el motivo. */
function leerFoto(photo: string | undefined): DecodedImage | null {
  if (photo === undefined) {
    return null;
  }

  const resultado = decodeImage(photo);
  if (!resultado.ok) {
    throw new BadRequestError(ERROR_CODES.VALIDATION_ERROR, 'La foto no es válida.', [
      { field: 'photo', issue: resultado.reason },
    ]);
  }
  return resultado.image;
}

function noEncontrado(id: string): NotFoundError {
  return new NotFoundError(ERROR_CODES.BARBER_NOT_FOUND, `No existe un barbero con id "${id}".`);
}

function nombreRepetido(): ConflictError {
  return new ConflictError(ERROR_CODES.BARBER_NAME_TAKEN, 'Ya existe un barbero con ese nombre.', [
    { field: 'name', issue: 'repetido' },
  ]);
}

export async function list(): Promise<BarberSummary[]> {
  return barbersRepository.findAll();
}

export async function getById(id: string): Promise<Barber> {
  const barber = await barbersRepository.findById(id);

  if (barber === null) {
    throw noEncontrado(id);
  }
  return barber;
}

/** Lanza 404 si el barbero no existe. Reutilizado por los demás servicios. */
export async function assertExists(id: string): Promise<void> {
  const found = await barbersRepository.exists(id);

  if (!found) {
    throw noEncontrado(id);
  }
}

/**
 * Crea un barbero. El id lo pone el servidor a partir del nombre.
 *
 * Un id puede estar ocupado sin que el nombre lo esté: por un barbero dado
 * de baja (su fila sigue existiendo) o por uno que luego cambió de nombre.
 * En ese caso no hay nada que el administrador pueda corregir, así que se
 * prueba con un sufijo en vez de devolverle un error que no entendería.
 */
export async function create(input: BarberInput): Promise<BarberSummary> {
  const base = slugify(input.name);
  // Se valida antes de tocar la base: una foto inválida no debe gastar un id.
  const photo = leerFoto(input.photo);

  for (let intento = 1; intento <= MAX_INTENTOS_DE_ID; intento += 1) {
    const id = intento === 1 ? base : `${base}-${sufijoAlAzar()}`;
    const resultado = await barbersRepository.create(
      id,
      {
        name: input.name,
        specialty: input.specialty,
        // El DTO garantiza que al crear llega una de las dos.
        avatarUrl: photo !== null ? photoPath(id) : (input.avatar ?? null),
        photo,
      },
      HORARIO_POR_DEFECTO,
    );

    if (resultado.ok) {
      return resultado.barber;
    }
    if (resultado.reason === 'name_taken') {
      throw nombreRepetido();
    }
  }

  // Prácticamente inalcanzable; se responde 409 en vez de dejar un bucle
  // sin salida o un 500 que no dice nada.
  throw new ConflictError(
    ERROR_CODES.BARBER_NAME_TAKEN,
    'No se pudo generar un identificador para ese nombre. Inténtalo de nuevo.',
  );
}

export async function update(id: string, input: BarberInput): Promise<BarberSummary> {
  const photo = leerFoto(input.photo);
  const urlNueva =
    input.avatar !== undefined && !esSuPropiaFoto(id, input.avatar) ? input.avatar : null;

  const resultado = await barbersRepository.update(id, {
    name: input.name,
    specialty: input.specialty,
    // Sin foto ni URL nueva queda en null, que para el repositorio es
    // "no tocar la que tiene".
    avatarUrl: photo !== null ? photoPath(id) : urlNueva,
    photo,
  });

  // null y { ok: false } son cosas distintas: la primera es que el barbero
  // no existe (404), la segunda que el nombre nuevo ya lo usa otro (409).
  if (resultado === null) {
    throw noEncontrado(id);
  }
  if (!resultado.ok) {
    throw nombreRepetido();
  }
  return resultado.barber;
}

/** La foto subida de un barbero, para servirla. 404 si no tiene. */
export async function getPhoto(id: string): Promise<DecodedImage> {
  const photo = await barbersRepository.findPhoto(id);

  if (photo === null) {
    throw new NotFoundError(
      ERROR_CODES.BARBER_PHOTO_NOT_FOUND,
      `El barbero "${id}" no tiene una foto subida.`,
    );
  }
  return photo;
}

/**
 * Da de baja a un barbero.
 *
 * Regla de negocio: no se puede dar de baja a quien tiene citas activas de
 * hoy en adelante. Cada una es un compromiso con un cliente; el administrador
 * debe cancelarlas (y avisar) antes, no dejarlas huérfanas sin enterarse.
 */
export async function remove(id: string): Promise<void> {
  const dadoDeBaja = await barbersRepository.softDelete(id, today());
  if (dadoDeBaja) {
    return;
  }

  // El UPDATE no tocó nada: o no existe, o lo frenaron sus citas.
  await assertExists(id);

  throw new ConflictError(
    ERROR_CODES.BARBER_HAS_BOOKINGS,
    'El barbero tiene citas activas pendientes. Cancélalas antes de darlo de baja.',
  );
}
