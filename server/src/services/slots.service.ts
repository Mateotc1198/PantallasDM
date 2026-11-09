import { UnprocessableError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as bookingsRepository from '../repositories/bookings.repository.js';
import * as schedulesRepository from '../repositories/schedules.repository.js';
import type { MonthAvailability, Slot } from '../types/api.js';
import { currentMinutes, today } from '../utils/clock.js';
import { daysOfMonth, generateSlotTimes, toMinutes, weekdayOf } from '../utils/time.js';

import * as barbersService from './barbers.service.js';

/**
 * Disponibilidad de un barbero en un día.
 *
 * Las franjas no están almacenadas: se generan a partir de la regla guardada
 * en barber_schedules y se cruzan con las citas activas de ese día.
 */
export async function getAvailability(barberId: string, date: string): Promise<Slot[]> {
  await barbersService.assertExists(barberId);

  const currentDate = today();
  if (date < currentDate) {
    // Comparar strings 'YYYY-MM-DD' funciona: el formato ordena igual que la fecha.
    throw new UnprocessableError(
      ERROR_CODES.DATE_IN_PAST,
      'No se puede consultar disponibilidad de una fecha pasada.',
      [{ field: 'date', issue: 'anterior a hoy' }],
    );
  }

  const schedule = await schedulesRepository.findByBarberAndWeekday(barberId, weekdayOf(date));

  // Día sin horario no es un error: es una pregunta válida con respuesta vacía.
  if (schedule === null) {
    return [];
  }

  const takenTimes = new Set(await bookingsRepository.findActiveTimes(barberId, date));
  const isToday = date === currentDate;
  const minutesNow = currentMinutes();

  return generateSlotTimes(schedule.firstSlotAt, schedule.lastSlotAt, schedule.slotMinutes).map(
    (time) => ({
      id: `${barberId}-${date}-${time}`,
      time,
      // Una hora de hoy que ya pasó se expone como ocupada: el contrato solo
      // tiene libre/ocupado, y lo que importa es que no se pueda reservar.
      status:
        takenTimes.has(time) || (isToday && toMinutes(time) <= minutesNow) ? 'ocupado' : 'libre',
    }),
  );
}

/**
 * Días de un mes en los que el barbero tiene al menos una franja libre.
 *
 * Existe por una razón concreta: un calendario pinta más de treinta días a la
 * vez. Preguntar uno por uno son más de treinta peticiones para dibujar una
 * sola pantalla, y contra un servidor que puede estar dormido eso es una
 * interfaz congelada.
 *
 * Se resuelve con dos consultas (la regla semanal del barbero y el conteo de
 * citas del mes) y el resto es aritmética. La alternativa, un generate_series
 * dentro de SQL, obligaría a reescribir en la base la regla de "las horas de
 * hoy que ya pasaron no cuentan", que ya vive aquí arriba: dos copias de la
 * misma regla es una copia de más.
 */
export async function getMonthAvailability(
  barberId: string,
  month: string,
): Promise<MonthAvailability> {
  await barbersService.assertExists(barberId);

  const currentDate = today();
  // Un mes entero en el pasado no es un error, es una pregunta legítima cuya
  // respuesta es "ningún día". Distinto de pedir las franjas de un día
  // concreto ya pasado, que sí es una equivocación de quien llama y por eso
  // getAvailability responde 422.
  const futureDays = daysOfMonth(month).filter((day) => day >= currentDate);

  if (futureDays.length === 0) {
    return { month, days: [] };
  }

  const schedules = await schedulesRepository.findByBarber(barberId);
  const byWeekday = new Map(schedules.map((schedule) => [schedule.weekday, schedule]));

  if (byWeekday.size === 0) {
    return { month, days: [] };
  }

  const first = futureDays[0] as string;
  const last = futureDays[futureDays.length - 1] as string;
  const bookedByDate = await bookingsRepository.countActiveByDate(barberId, first, last);

  // Para hoy hacen falta las horas exactas y no el conteo: una cita de las
  // 9:00 cuando ya son las 18:00 ocupa una franja que de todas formas ya no
  // era reservable, así que contarla escondería el cupo que sí queda.
  const takenToday =
    first === currentDate
      ? new Set(await bookingsRepository.findActiveTimes(barberId, currentDate))
      : new Set<string>();
  const minutesNow = currentMinutes();

  const days = futureDays.filter((day) => {
    const schedule = byWeekday.get(weekdayOf(day));

    // Sin regla para ese día de la semana, el barbero no atiende.
    if (schedule === undefined) {
      return false;
    }

    const times = generateSlotTimes(
      schedule.firstSlotAt,
      schedule.lastSlotAt,
      schedule.slotMinutes,
    );

    if (day === currentDate) {
      return times.some((time) => toMinutes(time) > minutesNow && !takenToday.has(time));
    }
    return (bookedByDate.get(day) ?? 0) < times.length;
  });

  return { month, days };
}
