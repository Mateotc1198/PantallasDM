import { z } from 'zod';

import { isValidISODate, isValidISOMonth } from '../../../utils/time.js';

/**
 * Esquemas de entrada de los endpoints de barberos.
 *
 * Toda la validación de forma vive aquí, en el borde HTTP. Más adentro
 * (servicios, repositorios) los datos ya se dan por válidos y solo se
 * comprueban reglas de negocio.
 */

export const barberIdParamsSchema = z.object({
  id: z.string().min(1, 'el id es obligatorio').max(100),
});

export const slotsQuerySchema = z.object({
  date: z
    .string({ message: 'el parámetro date es obligatorio' })
    .refine(isValidISODate, 'formato esperado YYYY-MM-DD y fecha existente'),
});

export const monthQuerySchema = z.object({
  month: z
    .string({ message: 'el parámetro month es obligatorio' })
    .refine(isValidISOMonth, 'formato esperado YYYY-MM'),
});

export type BarberIdParams = z.infer<typeof barberIdParamsSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
