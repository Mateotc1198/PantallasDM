/**
 * Precio en pesos colombianos, sin decimales: 30000 -> "$ 30.000".
 *
 * Un solo sitio para formatear dinero: el catálogo, la reserva y la agenda
 * tienen que mostrar el mismo precio escrito igual.
 *
 * Intl está disponible en Hermes con la variante internacional, que es la que
 * trae Expo.
 */
const FORMATO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function formatCop(pesos: number): string {
  return FORMATO_COP.format(pesos);
}
