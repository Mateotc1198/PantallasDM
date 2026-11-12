import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface FormFieldProps {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  editable: boolean;
  /** Aclaración bajo el campo: formato esperado, consecuencia, etc. */
  ayuda?: string;
  teclado?: 'default' | 'number-pad' | 'url';
  multilinea?: boolean;
  /**
   * En falso, el teclado no corrige ni pone mayúsculas. Para direcciones web,
   * donde el autocorrector solo estorba.
   */
  textoLibre?: boolean;
  /** Oculta lo que se escribe. Para contraseñas. */
  secreto?: boolean;
}

/**
 * Campo de texto con su etiqueta, para los formularios del panel.
 *
 * La etiqueta visible es también la etiqueta de accesibilidad: un lector de
 * pantalla anuncia lo mismo que se lee.
 */
export function FormField({
  etiqueta,
  valor,
  onChange,
  editable,
  ayuda,
  teclado = 'default',
  multilinea = false,
  textoLibre = true,
  secreto = false,
}: FormFieldProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        editable={editable}
        keyboardType={teclado}
        multiline={multilinea}
        // Una contraseña nunca se corrige ni se pone en mayúscula sola.
        autoCapitalize={textoLibre && !secreto ? 'sentences' : 'none'}
        autoCorrect={textoLibre && !secreto}
        secureTextEntry={secreto}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={etiqueta}
        style={[styles.input, multilinea && styles.inputAlto]}
      />
      {ayuda !== undefined ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  campo: {
    gap: spacing.xs,
  },
  etiqueta: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  ayuda: {
    ...typography.meta,
    color: colors.textMuted,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputAlto: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
