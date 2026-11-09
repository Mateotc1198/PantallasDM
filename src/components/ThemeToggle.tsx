import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

const SIZE = 48;
const ICON = 22;

/**
 * Interruptor de tema, flotante sobre todas las pantallas.
 *
 * Vive en el layout raíz y no en cada pantalla: así está en las cinco del
 * flujo de reserva, en el inicio y en las que aún no existen, sin que nadie
 * tenga que acordarse de añadirlo.
 *
 * Va arriba y no abajo como el botón de WhatsApp porque tres pantallas del
 * flujo tienen un botón de ancho completo pegado al borde inferior; un
 * flotante ahí se sentaría encima de "Confirmar cita".
 *
 * Muestra el icono del tema al que se VA, no del actual: un botón con un sol
 * se lee como "ponlo claro". Un icono junto a un control se interpreta como
 * la acción que dispara, no como el estado en que está.
 */
export function ThemeToggle() {
  const styles = useThemedStyles(makeStyles);
  const { name, colors, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const vaAClaro = name === 'dark';

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: !vaAClaro }}
      accessibilityLabel={vaAClaro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      style={({ pressed }) => [
        styles.fab,
        // El inset evita la muesca y la cámara; sin esto el botón queda
        // debajo del recorte en los teléfonos que lo tienen.
        { top: insets.top + spacing.sm },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={vaAClaro ? 'sunny-outline' : 'moon-outline'}
        size={ICON}
        color={colors.primaryText}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    // El borde no es decorativo: sobre la fotografía del inicio, en tema
    // oscuro, el círculo y el fondo son casi del mismo color.
    borderWidth: 1,
    borderColor: colors.border,
    // Sombra en las dos plataformas: Android usa elevation, iOS las shadow*.
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: {
    opacity: 0.7,
  },
});
