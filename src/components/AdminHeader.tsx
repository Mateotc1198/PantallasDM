import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AuthUser } from '../types/api';

interface AdminHeaderProps {
  user: AuthUser;
  onLogout: () => void;
}

type NombreDeIcono = keyof typeof Ionicons.glyphMap;

interface Pestana {
  label: string;
  ruta: '/admin' | '/admin/barberos' | '/admin/servicios';
  icono: NombreDeIcono;
  /** Solo el administrador la ve. */
  soloAdmin: boolean;
}

/**
 * El diseño tiene cuatro pestañas: Agenda, Barberos, Servicios y Contacto.
 * Aquí hay tres, las que llevan a algo que el panel gestiona. Contacto no
 * está: es información fija de la barbería, sin nada que editar, y una
 * pestaña que no abre nada es el mismo problema que un botón muerto.
 */
const PESTANAS: Pestana[] = [
  { label: 'Agenda', ruta: '/admin', icono: 'calendar-outline', soloAdmin: false },
  { label: 'Barberos', ruta: '/admin/barberos', icono: 'people-outline', soloAdmin: true },
  { label: 'Servicios', ruta: '/admin/servicios', icono: 'cut-outline', soloAdmin: true },
];

/**
 * Cabecera del panel: quién ha entrado, con qué rol, y por dónde se navega.
 *
 * Vive aparte porque todas las pantallas del panel la comparten, y porque
 * saber qué pestaña está activa es cosa de la ruta y no del estado de
 * ninguna de ellas.
 *
 * Las pestañas son un control segmentado y no chips sueltos: los chips del
 * resto de la pantalla filtran lo que se ve, y estas cambian de pantalla. Si
 * se parecen, no se distingue qué hace cada cosa.
 */
export function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const esAdmin = user.role === 'admin';
  const visibles = PESTANAS.filter((pestana) => esAdmin || !pestana.soloAdmin);

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        <View style={styles.insignia}>
          <Ionicons
            name={esAdmin ? 'shield-checkmark-outline' : 'cut-outline'}
            size={20}
            color={colors.primaryText}
          />
        </View>

        <View style={styles.identidad}>
          <Text style={styles.saludo} numberOfLines={1}>{`Hola, ${user.username}`}</Text>
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
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Con una sola pestaña no hay nada que elegir: no se pinta. */}
      {visibles.length > 1 ? (
        <View style={styles.pestanas} accessibilityRole="tablist">
          {visibles.map((pestana) => {
            const activa = pathname === pestana.ruta;
            return (
              <Pressable
                key={pestana.ruta}
                onPress={() => router.replace(pestana.ruta)}
                accessibilityRole="tab"
                accessibilityLabel={pestana.label}
                accessibilityState={{ selected: activa }}
                style={({ pressed }) => [
                  styles.pestana,
                  activa && styles.pestanaActiva,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={pestana.icono}
                  size={16}
                  color={activa ? colors.onPrimary : colors.textSecondary}
                />
                <Text style={[styles.pestanaLabel, activa && styles.pestanaLabelActiva]}>
                  {pestana.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  contenedor: {
    gap: spacing.md,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Deja sitio al interruptor de tema, que flota arriba a la derecha.
    paddingRight: 56,
  },
  insignia: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  identidad: {
    flex: 1,
    gap: 2,
  },
  saludo: {
    ...typography.cardTitle,
    fontSize: 18,
    color: colors.textPrimary,
  },
  rol: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  salir: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pestanas: {
    flexDirection: 'row',
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pestana: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
  },
  pestanaActiva: {
    backgroundColor: colors.primary,
  },
  pestanaLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pestanaLabelActiva: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.6,
  },
});
