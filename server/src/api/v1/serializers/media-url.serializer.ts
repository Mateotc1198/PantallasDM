import type { Request, Response } from 'express';

import type { DecodedImage } from '../../../utils/image.js';

/** Un año: la URL de una foto cambia en cada subida, así que nunca caduca. */
const CACHE_DE_FOTO = 'public, max-age=31536000, immutable';

/**
 * Convierte en absolutas las URLs de las fotos subidas antes de responder.
 *
 * Una foto subida desde la galería se guarda como una ruta de esta misma API
 * ("/api/v1/barbers/luis-gomez/photo?v=..."), sin dominio. El contrato dice
 * que son URLs absolutas, así que aquí se les antepone el origen.
 *
 * El origen se toma de la propia petición y no de una variable de entorno a
 * propósito: así funciona igual en local, en la red de casa (donde el teléfono
 * entra por la IP del computador) y en producción, sin configurar nada.
 *
 * Usar la cabecera Host aquí no abre ningún hueco: el valor no se guarda, solo
 * viaja de vuelta a quien hizo esa misma petición. Quien la falsee solo se
 * estropea su propia respuesta.
 */
function absoluteUrl(req: Request, url: string): string {
  if (!url.startsWith('/')) {
    return url;
  }

  const host = req.get('host');
  return host === undefined ? url : `${req.protocol}://${host}${url}`;
}

/** Para un barbero: su avatar siempre existe. */
export function withAbsoluteAvatar<T extends { avatar: string }>(req: Request, barber: T): T {
  return { ...barber, avatar: absoluteUrl(req, barber.avatar) };
}

/** Para un servicio: la imagen es opcional. */
export function withAbsoluteImage<T extends { imageUrl: string | null }>(
  req: Request,
  service: T,
): T {
  return service.imageUrl === null
    ? service
    : { ...service, imageUrl: absoluteUrl(req, service.imageUrl) };
}

/**
 * Responde con los bytes de una foto subida, no con JSON.
 *
 * El Content-Type sale de lo que se detectó al subirla, nunca de lo que dijo
 * el cliente, y helmet añade nosniff: el navegador no puede reinterpretar la
 * imagen como otra cosa.
 */
export function sendPhoto(res: Response, photo: DecodedImage): void {
  res
    .status(200)
    .set('Content-Type', photo.contentType)
    .set('Cache-Control', CACHE_DE_FOTO)
    // helmet restringe por defecto los recursos al mismo origen; una imagen
    // pública tiene que poder cargarse desde la app web en otro dominio.
    .set('Cross-Origin-Resource-Policy', 'cross-origin')
    .send(photo.content);
}
