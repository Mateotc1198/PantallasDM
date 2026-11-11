import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Slot } from '../types/api';
import { formatTime12h } from '../utils/date';

interface SlotChipProps {
  slot: Slot;
  selected: boolean;
  onSelect: (slot: Slot) => void;
}

export function SlotChip({ slot, selected, onSelect }: SlotChipProps) {
  const styles = useThemedStyles(makeStyles);
  const busy = slot.status === 'ocupado';
  const label = formatTime12h(slot.time);

  if (busy) {
    return (
      <View style={[styles.chip, styles.busyChip]} accessibilityLabel={`${label}, ocupado`}>
        <Text style={[styles.time, styles.busyText]}>{label}</Text>
        <Text style={[styles.status, styles.busyText]}>ocupado</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onSelect(slot)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, libre`}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selectedChip : styles.freeChip,
        pressed && !selected && styles.pressed,
      ]}
    >
      <Text style={[styles.time, selected ? styles.selectedText : styles.freeText]}>{label}</Text>
      <Text style={[styles.status, selected ? styles.selectedText : styles.freeText]}>
        {selected ? 'elegido' : 'libre'}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 2,
  },
  freeChip: {
    borderWidth: 1,
    borderColor: colors.free,
  },
  busyChip: {
    borderWidth: 1,
    borderColor: colors.busy,
  },
  selectedChip: {
    backgroundColor: colors.primary,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  time: {
    ...typography.bodyStrong,
  },
  status: {
    ...typography.micro,
    fontWeight: '400',
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'none',
  },
  freeText: {
    color: colors.freeText,
  },
  busyText: {
    color: colors.busy,
    textDecorationLine: 'line-through',
  },
  selectedText: {
    color: colors.onPrimary,
  },
});
