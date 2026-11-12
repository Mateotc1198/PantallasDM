import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { elegirFotoDeGaleria, type FotoElegida } from '../media/photoPicker';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import { Avatar } from './Avatar';

const TAMANO = 72;

interface PhotoFieldProps {
  /** Texto sobre el campo. */
  etiqueta?: string;
  /** Redonda para la cara de un barbero, cuadrada para la imagen de un servicio. */
  forma?: 'circulo' | 'cuadrado';
  /** Icono del hueco vacío, cuando todavía no hay imagen. */
  iconoVacio?: keyof typeof Ionicons.glyphMap;
  /** Lo que se ve ahora: la foto nueva, la URL escrita o la foto actual. */
  vistaPrevia: string | null;
  /** Hay una foto de la galería elegida y pendiente de subir. */
  hayFotoNueva: boolean;
  /** Se está editando algo que ya tiene foto. */
  tieneFotoActual: boolean;
  editable: boolean;
  onElegida: (foto: FotoElegida) => void;
  /**
   * Para quitar la imagen. Solo donde es opcional (los servicios): un
   * barbero siempre tiene foto, y ahí no se pasa.
   */
  onQuitar?: () => void;
}

/**
 * Una foto con su vista previa y el botón para elegirla de la galería.
 *
 * La URL, como alternativa, va en un campo aparte debajo. Este componente solo
 * se ocupa de la galería y de enseñar cómo va a quedar.
 */
export function PhotoField({
  etiqueta = 'Foto',
  forma = 'circulo',
  iconoVacio = 'person-outline',
  vistaPrevia,
  hayFotoNueva,
  tieneFotoActual,
  editable,
  onElegida,
  onQuitar,
}: PhotoFieldProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [eligiendo, setEligiendo] = useState(false);

  const elegir = async () => {
    setEligiendo(true);
    try {
      const foto = await elegirFotoDeGaleria();
      // null es que cerró la galería sin elegir: no hay nada que hacer.
      if (foto !== null) {
        onElegida(foto);
      }
    } catch {
      Alert.alert(
        'No se pudo usar esa foto',
        'Prueba con otra imagen de la galería, o pega la URL de la foto.',
      );
    } finally {
      setEligiendo(false);
    }
  };

  let nota = 'Se recorta en cuadrado y se reduce antes de subirla.';
  if (hayFotoNueva) {
    nota = 'Foto nueva lista. Se sube al guardar.';
  } else if (tieneFotoActual) {
    nota = 'Si no eliges otra, se conserva la foto actual.';
  }

  const inactivo = !editable || eligiendo;
  const cuadrada = forma === 'cuadrado';

  let vista;
  if (vistaPrevia === null) {
    vista = (
      <View
        style={[styles.vacia, cuadrada && styles.cuadrada]}
        accessibilityLabel="Sin foto todavía"
      >
        <Ionicons name={iconoVacio} size={30} color={colors.textMuted} />
      </View>
    );
  } else if (cuadrada) {
    vista = (
      <Image
        source={{ uri: vistaPrevia }}
        accessibilityIgnoresInvertColors
        style={[styles.imagenCuadrada, styles.cuadrada]}
      />
    );
  } else {
    vista = <Avatar uri={vistaPrevia} size={TAMANO} ring />;
  }

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>

      <View style={styles.fila}>
        {vista}

        <View style={styles.lado}>
          <Pressable
            onPress={() => {
              void elegir();
            }}
            disabled={inactivo}
            accessibilityRole="button"
            accessibilityLabel="Elegir foto de la galería"
            accessibilityState={{ disabled: inactivo, busy: eligiendo }}
            style={({ pressed }) => [
              styles.boton,
              inactivo && styles.botonInactivo,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="images-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.botonTexto}>
              {eligiendo ? 'Abriendo...' : hayFotoNueva ? 'Cambiar foto' : 'Elegir de la galería'}
            </Text>
          </Pressable>

          <Text style={styles.nota}>{nota}</Text>

          {onQuitar !== undefined && vistaPrevia !== null ? (
            <Pressable
              onPress={onQuitar}
              disabled={inactivo}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Quitar la imagen"
              style={({ pressed }) => [styles.quitar, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.busy} />
              <Text style={styles.quitarTexto}>Quitar imagen</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  contenedor: {
    gap: spacing.xs,
  },
  etiqueta: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vacia: {
    width: TAMANO,
    height: TAMANO,
    borderRadius: TAMANO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  cuadrada: {
    borderRadius: radius.md,
  },
  imagenCuadrada: {
    width: TAMANO,
    height: TAMANO,
    backgroundColor: colors.surfaceAlt,
  },
  lado: {
    flex: 1,
    gap: spacing.xs,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  botonInactivo: {
    opacity: 0.5,
  },
  botonTexto: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  nota: {
    ...typography.meta,
    color: colors.textMuted,
  },
  quitar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  quitarTexto: {
    ...typography.meta,
    fontWeight: '700',
    color: colors.busy,
  },
  pressed: {
    opacity: 0.7,
  },
});
