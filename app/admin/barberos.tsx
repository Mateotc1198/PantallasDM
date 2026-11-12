import { Fragment, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Avatar } from '../../src/components/Avatar';
import { BarberAccessForm } from '../../src/components/BarberAccessForm';
import { CrudRow } from '../../src/components/CrudRow';
import { CrudScreen } from '../../src/components/CrudScreen';
import { FormField } from '../../src/components/FormField';
import { PhotoField } from '../../src/components/PhotoField';
import { useAuth } from '../../src/context/AuthContext';
import { createBarber, deleteBarber, getBarbers, updateBarber } from '../../src/data/barbers';
import { getUsers, removeBarberAccount, setBarberAccount } from '../../src/data/users';
import { useAsync } from '../../src/hooks/useAsync';
import { useCrudForm } from '../../src/hooks/useCrudForm';
import type { FotoElegida } from '../../src/media/photoPicker';
import { typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { BarberInput, BarberSummary } from '../../src/types/api';

/**
 * Lo que hay en el formulario.
 *
 * La foto puede venir por dos caminos, y el último que se usa gana: elegir de
 * la galería vacía la URL, y escribir una URL descarta la foto elegida.
 */
interface Formulario {
  name: string;
  specialty: string;
  /** URL nueva escrita a mano. Vacía = no se cambia por URL. */
  avatar: string;
  /** Foto nueva de la galería, pendiente de subir. */
  foto: FotoElegida | null;
  /**
   * La foto que el barbero ya tiene, solo para enseñarla. Nunca se reenvía:
   * si no se elige otra, el servidor conserva la suya.
   */
  fotoActual: string | null;
}

const FORMULARIO_VACIO: Formulario = {
  name: '',
  specialty: '',
  avatar: '',
  foto: null,
  fotoActual: null,
};

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
  return {
    name: barbero.name,
    specialty: barbero.specialty,
    // El campo de URL empieza vacío: es para poner una NUEVA. Si se llenara
    // con la actual, guardar sin tocar nada la mandaría de vuelta.
    avatar: '',
    foto: null,
    fotoActual: barbero.avatar,
  };
}

/** Lo que se enseña en el círculo de la foto: lo último que se eligió. */
function vistaPreviaDe(form: Formulario): string | null {
  if (form.foto !== null) {
    return form.foto.uri;
  }
  const url = form.avatar.trim();
  // Solo una URL bien formada: no se intenta descargar media dirección a
  // medio teclear.
  return URL_HTTPS.test(url) ? url : form.fotoActual;
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
  const url = form.avatar.trim();
  if (url.length > 0 && !URL_HTTPS.test(url)) {
    return 'La URL de la foto debe empezar por https://';
  }
  if (form.foto === null && url.length === 0 && form.fotoActual === null) {
    return 'Elige una foto de la galería o pega su URL.';
  }
  return null;
}

/**
 * Lo que viaja a la API. De la foto va como mucho una cosa: la de la galería,
 * la URL nueva, o nada, y entonces el servidor conserva la que había.
 */
function aEntrada(form: Formulario): BarberInput {
  const datos = { name: form.name.trim(), specialty: form.specialty.trim() };
  const url = form.avatar.trim();

  if (form.foto !== null) {
    return { ...datos, photo: form.foto.base64 };
  }
  if (url.length > 0) {
    return { ...datos, avatar: url };
  }
  return datos;
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
          <PhotoField
            vistaPrevia={vistaPreviaDe(form)}
            hayFotoNueva={form.foto !== null}
            tieneFotoActual={form.fotoActual !== null}
            editable={editable}
            // Con función: la galería tarda, y lo escrito mientras tanto no
            // se pierde.
            onElegida={(foto) => setForm((actual) => ({ ...actual, foto, avatar: '' }))}
          />
          <FormField
            etiqueta="O pega la URL de una foto"
            valor={form.avatar}
            onChange={(avatar) =>
              setForm((actual) => ({
                ...actual,
                avatar,
                // Escribir una URL descarta la foto de la galería elegida.
                foto: avatar.trim().length > 0 ? null : actual.foto,
              }))
            }
            editable={editable}
            teclado="url"
            textoLibre={false}
            ayuda="Opcional. Debe empezar por https://"
          />

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
  nota: {
    ...typography.meta,
    color: colors.textMuted,
  },
});
