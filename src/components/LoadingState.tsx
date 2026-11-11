import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type Palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

interface LoadingStateProps {
  /** Qué se está cargando, en lenguaje de persona. */
  label?: string;
  /** La espera se está alargando: el servidor probablemente está despertando. */
  slow?: boolean;
}

/**
 * Indicador de carga.
 *
 * El caso `slow` no es un adorno. El servicio gratuito de Render se duerme y
 * la primera petición tarda unos veinte segundos; sin explicación, el usuario
 * concluye que la aplicación se colgó y la cierra justo antes de que
 * respondiera.
 */
export function LoadingState({ label = 'Cargando...', slow = false }: LoadingStateProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primaryText} />
      <Text style={styles.label}>{label}</Text>
      {slow ? (
        <Text style={styles.hint}>
          El servidor estaba inactivo y está despertando. Puede tardar unos segundos.
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 19,
  },
});
