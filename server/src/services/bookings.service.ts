import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as bookingsRepository from '../repositories/bookings.repository.js';
import * as schedulesRepository from '../repositories/schedules.repository.js';
import type { AuthUser, Booking, BookingOutcome, CreateBookingInput } from '../types/api.js';
import { env } from '../config/env.js';
import { currentMinutes, minutesUntilBooking, today } from '../utils/clock.js';
import { isSlotBoundary, toMinutes, weekdayOf } from '../utils/time.js';

import * as barbersService from './barbers.service.js';

/**
 * Reglas de negocio de las citas.
 *
 * El orden de las validaciones importa: primero lo que determina un 404,
 * después lo que determina un 422, y el 409 lo decide la base de datos.
 */

interface FranjaSolicitada {
  barberId: string;
  date: string;
  time: string;
}

async function assertReservable(input: FranjaSolicitada): Promise<void> {
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

  if (!result.ok && result.reason === 'service_not_found') {
    throw new NotFoundError(
      ERROR_CODES.SERVICE_NOT_FOUND,
      'El servicio elegido ya no está en el catálogo.',
    );
  }

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
/**
 * Solo una cita activa se puede cancelar o aplazar.
 *
 * Una cancelada ya no existe para nadie, y una atendida o no asistida ya
 * pasó: cancelarla después borraría lo que ocurrió de verdad. Cada caso con
 * su código, porque el mensaje que necesita leer cada uno es distinto.
 */
function assertSigueActiva(booking: Booking): void {
  if (booking.status === 'cancelada') {
    throw new ConflictError(ERROR_CODES.BOOKING_ALREADY_CANCELLED, 'Esa cita ya estaba cancelada.');
  }
  if (booking.status !== 'activa') {
    throw new ConflictError(
      ERROR_CODES.BOOKING_ALREADY_CLOSED,
      'Esa cita ya pasó y quedó cerrada: no se puede cambiar.',
    );
  }
}

/**
 * Un UPDATE condicionado al estado no tocó nada: otra petición cambió la cita
 * entre la lectura y la escritura. Se vuelve a leer para decir qué pasó.
 */
async function fallarSegunEstadoActual(id: string): Promise<never> {
  assertSigueActiva(await getById(id));
  // Si siguiera activa, el UPDATE no tenía por qué fallar: es un fallo
  // nuestro, no de la petición, y se trata como tal (500).
  throw new Error(`La cita ${id} sigue activa, pero no se pudo actualizar.`);
}

export async function cancel(id: string, user: AuthUser): Promise<void> {
  const booking = await getById(id);
  assertPuedeGestionar(booking, user);
  assertSigueActiva(booking);

  const cancelled = await bookingsRepository.cancel(id);

  if (cancelled === null) {
    await fallarSegunEstadoActual(id);
  }
}

/**
 * Marca cómo terminó una cita: atendida, o el cliente no vino.
 *
 * Reglas de negocio:
 * - Lo hace el panel: el administrador en cualquier cita, el barbero en las
 *   suyas. El cliente no, que diría siempre que vino.
 * - Solo cuando ya llegó la hora de la cita. Antes no se sabe cómo termina,
 *   y marcarla cerrada liberaría una franja que todavía es de alguien.
 * - Una cancelada no se marca. Una ya marcada sí, para corregir un error.
 */
export async function setOutcome(
  id: string,
  outcome: BookingOutcome,
  user: AuthUser,
): Promise<Booking> {
  const booking = await getById(id);
  assertPuedeGestionar(booking, user);

  if (booking.status === 'cancelada') {
    throw new ConflictError(
      ERROR_CODES.BOOKING_ALREADY_CANCELLED,
      'Una cita cancelada no se puede marcar como atendida ni como no asistida.',
    );
  }

  if (minutesUntilBooking(booking.date, booking.time) > 0) {
    throw new UnprocessableError(
      ERROR_CODES.BOOKING_NOT_STARTED,
      'Todavía no es la hora de esta cita: se podrá marcar cuando empiece.',
      [{ field: 'status', issue: 'la cita no ha empezado' }],
    );
  }

  const actualizada = await bookingsRepository.setOutcome(id, outcome);
  return actualizada ?? fallarSegunEstadoActual(id);
}

/**
 * El cliente no tiene cuenta: su credencial es conocer el UUID de la cita,
 * que no se adivina, más el teléfono con el que reservó.
 *
 * El teléfono no está ahí por capricho. Si alguien ve el código de reojo en
 * una pantalla, o lo recibe reenviado, con el UUID solo podría cancelarle
 * la cita a otro. Con el teléfono tiene que saber además quién reservó.
 */
function assertEsSuCita(booking: Booking, customerPhone: string): void {
  if (booking.customerPhone !== customerPhone) {
    throw new ForbiddenError(
      ERROR_CODES.BOOKING_PHONE_MISMATCH,
      'El teléfono no coincide con el de la cita.',
    );
  }
}

/**
 * Regla de negocio: una cita no se toca a última hora.
 *
 * El barbero ya reservó ese tiempo y no puede rellenarlo con diez minutos
 * de aviso. El plazo es configurable porque es una decisión del negocio, no
 * del programa.
 */
function assertDentroDelPlazo(booking: Booking): void {
  const faltan = minutesUntilBooking(booking.date, booking.time);

  if (faltan < env.bookingChangeWindowMinutes) {
    const horas = env.bookingChangeWindowHours;
    throw new UnprocessableError(
      ERROR_CODES.BOOKING_CHANGE_TOO_LATE,
      `Los cambios deben hacerse con al menos ${horas} ${horas === 1 ? 'hora' : 'horas'} de antelación. Comunícate con la barbería.`,
      [{ field: 'date', issue: 'fuera del plazo de cambios' }],
    );
  }
}

/** Cancelación hecha por el propio cliente, sin sesión. */
export async function cancelByCustomer(id: string, customerPhone: string): Promise<void> {
  const booking = await getById(id);

  // El teléfono se comprueba antes que nada: si no es tu cita, no tienes por
  // qué enterarte de en qué estado está ni de a qué hora es.
  assertEsSuCita(booking, customerPhone);
  assertSigueActiva(booking);
  assertDentroDelPlazo(booking);

  const cancelled = await bookingsRepository.cancel(id);

  if (cancelled === null) {
    await fallarSegunEstadoActual(id);
  }
}

/**
 * Aplazamiento hecho por el propio cliente.
 *
 * El plazo se mide sobre la cita ACTUAL, no sobre la nueva: lo que hay que
 * respetar es el aviso al barbero que ya tenía ese hueco reservado.
 *
 * La franja de destino pasa por las mismas reglas que una reserva nueva: el
 * barbero tiene que atender ese día, la hora tiene que ser una franja real y
 * no puede estar en el pasado.
 */
export async function rescheduleByCustomer(
  id: string,
  customerPhone: string,
  date: string,
  time: string,
): Promise<Booking> {
  const booking = await getById(id);

  assertEsSuCita(booking, customerPhone);
  assertSigueActiva(booking);
  assertDentroDelPlazo(booking);
  await assertReservable({ barberId: booking.barberId, date, time });

  const result = await bookingsRepository.reschedule(id, date, time);

  if (result === null) {
    return fallarSegunEstadoActual(id);
  }

  if (!result.ok) {
    throw new ConflictError(
      ERROR_CODES.BOOKING_SLOT_TAKEN,
      'Ese horario ya está reservado.',
      [{ field: 'time', issue: 'ocupado' }],
    );
  }

  return result.booking;
}
