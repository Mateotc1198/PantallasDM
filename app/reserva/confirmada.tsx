import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SummaryRow } from '../../src/components/SummaryRow';
import { useBooking } from '../../src/context/BookingContext';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
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
          <Ionicons name="checkmark" size={32} color={colors.primary} />
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
        */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Código de la cita</Text>
          <Text style={styles.code} selectable>
            {booking.id}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Ir al inicio ahora" onPress={goHome} />
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
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
});
