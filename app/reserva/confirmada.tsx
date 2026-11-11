import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SummaryRow } from '../../src/components/SummaryRow';
import { enlaceWhatsAppLibre } from '../../src/config/barberia';
import { useBooking } from '../../src/context/BookingContext';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import { formatDayMonthYear, formatTime12h } from '../../src/utils/date';

const CHECK_CIRCLE = 64;

/**
 * Confirmación.
 *
 * Todo lo que se muestra sale de la cita que devolvió el servidor, no del
 * estado local del formulario. La diferencia no es cosmética: el estado local
 * dice lo que el usuario pidió, y la respuesta dice lo que quedó guardado.
 * Enseñar lo primero sería afirmar algo que no hemos comprobado.
 */
export default function ConfirmadaScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { goHome } = useBookingNavigation();
  const ready = useRequireBooking(['booking']);
  const { barber, booking } = useBooking();

  if (!ready || booking === null) {
    return null;
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.check}>
          <Ionicons name="checkmark" size={32} color={colors.primaryText} />
        </View>
        <Text style={styles.title}>Cita confirmada</Text>
        <Text style={styles.subtitle}>{`Te esperamos, ${booking.customerName}.`}</Text>

        <View style={styles.card}>
          <Card>
            <SummaryRow label="Barbero" value={barber?.name ?? booking.barberId} />
            <SummaryRow label="Fecha" value={formatDayMonthYear(booking.date)} />
            <SummaryRow label="Hora" value={formatTime12h(booking.time)} />
            <SummaryRow label="Nombre" value={booking.customerName} />
            <SummaryRow label="Celular" value={booking.customerPhone} />
          </Card>
        </View>

        {/*
          El código es el identificador real de la cita en la base de datos.
          Se muestra completo y seleccionable a propósito: es lo que permite
          consultarla o cancelarla después, y un fragmento recortado no
          serviría para buscarla.

          La aplicación ya lo guardó sola, así que esto es el plan B para
          quien cambie de teléfono o borre los datos.
        */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Código de la cita</Text>
          <Text style={styles.code} selectable>
            {booking.id}
          </Text>

          <Pressable
            onPress={() => {
              const texto = `Mi cita en ZonaBarber: ${formatDayMonthYear(booking.date)} a las ${formatTime12h(booking.time)}. Código: ${booking.id}`;
              void Linking.openURL(enlaceWhatsAppLibre(texto));
            }}
            accessibilityRole="button"
            accessibilityLabel="Enviarme el código por WhatsApp"
            style={({ pressed }) => [styles.share, pressed && styles.pressed]}
          >
            <Ionicons name="logo-whatsapp" size={16} color={colors.whatsapp} />
            <Text style={styles.shareLabel}>Enviármelo por WhatsApp</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Ir al inicio ahora" onPress={goHome} />
        <Pressable
          onPress={() => router.replace('/cita')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.verCita, pressed && styles.pressed]}
        >
          <Text style={styles.verCitaLabel}>Ver, aplazar o cancelar mi cita</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  check: {
    width: CHECK_CIRCLE,
    height: CHECK_CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.resultTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  card: {
    alignSelf: 'stretch',
    paddingTop: spacing.md,
  },
  codeBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  codeLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  code: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  shareLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  verCita: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  verCitaLabel: {
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
