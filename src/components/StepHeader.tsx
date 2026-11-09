import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { spacing, typography, type Palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

const DEFAULT_TOTAL = 5;

interface StepHeaderProps {
  step: number;
  total?: number;
  label: string;
  onBack: () => void;
}

export function StepHeader({ step, total = DEFAULT_TOTAL, label, onBack }: StepHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const ratio = Math.min(Math.max(step / total, 0), 1);
  const fillWidth: DimensionValue = `${ratio * 100}%`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver al paso anterior"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.primaryText} />
          <Text style={styles.label}>{label}</Text>
        </Pressable>
        <Text style={styles.counter}>{`Paso ${step} de ${total}`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: fillWidth }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...typography.overline,
    color: colors.primaryText,
  },
  counter: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  track: {
    height: 3,
    backgroundColor: colors.border,
  },
  fill: {
    height: 3,
    backgroundColor: colors.primary,
  },
});
