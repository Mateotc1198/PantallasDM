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
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SummaryRow } from '../../src/components/SummaryRow';
import { TopBar } from '../../src/components/TopBar';
import { getBarbers } from '../../src/data/barbers';
import { cancelBookingAsCustomer, getBooking } from '../../src/data/bookings';
import { useAsync } from '../../src/hooks/useAsync';
import { guardarUltimaCita, leerUltimaCita, olvidarUltimaCita } from '../../src/storage/lastBooking';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import { formatDayMonthYear, formatTime12h } from '../../src/utils/date';

const PHONE_LENGTH = 10;
const UUID_LENGTH = 36;
const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

export default function MiCitaScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  /** null = todavía no sabemos; '' = no hay ninguna guardada. */
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<ApiError | null>(null);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  // La cita guardada se lee una sola vez al abrir la pantalla.
  useEffect(() => {
    let vigente = true;
    void leerUltimaCita().then((guardada) => {
      if (vigente) {
        setBookingId(guardada ?? '');
      }
    });
    return () => {
      vigente = false;
    };
  }, []);

  const tieneCita = bookingId !== null && bookingId.length > 0;

  const cita = useAsync(
    async () => (tieneCita ? getBooking(bookingId) : null),
    [bookingId],
    tieneCita,
  );

  const barberos = useAsync(() => getBarbers(), [], tieneCita);

  const nombreBarbero =
    (barberos.data ?? []).find((barbero) => barbero.id === cita.data?.barberId)?.name ??
    cita.data?.barberId ??
    '';

  const buscarPorCodigo = useCallback(() => {
    const limpio = codigo.trim();
    if (limpio.length !== UUID_LENGTH) {
      return;
    }
    void guardarUltimaCita(limpio);
    setBookingId(limpio);
  }, [codigo]);

  const usarOtroCodigo = useCallback(() => {
    void olvidarUltimaCita();
    setBookingId('');
    setCodigo('');
    setConfirmando(false);
    setTelefono('');
    setErrorCancelar(null);
  }, []);

  const cancelar = useCallback(async () => {
    if (telefono.length !== PHONE_LENGTH || cancelando || !tieneCita) {
      return;
    }
    setCancelando(true);
    setErrorCancelar(null);

    try {
      await cancelBookingAsCustomer(bookingId, telefono);
      if (montado.current) {
        setConfirmando(false);
        setTelefono('');
        // Se recarga en vez de asumir: la pantalla muestra el estado que
        // devuelve el servidor, no el que esperábamos provocar.
        cita.reload();
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        setErrorCancelar(toApiError(fallo));
      }
    } finally {
      if (montado.current) {
        setCancelando(false);
      }
    }
  }, [bookingId, cancelando, cita, telefono, tieneCita]);

  const activa = cita.data?.status === 'activa';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBarArea}>
        <TopBar onClose={() => router.replace('/')} />
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Mi cita</Text>

          {bookingId === null ? <LoadingState label="Buscando tu cita..." /> : null}

          {/* Sin cita guardada: o es la primera vez, o cambió de teléfono. */}
          {bookingId === '' ? (
            <View style={styles.sinCita}>
              <Text style={styles.ayuda}>
                No encontramos ninguna cita en este dispositivo. Si tienes el código que te dimos
                al reservar, pégalo aquí.
              </Text>
              <TextInput
                value={codigo}
                onChangeText={setCodigo}
                placeholder="Código de la cita"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Código de la cita"
                style={styles.input}
              />
              <PrimaryButton
                label="Buscar mi cita"
                disabled={codigo.trim().length !== UUID_LENGTH}
                onPress={buscarPorCodigo}
              />
            </View>
          ) : null}

          {cita.loading ? <LoadingState label="Cargando tu cita..." slow={cita.slow} /> : null}

          {cita.error !== null ? (
            <>
              <ErrorState error={cita.error} onRetry={cita.reload} />
              <Pressable onPress={usarOtroCodigo} accessibilityRole="button">
                <Text style={styles.enlace}>Usar otro código</Text>
              </Pressable>
            </>
          ) : null}

          {cita.data !== null && cita.data !== undefined ? (
            <>
              {!activa ? (
                <View style={styles.aviso}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.busy} />
                  <Text style={styles.avisoTexto}>Esta cita está cancelada.</Text>
                </View>
              ) : null}

              <Card>
                <SummaryRow label="Barbero" value={nombreBarbero} />
                <SummaryRow label="Fecha" value={formatDayMonthYear(cita.data.date)} />
                <SummaryRow label="Hora" value={formatTime12h(cita.data.time)} />
                <SummaryRow label="Nombre" value={cita.data.customerName} />
                <SummaryRow label="Celular" value={cita.data.customerPhone} />
              </Card>

              {activa ? (
                <View style={styles.acciones}>
                  <PrimaryButton
                    label="Aplazar mi cita"
                    onPress={() =>
                      router.push({
                        pathname: '/cita/aplazar',
                        params: { id: cita.data!.id, barberId: cita.data!.barberId },
                      })
                    }
                  />

                  {confirmando ? (
                    <View style={styles.confirmacion}>
                      {/*
                        El teléfono no es burocracia: el código de la cita
                        puede haberse visto de reojo o reenviado, y sin este
                        dato cualquiera que lo tuviera podría cancelar una
                        cita ajena.
                      */}
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
                        editable={!cancelando}
                        accessibilityLabel="Celular con el que reservaste"
                        style={styles.input}
                      />

                      {errorCancelar !== null ? (
                        <Text style={styles.error}>
                          {errorCancelar.isNetwork
                            ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
                            : errorCancelar.message}
                        </Text>
                      ) : null}

                      <Pressable
                        onPress={() => {
                          void cancelar();
                        }}
                        disabled={telefono.length !== PHONE_LENGTH || cancelando}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.cancelar,
                          (telefono.length !== PHONE_LENGTH || cancelando) && styles.inactivo,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.cancelarLabel}>
                          {cancelando ? 'Cancelando...' : 'Confirmar cancelación'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => setConfirmando(false)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.enlace}>Mejor no</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setConfirmando(true)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.cancelar, pressed && styles.pressed]}
                    >
                      <Text style={styles.cancelarLabel}>Cancelar mi cita</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable onPress={usarOtroCodigo} accessibilityRole="button">
                  <Text style={styles.enlace}>Buscar otra cita</Text>
                </Pressable>
              )}
            </>
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
  sinCita: {
    gap: spacing.sm,
  },
  ayuda: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
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
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.busy,
  },
  avisoTexto: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  acciones: {
    gap: spacing.sm,
  },
  confirmacion: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelar: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.busy,
  },
  cancelarLabel: {
    ...typography.bodyStrong,
    color: colors.busy,
  },
  inactivo: {
    opacity: 0.4,
  },
  error: {
    ...typography.caption,
    color: colors.busy,
  },
  enlace: {
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.primaryText,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
