import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface EmptyStateProps {
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  /** Qué puede hacer la persona ahora, si es que puede hacer algo. */
  detalle?: string;
}

/**
 * Lo que se muestra cuando una lista cargó bien y no trae nada.
 *
 * Una línea de texto gris suelta se confunde con un fallo de carga. Un bloque
 * con icono dice que la pantalla funciona y que, sencillamente, no hay nada.
 */
export function EmptyState({ icono, titulo, detalle }: EmptyStateProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.contenedor}>
      <View style={styles.circulo}>
        <Ionicons name={icono} size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.titulo}>{titulo}</Text>
      {detalle !== undefined ? <Text style={styles.detalle}>{detalle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  circulo: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  titulo: {
    ...typography.bodyStrong,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  detalle: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
