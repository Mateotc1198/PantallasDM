import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

interface ThemeToggleProps {
  /**
   * Color del icono. Se pasa cuando el botón va sobre algo que no sigue al
   * tema, como la fotografía del inicio, que está oscurecida siempre.
   */
  color?: string;
  size?: number;
}

/**
 * Cambia entre tema oscuro y claro.
 *
 * Muestra el icono del tema al que se VA, no del actual: un botón con un sol
 * se lee como "ponlo claro". Mostrar el estado actual confunde, porque un
 * icono junto a un control se interpreta como la acción que dispara.
 */
export function ThemeToggle({ color, size = 20 }: ThemeToggleProps) {
  const { name, colors, toggle } = useTheme();
  const vaAClaro = name === 'dark';

  return (
    <Pressable
      onPress={toggle}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityState={{ checked: !vaAClaro }}
      accessibilityLabel={vaAClaro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={vaAClaro ? 'sunny-outline' : 'moon-outline'}
        size={size}
        color={color ?? colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
