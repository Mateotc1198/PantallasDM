import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily, spacing, type Palette } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

interface TopBarProps {
  onClose: () => void;
}

export function TopBar({ onClose }: TopBarProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar y volver al inicio"
        style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.brand}>ZonaBarber</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    position: 'absolute',
    left: spacing.md,
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  brand: {
    fontFamily,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
});
