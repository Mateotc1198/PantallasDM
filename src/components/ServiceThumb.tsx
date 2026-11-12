import { Image, StyleSheet } from 'react-native';

import { radius, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ServiceThumbProps {
  uri: string;
  /** Nombre del servicio, para que un lector de pantalla diga de qué es. */
  nombre: string;
  size?: number;
}

/**
 * La imagen de un servicio, en miniatura cuadrada.
 *
 * Es contenido y no decoración (enseña cómo queda el corte), así que se
 * anuncia con el nombre del servicio. Solo se pinta si el servicio tiene
 * imagen: quien la usa decide si hay hueco o no.
 */
export function ServiceThumb({ uri, nombre, size = 56 }: ServiceThumbProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Image
      source={{ uri }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Imagen de ${nombre}`}
      accessibilityIgnoresInvertColors
      // Dimensión derivada de la prop: no puede vivir en StyleSheet.create.
      style={[styles.imagen, { width: size, height: size }]}
    />
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  imagen: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});
