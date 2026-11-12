import { z } from 'zod';

import { isValidISODate, isValidISOMonth } from '../../../utils/time.js';

import { httpsImageUrl, photoField } from './photo.dto.js';

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
 * La foto llega de una de dos formas: subida desde la galería (`photo`, en
 * base64) o como la URL https de una imagen alojada en otro sitio (`avatar`).
 */
const barberFields = {
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
  avatar: httpsImageUrl('la foto').optional(),
  photo: photoField.optional(),
};

const UNA_SOLA_FOTO = {
  message: 'manda la foto o la URL, no las dos',
  path: ['photo'],
};

/**
 * PUT /barbers/:id — la foto es opcional: sin ella se conserva la actual.
 */
export const barberUpdateSchema = z
  .object(barberFields)
  .refine((datos) => datos.avatar === undefined || datos.photo === undefined, UNA_SOLA_FOTO);

/**
 * POST /barbers — un barbero nuevo necesita foto, subida o por URL.
 */
export const barberInputSchema = barberUpdateSchema.refine(
  (datos) => datos.avatar !== undefined || datos.photo !== undefined,
  { message: 'un barbero nuevo necesita una foto', path: ['photo'] },
);

export type BarberIdParams = z.infer<typeof barberIdParamsSchema>;
export type BarberInputBody = z.infer<typeof barberInputSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
