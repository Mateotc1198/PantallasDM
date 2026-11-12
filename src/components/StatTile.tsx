import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface StatTileProps {
  icono: keyof typeof Ionicons.glyphMap;
  valor: string;
  etiqueta: string;
}

/**
 * Una cifra del resumen del día: el número grande y debajo qué cuenta.
 *
 * Para un lector de pantalla la tarjeta es un solo elemento ("Citas: 3"):
 * leída en dos trozos, el número suelto no dice nada.
 */
export function StatTile({ icono, valor, etiqueta }: StatTileProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.tile} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Ionicons name={icono} size={16} color={colors.primaryText} />
      <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.etiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  tile: {
    flex: 1,
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  valor: {
    ...typography.cardTitle,
    fontSize: 20,
    color: colors.textPrimary,
    paddingTop: 2,
  },
  etiqueta: {
    ...typography.meta,
    color: colors.textSecondary,
  },
});
