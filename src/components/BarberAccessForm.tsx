import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../api/client';
import { radius, spacing, typography, type Palette } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { BarberAccountInput } from '../types/api';
import { FormField } from './FormField';
import { PrimaryButton } from './PrimaryButton';

/** Las mismas reglas que aplica el servidor. */
const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
const CLAVE_MINIMA = 8;

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisa tu conexión.';

interface BarberAccessFormProps {
  nombreBarbero: string;
  /** Usuario actual, o null si todavía no tiene acceso. */
  usuarioActual: string | null;
  onGuardar: (cuenta: BarberAccountInput) => Promise<unknown>;
  onQuitar: () => Promise<unknown>;
  /** Se guardó o se quitó con éxito: toca recargar y cerrar. */
  onHecho: () => void;
  onCancelar: () => void;
}

function mensajeDe(fallo: unknown): string {
  const error = toApiError(fallo);
  return error.isNetwork ? SIN_CONEXION : error.message;
}

/**
 * El acceso de un barbero al panel: su usuario y su contraseña.
 *
 * Va aparte del formulario de la ficha porque son dos cosas distintas que se
 * guardan por separado. Si fueran un solo formulario, un fallo al crear la
 * cuenta dejaría al barbero creado a medias y sin forma clara de saberlo.
 *
 * La contraseña nunca se muestra ni se recupera: el servidor solo guarda su
 * hash. Por eso al editar el campo sale vacío y hay que escribir una nueva.
 */
export function BarberAccessForm({
  nombreBarbero,
  usuarioActual,
  onGuardar,
  onQuitar,
  onHecho,
  onCancelar,
}: BarberAccessFormProps) {
  const styles = useThemedStyles(makeStyles);

  const [usuario, setUsuario] = useState(usuarioActual ?? '');
  const [clave, setClave] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setError(null);

    try {
      await accion();
      if (montado.current) {
        onHecho();
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        setError(mensajeDe(fallo));
      }
    } finally {
      if (montado.current) {
        setOcupado(false);
      }
    }
  };

  const guardar = () => {
    // Igual que el servidor: sin espacios alrededor y en minúsculas.
    const usuarioLimpio = usuario.trim().toLowerCase();

    if (!USUARIO_VALIDO.test(usuarioLimpio)) {
      setError('El usuario debe tener de 3 a 30 letras, números, puntos o guiones.');
      return;
    }
    if (clave.length < CLAVE_MINIMA) {
      setError(`La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`);
      return;
    }

    void ejecutar(() => onGuardar({ username: usuarioLimpio, password: clave }));
  };

  const confirmarQuitar = () => {
    Alert.alert(
      'Quitar el acceso',
      `${nombreBarbero} ya no podrá entrar al panel. Su ficha y sus citas no cambian.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, quitar',
          style: 'destructive',
          onPress: () => {
            void ejecutar(onQuitar);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>{`Acceso de ${nombreBarbero}`}</Text>
      <Text style={styles.explicacion}>
        {usuarioActual === null
          ? 'Con una cuenta podrá entrar al panel y ver solo su propia agenda.'
          : 'Escribe una contraseña nueva para cambiarla. La actual no se puede ver.'}
      </Text>

      <FormField
        etiqueta="Usuario"
        valor={usuario}
        onChange={setUsuario}
        editable={!ocupado}
        textoLibre={false}
      />
      <FormField
        etiqueta="Contraseña"
        valor={clave}
        onChange={setClave}
        editable={!ocupado}
        secreto
        ayuda={`Mínimo ${CLAVE_MINIMA} caracteres. Entrégasela en persona.`}
      />

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={usuarioActual === null ? 'Dar acceso' : 'Guardar acceso'}
        loadingLabel="Guardando..."
        loading={ocupado}
        onPress={guardar}
      />

      <View style={styles.secundarias}>
        {usuarioActual !== null ? (
          <Pressable onPress={confirmarQuitar} disabled={ocupado} accessibilityRole="button">
            <Text style={styles.quitar}>Quitar acceso</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onCancelar} disabled={ocupado} accessibilityRole="button">
          <Text style={styles.cancelar}>Cerrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  tarjeta: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  titulo: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  explicacion: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  error: {
    ...typography.caption,
    color: colors.busy,
  },
  secundarias: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  quitar: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.busy,
    paddingVertical: spacing.xs,
  },
  cancelar: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
});
