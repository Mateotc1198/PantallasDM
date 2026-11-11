import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ImageBackground, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { enlaceWhatsApp } from '../src/config/barberia';
import { useBooking } from '../src/context/BookingContext';
import { radius, spacing, typography, type Palette } from '../src/theme/tokens';
import { useTheme } from '../src/theme/ThemeContext';
import { useThemedStyles } from '../src/theme/useThemedStyles';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1080&q=80';

export default function HomeScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { reset } = useBooking();

  /** Cada flujo arranca limpio: es el único punto donde se resetea el estado. */
  const startBooking = useCallback(() => {
    reset();
    router.push('/reserva/barbero');
  }, [reset, router]);

  const openWhatsApp = useCallback(() => {
    void Linking.openURL(enlaceWhatsApp('Hola, quiero agendar una cita.'));
  }, []);

  const openServicios = useCallback(() => {
    router.push('/servicios');
  }, [router]);

  const openContacto = useCallback(() => {
    router.push('/contacto');
  }, [router]);

  const openAdmin = useCallback(() => {
    router.push('/admin');
  }, [router]);

  const openMiCita = useCallback(() => {
    router.push('/cita');
  }, [router]);

  return (
    <ImageBackground source={{ uri: HERO_IMAGE }} style={styles.hero}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <Text style={styles.eyebrow}>— Estilo & Precisión —</Text>
            <Text style={styles.title}>
              Tu mejor versión,{'\n'}
              <Text style={styles.titleAccent}>cada visita.</Text>
            </Text>
            <Text style={styles.description}>
              Reserva con el barbero que ya conoce tu corte. Elige el día, la hora y listo: sin
              llamadas y sin filas.
            </Text>

            <View style={styles.actions}>
              <View style={styles.actionSlot}>
                <PrimaryButton label="Agendar Cita" onPress={startBooking} />
              </View>
              <View style={styles.actionSlot}>
                <Pressable
                  onPress={openServicios}
                  accessibilityRole="button"
                  accessibilityLabel="Ver nuestros servicios"
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryLabel}>Ver Servicios</Text>
                </Pressable>
              </View>
            </View>

            {/*
              Quien ya reservó vuelve aquí a consultar, aplazar o cancelar.
              No depende de tener la cita guardada: la pantalla también
              acepta el código a mano.
            */}
            <Pressable
              onPress={openMiCita}
              accessibilityRole="button"
              accessibilityLabel="Ver, aplazar o cancelar mi cita"
              style={({ pressed }) => [styles.miCita, pressed && styles.pressed]}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.heroText} />
              <Text style={styles.miCitaLabel}>Mi cita</Text>
            </Pressable>

            {/*
              Acceso al panel. Discreto a propósito: esta es la pantalla de
              un cliente, no del dueño. Pero visible, porque esconderlo
              detrás de un gesto secreto significa que quien tenga que
              revisar la aplicación no lo encuentra.
            */}
            <Pressable
              onPress={openAdmin}
              accessibilityRole="button"
              accessibilityLabel="Acceder al panel de administración"
              style={({ pressed }) => [styles.admin, pressed && styles.pressed]}
            >
              <Ionicons name="lock-closed-outline" size={12} color={colors.heroTextMuted} />
              <Text style={styles.adminLabel}>Administración</Text>
            </Pressable>

            <Pressable
              onPress={openContacto}
              accessibilityRole="button"
              accessibilityLabel="Ver los datos de contacto"
              style={({ pressed }) => [styles.contact, pressed && styles.pressed]}
            >
              <Text style={styles.contactLabel}>Contáctanos</Text>
              {/* Lleva a otra pantalla, no despliega nada: la flecha apunta
                  hacia donde va. */}
              <Ionicons name="chevron-forward" size={14} color={colors.heroTextMuted} />
            </Pressable>
          </View>

          <Pressable
            onPress={openWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Escribir por WhatsApp"
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          >
            <Ionicons name="logo-whatsapp" size={28} color={colors.heroText} />
          </Pressable>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  hero: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.heroOverlay,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.overline,
    letterSpacing: 2,
    color: colors.primary,
  },
  title: {
    ...typography.heroTitle,
    color: colors.heroText,
    textAlign: 'center',
  },
  titleAccent: {
    color: colors.primary,
  },
  description: {
    ...typography.body,
    color: colors.heroText,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  actionSlot: {
    flex: 1,
  },
  secondary: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    ...typography.button,
    color: colors.textPrimary,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  contactLabel: {
    ...typography.caption,
    color: colors.heroTextMuted,
  },
  miCita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  miCitaLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.heroText,
  },
  admin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  adminLabel: {
    ...typography.meta,
    color: colors.heroTextMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.whatsapp,
  },
});
