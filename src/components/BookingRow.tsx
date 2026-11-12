import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { enlaceWhatsAppCliente } from '../config/barberia';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Booking } from '../types/api';
import { formatTime12h } from '../utils/date';
import { formatCop } from '../utils/money';

interface BookingRowProps {
  booking: Booking;
  /**
   * Nombre legible del barbero. Se omite en la agenda de un barbero: todas
   * las citas que ve son suyas y repetirlo en cada tarjeta es ruido.
   */
  barberName?: string;
  onCancel: (booking: Booking) => void;
  cancelling?: boolean;
  /** La hora de la cita ya pasó: se atenúa para que destaque lo que falta. */
  past?: boolean;
}

/**
 * Una cita en la agenda.
 *
 * La hora va primero, en un bloque propio, porque es el dato por el que se
 * busca: quien mira esta lista está comprobando qué le toca a las diez, no
 * quién es el tercer cliente del día. Debajo del cliente va lo que hay que
 * hacerle, que es lo siguiente que el barbero necesita saber.
 */
export function BookingRow({
  booking,
  barberName,
  onCancel,
  cancelling = false,
  past = false,
}: BookingRowProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const hora = formatTime12h(booking.time);
  // "9:30 am" -> ["9:30", "am"]: el número grande y el periodo pequeño.
  const [reloj, periodo = ''] = hora.split(' ');

  const escribir = () => {
    void Linking.openURL(
      enlaceWhatsAppCliente(
        booking.customerPhone,
        `Hola ${booking.customerName}, te escribimos por tu cita de las ${hora}.`,
      ),
    );
  };

  return (
    <View style={[styles.row, past && styles.rowPast]}>
      <View style={styles.timeBlock}>
        <Text style={styles.time}>{reloj}</Text>
        <Text style={styles.period}>{periodo}</Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.customer} numberOfLines={1}>
          {booking.customerName}
        </Text>

        {booking.service !== null ? (
          <Text style={styles.service} numberOfLines={1}>
            {`${booking.service.name} · ${formatCop(booking.service.priceCop)}`}
          </Text>
        ) : (
          <Text style={styles.noService}>Sin servicio indicado</Text>
        )}

        <View style={styles.metaRow}>
          {barberName !== undefined ? (
            <View style={styles.metaItem}>
              <Ionicons name="cut-outline" size={12} color={colors.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>
                {barberName}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="call-outline" size={12} color={colors.textMuted} />
            <Text style={styles.meta}>{booking.customerPhone}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={escribir}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Escribir por WhatsApp a ${booking.customerName}`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="logo-whatsapp" size={18} color={colors.whatsapp} />
        </Pressable>

        {cancelling ? (
          <View style={styles.action}>
            <ActivityIndicator size="small" color={colors.busy} />
          </View>
        ) : (
          <Pressable
            onPress={() => onCancel(booking)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Cancelar la cita de ${booking.customerName} a las ${hora}`}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={colors.busy} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPast: {
    opacity: 0.55,
  },
  timeBlock: {
    width: 64,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  time: {
    ...typography.cardTitle,
    fontSize: 17,
    color: colors.primaryText,
  },
  period: {
    ...typography.micro,
    color: colors.primaryText,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  customer: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
  },
  service: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  noService: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: 2,
    paddingTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    ...typography.meta,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.xs,
  },
  action: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
