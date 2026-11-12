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

/**
 * Datos que el administrador escribe al crear o editar una ficha.
 *
 * La foto es una URL y no un archivo: el servidor no aloja imágenes. Se exige
 * https por dos razones. Una práctica: Android bloquea por defecto las
 * imágenes por http en una app publicada, así que la foto no se vería. Otra de
 * seguridad: sin fijar el protocolo, z.url() aceptaría también `javascript:`
 * o `data:`, que no son direcciones de una imagen.
 */
export const barberInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'el nombre debe tener al menos 3 caracteres')
    .max(60, 'el nombre no puede superar 60 caracteres'),
  specialty: z
    .string()
    .trim()
    .min(3, 'la especialidad debe tener al menos 3 caracteres')
    .max(120, 'la especialidad no puede superar 120 caracteres'),
  avatar: z
    .url({ protocol: /^https$/, error: 'la foto debe ser una URL que empiece por https://' })
    .max(500, 'la URL de la foto no puede superar 500 caracteres'),
});

export type BarberIdParams = z.infer<typeof barberIdParamsSchema>;
export type BarberInputBody = z.infer<typeof barberInputSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
