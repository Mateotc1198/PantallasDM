import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Booking } from '../types/api';
import { formatTime12h } from '../utils/date';

interface BookingRowProps {
  booking: Booking;
  /** Nombre legible del barbero; el id no le dice nada a nadie. */
  barberName: string;
  onCancel: (booking: Booking) => void;
  cancelling?: boolean;
}

/**
 * Una cita en la agenda.
 *
 * La hora va primero y en grande porque es el dato por el que se busca:
 * quien mira esta lista está comprobando qué le toca a las diez, no quién
 * es el tercer cliente del día.
 */
export function BookingRow({
  booking,
  barberName,
  onCancel,
  cancelling = false,
}: BookingRowProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      <Text style={styles.time}>{formatTime12h(booking.time)}</Text>

      <View style={styles.details}>
        <Text style={styles.customer} numberOfLines={1}>
          {booking.customerName}
        </Text>
        <Text style={styles.barber} numberOfLines={1}>
          {barberName}
        </Text>
        <Text style={styles.phone}>{booking.customerPhone}</Text>
      </View>

      {cancelling ? (
        <ActivityIndicator size="small" color={styles.cancelLabel.color} />
      ) : (
        <Pressable
          onPress={() => onCancel(booking)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Cancelar la cita de ${booking.customerName} a las ${formatTime12h(booking.time)}`}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelLabel}>Cancelar</Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  time: {
    ...typography.bodyStrong,
    color: colors.primaryText,
    width: 76,
  },
  details: {
    flex: 1,
    gap: 1,
  },
  customer: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  barber: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  phone: {
    ...typography.meta,
    color: colors.textMuted,
  },
  cancel: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelLabel: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.busy,
  },
  pressed: {
    opacity: 0.6,
  },
});
