import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { BarberSummary } from '../types/api';
import { Avatar } from './Avatar';

const AVATAR_SIZE = 40;

interface BarberChipProps {
  barber: BarberSummary;
  /** La navegación la decide la pantalla; el chip solo avisa del intento. */
  onChange: () => void;
}

export function BarberChip({ barber, onChange }: BarberChipProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <Avatar uri={barber.avatar} size={AVATAR_SIZE} />
      <View style={styles.info}>
        <Text style={styles.overline}>Tu barbero</Text>
        <Text style={styles.name} numberOfLines={1}>
          {barber.name}
        </Text>
      </View>
      <Pressable
        onPress={onChange}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cambiar de barbero"
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={styles.change}>Cambiar</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  overline: {
    ...typography.micro,
    color: colors.textMuted,
  },
  name: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  change: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryText,
  },
  pressed: {
    opacity: 0.6,
  },
});
