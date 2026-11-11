import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ApiError, toApiError } from '../../src/api/client';
import { Calendar } from '../../src/components/Calendar';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SlotChip } from '../../src/components/SlotChip';
import { TopBar } from '../../src/components/TopBar';
import { rescheduleBooking } from '../../src/data/bookings';
import { getMonthAvailability, getSlots } from '../../src/data/slots';
import { useAsync } from '../../src/hooks/useAsync';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Slot } from '../../src/types/api';
import { currentMonthKey, formatShortDate } from '../../src/utils/date';

const PHONE_LENGTH = 10;
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

/**
 * Elegir nueva fecha y hora para una cita existente.
 *
 * Reutiliza el calendario y las franjas del flujo de reserva, pero no pasa
 * por BookingContext: aquí no se está construyendo una cita nueva, se está
 * moviendo una que ya existe y cuyo barbero no se puede cambiar.
 */
export default function AplazarScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  // Llegan por la ruta para no volver a pedir la cita al servidor, que en
  // frío puede tardar veinte segundos en responder.
  const { id, barberId } = useLocalSearchParams<{ id: string; barberId: string }>();

  const [visibleMonth, setVisibleMonth] = useState(() => currentMonthKey());
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const disponibilidad = useAsync(
    async () => getMonthAvailability(barberId, visibleMonth),
    [barberId, visibleMonth],
  );

  const diasConCupo = useMemo(
    () => new Set(disponibilidad.data?.days ?? []),
    [disponibilidad.data],
  );

  const horarios = useAsync<Slot[]>(
    async () => (date === null ? [] : getSlots(barberId, date)),
    [barberId, date],
    date !== null,
  );

  const listo = date !== null && time !== null && telefono.length === PHONE_LENGTH;

  const confirmar = useCallback(async () => {
    if (!listo || enviando || date === null || time === null) {
      return;
    }
    setEnviando(true);
    setError(null);

    try {
      await rescheduleBooking(id, telefono, date, time);
      if (montado.current) {
        // replace y no back: al volver, "Mi cita" vuelve a pedir la cita y
        // muestra la fecha nueva en lugar de la vieja en caché.
        router.replace('/cita');
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        const apiError = toApiError(fallo);
        setError(apiError);
        // Si la franja se ocupó mientras elegía, lo que hay en pantalla ya
        // no es cierto: se recargan las horas de ese día.
        if (apiError.isConflict) {
          horarios.reload();
          setTime(null);
        }
      }
    } finally {
      if (montado.current) {
        setEnviando(false);
      }
    }
  }, [date, enviando, horarios, id, listo, router, telefono, time]);

  const slots = horarios.data ?? [];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBarArea}>
        <TopBar onClose={() => router.replace('/')} />
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Aplazar mi cita</Text>
          <Text style={styles.ayuda}>
            Elige el nuevo día y la nueva hora. Seguirás con el mismo barbero.
          </Text>

          {disponibilidad.error !== null ? (
            <ErrorState error={disponibilidad.error} onRetry={disponibilidad.reload} />
          ) : (
            <>
              <Calendar
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                selectedDate={date}
                onSelectDate={(iso) => {
                  setDate(iso);
                  setTime(null);
                }}
                isDayAvailable={(iso) => diasConCupo.has(iso)}
              />
              {disponibilidad.loading ? (
                <LoadingState label="Consultando disponibilidad..." slow={disponibilidad.slow} />
              ) : null}
            </>
          )}

          {date !== null ? (
            <View style={styles.horas}>
              <Text style={styles.subtitulo}>{formatShortDate(date)}</Text>

              {horarios.loading ? (
                <LoadingState label="Consultando horarios..." slow={horarios.slow} />
              ) : null}

              {horarios.error !== null ? (
                <ErrorState error={horarios.error} onRetry={horarios.reload} />
              ) : null}

              {!horarios.loading && horarios.error === null && slots.length === 0 ? (
                <Text style={styles.vacio}>Sin horarios disponibles ese día.</Text>
              ) : null}

              <View style={styles.grid}>
                {slots.map((slot) => (
                  <View key={slot.id} style={styles.gridItem}>
                    <SlotChip
                      slot={slot}
                      selected={slot.time === time}
                      onSelect={(elegido) => setTime(elegido.time)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {time !== null ? (
            <View style={styles.confirmacion}>
              <Text style={styles.ayuda}>
                Para confirmar, escribe el celular con el que reservaste.
              </Text>
              <TextInput
                value={telefono}
                onChangeText={(valor) =>
                  setTelefono(valor.replace(/\D/g, '').slice(0, PHONE_LENGTH))
                }
                placeholder="Número de celular"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={PHONE_LENGTH}
                editable={!enviando}
                accessibilityLabel="Celular con el que reservaste"
                style={styles.input}
              />

              {error !== null ? (
                <Text style={styles.error}>
                  {error.isNetwork
                    ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
                    : error.message}
                </Text>
              ) : null}

              <PrimaryButton
                label="Confirmar cambio"
                loadingLabel="Aplazando..."
                loading={enviando}
                disabled={!listo}
                onPress={() => {
                  void confirmar();
                }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBarArea: {
    backgroundColor: colors.surfaceAlt,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
    paddingTop: spacing.xs,
  },
  subtitulo: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  ayuda: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  horas: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31%',
  },
  vacio: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  confirmacion: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.textPrimary,
  },
  error: {
    ...typography.caption,
    color: colors.busy,
  },
});
