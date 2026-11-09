import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Píldora de filtro.
 *
 * Usa accessibilityRole "radio" y no "button": las opciones del filtro son
 * excluyentes entre sí, y un lector de pantalla necesita saber que elegir
 * una deselecciona la otra.
 */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  chip: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
});
