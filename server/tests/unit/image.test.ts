import { describe, expect, it } from 'vitest';

import { decodeImage, detectImageType, MAX_IMAGE_BYTES } from '../../src/utils/image.js';

/**
 * La validación de las fotos subidas.
 *
 * Lo que se prueba es que el formato se decide por los bytes y no por lo que
 * diga quien sube el archivo, y que lo que no es una imagen no entra.
 */

/** Cabecera real de un JPEG seguida de relleno: basta para la detección. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/** Un PNG de 1x1 píxel completo y válido. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('detectImageType', () => {
  it('reconoce un JPEG por su firma', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
  });

  it('reconoce un PNG por su firma', () => {
    expect(detectImageType(Buffer.from(PNG_BASE64, 'base64'))).toBe('image/png');
  });

  it('rechaza un SVG: es texto y podría llevar un script dentro', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    expect(detectImageType(svg)).toBeNull();
  });

  it('rechaza un GIF y cualquier otro formato', () => {
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7'))).toBeNull();
  });

  it('rechaza un archivo más corto que cualquier firma', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('decodeImage', () => {
  it('decodifica un PNG válido y dice su formato', () => {
    const resultado = decodeImage(PNG_BASE64);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.image.contentType).toBe('image/png');
      expect(resultado.image.content.equals(Buffer.from(PNG_BASE64, 'base64'))).toBe(true);
    }
  });

  it('decodifica un JPEG válido', () => {
    const resultado = decodeImage(JPEG.toString('base64'));

    expect(resultado.ok && resultado.image.contentType).toBe('image/jpeg');
  });

  it('rechaza texto que no es base64, aunque Buffer lo "decodificaría" en silencio', () => {
    expect(decodeImage('<script>alert(1)</script>')).toEqual({
      ok: false,
      reason: 'no es base64 válido',
    });
  });

  it('rechaza un data URI completo: se espera solo el base64', () => {
    expect(decodeImage(`data:image/png;base64,${PNG_BASE64}`).ok).toBe(false);
  });

  it('rechaza base64 con la longitud mal formada', () => {
    expect(decodeImage('abc').ok).toBe(false);
  });

  it('rechaza una cadena vacía', () => {
    expect(decodeImage('').ok).toBe(false);
  });

  it('rechaza base64 válido que no es una imagen', () => {
    const texto = Buffer.from('esto es un texto cualquiera').toString('base64');

    expect(decodeImage(texto)).toEqual({ ok: false, reason: 'no es una imagen JPEG ni PNG' });
  });

  it('rechaza una imagen que pasa del tamaño máximo', () => {
    const enorme = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)]);

    const resultado = decodeImage(enorme.toString('base64'));

    expect(resultado.ok).toBe(false);
    expect(!resultado.ok && resultado.reason).toMatch(/máximo/);
  });

  it('acepta una imagen justo en el tamaño máximo', () => {
    const justa = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES - JPEG.length)]);

    expect(decodeImage(justa.toString('base64')).ok).toBe(true);
  });
});
