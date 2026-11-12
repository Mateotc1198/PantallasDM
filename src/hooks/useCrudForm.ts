import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';

import { toApiError } from '../api/client';

const SIN_CONEXION = 'No pudimos conectar con el servidor. Revisa tu conexión.';

/**
 * Un fallo de red se dice con palabras de persona; cualquier otro error trae
 * ya un mensaje redactado por el servidor (nombre repetido, citas pendientes)
 * y ese es justo el que hay que enseñar.
 */
function mensajeDe(fallo: unknown): string {
  const error = toApiError(fallo);
  return error.isNetwork ? SIN_CONEXION : error.message;
}

/** Textos del diálogo que confirma un borrado. */
export interface TextosDeBorrado {
  titulo: string;
  mensaje: string;
  /** Etiqueta del botón que confirma, p. ej. "Sí, eliminar". */
  aceptar: string;
  /** Título del segundo diálogo, si el servidor rechaza el borrado. */
  tituloFallo: string;
}

interface Opciones<Item extends { id: string }, Form> {
  /** El formulario en blanco, para "nuevo" y para después de guardar. */
  vacio: Form;
  aFormulario: (item: Item) => Form;
  /** Devuelve el problema en una frase, o null si el formulario es válido. */
  validar: (form: Form) => string | null;
  /** id null significa crear; con id, editar ese elemento. */
  guardar: (id: string | null, form: Form) => Promise<unknown>;
  borrar: (id: string) => Promise<unknown>;
  /** Se llama tras guardar o borrar con éxito: lo normal es recargar la lista. */
  alCambiar: () => void;
  textosDeBorrado: (item: Item) => TextosDeBorrado;
}

export interface CrudForm<Item, Form> {
  form: Form;
  /**
   * Admite también una función, como el setState de React: para quien
   * actualiza el formulario al terminar algo asíncrono (elegir una foto) y no
   * debe pisar lo que se haya escrito mientras tanto.
   */
  setForm: Dispatch<SetStateAction<Form>>;
  abierto: boolean;
  /** null mientras se crea; el id del elemento mientras se edita. */
  editando: string | null;
  guardando: boolean;
  error: string | null;
  /** Elemento cuyo borrado está en curso, para deshabilitar su botón. */
  borrandoId: string | null;
  abrirNuevo: () => void;
  abrirEdicion: (item: Item) => void;
  cerrar: () => void;
  guardar: () => Promise<void>;
  confirmarBorrado: (item: Item) => void;
}

/**
 * La mecánica de una pantalla de "lista + formulario" del panel.
 *
 * Servicios y barberos se gestionan igual: un formulario que se abre vacío o
 * con los datos de un elemento, se valida antes de salir a la red, enseña el
 * error del servidor si lo hay, y un borrado que pide confirmación. Lo único
 * que cambia de una pantalla a otra es QUÉ se edita, y eso entra por las
 * opciones. Con dos pantallas copiando esta lógica, un arreglo en una se
 * quedaría sin hacer en la otra.
 *
 * Las funciones que devuelve no van envueltas en useCallback a propósito:
 * dependen de opciones que se crean en cada render, así que memorizarlas no
 * ahorraría nada y obligaría a quien llama a memorizar las suyas.
 */
export function useCrudForm<Item extends { id: string }, Form>(
  opciones: Opciones<Item, Form>,
): CrudForm<Item, Form> {
  const [form, setForm] = useState<Form>(opciones.vacio);
  const [editando, setEditando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  // Las peticiones pueden terminar después de salir de la pantalla: sin esta
  // marca se intentaría actualizar el estado de un componente desmontado.
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const cerrar = () => {
    setAbierto(false);
    setEditando(null);
    setForm(opciones.vacio);
    setError(null);
  };

  const abrirNuevo = () => {
    setForm(opciones.vacio);
    setEditando(null);
    setError(null);
    setAbierto(true);
  };

  const abrirEdicion = (item: Item) => {
    setForm(opciones.aFormulario(item));
    setEditando(item.id);
    setError(null);
    setAbierto(true);
  };

  const guardar = async () => {
    const problema = opciones.validar(form);
    if (problema !== null) {
      setError(problema);
      return;
    }

    setGuardando(true);
    setError(null);

    try {
      await opciones.guardar(editando, form);
      if (montado.current) {
        cerrar();
        opciones.alCambiar();
      }
    } catch (fallo: unknown) {
      if (montado.current) {
        setError(mensajeDe(fallo));
      }
    } finally {
      if (montado.current) {
        setGuardando(false);
      }
    }
  };

  const borrar = async (item: Item, tituloFallo: string) => {
    setBorrandoId(item.id);

    try {
      await opciones.borrar(item.id);
      if (montado.current) {
        opciones.alCambiar();
      }
    } catch (fallo: unknown) {
      Alert.alert(tituloFallo, mensajeDe(fallo));
    } finally {
      if (montado.current) {
        setBorrandoId(null);
      }
    }
  };

  const confirmarBorrado = (item: Item) => {
    const textos = opciones.textosDeBorrado(item);

    Alert.alert(textos.titulo, textos.mensaje, [
      { text: 'No', style: 'cancel' },
      {
        text: textos.aceptar,
        style: 'destructive',
        onPress: () => {
          void borrar(item, textos.tituloFallo);
        },
      },
    ]);
  };

  return {
    form,
    setForm,
    abierto,
    editando,
    guardando,
    error,
    borrandoId,
    abrirNuevo,
    abrirEdicion,
    cerrar,
    guardar,
    confirmarBorrado,
  };
}
