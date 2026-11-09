import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Bloquea el botón y muestra loadingLabel mientras la acción corre. */
  loading?: boolean;
  loadingLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
}: PrimaryButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const inactive = disabled || loading;
  const text = loading ? (loadingLabel ?? label) : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      <Text style={[styles.label, inactive && styles.labelInactive]}>{text}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pressed: {
    backgroundColor: colors.primaryDark,
  },
  inactive: {
    backgroundColor: colors.disabledBg,
  },
  label: {
    ...typography.button,
    color: colors.onPrimary,
  },
  labelInactive: {
    color: colors.textMuted,
  },
});
