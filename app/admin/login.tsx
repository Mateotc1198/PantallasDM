import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';

const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

type FocusedField = 'username' | 'password' | null;

export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { user, restoring, login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<FocusedField>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const isValid = username.trim().length > 0 && password.length > 0;

  const submit = useCallback(async () => {
    if (!isValid || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await login(username.trim(), password);
      if (montado.current) {
        // replace y no push: volver atrás desde el panel no debe devolver
        // al formulario de una sesión que ya se abrió.
        router.replace('/admin');
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        setError(toApiError(fallo));
        setPassword('');
      }
    } finally {
      if (montado.current) {
        setSubmitting(false);
      }
    }
  }, [isValid, login, password, router, submitting, username]);

  // Mientras se lee el llavero no se decide nada: enseñar el formulario y
  // saltar al panel medio segundo después se ve como un fallo.
  if (restoring) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState label="Comprobando sesión..." />
      </SafeAreaView>
    );
  }

  if (user !== null) {
    return <Redirect href="/admin" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.fill} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => router.replace('/')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver al inicio"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.brand}>ZONABARBER</Text>
            <Text style={styles.subtitle}>Administración</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                // Sin autocorrección ni mayúscula inicial: un nombre de
                // usuario no es una palabra del idioma, y el teclado lo
                // "arreglaría" hasta hacerlo fallar.
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                editable={!submitting}
                accessibilityLabel="Usuario"
                style={[styles.input, focused === 'username' && styles.inputFocused]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => {
                  void submit();
                }}
                editable={!submitting}
                accessibilityLabel="Contraseña"
                style={[styles.input, focused === 'password' && styles.inputFocused]}
              />
            </View>

            {error !== null ? (
              <View style={styles.alert}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.busy} />
                <Text style={styles.alertText}>
                  {error.isNetwork
                    ? 'No pudimos conectar con el servidor. Revisa tu conexión.'
                    : error.message}
                </Text>
              </View>
            ) : null}

            <View style={styles.action}>
              <PrimaryButton
                label="Ingresar"
                loadingLabel="Entrando..."
                loading={submitting}
                disabled={!isValid}
                onPress={() => {
                  void submit();
                }}
              />
            </View>
          </View>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  back: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    padding: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  brand: {
    ...typography.screenTitle,
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alertText: {
    ...typography.caption,
    flex: 1,
    color: colors.busy,
  },
  action: {
    paddingTop: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
