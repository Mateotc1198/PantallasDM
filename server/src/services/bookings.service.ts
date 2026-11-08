import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as bookingsRepository from '../repositories/bookings.repository.js';
import * as schedulesRepository from '../repositories/schedules.repository.js';
import type { AuthUser, Booking, CreateBookingInput } from '../types/api.js';
import { currentMinutes, today } from '../utils/clock.js';
import { isSlotBoundary, toMinutes, weekdayOf } from '../utils/time.js';

import * as barbersService from './barbers.service.js';

/**
 * Reglas de negocio de las citas.
 *
 * El orden de las validaciones importa: primero lo que determina un 404,
 * después lo que determina un 422, y el 409 lo decide la base de datos.
 */

async function assertReservable(input: CreateBookingInput): Promise<void> {
  const currentDate = today();

  if (input.date < currentDate) {
    throw new UnprocessableError(
      ERROR_CODES.DATE_IN_PAST,
      'No se puede reservar en una fecha pasada.',
      [{ field: 'date', issue: 'anterior a hoy' }],
    );
  }

  const schedule = await schedulesRepository.findByBarberAndWeekday(
    input.barberId,
    weekdayOf(input.date),
  );

  if (schedule === null) {
    throw new UnprocessableError(
      ERROR_CODES.BARBER_CLOSED_THAT_DAY,
      'El barbero no atiende ese día.',
      [{ field: 'date', issue: 'sin horario de atención' }],
    );
  }

  // Rechaza las 9:17 aunque esté dentro del rango: no es una franja real.
  if (!isSlotBoundary(input.time, schedule.firstSlotAt, schedule.lastSlotAt, schedule.slotMinutes)) {
    throw new UnprocessableError(
      ERROR_CODES.TIME_NOT_IN_SCHEDULE,
      `La hora debe ser una franja entre ${schedule.firstSlotAt} y ${schedule.lastSlotAt}.`,
      [{ field: 'time', issue: 'fuera del horario de atención' }],
    );
  }

  if (input.date === currentDate && toMinutes(input.time) <= currentMinutes()) {
    throw new UnprocessableError(
      ERROR_CODES.TIME_IN_PAST,
      'Esa hora de hoy ya pasó.',
      [{ field: 'time', issue: 'anterior a la hora actual' }],
    );
  }
}

export async function create(input: CreateBookingInput): Promise<Booking> {
  await barbersService.assertExists(input.barberId);
  await assertReservable(input);

  const result = await bookingsRepository.create(input);

  // El choque lo detecta el índice único de la base, no una consulta previa:
  // es la única forma de que dos peticiones simultáneas no reserven lo mismo.
  if (!result.ok) {
    throw new ConflictError(
      ERROR_CODES.BOOKING_SLOT_TAKEN,
      'Ese horario ya está reservado.',
      [{ field: 'time', issue: 'ocupado' }],
    );
  }

  return result.booking;
}

/**
 * Un barbero solo puede tocar sus propias citas; un admin, todas.
 *
 * La comprobación vive en el servicio y no en el middleware a propósito: el
 * middleware sabe qué ROL tienes, pero para saber si esta cita concreta es
 * tuya hay que mirar el dato. Eso es una regla de negocio.
 */
function assertPuedeGestionar(booking: Booking, user: AuthUser): void {
  if (user.role === 'admin') {
    return;
  }
  if (user.barberId === null || booking.barberId !== user.barberId) {
    throw new ForbiddenError(
      ERROR_CODES.FORBIDDEN,
      'Solo puedes gestionar las citas de tu propia agenda.',
    );
  }
}

/**
 * Agenda del panel.
 *
 * Al barbero se le IGNORA cualquier filtro de barbero que mande y se le fuerza
 * el suyo. Si se respetara el parámetro, bastaría con cambiarlo en la petición
 * para leer la agenda de otro: el filtro de la interfaz no es una medida de
 * seguridad, la del servidor sí.
 */
export async function getAgenda(
  user: AuthUser,
  filtros: { date?: string | undefined; barberId?: string | undefined },
): Promise<Booking[]> {
  const date = filtros.date ?? null;

  if (user.role === 'barbero') {
    if (user.barberId === null) {
      throw new ForbiddenError(
        ERROR_CODES.FORBIDDEN,
        'Tu cuenta de barbero no está asociada a ninguna ficha.',
      );
    }
    return bookingsRepository.findAgenda({ date, barberId: user.barberId });
  }

  return bookingsRepository.findAgenda({ date, barberId: filtros.barberId ?? null });
}

export async function getById(id: string): Promise<Booking> {
  const booking = await bookingsRepository.findById(id);

  if (booking === null) {
    throw new NotFoundError(
      ERROR_CODES.BOOKING_NOT_FOUND,
      `No existe una cita con id "${id}".`,
    );
  }
  return booking;
}

/**
 * Cancela una cita.
 *
 * Se consulta primero para poder distinguir dos situaciones que el UPDATE
 * confunde: la cita no existe (404) o existe pero ya estaba cancelada (409).
 */
export async function cancel(id: string, user: AuthUser): Promise<void> {
  const booking = await getById(id);
  assertPuedeGestionar(booking, user);

  const cancelled = await bookingsRepository.cancel(id);

  if (cancelled === null) {
    throw new ConflictError(
      ERROR_CODES.BOOKING_ALREADY_CANCELLED,
      'Esa cita ya estaba cancelada.',
    );
  }
}
