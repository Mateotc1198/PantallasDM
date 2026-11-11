import { z } from 'zod';

import { isValidISODate, isValidTime } from '../../../utils/time.js';

const PHONE_PATTERN = /^\d{10}$/;

const customerPhoneField = z
  .string()
  .regex(PHONE_PATTERN, 'debe tener exactamente 10 dígitos, sin espacios ni signos');

/** Cuerpo de POST /bookings. */
export const createBookingSchema = z.object({
  barberId: z.string().min(1, 'el barberId es obligatorio').max(100),
  date: z.string().refine(isValidISODate, 'formato esperado YYYY-MM-DD y fecha existente'),
  time: z.string().refine(isValidTime, 'formato esperado HH:mm en 24 horas'),
  customerName: z
    .string()
    .trim()
    .min(3, 'el nombre debe tener al menos 3 caracteres')
    .max(80, 'el nombre no puede superar 80 caracteres'),
  customerPhone: customerPhoneField,
});

/**
 * Cuerpo de las acciones del cliente sobre su propia cita.
 *
 * El teléfono va en el cuerpo y no en la URL a propósito: una query string
 * acaba escrita en los registros del servidor y en el historial de los
 * proxies, y esto es un dato personal que además sirve de credencial.
 */
export const customerActionSchema = z.object({
  customerPhone: customerPhoneField,
});

/** Cuerpo de POST /bookings/:id/reschedule. */
export const rescheduleSchema = z.object({
  customerPhone: customerPhoneField,
  date: z.string().refine(isValidISODate, 'formato esperado YYYY-MM-DD y fecha existente'),
  time: z.string().refine(isValidTime, 'formato esperado HH:mm en 24 horas'),
});

/** Filtros opcionales de GET /bookings. */
export const agendaQuerySchema = z.object({
  date: z
    .string()
    .refine(isValidISODate, 'formato esperado YYYY-MM-DD y fecha existente')
    .optional(),
  barberId: z.string().min(1).max(100).optional(),
});

export const bookingIdParamsSchema = z.object({
  id: z.uuid('el id de la cita debe ser un UUID'),
});

export type CreateBookingBody = z.infer<typeof createBookingSchema>;
export type BookingIdParams = z.infer<typeof bookingIdParamsSchema>;
export type AgendaQuery = z.infer<typeof agendaQuerySchema>;
export type CustomerActionBody = z.infer<typeof customerActionSchema>;
export type RescheduleBody = z.infer<typeof rescheduleSchema>;
