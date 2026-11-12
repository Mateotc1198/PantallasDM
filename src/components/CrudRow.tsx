import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface CrudRowProps {
  nombre: string;
  /** Segunda línea: precio y categoría, especialidad... */
  detalle: string;
  /** Elemento a la izquierda del texto, p. ej. la foto. */
  inicio?: ReactNode;
  onEditar: () => void;
  onEliminar: () => void;
  /** Hay un borrado de esta fila en curso: su botón no responde. */
  eliminando: boolean;
  /** Verbo del borrado para el lector de pantalla. Por defecto "Eliminar". */
  verboEliminar?: string;
}

/**
 * Fila de una lista gestionable del panel: qué es, y sus dos acciones.
 *
 * Los botones son solo un icono, así que cada uno lleva una etiqueta con el
 * nombre del elemento ("Editar Fade"): sin ella, un lector de pantalla
 * anunciaría una lista de botones idénticos.
 */
export function CrudRow({
  nombre,
  detalle,
  inicio,
  onEditar,
  onEliminar,
  eliminando,
  verboEliminar = 'Eliminar',
}: CrudRowProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.fila}>
      {inicio}

      <View style={styles.texto}>
        <Text style={styles.nombre}>{nombre}</Text>
        <Text style={styles.detalle}>{detalle}</Text>
      </View>

      <Pressable
        onPress={onEditar}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${nombre}`}
        style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
      >
        <Ionicons name="create-outline" size={20} color={colors.primaryText} />
      </Pressable>

      <Pressable
        onPress={onEliminar}
        disabled={eliminando}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`${verboEliminar} ${nombre}`}
        style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
      >
        <Ionicons
          name="trash-outline"
          size={20}
          color={eliminando ? colors.textMuted : colors.busy}
        />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  detalle: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  accion: {
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
