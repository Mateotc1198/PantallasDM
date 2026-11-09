import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ApiError, toApiError } from '../../src/api/client';
import { BarberChip } from '../../src/components/BarberChip';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { StepHeader } from '../../src/components/StepHeader';
import { SummaryRow } from '../../src/components/SummaryRow';
import { useBooking } from '../../src/context/BookingContext';
import { createBooking } from '../../src/data/bookings';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import { formatShortDate, formatTime12h } from '../../src/utils/date';

const MIN_NAME_LENGTH = 3;
const PHONE_LENGTH = 10;

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

type FocusedField = 'name' | 'phone' | null;

export default function DatosScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { goBack, changeBarber } = useBookingNavigation();
  const ready = useRequireBooking(['barber', 'date', 'time']);
  const { barber, date, time, name, phone, setName, setPhone, setBooking } = useBooking();

  const [focused, setFocused] = useState<FocusedField>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Evita tocar el estado de una pantalla ya desmontada: el usuario puede
   * retroceder mientras la petición sigue en vuelo, y la respuesta llegará
   * de todos modos.
   */
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= MIN_NAME_LENGTH && phone.length === PHONE_LENGTH;

  /** El teléfono se guarda solo con dígitos: así viaja al backend sin limpiar. */
  const changePhone = useCallback(
    (value: string) => {
      setPhone(value.replace(/\D/g, '').slice(0, PHONE_LENGTH));
    },
    [setPhone],
  );

  const confirm = useCallback(async () => {
    if (!isValid || submitting || barber === null || date === null || time === null) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setName(trimmedName);

    try {
      const booking = await createBooking({
        barberId: barber.id,
        date,
        time,
        customerName: trimmedName,
        customerPhone: phone,
      });

      if (!montado.current) {
        return;
      }
      // Se guarda la cita del servidor, no la que creíamos estar creando: la
      // pantalla final muestra lo que quedó registrado de verdad.
      setBooking(booking);
      router.replace('/reserva/confirmada');
    } catch (fallo: unknown) {
      if (montado.current) {
        setError(toApiError(fallo));
      }
    } finally {
      if (montado.current) {
        setSubmitting(false);
      }
    }
  }, [
    barber,
    date,
    isValid,
    phone,
    router,
    setBooking,
    setName,
    submitting,
    time,
    trimmedName,
  ]);

  if (!ready || barber === null || date === null || time === null) {
    return null;
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={5} label="Datos" onBack={goBack} />
      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BarberChip barber={barber} onChange={changeBarber} />
          <View style={styles.heading}>
            <Text style={styles.title}>Tus datos</Text>
          </View>

          <Card>
            <SummaryRow label="Barbero:" value={barber.name} />
            <SummaryRow label="Fecha:" value={formatShortDate(date)} />
            <SummaryRow label="Hora:" value={formatTime12h(time)} />
          </Card>

          <View style={styles.form}>
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              placeholder="¿Cómo te llamas?"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!submitting}
              accessibilityLabel="Tu nombre"
              style={[styles.input, focused === 'name' && styles.inputFocused]}
            />
            <TextInput
              value={phone}
              onChangeText={changePhone}
              onFocus={() => setFocused('phone')}
              onBlur={() => setFocused(null)}
              placeholder="Número de celular"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={PHONE_LENGTH}
              returnKeyType="done"
              editable={!submitting}
              accessibilityLabel="Tu número de celular"
              style={[styles.input, focused === 'phone' && styles.inputFocused]}
            />
          </View>

          {error !== null ? <SubmitError error={error} onPickAnotherTime={goBack} /> : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="Confirmar cita"
            loadingLabel="Reservando..."
            loading={submitting}
            disabled={!isValid}
            onPress={() => {
              void confirm();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface SubmitErrorProps {
  error: ApiError;
  onPickAnotherTime: () => void;
}

/**
 * Aviso de que la reserva no se completó.
 *
 * El 409 merece un trato aparte y no un "inténtalo de nuevo": reintentar no
 * sirve de nada, porque el horario ya es de otra persona. Es exactamente la
 * carrera que el índice único de la base está ahí para ganar, y la interfaz
 * tiene que honrarla mandando al usuario a elegir otra hora. Si no, la
 * garantía del servidor se convierte en un error incomprensible.
 */
function SubmitError({ error, onPickAnotherTime }: SubmitErrorProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const conflicto = error.isConflict;

  return (
    <View style={[styles.alert, conflicto && styles.alertConflict]}>
      <Ionicons
        name={conflicto ? 'time-outline' : 'alert-circle-outline'}
        size={20}
        color={conflicto ? colors.primaryText : colors.busy}
      />
      <View style={styles.alertBody}>
        <Text style={styles.alertTitle}>
          {conflicto ? 'Ese horario acaba de ocuparse' : 'No pudimos reservar'}
        </Text>
        <Text style={styles.alertDetail}>
          {conflicto
            ? 'Alguien lo tomó mientras completabas tus datos. Elige otra hora disponible.'
            : error.message}
        </Text>
        {conflicto ? (
          <Pressable
            onPress={onPickAnotherTime}
            accessibilityRole="button"
            style={({ pressed }) => [styles.alertAction, pressed && styles.pressed]}
          >
            <Text style={styles.alertActionLabel}>Elegir otra hora</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  fill: {
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
  form: {
    gap: spacing.sm,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  alert: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.busy,
  },
  alertConflict: {
    borderColor: colors.primary,
  },
  alertBody: {
    flex: 1,
    gap: spacing.xs,
  },
  alertTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  alertDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  alertAction: {
    alignSelf: 'flex-start',
    paddingTop: spacing.xs,
  },
  alertActionLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.6,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
});
