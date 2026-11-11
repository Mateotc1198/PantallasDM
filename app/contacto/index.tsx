import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FooterCta } from '../../src/components/FooterCta';
import { TopBar } from '../../src/components/TopBar';
import { BARBERIA, enlaceWhatsApp } from '../../src/config/barberia';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';

const LOGO = 44;

interface DatoProps {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  valor: string;
  onPress?: () => void;
}

/**
 * Contacto.
 *
 * Es la única pantalla sin llamadas a la API: sus datos no cambian y no
 * tiene sentido una tabla, un endpoint y un panel de edición para tres
 * cadenas de texto. Viven en src/config/barberia.ts, que es el único sitio
 * que hay que tocar el día que la barbería se mude.
 */
export default function ContactoScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const escribirWhatsApp = useCallback(() => {
    void Linking.openURL(enlaceWhatsApp('Hola, quiero información sobre sus servicios.'));
  }, []);

  const llamar = useCallback(() => {
    void Linking.openURL(`tel:+${BARBERIA.whatsapp}`);
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBarArea}>
        <TopBar onClose={() => router.replace('/')} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.encabezado}>
          <Text style={styles.eyebrow}>Estamos aquí para ti</Text>
          <Text style={styles.titulo}>Contáctanos</Text>
        </View>

        <View style={styles.tarjeta}>
          {/*
            El logotipo de la aplicación hace de identidad de la barbería.
            El diseño usa una fotografía de archivo que es relleno de la
            maqueta, no un recurso de la marca.
          */}
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.marca}>{BARBERIA.nombre.toUpperCase()}</Text>
          <Text style={styles.lema}>{BARBERIA.lema}</Text>

          <Pressable
            onPress={escribirWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Escribir por WhatsApp"
            style={({ pressed }) => [styles.whatsapp, pressed && styles.pressed]}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.heroText} />
            <Text style={styles.whatsappLabel}>Escríbenos por WhatsApp</Text>
          </Pressable>
        </View>

        <View style={styles.datos}>
          <Dato
            icono="call-outline"
            etiqueta="Teléfono"
            valor={BARBERIA.telefonoVisible}
            onPress={llamar}
          />
          <Dato icono="location-outline" etiqueta="Dirección" valor={BARBERIA.direccion} />
          <Dato icono="time-outline" etiqueta="Horario" valor={BARBERIA.horarioResumen} />
          <Dato
            icono="logo-instagram"
            etiqueta="Instagram"
            valor="@zonabarber"
            onPress={() => {
              void Linking.openURL(BARBERIA.instagram);
            }}
          />
        </View>

        <View style={styles.pie}>
          <FooterCta
            onAgendar={() => router.push('/reserva/barbero')}
            onVerServicios={() => router.push('/servicios')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Dato({ icono, etiqueta, valor, onPress }: DatoProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const contenido = (
    <View style={styles.dato}>
      <Ionicons name={icono} size={18} color={colors.primaryText} />
      <View style={styles.datoTexto}>
        <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
        <Text style={styles.datoValor}>{valor}</Text>
      </View>
      {onPress !== undefined ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </View>
  );

  // Sin acción no es un botón: envolverlo en Pressable le diría a un lector
  // de pantalla que se puede tocar algo que no hace nada.
  if (onPress === undefined) {
    return contenido;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {contenido}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBarArea: {
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  encabezado: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    ...typography.micro,
    color: colors.primaryText,
  },
  titulo: {
    ...typography.resultTitle,
    color: colors.textPrimary,
  },
  tarjeta: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: LOGO * 2,
    height: LOGO * 2,
    borderRadius: radius.pill,
  },
  marca: {
    ...typography.cardTitle,
    letterSpacing: 2,
    color: colors.textPrimary,
    paddingTop: spacing.sm,
  },
  lema: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    height: 48,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.whatsapp,
  },
  whatsappLabel: {
    ...typography.button,
    fontSize: 15,
    color: colors.heroText,
  },
  datos: {
    gap: spacing.sm,
  },
  dato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  datoTexto: {
    flex: 1,
    gap: 1,
  },
  datoEtiqueta: {
    ...typography.micro,
    color: colors.textMuted,
  },
  datoValor: {
    ...typography.body,
    color: colors.textPrimary,
  },
  pie: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
