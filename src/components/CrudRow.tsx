import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

type NombreDeIcono = keyof typeof Ionicons.glyphMap;

interface Insignia {
  icono: NombreDeIcono;
  texto: string;
  /** Resaltada (con color) o apagada (gris): "tiene acceso" contra "no tiene". */
  activa: boolean;
}

interface AccionExtra {
  icono: NombreDeIcono;
  /** Etiqueta completa para el lector de pantalla. */
  etiqueta: string;
  onPress: () => void;
}

interface CrudRowProps {
  nombre: string;
  /** Segunda línea: categoría, especialidad... */
  detalle: string;
  /** Elemento a la izquierda del texto, p. ej. la foto. */
  inicio?: ReactNode;
  /** Dato destacado a la derecha del nombre, p. ej. el precio. */
  valor?: string;
  /** Estado en una píldora bajo el detalle. */
  insignia?: Insignia;
  /** Tercera acción, antes de editar y eliminar. */
  accionExtra?: AccionExtra;
  onEditar: () => void;
  onEliminar: () => void;
  /** Hay un borrado de esta fila en curso: su botón no responde. */
  eliminando: boolean;
  /** Verbo del borrado para el lector de pantalla. Por defecto "Eliminar". */
  verboEliminar?: string;
}

/**
 * Fila de una lista gestionable del panel: qué es, y sus acciones.
 *
 * Los botones son solo un icono, así que cada uno lleva una etiqueta con el
 * nombre del elemento ("Editar Fade"): sin ella, un lector de pantalla
 * anunciaría una lista de botones idénticos.
 */
export function CrudRow({
  nombre,
  detalle,
  inicio,
  valor,
  insignia,
  accionExtra,
  onEditar,
  onEliminar,
  eliminando,
  verboEliminar = 'Eliminar',
}: CrudRowProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.fila}>
      <View style={styles.cabecera}>
        {inicio}

        <View style={styles.texto}>
          <Text style={styles.nombre} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={styles.detalle} numberOfLines={2}>
            {detalle}
          </Text>
        </View>

        {valor !== undefined ? <Text style={styles.valor}>{valor}</Text> : null}
      </View>

      <View style={styles.pie}>
        {insignia !== undefined ? (
          <View style={styles.insignia}>
            <Ionicons
              name={insignia.icono}
              size={12}
              color={insignia.activa ? colors.primaryText : colors.textMuted}
            />
            <Text
              style={[styles.insigniaTexto, insignia.activa && styles.insigniaTextoActiva]}
              numberOfLines={1}
            >
              {insignia.texto}
            </Text>
          </View>
        ) : (
          <View style={styles.relleno} />
        )}

        <View style={styles.acciones}>
          {accionExtra !== undefined ? (
            <Pressable
              onPress={accionExtra.onPress}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={accionExtra.etiqueta}
              style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
            >
              <Ionicons name={accionExtra.icono} size={17} color={colors.textPrimary} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={onEditar}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${nombre}`}
            style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={17} color={colors.primaryText} />
          </Pressable>

          <Pressable
            onPress={onEliminar}
            disabled={eliminando}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${verboEliminar} ${nombre}`}
            style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={eliminando ? colors.textMuted : colors.busy}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fila: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  texto: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  detalle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  valor: {
    ...typography.cardTitle,
    color: colors.primaryText,
  },
  pie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  relleno: {
    flex: 1,
  },
  insignia: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insigniaTexto: {
    ...typography.meta,
    flexShrink: 1,
    color: colors.textMuted,
  },
  insigniaTextoActiva: {
    fontWeight: '700',
    color: colors.primaryText,
  },
  acciones: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  accion: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
