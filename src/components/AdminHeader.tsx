import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AuthUser } from '../types/api';
import { FilterChip } from './FilterChip';

interface AdminHeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

interface Pestana {
  label: string;
  ruta: '/admin' | '/admin/servicios';
  /** Solo el administrador la ve. */
  soloAdmin: boolean;
}

/**
 * El diseño tiene cuatro pestañas: Agenda, Barberos, Servicios y Contacto.
 * Aquí hay dos, las que llevan a algo que existe. Una pestaña que no abre
 * nada es el mismo problema que los botones muertos del inicio.
 */
const PESTANAS: Pestana[] = [
  { label: 'Agenda', ruta: '/admin', soloAdmin: false },
  { label: 'Servicios', ruta: '/admin/servicios', soloAdmin: true },
];

/**
 * Cabecera del panel.
 *
 * Vive aparte porque las dos pantallas del panel la comparten, y porque
 * saber qué pestaña está activa es cosa de la ruta y no del estado de
 * ninguna de ellas.
 */
export function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();

  const esAdmin = user.role === 'admin';
  const visibles = PESTANAS.filter((pestana) => esAdmin || !pestana.soloAdmin);

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        <View style={styles.identidad}>
          <Text style={styles.marca}>ZONABARBER</Text>
          <Text style={styles.rol}>
            {esAdmin ? 'Panel de administración' : `Agenda de ${user.username}`}
          </Text>
        </View>
        <Pressable
          onPress={onLogout}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          style={({ pressed }) => [styles.salir, pressed && styles.pressed]}
        >
          <Text style={styles.salirLabel}>Cerrar sesión</Text>
        </Pressable>
      </View>

      {/* Con una sola pestaña no hay nada que elegir: no se pinta. */}
      {visibles.length > 1 ? (
        <View style={styles.pestanas} accessibilityRole="tablist">
          {visibles.map((pestana) => (
            <FilterChip
              key={pestana.ruta}
              label={pestana.label}
              selected={pathname === pestana.ruta}
              onPress={() => router.replace(pestana.ruta)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  contenedor: {
    gap: spacing.sm,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    // Deja sitio al interruptor de tema, que flota arriba a la derecha.
    paddingRight: 56,
  },
  identidad: {
    flex: 1,
    gap: 2,
  },
  marca: {
    ...typography.cardTitle,
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  rol: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  salir: {
    paddingVertical: spacing.xs,
  },
  salirLabel: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.primaryText,
  },
  pestanas: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
