import { useMemo } from 'react';

import { useTheme } from './ThemeContext';
import type { Palette } from './tokens';

/**
 * Construye los estilos de un componente con la paleta activa.
 *
 * Antes del tema, cada archivo llamaba a StyleSheet.create en el ámbito del
 * módulo. Eso se evalúa UNA vez al importar, así que los colores quedaban
 * congelados para siempre: por eso no bastaba con cambiar una variable.
 *
 * El patrón ahora es:
 *
 *   const makeStyles = (colors: Palette) => StyleSheet.create({ ... });
 *   // dentro del componente:
 *   const styles = useThemedStyles(makeStyles);
 *
 * `makeStyles` tiene que declararse en el ámbito del módulo, nunca dentro
 * del componente: si cambiara de identidad en cada render, la caché no
 * acertaría jamás y se recrearían las hojas de estilo sin parar.
 */

/**
 * Una hoja de estilos por cada par (componente, paleta) en toda la app.
 *
 * Sin esto, useMemo guardaría los estilos por INSTANCIA: una pantalla con
 * veinticuatro franjas horarias crearía veinticuatro hojas idénticas. El
 * WeakMap no retiene las funciones, así que no filtra memoria si un módulo
 * deja de usarse.
 */
const cache = new WeakMap<(colors: Palette) => unknown, Map<Palette, unknown>>();

export function useThemedStyles<T>(makeStyles: (colors: Palette) => T): T {
  const { colors } = useTheme();

  return useMemo(() => {
    let porPaleta = cache.get(makeStyles);

    if (porPaleta === undefined) {
      porPaleta = new Map<Palette, unknown>();
      cache.set(makeStyles, porPaleta);
    }

    let estilos = porPaleta.get(colors);

    if (estilos === undefined) {
      estilos = makeStyles(colors);
      porPaleta.set(colors, estilos);
    }
    return estilos as T;
  }, [colors, makeStyles]);
}
