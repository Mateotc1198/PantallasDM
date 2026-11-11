import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarberChip } from '../../src/components/BarberChip';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { SlotChip } from '../../src/components/SlotChip';
import { StepHeader } from '../../src/components/StepHeader';
import { useBooking } from '../../src/context/BookingContext';
import { getSlots } from '../../src/data/slots';
import { useAsync } from '../../src/hooks/useAsync';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Slot } from '../../src/types/api';
import { formatShortDate } from '../../src/utils/date';

export default function HoraScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { goBack, changeBarber } = useBookingNavigation();
  const ready = useRequireBooking(['barber', 'date']);
  const { barber, date, time, setTime } = useBooking();

  const barberId = barber?.id ?? null;
  const listo = barberId !== null && date !== null;

  /**
   * Se recarga cada vez que se entra a la pantalla porque el hook vuelve a
   * ejecutarse al montar. Importa: si el usuario retrocede desde el paso de
   * datos tras un choque de horario, aquí ve la disponibilidad actualizada y
   * no la foto de hace un minuto.
   */
  const horarios = useAsync<Slot[]>(
    async () => (listo ? getSlots(barberId, date) : []),
    [barberId, date],
    listo,
  );

  const selectSlot = useCallback(
    (slot: Slot) => {
      setTime(slot.time);
      router.push('/reserva/datos');
    },
    [router, setTime],
  );

  if (!ready || barber === null || date === null) {
    return null;
  }

  const slots = horarios.data ?? [];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={4} label="Hora" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <BarberChip barber={barber} onChange={changeBarber} />
        <View style={styles.heading}>
          <Text style={styles.title}>Elige la hora</Text>
          <Text style={styles.subtitle}>{formatShortDate(date)}</Text>
        </View>

        {horarios.loading ? (
          <LoadingState label="Consultando horarios..." slow={horarios.slow} />
        ) : null}

        {horarios.error !== null ? (
          <ErrorState error={horarios.error} onRetry={horarios.reload} />
        ) : null}

        {!horarios.loading && horarios.error === null && slots.length === 0 ? (
          <Text style={styles.empty}>Sin horarios disponibles ese día.</Text>
        ) : null}

        {slots.length > 0 ? (
          <View style={styles.grid}>
            {slots.map((slot) => (
              <View key={slot.id} style={styles.gridItem}>
                <SlotChip slot={slot} selected={slot.time === time} onSelect={selectSlot} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heading: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31%',
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
