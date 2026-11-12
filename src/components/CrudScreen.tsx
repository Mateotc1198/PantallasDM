import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CrudForm } from '../hooks/useCrudForm';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AdminHeader } from './AdminHeader';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { PrimaryButton } from './PrimaryButton';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

/** Lo que la pantalla base necesita saber del formulario: nada de su contenido. */
type EstadoDelFormulario = Pick<
  CrudForm<unknown, unknown>,
  'abierto' | 'editando' | 'guardando' | 'error' | 'abrirNuevo' | 'cerrar' | 'guardar'
>;

interface EstadoDeLaLista {
  loading: boolean;
  /** Recarga pedida con el gesto de deslizar: la lista no se vacía. */
  refreshing: boolean;
  slow: boolean;
  error: ApiError | null;
  reload: () => void;
}

interface Textos {
  /** Título de la pantalla: "Catálogo", "Barberos". */
  titulo: string;
  /** Etiqueta accesible del botón "Nuevo": "Agregar un servicio". */
  agregar: string;
  /** Título del formulario al crear y texto de su botón. */
  tituloNuevo: string;
  botonCrear: string;
  /** Título del formulario al editar. */
  tituloEditar: string;
  cargando: string;
  /** Lo que se dice cuando la lista cargó bien y no trae nada. */
  vacio: string;
  /** Qué hacer entonces: "Crea el primero con el botón Nuevo". */
  vacioDetalle: string;
}

interface CrudScreenProps {
  textos: Textos;
  crud: EstadoDelFormulario;
  lista: EstadoDeLaLista;
  /** Cuántos elementos tiene la lista ya cargada. */
  total: number;
  /** Icono del estado vacío, propio de cada recurso. */
  iconoVacio: keyof typeof Ionicons.glyphMap;
  /** Los campos del formulario, propios de cada recurso. */
  campos: ReactNode;
  /** Las filas de la lista. */
  children: ReactNode;
}

/**
 * Armazón de las pantallas de gestión del panel.
 *
 * Pone lo que servicios y barberos comparten: quién puede entrar, la
 * cabecera, el botón de "Nuevo", la tarjeta del formulario con su error y sus
 * botones, y los estados de carga, error y lista vacía. Cada pantalla aporta
 * solo sus campos y sus filas.
 *
 * El control de acceso vive aquí para que no se pueda olvidar al crear una
 * pantalla nueva. Es una comodidad de interfaz, no la seguridad: quien manda
 * es el servidor, que responde 403 a un barbero aunque llegara hasta aquí.
 */
export function CrudScreen({
  textos,
  crud,
  lista,
  total,
  iconoVacio,
  campos,
  children,
}: CrudScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user, restoring, logout } = useAuth();

  if (restoring) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState label="Comprobando sesión..." />
      </SafeAreaView>
    );
  }

  if (user === null) {
    return <Redirect href="/admin/login" />;
  }

  if (user.role !== 'admin') {
    return <Redirect href="/admin" />;
  }

  const cerrarSesion = () => {
    logout();
    router.replace('/');
  };

  /** Hay una lista en pantalla de la que hablar: ni cargando ni con error. */
  const cargado = (!lista.loading || lista.refreshing) && lista.error === null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={lista.refreshing}
              onRefresh={lista.reload}
              tintColor={colors.primaryText}
              colors={[colors.primary]}
            />
          }
        >
          <AdminHeader user={user} onLogout={cerrarSesion} />

          <View style={styles.tituloFila}>
            <View style={styles.tituloGrupo}>
              <Text style={styles.titulo}>{textos.titulo}</Text>
              {cargado && total > 0 ? (
                <View style={styles.contador}>
                  <Text style={styles.contadorTexto}>{total}</Text>
                </View>
              ) : null}
            </View>
            {!crud.abierto ? (
              <Pressable
                onPress={crud.abrirNuevo}
                accessibilityRole="button"
                accessibilityLabel={textos.agregar}
                style={({ pressed }) => [styles.nuevo, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={16} color={colors.onPrimary} />
                <Text style={styles.nuevoLabel}>Nuevo</Text>
              </Pressable>
            ) : null}
          </View>

          {crud.abierto ? (
            <View style={styles.formulario}>
              <Text style={styles.formularioTitulo}>
                {crud.editando === null ? textos.tituloNuevo : textos.tituloEditar}
              </Text>

              {campos}

              {crud.error !== null ? <Text style={styles.error}>{crud.error}</Text> : null}

              <PrimaryButton
                label={crud.editando === null ? textos.botonCrear : 'Guardar cambios'}
                loadingLabel="Guardando..."
                loading={crud.guardando}
                onPress={() => {
                  void crud.guardar();
                }}
              />
              <Pressable onPress={crud.cerrar} accessibilityRole="button">
                <Text style={styles.cancelar}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}

          {lista.loading && !lista.refreshing ? (
            <LoadingState label={textos.cargando} slow={lista.slow} />
          ) : null}

          {lista.error !== null ? <ErrorState error={lista.error} onRetry={lista.reload} /> : null}

          {cargado && total === 0 ? (
            <EmptyState icono={iconoVacio} titulo={textos.vacio} detalle={textos.vacioDetalle} />
          ) : null}

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  tituloGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titulo: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  contador: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  contadorTexto: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryText,
  },
  nuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  nuevoLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  formulario: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    // El borde de color separa "estoy editando" de las tarjetas de la lista.
    borderColor: colors.primary,
  },
  formularioTitulo: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  error: {
    ...typography.caption,
    color: colors.busy,
  },
  cancelar: {
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
