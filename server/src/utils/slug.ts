/**
 * Convierte un nombre en un identificador legible para la URL.
 *
 *   'Luis Gómez'      -> 'luis-gomez'
 *   '  Ñato  Pérez! ' -> 'nato-perez'
 *
 * Función pura: misma entrada, misma salida. Por eso vive aquí y no en el
 * servicio, y por eso se prueba sin base de datos.
 */

/** Marcas diacríticas que deja la normalización NFD (tildes, diéresis, virgulilla). */
const DIACRITICOS = /[̀-ͯ]/g;

/** Cualquier tramo que no sea letra ASCII o dígito. */
const NO_ALFANUMERICO = /[^a-z0-9]+/g;

/** Identificador de reserva cuando el nombre no deja ni una letra aprovechable. */
const SLUG_DE_RESERVA = 'barbero';

/** Tope para que el id no crezca sin límite con un nombre larguísimo. */
const LONGITUD_MAXIMA = 60;

function sinGuionesEnLosBordes(valor: string): string {
  let inicio = 0;
  let fin = valor.length;

  while (inicio < fin && valor[inicio] === '-') {
    inicio += 1;
  }
  while (fin > inicio && valor[fin - 1] === '-') {
    fin -= 1;
  }
  return valor.slice(inicio, fin);
}

export function slugify(nombre: string): string {
  const base = nombre
    // NFD separa "ó" en "o" + tilde; después se descarta la tilde.
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(NO_ALFANUMERICO, '-')
    .slice(0, LONGITUD_MAXIMA);

  const slug = sinGuionesEnLosBordes(base);

  // Un nombre escrito entero en otro alfabeto se queda vacío: mejor un id
  // genérico que uno en blanco, que rompería la ruta.
  return slug.length > 0 ? slug : SLUG_DE_RESERVA;
}
