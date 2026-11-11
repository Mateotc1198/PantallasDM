import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../src/api/client';
import { BookingRow } from '../../src/components/BookingRow';
import { Calendar } from '../../src/components/Calendar';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { LoadingState } from '../../src/components/LoadingState';
import { useAuth } from '../../src/context/AuthContext';
import { getBarbers } from '../../src/data/barbers';
import { cancelBooking, getAgenda } from '../../src/data/bookings';
import { useAsync } from '../../src/hooks/useAsync';
import { spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Booking } from '../../src/types/api';
import {
  currentMonthKey,
  formatShortDate,
  monthKeyOf,
  startOfToday,
  toISODate,
} from '../../src/utils/date';

/** En la agenda todos los días son consultables; no se filtra por cupo. */
const TODOS_LOS_DIAS = () => true;

export default function AgendaScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { user, restoring, logout } = useAuth();

  const hoy = useMemo(() => toISODate(startOfToday()), []);
  const [selectedDate, setSelectedDate] = useState(hoy);
  const [visibleMonth, setVisibleMonth] = useState(() => currentMonthKey());
  /** null = todos los barberos. Solo lo usa el administrador. */
  const [barberFilter, setBarberFilter] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const esAdmin = user?.role === 'admin';

  const barberos = useAsync(() => getBarbers(), []);

  /**
   * El filtro solo viaja si lo manda un administrador. Para un barbero el
   * servidor ignora el parámetro y fuerza el suyo, así que mandarlo sería
   * sugerir un control que la interfaz no tiene.
   */
  const agenda = useAsync(
    async () =>
      getAgenda({
        date: selectedDate,
        barberId: esAdmin && barberFilter !== null ? barberFilter : undefined,
      }),
    [selectedDate, barberFilter, esAdmin],
    user !== null,
  );

  const nombrePorBarbero = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const barbero of barberos.data ?? []) {
      mapa.set(barbero.id, barbero.name);
    }
    return mapa;
  }, [barberos.data]);

  const recargarAgenda = agenda.reload;

  const confirmarCancelacion = useCallback(
    (booking: Booking) => {
      // Cancelar es irreversible desde la aplicación y afecta a una persona
      // que espera ese turno: un toque accidental en una lista no puede
      // bastar. El diseño no lo pedía; el buen juicio, sí.
      Alert.alert(
        'Cancelar la cita',
        `Se cancelará la cita de ${booking.customerName}. Esta acción no se puede deshacer.`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí, cancelar',
            style: 'destructive',
            onPress: () => {
              setCancellingId(booking.id);
              cancelBooking(booking.id)
                .then(() => {
                  recargarAgenda();
                })
                .catch((fallo: unknown) => {
                  const error = toApiError(fallo);
                  Alert.alert(
                    'No se pudo cancelar',
                    error.isNetwork
                      ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
                      : error.message,
                  );
                })
                .finally(() => {
                  setCancellingId(null);
                });
            },
          },
        ],
      );
    },
    [recargarAgenda],
  );

  const cerrarSesion = useCallback(() => {
    logout();
    router.replace('/');
  }, [logout, router]);

  if (restoring) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState label="Comprobando sesión..." />
      </SafeAreaView>
    );
  }

  if (user === null) {
    return <Redirect href="/admin/login" />;
  }

  const citas = agenda.data ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Text style={styles.brand}>ZONABARBER</Text>
            <Text style={styles.role}>
              {esAdmin ? 'Panel de administración' : `Agenda de ${user.username}`}
            </Text>
          </View>
          <Pressable
            onPress={cerrarSesion}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          >
            <Text style={styles.logoutLabel}>Cerrar sesión</Text>
          </Pressable>
        </View>

        {/*
          El filtro solo existe para el administrador. A un barbero el
          servidor le devuelve sus citas pase lo que pase, así que un
          selector de barberos sería un control que no controla nada.
        */}
        {esAdmin ? (
          <View style={styles.filters} accessibilityRole="radiogroup">
            <FilterChip
              label="Todos"
              selected={barberFilter === null}
              onPress={() => setBarberFilter(null)}
            />
            {(barberos.data ?? []).map((barbero) => (
              <FilterChip
                key={barbero.id}
                label={barbero.name}
                selected={barberFilter === barbero.id}
                onPress={() => setBarberFilter(barbero.id)}
              />
            ))}
          </View>
        ) : null}

        <Calendar
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          selectedDate={selectedDate}
          onSelectDate={(iso) => {
            setSelectedDate(iso);
            setVisibleMonth(monthKeyOf(iso));
          }}
          isDayAvailable={TODOS_LOS_DIAS}
          // Una agenda mira hacia atrás: hay que poder revisar qué pasó ayer.
          allowPast
        />

        <View style={styles.dayHeading}>
          <Text style={styles.dayLabel}>{formatShortDate(selectedDate)}</Text>
          {!agenda.loading && agenda.error === null ? (
            <Text style={styles.dayCount}>
              {citas.length === 1 ? '1 cita' : `${citas.length} citas`}
            </Text>
          ) : null}
        </View>

        {agenda.loading ? (
          <LoadingState label="Cargando la agenda..." slow={agenda.slow} />
        ) : null}

        {agenda.error !== null ? (
          <ErrorState error={agenda.error} onRetry={agenda.reload} />
        ) : null}

        {!agenda.loading && agenda.error === null && citas.length === 0 ? (
          <Text style={styles.empty}>No hay citas para este día.</Text>
        ) : null}

        {citas.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            barberName={nombrePorBarbero.get(booking.barberId) ?? booking.barberId}
            onCancel={confirmarCancelacion}
            cancelling={cancellingId === booking.id}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    // Deja sitio al interruptor de tema, que flota arriba a la derecha.
    paddingRight: 56,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  brand: {
    ...typography.cardTitle,
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  role: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  logout: {
    paddingVertical: spacing.xs,
  },
  logoutLabel: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.primaryText,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  dayLabel: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  dayCount: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  pressed: {
    opacity: 0.6,
  },
});
