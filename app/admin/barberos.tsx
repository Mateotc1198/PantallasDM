import { Fragment, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../src/components/Avatar';
import { BarberAccessForm } from '../../src/components/BarberAccessForm';
import { CrudRow } from '../../src/components/CrudRow';
import { CrudScreen } from '../../src/components/CrudScreen';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/context/AuthContext';
import { createBarber, deleteBarber, getBarbers, updateBarber } from '../../src/data/barbers';
import { getUsers, removeBarberAccount, setBarberAccount } from '../../src/data/users';
import { useAsync } from '../../src/hooks/useAsync';
import { useCrudForm } from '../../src/hooks/useCrudForm';
import { spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { BarberInput, BarberSummary } from '../../src/types/api';

/** Los tres datos que el administrador escribe. El resto lo pone el servidor. */
type Formulario = BarberInput;

const FORMULARIO_VACIO: Formulario = { name: '', specialty: '', avatar: '' };

const TEXTOS = {
  titulo: 'Barberos',
  agregar: 'Agregar un barbero',
  tituloNuevo: 'Nuevo barbero',
  botonCrear: 'Crear barbero',
  tituloEditar: 'Editar barbero',
  cargando: 'Cargando los barberos...',
  vacio: 'No hay barberos activos.',
  vacioDetalle: 'Agrega el primero con el botón Nuevo.',
};

/** Una dirección https sin espacios. La misma regla que aplica el servidor. */
const URL_HTTPS = /^https:\/\/\S+$/i;

const TAMANO_FOTO = 48;

function aFormulario(barbero: BarberSummary): Formulario {
  return { name: barbero.name, specialty: barbero.specialty, avatar: barbero.avatar };
}

/**
 * Validación del lado del cliente: evita un viaje de red para decir algo que
 * ya se sabe. La del servidor sigue mandando.
 */
function validar(form: Formulario): string | null {
  if (form.name.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres.';
  }
  if (form.specialty.trim().length < 3) {
    return 'La especialidad debe tener al menos 3 caracteres.';
  }
  if (!URL_HTTPS.test(form.avatar.trim())) {
    return 'La foto debe ser una URL que empiece por https://';
  }
  return null;
}

function aEntrada(form: Formulario): BarberInput {
  return {
    name: form.name.trim(),
    specialty: form.specialty.trim(),
    avatar: form.avatar.trim(),
  };
}

/**
 * Gestión de la plantilla de barberos: agregar, editar la ficha y la foto,
 * dar de baja, y decidir quién puede entrar al panel.
 *
 * La mecánica del formulario y el armazón de la pantalla son los mismos que
 * en servicios (useCrudForm y CrudScreen). Lo propio de aquí es la vista
 * previa de la foto y el acceso de cada barbero, que se guarda aparte de su
 * ficha.
 *
 * Los horarios no se editan aquí: un barbero nuevo nace atendiendo todos los
 * días de 9:00 a 21:00.
 */
export default function AdminBarberosScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';

  const barberos = useAsync(() => getBarbers(), [], user !== null);
  // Las cuentas solo las puede leer un administrador: a un barbero el
  // servidor le respondería 403, así que ni se piden.
  const cuentas = useAsync(() => getUsers(), [], esAdmin);

  /** Id del barbero cuyo acceso se está editando, o null. */
  const [accesoAbierto, setAccesoAbierto] = useState<string | null>(null);

  const usuarioPorBarbero = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const cuenta of cuentas.data ?? []) {
      if (cuenta.barberId !== null) {
        mapa.set(cuenta.barberId, cuenta.username);
      }
    }
    return mapa;
  }, [cuentas.data]);

  const recargarTodo = () => {
    barberos.reload();
    cuentas.reload();
  };

  const crud = useCrudForm<BarberSummary, Formulario>({
    vacio: FORMULARIO_VACIO,
    aFormulario,
    validar,
    guardar: (id, form) =>
      id === null ? createBarber(aEntrada(form)) : updateBarber(id, aEntrada(form)),
    borrar: deleteBarber,
    alCambiar: recargarTodo,
    textosDeBorrado: (barbero) => ({
      titulo: 'Dar de baja',
      mensaje:
        `"${barbero.name}" dejará de aparecer en la app y no podrá recibir reservas. ` +
        'Sus citas pasadas se conservan.',
      aceptar: 'Sí, dar de baja',
      tituloFallo: 'No se pudo dar de baja',
    }),
  });

  const { form, setForm } = crud;
  const editable = !crud.guardando;
  const lista = barberos.data ?? [];
  const fotoValida = URL_HTTPS.test(form.avatar.trim());

  return (
    <CrudScreen
      textos={TEXTOS}
      crud={crud}
      // Deslizar para recargar trae también las cuentas, no solo las fichas.
      lista={{ ...barberos, reload: recargarTodo }}
      total={lista.length}
      iconoVacio="people-outline"
      campos={
        <>
          <FormField
            etiqueta="Nombre"
            valor={form.name}
            onChange={(name) => setForm({ ...form, name })}
            editable={editable}
          />
          <FormField
            etiqueta="Especialidad"
            valor={form.specialty}
            onChange={(specialty) => setForm({ ...form, specialty })}
            editable={editable}
            multilinea
          />
          <FormField
            etiqueta="Foto"
            valor={form.avatar}
            onChange={(avatar) => setForm({ ...form, avatar })}
            editable={editable}
            teclado="url"
            textoLibre={false}
            ayuda="URL que empiece por https://. El servidor no aloja archivos."
          />

          {/*
            La vista previa aparece solo con una dirección bien formada: así
            el administrador comprueba que la foto es la que quiere antes de
            guardar, y no se intenta descargar media URL a medio teclear.
          */}
          {fotoValida ? (
            <View style={styles.vistaPrevia}>
              <Avatar uri={form.avatar.trim()} size={TAMANO_FOTO} />
              <Text style={styles.vistaPreviaTexto}>Así se verá la foto.</Text>
            </View>
          ) : null}

          {crud.editando === null ? (
            <Text style={styles.nota}>
              Atenderá todos los días de 9:00 a 21:00. El acceso al panel se le da después,
              desde su tarjeta.
            </Text>
          ) : null}
        </>
      }
    >
      {lista.map((barbero) => {
        const usuario = usuarioPorBarbero.get(barbero.id) ?? null;

        return (
          <Fragment key={barbero.id}>
            <CrudRow
              nombre={barbero.name}
              detalle={barbero.specialty}
              inicio={<Avatar uri={barbero.avatar} size={TAMANO_FOTO} />}
              insignia={
                usuario !== null
                  ? { icono: 'key', texto: `Entra como ${usuario}`, activa: true }
                  : { icono: 'lock-closed-outline', texto: 'Sin acceso al panel', activa: false }
              }
              accionExtra={{
                icono: 'key-outline',
                etiqueta: `Gestionar el acceso de ${barbero.name}`,
                onPress: () =>
                  setAccesoAbierto((abierto) => (abierto === barbero.id ? null : barbero.id)),
              }}
              onEditar={() => crud.abrirEdicion(barbero)}
              onEliminar={() => crud.confirmarBorrado(barbero)}
              eliminando={crud.borrandoId === barbero.id}
              verboEliminar="Dar de baja a"
            />

            {accesoAbierto === barbero.id ? (
              <BarberAccessForm
                nombreBarbero={barbero.name}
                usuarioActual={usuario}
                onGuardar={(cuenta) => setBarberAccount(barbero.id, cuenta)}
                onQuitar={() => removeBarberAccount(barbero.id)}
                onHecho={() => {
                  setAccesoAbierto(null);
                  cuentas.reload();
                }}
                onCancelar={() => setAccesoAbierto(null)}
              />
            ) : null}
          </Fragment>
        );
      })}
    </CrudScreen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  vistaPrevia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vistaPreviaTexto: {
    ...typography.meta,
    color: colors.textSecondary,
  },
  nota: {
    ...typography.meta,
    color: colors.textMuted,
  },
});
