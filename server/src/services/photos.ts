import { BadRequestError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import { decodeImage, type DecodedImage } from '../utils/image.js';

/**
 * Lo común a las fotos subidas desde la galería: las de los barberos y las de
 * los servicios se reciben, se validan y se nombran igual.
 */

/**
 * Decodifica la foto que llegó en la petición, o lanza 400 con el motivo.
 * null si la petición no traía foto.
 */
export function readUploadedPhoto(photo: string | undefined): DecodedImage | null {
  if (photo === undefined) {
    return null;
  }

  const resultado = decodeImage(photo);
  if (!resultado.ok) {
    throw new BadRequestError(ERROR_CODES.VALIDATION_ERROR, 'La foto no es válida.', [
      { field: 'photo', issue: resultado.reason },
    ]);
  }
  return resultado.image;
}

/**
 * La URL con la que se guarda una foto subida: la ruta de esta API que la
 * sirve, sin dominio (lo pone la capa HTTP al responder).
 *
 * El parámetro v cambia en cada subida. La imagen se sirve con caché de un
 * año, así que sin él un teléfono seguiría enseñando la foto vieja después
 * de cambiarla: con una URL distinta, es para él una imagen distinta.
 */
export function versionedPhotoPath(route: string): string {
  return `${route}?v=${Date.now()}`;
}

/**
 * ¿Apunta esta URL a la ruta indicada de esta misma API?
 *
 * Una versión anterior de la app, al editar, reenvía la URL de la foto que
 * recibió. Si es la de la foto subida, tomarla como "imagen externa nueva"
 * haría borrar la guardada y dejaría la ficha apuntando a una foto que ya no
 * existe. Reconocerla permite tratarla como "sin cambios".
 *
 * Se compara solo la ruta: el dominio depende de por dónde se conectó cada
 * cliente.
 */
export function pointsToRoute(url: string, route: string): boolean {
  try {
    return new URL(url).pathname === route;
  } catch {
    return false;
  }
}
