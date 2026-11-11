import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import {
  buildMonthGrid,
  compareMonths,
  currentMonthKey,
  formatMonthLabel,
  fromISODate,
  fromMonthKey,
  isPastDate,
  shiftMonth,
  toMonthKey,
  WEEKDAY_COLUMNS,
} from '../utils/date';

const SELECTED_CIRCLE = 36;

interface CalendarProps {
  /**
   * Mes visible, 'YYYY-MM'. Lo controla la pantalla y no el calendario.
   *
   * Antes era estado interno, y tenía sentido mientras la disponibilidad se
   * calculaba en memoria. Ahora el mes visible decide qué le pedimos a la
   * API, así que tiene que vivir donde se hace la petición.
   */
  month: string;
  onMonthChange: (month: string) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  /** La pantalla decide qué día tiene cupo; el calendario solo lo pinta. */
  isDayAvailable: (date: string) => boolean;
  /**
   * Permite elegir días ya pasados y retroceder de mes.
   *
   * Reservar mira hacia delante, pero una agenda mira hacia atrás: el
   * administrador necesita consultar qué citas hubo ayer.
   */
  allowPast?: boolean;
}

export function Calendar({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  isDayAvailable,
  allowPast = false,
}: CalendarProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const visible = useMemo(() => fromMonthKey(month), [month]);
  const weeks = useMemo(() => buildMonthGrid(visible.year, visible.month), [visible]);

  // Reservando no se navega a meses pasados porque no hay nada que tomar
  // ahí; consultando la agenda, sí.
  const canGoBack = allowPast || compareMonths(visible, fromMonthKey(currentMonthKey())) > 0;

  const goToPreviousMonth = () => {
    const anterior = shiftMonth(visible.year, visible.month, -1);
    onMonthChange(toMonthKey(anterior.year, anterior.month));
  };

  const goToNextMonth = () => {
    const siguiente = shiftMonth(visible.year, visible.month, 1);
    onMonthChange(toMonthKey(siguiente.year, siguiente.month));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={goToPreviousMonth}
          disabled={!canGoBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          accessibilityState={{ disabled: !canGoBack }}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoBack ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(visible.year, visible.month)}</Text>
        <Pressable
          onPress={goToNextMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_COLUMNS.map((column) => (
          <Text key={column} style={styles.weekday}>
            {column}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`semana-${weekIndex}`} style={styles.weekRow}>
          {week.map((iso, dayIndex) => {
            if (iso === null) {
              return <View key={`vacio-${weekIndex}-${dayIndex}`} style={styles.cell} />;
            }

            const disabled = (!allowPast && isPastDate(iso)) || !isDayAvailable(iso);
            const selected = iso === selectedDate;
            const dayNumber = fromISODate(iso).getDate();

            return (
              <Pressable
                key={iso}
                onPress={() => onSelectDate(iso)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                accessibilityLabel={`Día ${dayNumber}`}
                style={styles.cell}
              >
                <View style={[styles.dayWrapper, selected && styles.selectedWrapper]}>
                  <Text
                    style={[
                      styles.day,
                      disabled && styles.dayDisabled,
                      selected && styles.daySelected,
                    ]}
                  >
                    {dayNumber}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  monthLabel: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    ...typography.micro,
    fontSize: 11,
    letterSpacing: 0,
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    paddingBottom: spacing.xs,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayWrapper: {
    width: SELECTED_CIRCLE,
    height: SELECTED_CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedWrapper: {
    backgroundColor: colors.primary,
  },
  day: {
    ...typography.body,
    fontWeight: '600',
    color: colors.freeText,
  },
  dayDisabled: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  daySelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
