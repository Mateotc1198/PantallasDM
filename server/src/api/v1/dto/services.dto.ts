import { z } from 'zod';

import { httpsImageUrl, photoField } from './photo.dto.js';

/**
 * Esquemas de entrada del catálogo de servicios.
 *
 * El precio se valida como entero no negativo y con un techo: un servicio de
 * cien millones de pesos no es un caso de uso, es un error de tecleo o un
 * intento de romper la pantalla.
 */
const PRECIO_MAXIMO_COP = 10_000_000;

export const serviceInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'el nombre debe tener al menos 3 caracteres')
      .max(80, 'el nombre no puede superar 80 caracteres'),
    description: z
      .string()
      .trim()
      .max(300, 'la descripción no puede superar 300 caracteres')
      // Opcional de cara afuera, cadena vacía hacia adentro: así la columna
      // nunca es NULL y nadie tiene que comprobarlo al leer.
      .default(''),
    priceCop: z
      .number()
      .int('el precio debe ser un número entero de pesos')
      .min(0, 'el precio no puede ser negativo')
      .max(PRECIO_MAXIMO_COP, 'el precio parece un error de tecleo'),
    category: z
      .string()
      .trim()
      .min(3, 'la categoría debe tener al menos 3 caracteres')
      .max(40, 'la categoría no puede superar 40 caracteres'),
    // Antes era z.url() a secas, que acepta cualquier esquema: también
    // javascript: y data:. Ahora exige https, como la foto de los barberos.
    //
    // Sin valor por defecto a propósito: al editar, "no viene" significa
    // conservar la imagen, y null significa quitarla.
    imageUrl: httpsImageUrl('la imagen').nullable().optional(),
    photo: photoField.optional(),
  })
  .refine((datos) => datos.photo === undefined || datos.imageUrl === undefined, {
    message: 'manda la imagen o la URL, no las dos',
    path: ['photo'],
  });

export const serviceIdParamsSchema = z.object({
  id: z.uuid('el id del servicio debe ser un UUID'),
});

export type ServiceInputBody = z.infer<typeof serviceInputSchema>;
export type ServiceIdParams = z.infer<typeof serviceIdParamsSchema>;
