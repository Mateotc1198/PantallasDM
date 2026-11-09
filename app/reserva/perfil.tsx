import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StepHeader } from '../../src/components/StepHeader';
import { useBooking } from '../../src/context/BookingContext';
import { getBarberById } from '../../src/data/barbers';
import { useAsync } from '../../src/hooks/useAsync';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { colors, spacing, typography } from '../../src/theme/tokens';
import type { Barber } from '../../src/types/api';

const AVATAR_SIZE = 96;
const MAX_STARS = 5;

interface StarsProps {
  rating: number;
  size: number;
}

/** Fila de estrellas llenas según el promedio, redondeado al entero cercano. */
function Stars({ rating, size }: StarsProps) {
  const filled = Math.round(rating);

  return (
    <View style={styles.stars} accessibilityLabel={`Calificación ${rating} de ${MAX_STARS}`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Ionicons
          key={index}
          name={index < filled ? 'star' : 'star-outline'}
          size={size}
          color={colors.primary}
        />
      ))}
    </View>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const { goBack } = useBookingNavigation();
  const ready = useRequireBooking(['barber']);
  const { barber } = useBooking();

  const barberId = barber?.id ?? null;

  /**
   * Solo se pide el detalle, que es lo único que falta: las reseñas.
   *
   * El nombre, el avatar, la especialidad y la calificación ya venían en la
   * lista, así que la cabecera se pinta al instante y el usuario nunca ve la
   * pantalla en blanco. La espera queda acotada a la parte que de verdad
   * requiere ir al servidor.
   */
  const detalle = useAsync<Barber | null>(
    async () => (barberId === null ? null : getBarberById(barberId)),
    [barberId],
    barberId !== null,
  );

  const goToDate = useCallback(() => {
    router.push('/reserva/fecha');
  }, [router]);

  if (!ready || barber === null) {
    return null;
  }

  const reviews = detalle.data?.reviews ?? [];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={2} label="Perfil" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar uri={barber.avatar} size={AVATAR_SIZE} ring />
          <Text style={styles.name}>{barber.name}</Text>
          <Text style={styles.specialty}>{barber.specialty}</Text>
          <View style={styles.metaRow}>
            <Stars rating={barber.rating} size={14} />
            <Text style={styles.meta}>{`${barber.rating.toFixed(1)} (${barber.reviewsCount})`}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.meta}>{`${barber.servicesCount} servicios`}</Text>
          </View>
        </View>

        {detalle.loading ? <LoadingState label="Cargando reseñas..." slow={detalle.slow} /> : null}

        {detalle.error !== null ? (
          <ErrorState error={detalle.error} onRetry={detalle.reload} />
        ) : null}

        {detalle.data !== null && reviews.length === 0 ? (
          <Text style={styles.empty}>Este barbero todavía no tiene reseñas.</Text>
        ) : null}

        {reviews.length > 0 ? (
          <Card>
            {reviews.map((review, index) => (
              <View key={review.id}>
                {index > 0 && <View style={styles.separator} />}
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                  <Stars rating={review.rating} size={12} />
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Continuar" onPress={goToDate} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  name: {
    ...typography.profileName,
    color: colors.textPrimary,
    paddingTop: spacing.sm,
  },
  specialty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaDot: {
    ...typography.caption,
    color: colors.textMuted,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  reviewAuthor: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  reviewComment: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
});
