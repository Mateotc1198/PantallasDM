import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import { formatShortDate, shiftDays } from '../utils/date';

interface DayNavigatorProps {
  /** Día que se está viendo, 'YYYY-MM-DD'. */
  date: string;
  /** Hoy, 'YYYY-MM-DD'. Llega por prop para que el componente sea puro. */
  today: string;
  onChange: (date: string) => void;
  /** El calendario completo está desplegado debajo. */
  expanded: boolean;
  onToggleCalendar: () => void;
}

/** "Hoy", "Mañana" o "Ayer" si aplica; si no, nada. */
function nombreRelativo(date: string, today: string): string | null {
  if (date === today) return 'Hoy';
  if (date === shiftDays(today, 1)) return 'Mañana';
  if (date === shiftDays(today, -1)) return 'Ayer';
  return null;
}

/**
 * Navegación por días de la agenda.
 *
 * Sustituye al calendario mensual siempre abierto. Quien abre la agenda quiere
 * ver hoy, y a lo sumo mañana o ayer: para eso bastan dos flechas, y las citas
 * quedan arriba en vez de debajo de una cuadrícula de seis filas. El
 * calendario completo sigue a un toque para saltar a una fecha lejana.
 */
export function DayNavigator({
  date,
  today,
  onChange,
  expanded,
  onToggleCalendar,
}: DayNavigatorProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const relativo = nombreRelativo(date, today);
  const fecha = formatShortDate(date);

  return (
    <View style={styles.contenedor}>
      <Pressable
        onPress={() => onChange(shiftDays(date, -1))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Día anterior"
        style={({ pressed }) => [styles.flecha, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
      </Pressable>

      <Pressable
        onPress={onToggleCalendar}
        accessibilityRole="button"
        accessibilityLabel={`${relativo ?? fecha}. Elegir otro día`}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.centro, pressed && styles.pressed]}
      >
        <Text style={styles.titulo}>{relativo ?? fecha}</Text>
        <View style={styles.subfila}>
          {relativo !== null ? <Text style={styles.subtitulo}>{fecha}</Text> : null}
          <Ionicons
            name={expanded ? 'chevron-up' : 'calendar-outline'}
            size={12}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      <Pressable
        onPress={() => onChange(shiftDays(date, 1))}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Día siguiente"
        style={({ pressed }) => [styles.flecha, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centro: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  titulo: {
    ...typography.cardTitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  subfila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subtitulo: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
});
