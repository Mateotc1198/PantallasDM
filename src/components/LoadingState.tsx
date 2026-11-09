import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

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
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
      {slow ? (
        <Text style={styles.hint}>
          El servidor estaba inactivo y está despertando. Puede tardar unos segundos.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
