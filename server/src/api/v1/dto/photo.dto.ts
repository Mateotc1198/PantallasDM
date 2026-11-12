import { z } from 'zod';

/**
 * Campos de imagen comunes a barberos y servicios.
 */

/**
 * Largo máximo del base64 de una foto.
 *
 * Base64 ocupa cuatro caracteres por cada tres bytes, así que 300 KB de
 * imagen son 400.000 caracteres. El tamaño real se vuelve a comprobar tras
 * decodificar; este tope solo evita ponerse a decodificar algo absurdo.
 */
const MAX_PHOTO_BASE64_LENGTH = 409_600;

/**
 * La foto subida desde la galería, en base64.
 *
 * Aquí solo se acota el tamaño del texto. Que sea base64 de verdad y una
 * imagen de verdad lo decide el servicio, mirando los bytes.
 */
export const photoField = z
  .string()
  .min(1, 'la foto no puede estar vacía')
  .max(MAX_PHOTO_BASE64_LENGTH, 'la foto es demasiado grande');

/**
 * Una URL de imagen alojada en otro sitio.
 *
 * Se exige https por dos razones. Una práctica: Android bloquea por defecto
 * las imágenes por http en una app publicada, así que no se verían. Otra de
 * seguridad: z.url() a secas acepta cualquier esquema, también `javascript:`
 * y `data:`, que no son la dirección de una imagen.
 */
export function httpsImageUrl(nombre: string) {
  return z
    .url({ protocol: /^https$/, error: `${nombre} debe ser una URL que empiece por https://` })
    .max(500, `la URL de ${nombre} no puede superar 500 caracteres`);
}
