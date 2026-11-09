import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError } from '../api/client';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ErrorStateProps {
  error: ApiError;
  onRetry: () => void;
}

/**
 * Estado de error con reintento.
 *
 * Nunca se muestra el mensaje técnico tal cual. El usuario no puede hacer
 * nada con "HTTP 500" ni con "Network request failed": necesita saber si el
 * problema es suyo (sin conexión) o nuestro (servidor caído), y si tiene
 * sentido volver a intentarlo.
 */
function mensajeDe(error: ApiError): { titulo: string; detalle: string } {
  if (error.isNetwork) {
    return {
      titulo: 'Sin conexión',
      detalle: 'No pudimos contactar con el servidor. Revisa tu internet e inténtalo de nuevo.',
    };
  }
  if (error.status >= 500) {
    return {
      titulo: 'El servidor falló',
      detalle: 'El problema está de nuestro lado. Vuelve a intentarlo en un momento.',
    };
  }
  if (error.isNotFound) {
    return {
      titulo: 'No encontrado',
      detalle: 'Lo que buscabas ya no está disponible.',
    };
  }
  // El resto de 4xx sí traen un mensaje útil escrito por la API.
  return { titulo: 'No se pudo completar', detalle: error.message };
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { titulo, detalle } = mensajeDe(error);

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.busy} />
      </View>
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.detail}>{detalle}</Text>

      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        <Ionicons name="refresh" size={16} color={colors.textPrimary} />
        <Text style={styles.retryLabel}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
});
