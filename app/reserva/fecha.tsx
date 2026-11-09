import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarberChip } from '../../src/components/BarberChip';
import { Calendar } from '../../src/components/Calendar';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { StepHeader } from '../../src/components/StepHeader';
import { useBooking } from '../../src/context/BookingContext';
import { getMonthAvailability } from '../../src/data/slots';
import { useAsync } from '../../src/hooks/useAsync';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { colors, spacing, typography } from '../../src/theme/tokens';
import { currentMonthKey, monthKeyOf } from '../../src/utils/date';

export default function FechaScreen() {
  const router = useRouter();
  const { goBack, changeBarber } = useBookingNavigation();
  const ready = useRequireBooking(['barber']);
  const { barber, date, setDate } = useBooking();

  /**
   * El mes visible vive aquí y no dentro del calendario: es lo que decide
   * qué disponibilidad hay que pedirle a la API, así que tiene que estar
   * donde se hace la petición.
   */
  const [visibleMonth, setVisibleMonth] = useState<string>(
    () => (date === null ? currentMonthKey() : monthKeyOf(date)),
  );

  const barberId = barber?.id ?? null;

  /**
   * Una petición por mes, no una por día.
   *
   * El calendario pinta hasta 42 celdas. Preguntar "¿este día tiene cupo?"
   * celda por celda serían 42 peticiones para dibujar una sola pantalla, y
   * contra un servidor que puede estar despertando eso es una interfaz
   * congelada. La API responde el mes entero de una vez y aquí se convierte
   * en un Set, que es lo que el calendario necesita consultar en el render.
   */
  const disponibilidad = useAsync(
    async () =>
      barberId === null
        ? { month: visibleMonth, days: [] }
        : getMonthAvailability(barberId, visibleMonth),
    [barberId, visibleMonth],
    barberId !== null,
  );

  const diasConCupo = useMemo(
    () => new Set(disponibilidad.data?.days ?? []),
    [disponibilidad.data],
  );

  const isDayAvailable = useCallback((iso: string) => diasConCupo.has(iso), [diasConCupo]);

  const selectDate = useCallback(
    (iso: string) => {
      setDate(iso);
      router.push('/reserva/hora');
    },
    [router, setDate],
  );

  if (!ready || barber === null) {
    return null;
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={3} label="Fecha" onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <BarberChip barber={barber} onChange={changeBarber} />
        <View style={styles.heading}>
          <Text style={styles.title}>Elige el día</Text>
        </View>

        {disponibilidad.error !== null ? (
          <ErrorState error={disponibilidad.error} onRetry={disponibilidad.reload} />
        ) : (
          <>
            {/*
              El calendario no se desmonta mientras carga: si desapareciera,
              se iría con él la flecha de cambiar de mes y el usuario no
              podría corregir el movimiento que acaba de hacer. Mientras no
              hay datos, el Set está vacío y los días salen deshabilitados.
            */}
            <Calendar
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              selectedDate={date}
              onSelectDate={selectDate}
              isDayAvailable={isDayAvailable}
            />
            {disponibilidad.loading ? (
              <LoadingState label="Consultando disponibilidad..." slow={disponibilidad.slow} />
            ) : null}
            {!disponibilidad.loading && diasConCupo.size === 0 ? (
              <Text style={styles.empty}>
                No quedan días con cupo este mes. Prueba con el siguiente.
              </Text>
            ) : null}
          </>
        )}
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
    gap: spacing.md,
  },
  heading: {
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
