import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { enlaceWhatsAppCliente } from '../config/barberia';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Booking, BookingOutcome } from '../types/api';
import { formatTime12h } from '../utils/date';
import { formatCop } from '../utils/money';

interface BookingRowProps {
  booking: Booking;
  /**
   * Nombre legible del barbero. Se omite en la agenda de un barbero: todas
   * las citas que ve son suyas y repetirlo en cada tarjeta es ruido.
   */
  barberName?: string;
  /**
   * Ya llegó la hora de la cita. Antes se puede cancelar; desde entonces lo
   * que toca es decir cómo terminó.
   */
  started: boolean;
  onCancel: (booking: Booking) => void;
  onOutcome: (booking: Booking, outcome: BookingOutcome) => void;
  /** Hay una acción en curso sobre esta cita: sus botones no responden. */
  busy?: boolean;
}

/** Cómo se ve cada estado de cierre en la píldora de la tarjeta. */
const ETIQUETA_DE_ESTADO: Record<BookingOutcome, string> = {
  atendida: 'Atendida',
  no_asistio: 'No vino',
};

/**
 * Una cita en la agenda.
 *
 * La hora va primero, en un bloque propio, porque es el dato por el que se
 * busca. Debajo del cliente va lo que hay que hacerle.
 *
 * Las acciones cambian con el momento de la cita:
 * - antes de su hora: escribirle al cliente y cancelar;
 * - desde su hora: marcar si vino o no. Una cita que ya pasó y nadie marcó
 *   lleva el aviso "Sin marcar", para que no se quede así.
 * Ya marcada, el botón del estado actual queda resaltado y el otro sirve para
 * corregir un toque equivocado.
 */
export function BookingRow({
  booking,
  barberName,
  started,
  onCancel,
  onOutcome,
  busy = false,
}: BookingRowProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const hora = formatTime12h(booking.time);
  // "9:30 am" -> ["9:30", "am"]: el número grande y el periodo pequeño.
  const [reloj, periodo = ''] = hora.split(' ');

  const cerrada = booking.status === 'atendida' || booking.status === 'no_asistio';
  const sinMarcar = started && booking.status === 'activa';

  const escribir = () => {
    void Linking.openURL(
      enlaceWhatsAppCliente(
        booking.customerPhone,
        `Hola ${booking.customerName}, te escribimos por tu cita de las ${hora}.`,
      ),
    );
  };

  return (
    <View style={[styles.row, cerrada && styles.rowCerrada, sinMarcar && styles.rowSinMarcar]}>
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

        {cerrada ? (
          <View
            style={[
              styles.pill,
              booking.status === 'atendida' ? styles.pillAtendida : styles.pillNoVino,
            ]}
          >
            <Text
              style={[
                styles.pillTexto,
                booking.status === 'atendida' ? styles.pillTextoAtendida : styles.pillTextoNoVino,
              ]}
            >
              {ETIQUETA_DE_ESTADO[booking.status as BookingOutcome]}
            </Text>
          </View>
        ) : null}

        {sinMarcar ? (
          <View style={[styles.pill, styles.pillPendiente]}>
            <Text style={[styles.pillTexto, styles.pillTextoPendiente]}>Sin marcar</Text>
          </View>
        ) : null}
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

        {busy ? (
          <View style={styles.action}>
            <ActivityIndicator size="small" color={colors.primaryText} />
          </View>
        ) : null}

        {!busy && !started ? (
          <Pressable
            onPress={() => onCancel(booking)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Cancelar la cita de ${booking.customerName} a las ${hora}`}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={colors.busy} />
          </Pressable>
        ) : null}

        {!busy && started ? (
          <>
            <Pressable
              onPress={() => onOutcome(booking, 'atendida')}
              disabled={booking.status === 'atendida'}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Marcar atendida la cita de ${booking.customerName}`}
              accessibilityState={{ selected: booking.status === 'atendida' }}
              style={({ pressed }) => [
                styles.action,
                booking.status === 'atendida' && styles.actionAtendida,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={booking.status === 'atendida' ? colors.onPrimary : colors.freeText}
              />
            </Pressable>
            <Pressable
              onPress={() => onOutcome(booking, 'no_asistio')}
              disabled={booking.status === 'no_asistio'}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Marcar que ${booking.customerName} no vino`}
              accessibilityState={{ selected: booking.status === 'no_asistio' }}
              style={({ pressed }) => [
                styles.action,
                booking.status === 'no_asistio' && styles.actionNoVino,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="person-remove-outline"
                size={17}
                color={booking.status === 'no_asistio' ? colors.onPrimary : colors.busy}
              />
            </Pressable>
          </>
        ) : null}
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
  // Una cita cerrada ya no pide nada: se atenúa para que destaque lo que falta.
  rowCerrada: {
    opacity: 0.7,
  },
  // Una que ya pasó sin marcar sí pide algo: el borde la señala.
  rowSinMarcar: {
    borderColor: colors.primary,
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
  pill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillAtendida: {
    backgroundColor: colors.free,
  },
  pillNoVino: {
    backgroundColor: colors.busy,
  },
  pillPendiente: {
    backgroundColor: colors.primarySoft,
  },
  pillTexto: {
    ...typography.micro,
  },
  pillTextoAtendida: {
    color: colors.onPrimary,
  },
  pillTextoNoVino: {
    color: colors.onPrimary,
  },
  pillTextoPendiente: {
    color: colors.primaryText,
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
  actionAtendida: {
    backgroundColor: colors.free,
    borderColor: colors.free,
  },
  actionNoVino: {
    backgroundColor: colors.busy,
    borderColor: colors.busy,
  },
  pressed: {
    opacity: 0.6,
  },
});
