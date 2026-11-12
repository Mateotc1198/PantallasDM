/**
 * Validación de imágenes subidas.
 *
 * Funciones puras: reciben texto o bytes y deciden, sin tocar red ni disco.
 */

/** Los únicos formatos que se aceptan. */
export type ImageContentType = 'image/jpeg' | 'image/png';

export interface DecodedImage {
  content: Buffer;
  contentType: ImageContentType;
}

/**
 * Tope de la imagen ya decodificada: 300 KB.
 *
 * La app reduce la foto a 512 px antes de enviarla y pesa unos 50 KB; el tope
 * deja margen de sobra y a la vez impide usar la base de datos como disco.
 */
export const MAX_IMAGE_BYTES = 300 * 1024;

/** Solo el alfabeto base64 estándar, con su relleno opcional al final. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const FIRMA_JPEG = [0xff, 0xd8, 0xff];
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function empiezaPor(bytes: Buffer, firma: number[]): boolean {
  return bytes.length >= firma.length && firma.every((byte, indice) => bytes[indice] === byte);
}

/**
 * El formato REAL de unos bytes, leído de su firma inicial.
 *
 * No se usa el tipo que declare quien sube el archivo: ese dato lo escribe el
 * cliente y puede decir lo que quiera. Los primeros bytes no mienten: un JPEG
 * empieza siempre igual, un PNG también.
 *
 * Que solo se acepten estos dos formatos es además una medida de seguridad:
 * un SVG es texto que puede llevar un script dentro, y servido desde la API
 * se ejecutaría en el navegador de quien lo abriera.
 */
export function detectImageType(bytes: Buffer): ImageContentType | null {
  if (empiezaPor(bytes, FIRMA_JPEG)) return 'image/jpeg';
  if (empiezaPor(bytes, FIRMA_PNG)) return 'image/png';
  return null;
}

/**
 * Convierte una imagen en base64 a bytes, o explica por qué no se acepta.
 *
 * Devuelve un motivo en vez de lanzar: decidir que eso es un error 400 le
 * corresponde al servicio, no a una función de utilidades.
 */
export function decodeImage(
  base64: string,
): { ok: true; image: DecodedImage } | { ok: false; reason: string } {
  // Buffer.from ignora en silencio los caracteres que no son base64: sin
  // esta comprobación, "<script>" se decodificaría a basura sin avisar.
  if (base64.length === 0 || base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) {
    return { ok: false, reason: 'no es base64 válido' };
  }

  const content = Buffer.from(base64, 'base64');

  if (content.length > MAX_IMAGE_BYTES) {
    return { ok: false, reason: `supera el máximo de ${MAX_IMAGE_BYTES / 1024} KB` };
  }

  const contentType = detectImageType(content);
  if (contentType === null) {
    return { ok: false, reason: 'no es una imagen JPEG ni PNG' };
  }

  return { ok: true, image: { content, contentType } };
}
