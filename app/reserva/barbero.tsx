import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../../src/components/Avatar';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { StepHeader } from '../../src/components/StepHeader';
import { useBooking } from '../../src/context/BookingContext';
import { getBarbers } from '../../src/data/barbers';
import { useAsync } from '../../src/hooks/useAsync';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { colors, spacing, typography } from '../../src/theme/tokens';
import type { BarberSummary } from '../../src/types/api';

const AVATAR_SIZE = 44;

export default function BarberoScreen() {
  const router = useRouter();
  const { goBack } = useBookingNavigation();
  const { setBarber } = useBooking();

  const { data: barbers, loading, error, slow, reload } = useAsync(() => getBarbers(), []);

  const selectBarber = useCallback(
    (barber: BarberSummary) => {
      setBarber(barber);
      router.push('/reserva/perfil');
    },
    [router, setBarber],
  );

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={1} label="Barbero" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>Elige tu barbero</Text>
          <Text style={styles.subtitle}>Con quién quieres tu próxima cita</Text>
        </View>

        {loading ? <LoadingState label="Buscando barberos..." slow={slow} /> : null}

        {error !== null ? <ErrorState error={error} onRetry={reload} /> : null}

        {barbers?.length === 0 ? (
          <Text style={styles.empty}>No hay barberos disponibles en este momento.</Text>
        ) : null}

        {barbers?.map((barber) => (
          <Card
            key={barber.id}
            onPress={() => selectBarber(barber)}
            accessibilityLabel={`Elegir a ${barber.name}`}
          >
            <View style={styles.row}>
              <Avatar uri={barber.avatar} size={AVATAR_SIZE} />
              <View style={styles.info}>
                <Text style={styles.name}>{barber.name}</Text>
                <Text style={styles.specialty} numberOfLines={1}>
                  {barber.specialty}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  specialty: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
