import type { Request } from 'express';

/**
 * Traduce un barbero del dominio a lo que sale por HTTP.
 *
 * La foto subida desde la galería se guarda como una ruta de esta misma API
 * ("/api/v1/barbers/luis-gomez/photo?v=..."), sin dominio. El contrato dice
 * que `avatar` es una URL absoluta, así que aquí se le antepone el origen.
 *
 * El origen se toma de la propia petición y no de una variable de entorno a
 * propósito: así funciona igual en local, en la red de casa (donde el teléfono
 * entra por la IP del computador) y en producción, sin configurar nada.
 *
 * Usar la cabecera Host aquí no abre ningún hueco: el valor no se guarda, solo
 * viaja de vuelta a quien hizo esa misma petición. Quien la falsee solo se
 * estropea su propia respuesta.
 */
export function withAbsoluteAvatar<T extends { avatar: string }>(req: Request, barber: T): T {
  if (!barber.avatar.startsWith('/')) {
    return barber;
  }

  const host = req.get('host');
  if (host === undefined) {
    return barber;
  }
  return { ...barber, avatar: `${req.protocol}://${host}${barber.avatar}` };
}
