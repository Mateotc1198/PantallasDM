import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BARBERIA, enlaceWhatsApp } from '../config/barberia';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

/**
 * Misma fotografía que el inicio: es la identidad visual de la marca, no una
 * decoración distinta por pantalla.
 */
const FONDO =
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1080&q=80';

interface FooterCtaProps {
  onAgendar: () => void;
  /** Se omite en la propia pantalla de servicios: llevaría a sí misma. */
  onVerServicios?: () => void;
}

/**
 * Banda de cierre con llamada a la acción y pie de página.
 *
 * En el diseño aparece repetida en inicio, servicios y contacto. Repetirla
 * en tres archivos significaría que el día que cambie el lema haya que
 * acordarse de los tres, así que vive una sola vez aquí.
 *
 * Su fondo es una fotografía oscurecida en ambos temas, por eso usa los
 * tokens heroText: con textPrimary se volvería ilegible en modo claro.
 */
export function FooterCta({ onAgendar, onVerServicios }: FooterCtaProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <ImageBackground source={{ uri: FONDO }} style={styles.fondo}>
      <View style={styles.velo}>
        <Text style={styles.eyebrow}>Agenda tu cita</Text>
        <Text style={styles.titulo}>
          ¿Listo para tu{'\n'}
          <Text style={styles.tituloAcento}>mejor versión?</Text>
        </Text>
        <Text style={styles.subtitulo}>
          Reserva en menos de un minuto, sin llamadas ni esperas.
        </Text>

        <View style={styles.acciones}>
          <Pressable
            onPress={onAgendar}
            accessibilityRole="button"
            style={({ pressed }) => [styles.botonPrimario, pressed && styles.pressed]}
          >
            <Text style={styles.botonPrimarioLabel}>Agenda tu cita ahora</Text>
          </Pressable>

          {onVerServicios !== undefined ? (
            <Pressable
              onPress={onVerServicios}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botonSecundario, pressed && styles.pressed]}
            >
              <Text style={styles.botonSecundarioLabel}>Ver todos los servicios</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.separador} />

        <View style={styles.pie}>
          <View style={styles.pieColumna}>
            <Text style={styles.marca}>{BARBERIA.nombre.toUpperCase()}</Text>
            <Text style={styles.lema}>{BARBERIA.lema}</Text>
            <Pressable
              onPress={() => {
                void Linking.openURL(enlaceWhatsApp('Hola, quiero información.'));
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Escribir por WhatsApp"
              style={({ pressed }) => [styles.social, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={styles.lema.color} />
              <Text style={styles.lema}>{BARBERIA.telefonoVisible}</Text>
            </Pressable>
          </View>

          <View style={styles.pieColumna}>
            <Text style={styles.marca}>Servicios</Text>
            <Text style={styles.lema}>cortes</Text>
            <Text style={styles.lema}>barba</Text>
            <Text style={styles.lema}>color & estilos</Text>
          </View>
        </View>

        <Text style={styles.copyright}>
          © 2026 {BARBERIA.nombre}. Todos los derechos reservados.{'\n'}
          Hecho con dedicación para los que cuidan su imagen.
        </Text>
      </View>
    </ImageBackground>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  fondo: {
    backgroundColor: colors.surfaceAlt,
  },
  velo: {
    backgroundColor: colors.heroOverlay,
    padding: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  eyebrow: {
    ...typography.micro,
    color: colors.primary,
  },
  titulo: {
    ...typography.resultTitle,
    fontSize: 22,
    textAlign: 'center',
    color: colors.heroText,
  },
  tituloAcento: {
    color: colors.primary,
  },
  subtitulo: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.heroTextMuted,
  },
  acciones: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  botonPrimario: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  botonPrimarioLabel: {
    ...typography.bodyStrong,
    color: colors.onPrimary,
  },
  botonSecundario: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.heroTextMuted,
  },
  botonSecundarioLabel: {
    ...typography.bodyStrong,
    color: colors.heroText,
  },
  separador: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.heroTextMuted,
    opacity: 0.3,
    marginVertical: spacing.md,
  },
  pie: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pieColumna: {
    flex: 1,
    gap: 2,
  },
  marca: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.heroText,
    paddingBottom: spacing.xs,
  },
  lema: {
    ...typography.meta,
    color: colors.heroTextMuted,
  },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  copyright: {
    ...typography.meta,
    fontSize: 10,
    textAlign: 'center',
    color: colors.heroTextMuted,
    paddingTop: spacing.md,
    lineHeight: 15,
  },
  pressed: {
    opacity: 0.7,
  },
});
