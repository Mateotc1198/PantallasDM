import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../src/api/client';
import { AdminHeader } from '../../src/components/AdminHeader';
import { BookingRow } from '../../src/components/BookingRow';
import { Calendar } from '../../src/components/Calendar';
import { DayNavigator } from '../../src/components/DayNavigator';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { LoadingState } from '../../src/components/LoadingState';
import { StatTile } from '../../src/components/StatTile';
import { useAuth } from '../../src/context/AuthContext';
import { getBarbers } from '../../src/data/barbers';
import { cancelBooking, getAgenda, setBookingStatus } from '../../src/data/bookings';
import { useAsync } from '../../src/hooks/useAsync';
import { useTheme } from '../../src/theme/ThemeContext';
import { spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Booking, BookingOutcome } from '../../src/types/api';
import { currentMonthKey, monthKeyOf, startOfToday, toISODate } from '../../src/utils/date';
import { formatCop } from '../../src/utils/money';

/** En la agenda todos los días son consultables; no se filtra por cupo. */
const TODOS_LOS_DIAS = () => true;

/** La hora de ahora como 'HH:mm', comparable con la de una cita. */
function horaActual(): string {
  const ahora = new Date();
  const dos = (valor: number) => String(valor).padStart(2, '0');
  return `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;
}

/**
 * ¿Ya llegó la hora de esta cita?
 *
 * Las fechas 'YYYY-MM-DD' y las horas 'HH:mm' se ordenan igual como texto que
 * como tiempo, así que basta comparar cadenas.
 */
function yaEmpezo(cita: Booking, hoy: string, ahora: string): boolean {
  if (cita.date !== hoy) {
    return cita.date < hoy;
  }
  // <= y no <: a las 10:00 en punto la cita de las 10:00 ya empezó, igual
  // que la cuenta el servidor.
  return cita.time <= ahora;
}

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisa tu conexión.';

export default function AgendaScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user, restoring, logout } = useAuth();

  const hoy = useMemo(() => toISODate(startOfToday()), []);
  const [selectedDate, setSelectedDate] = useState(hoy);
  const [visibleMonth, setVisibleMonth] = useState(() => currentMonthKey());
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  /** null = todos los barberos. Solo lo usa el administrador. */
  const [barberFilter, setBarberFilter] = useState<string | null>(null);
  /** Cita con una acción en curso (cancelar o marcar), para bloquear sus botones. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const esAdmin = user?.role === 'admin';

  // Solo el administrador necesita la lista: para el filtro y para poner
  // nombre a cada cita. Un barbero solo ve las suyas.
  const barberos = useAsync(() => getBarbers(), [], esAdmin);

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

  const elegirDia = useCallback((iso: string) => {
    setSelectedDate(iso);
    setVisibleMonth(monthKeyOf(iso));
  }, []);

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
              setBusyId(booking.id);
              cancelBooking(booking.id)
                .then(() => {
                  recargarAgenda();
                })
                .catch((fallo: unknown) => {
                  const error = toApiError(fallo);
                  Alert.alert('No se pudo cancelar', error.isNetwork ? SIN_CONEXION : error.message);
                })
                .finally(() => {
                  setBusyId(null);
                });
            },
          },
        ],
      );
    },
    [recargarAgenda],
  );

  /**
   * Marcar no pide confirmación, a diferencia de cancelar: no es
   * irreversible (se corrige con el otro botón) y es lo que el barbero hace
   * cita tras cita. Un diálogo cada vez sería un toque de más.
   */
  const marcar = useCallback(
    (booking: Booking, outcome: BookingOutcome) => {
      setBusyId(booking.id);
      setBookingStatus(booking.id, outcome)
        .then(() => {
          recargarAgenda();
        })
        .catch((fallo: unknown) => {
          const error = toApiError(fallo);
          Alert.alert('No se pudo marcar', error.isNetwork ? SIN_CONEXION : error.message);
        })
        .finally(() => {
          setBusyId(null);
        });
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

  /**
   * Mientras se carga OTRO día no se enseñan las citas del anterior: serían
   * datos de una fecha bajo el título de otra. Al recargar el mismo día sí se
   * conservan, con el indicador de recarga encima.
   */
  const cargandoDia = agenda.loading && !agenda.refreshing;
  const citas = cargandoDia ? [] : (agenda.data ?? []);
  const hayDatos = !cargandoDia && agenda.error === null;

  const ahora = horaActual();
  const pendientes = citas.filter((cita) => cita.status === 'activa').length;

  /**
   * Un día que ya empezó cuenta lo cobrado: solo las citas atendidas. Uno
   * futuro, lo que dejarían sus citas si todas se cumplen. Mezclar las dos
   * cosas en una cifra sumaría dinero que todavía no ha entrado.
   *
   * Las citas sin servicio no suman: se desconoce su precio, no es cero.
   */
  const esFuturo = selectedDate > hoy;
  const cuentan = citas.filter((cita) =>
    esFuturo ? cita.status === 'activa' : cita.status === 'atendida',
  );
  const dinero = cuentan.reduce((suma, cita) => suma + (cita.service?.priceCop ?? 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={agenda.refreshing}
            onRefresh={recargarAgenda}
            tintColor={colors.primaryText}
            colors={[colors.primary]}
          />
        }
      >
        <AdminHeader user={user} onLogout={cerrarSesion} />

        <DayNavigator
          date={selectedDate}
          today={hoy}
          onChange={elegirDia}
          expanded={calendarioAbierto}
          onToggleCalendar={() => setCalendarioAbierto((abierto) => !abierto)}
        />

        {calendarioAbierto ? (
          <Calendar
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            selectedDate={selectedDate}
            onSelectDate={(iso) => {
              elegirDia(iso);
              // Elegido el día, el calendario ya cumplió: se recoge para
              // devolverle el sitio a las citas.
              setCalendarioAbierto(false);
            }}
            isDayAvailable={TODOS_LOS_DIAS}
            // Una agenda mira hacia atrás: hay que poder revisar qué pasó ayer.
            allowPast
          />
        ) : null}

        {hayDatos ? (
          <View style={styles.resumen}>
            <StatTile
              icono="calendar-outline"
              valor={String(citas.length)}
              etiqueta={citas.length === 1 ? 'Cita' : 'Citas'}
            />
            <StatTile icono="time-outline" valor={String(pendientes)} etiqueta="Pendientes" />
            <StatTile
              icono="cash-outline"
              valor={formatCop(dinero)}
              etiqueta={esFuturo ? 'Estimado' : 'Cobrado'}
            />
          </View>
        ) : null}

        {/*
          El filtro solo existe para el administrador. A un barbero el
          servidor le devuelve sus citas pase lo que pase, así que un
          selector de barberos sería un control que no controla nada.
        */}
        {esAdmin ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            accessibilityRole="radiogroup"
          >
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
          </ScrollView>
        ) : null}

        {cargandoDia ? <LoadingState label="Cargando la agenda..." slow={agenda.slow} /> : null}

        {agenda.error !== null ? (
          <ErrorState error={agenda.error} onRetry={agenda.reload} />
        ) : null}

        {hayDatos && citas.length === 0 ? (
          <EmptyState
            icono="calendar-clear-outline"
            titulo="No hay citas para este día."
            detalle="Desliza hacia abajo para comprobar si entró alguna."
          />
        ) : null}

        {citas.length > 0 ? (
          <View style={styles.lista}>
            <Text style={styles.seccion}>Citas del día</Text>

            {citas.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                // A un barbero no se le repite su propio nombre en cada cita.
                barberName={
                  esAdmin
                    ? (nombrePorBarbero.get(booking.barberId) ?? booking.barberId)
                    : undefined
                }
                started={yaEmpezo(booking, hoy, ahora)}
                onCancel={confirmarCancelacion}
                onOutcome={marcar}
                busy={busyId === booking.id}
              />
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
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  resumen: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filters: {
    gap: spacing.xs,
  },
  lista: {
    gap: spacing.sm,
  },
  seccion: {
    ...typography.micro,
    color: colors.textSecondary,
  },
});
