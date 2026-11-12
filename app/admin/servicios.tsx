import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ApiError, toApiError } from '../../src/api/client';
import { AdminHeader } from '../../src/components/AdminHeader';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuth } from '../../src/context/AuthContext';
import { createService, deleteService, getServices, updateService } from '../../src/data/services';
import { useAsync } from '../../src/hooks/useAsync';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Service, ServiceInput } from '../../src/types/api';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

/** Lo que hay en el formulario: todo texto, porque eso es lo que se teclea. */
interface Formulario {
  name: string;
  description: string;
  priceCop: string;
  category: string;
  imageUrl: string;
}

const FORMULARIO_VACIO: Formulario = {
  name: '',
  description: '',
  priceCop: '',
  category: '',
  imageUrl: '',
};

function aFormulario(servicio: Service): Formulario {
  return {
    name: servicio.name,
    description: servicio.description,
    priceCop: String(servicio.priceCop),
    category: servicio.category,
    imageUrl: servicio.imageUrl ?? '',
  };
}

/**
 * Validación del lado del cliente.
 *
 * Repite las reglas del DTO de zod a propósito, y eso no es duplicación
 * ociosa: el servidor valida porque no puede fiarse de nadie, y el cliente
 * valida para no obligar al usuario a esperar un viaje de red completo para
 * enterarse de que escribió mal el precio. La del servidor sigue mandando.
 */
function validar(form: Formulario): string | null {
  if (form.name.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres.';
  }
  if (form.category.trim().length < 3) {
    return 'La categoría debe tener al menos 3 caracteres.';
  }
  const precio = Number(form.priceCop);
  if (!Number.isInteger(precio) || precio < 0) {
    return 'El precio debe ser un número entero de pesos.';
  }
  if (form.imageUrl.trim().length > 0 && !/^https?:\/\/\S+$/i.test(form.imageUrl.trim())) {
    return 'La imagen debe ser una URL que empiece por http.';
  }
  return null;
}

function aEntrada(form: Formulario): ServiceInput {
  const imagen = form.imageUrl.trim();
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    priceCop: Number(form.priceCop),
    category: form.category.trim(),
    // Cadena vacía no es una URL: hacia el servidor viaja null.
    imageUrl: imagen.length > 0 ? imagen : null,
  };
}

export default function AdminServiciosScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user, restoring, logout } = useAuth();

  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  /** null = formulario cerrado; '' = creando; un id = editando ese. */
  const [editando, setEditando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const catalogo = useAsync(() => getServices(), [], user !== null);
  const recargar = catalogo.reload;

  const cerrarFormulario = useCallback(() => {
    setAbierto(false);
    setEditando(null);
    setForm(FORMULARIO_VACIO);
    setError(null);
  }, []);

  const abrirNuevo = useCallback(() => {
    setForm(FORMULARIO_VACIO);
    setEditando(null);
    setError(null);
    setAbierto(true);
  }, []);

  const abrirEdicion = useCallback((servicio: Service) => {
    setForm(aFormulario(servicio));
    setEditando(servicio.id);
    setError(null);
    setAbierto(true);
  }, []);

  const guardar = useCallback(async () => {
    const problema = validar(form);
    if (problema !== null) {
      setError(problema);
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      if (editando === null) {
        await createService(aEntrada(form));
      } else {
        await updateService(editando, aEntrada(form));
      }
      if (montado.current) {
        cerrarFormulario();
        recargar();
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        const apiError: ApiError = toApiError(fallo);
        setError(
          apiError.isNetwork
            ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
            : apiError.message,
        );
      }
    } finally {
      if (montado.current) {
        setGuardando(false);
      }
    }
  }, [cerrarFormulario, editando, form, recargar]);

  const confirmarBorrado = useCallback(
    (servicio: Service) => {
      Alert.alert(
        'Eliminar servicio',
        `Se eliminará "${servicio.name}" del catálogo. Esta acción no se puede deshacer.`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí, eliminar',
            style: 'destructive',
            onPress: () => {
              setBorrandoId(servicio.id);
              deleteService(servicio.id)
                .then(() => {
                  recargar();
                })
                .catch((fallo: unknown) => {
                  const apiError = toApiError(fallo);
                  Alert.alert(
                    'No se pudo eliminar',
                    apiError.isNetwork
                      ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
                      : apiError.message,
                  );
                })
                .finally(() => {
                  setBorrandoId(null);
                });
            },
          },
        ],
      );
    },
    [recargar],
  );

  const cerrarSesion = useCallback(() => {
    logout();
    router.replace('/');
  }, [logout, router]);

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

  // El servidor responde 403 a un barbero que intente escribir; la interfaz
  // ni siquiera le ofrece la pantalla.
  if (user.role !== 'admin') {
    return <Redirect href="/admin" />;
  }

  const servicios = catalogo.data ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AdminHeader user={user} onLogout={cerrarSesion} />

          <View style={styles.tituloFila}>
            <Text style={styles.titulo}>Catálogo</Text>
            {!abierto ? (
              <Pressable
                onPress={abrirNuevo}
                accessibilityRole="button"
                accessibilityLabel="Agregar un servicio"
                style={({ pressed }) => [styles.nuevo, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={16} color={colors.onPrimary} />
                <Text style={styles.nuevoLabel}>Nuevo</Text>
              </Pressable>
            ) : null}
          </View>

          {abierto ? (
            <View style={styles.formulario}>
              <Text style={styles.formularioTitulo}>
                {editando === null ? 'Nuevo servicio' : 'Editar servicio'}
              </Text>

              <Campo
                etiqueta="Nombre"
                valor={form.name}
                onChange={(name) => setForm({ ...form, name })}
                editable={!guardando}
              />
              <Campo
                etiqueta="Categoría"
                valor={form.category}
                onChange={(category) => setForm({ ...form, category })}
                editable={!guardando}
                ayuda="Cortes, Barba, Color y estilos... o una nueva."
              />
              <Campo
                etiqueta="Precio en pesos"
                valor={form.priceCop}
                onChange={(priceCop) => setForm({ ...form, priceCop: priceCop.replace(/\D/g, '') })}
                editable={!guardando}
                teclado="number-pad"
              />
              <Campo
                etiqueta="Descripción"
                valor={form.description}
                onChange={(description) => setForm({ ...form, description })}
                editable={!guardando}
                multilinea
              />
              <Campo
                etiqueta="Imagen (opcional)"
                valor={form.imageUrl}
                onChange={(imageUrl) => setForm({ ...form, imageUrl })}
                editable={!guardando}
                ayuda="URL que empiece por http. El servidor no aloja archivos."
              />

              {error !== null ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label={editando === null ? 'Crear servicio' : 'Guardar cambios'}
                loadingLabel="Guardando..."
                loading={guardando}
                onPress={() => {
                  void guardar();
                }}
              />
              <Pressable onPress={cerrarFormulario} accessibilityRole="button">
                <Text style={styles.cancelar}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}

          {catalogo.loading ? (
            <LoadingState label="Cargando el catálogo..." slow={catalogo.slow} />
          ) : null}

          {catalogo.error !== null ? (
            <ErrorState error={catalogo.error} onRetry={catalogo.reload} />
          ) : null}

          {!catalogo.loading && catalogo.error === null && servicios.length === 0 ? (
            <Text style={styles.vacio}>
              El catálogo está vacío. Crea el primer servicio con el botón de arriba.
            </Text>
          ) : null}

          {servicios.map((servicio) => (
            <View key={servicio.id} style={styles.fila}>
              <View style={styles.filaTexto}>
                <Text style={styles.filaNombre}>{servicio.name}</Text>
                <Text style={styles.filaMeta}>
                  {servicio.category} · ${servicio.priceCop.toLocaleString('es-CO')}
                </Text>
              </View>

              <Pressable
                onPress={() => abrirEdicion(servicio)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${servicio.name}`}
                style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
              >
                <Ionicons name="create-outline" size={20} color={colors.primaryText} />
              </Pressable>

              <Pressable
                onPress={() => confirmarBorrado(servicio)}
                disabled={borrandoId === servicio.id}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${servicio.name}`}
                style={({ pressed }) => [styles.accion, pressed && styles.pressed]}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={borrandoId === servicio.id ? colors.textMuted : colors.busy}
                />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface CampoProps {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  editable: boolean;
  ayuda?: string;
  teclado?: 'default' | 'number-pad';
  multilinea?: boolean;
}

function Campo({
  etiqueta,
  valor,
  onChange,
  editable,
  ayuda,
  teclado = 'default',
  multilinea = false,
}: CampoProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        editable={editable}
        keyboardType={teclado}
        multiline={multilinea}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={etiqueta}
        style={[styles.input, multilinea && styles.inputAlto]}
      />
      {ayuda !== undefined ? <Text style={styles.campoAyuda}>{ayuda}</Text> : null}
    </View>
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
  titulo: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  nuevo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
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
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formularioTitulo: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  campo: {
    gap: spacing.xs,
  },
  campoEtiqueta: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  campoAyuda: {
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
  filaTexto: {
    flex: 1,
    gap: 2,
  },
  filaNombre: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  filaMeta: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  accion: {
    padding: spacing.xs,
  },
  vacio: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  pressed: {
    opacity: 0.6,
  },
});
