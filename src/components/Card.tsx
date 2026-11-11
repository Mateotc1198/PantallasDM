import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface CardProps extends PropsWithChildren {
  /** Si se pasa, la tarjeta es presionable y da feedback al tocarla. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, accessibilityLabel }: CardProps) {
  const styles = useThemedStyles(makeStyles);
  if (onPress === undefined) {
    return <View style={styles.card}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: {
    borderColor: colors.primary,
    opacity: 0.9,
  },
});
