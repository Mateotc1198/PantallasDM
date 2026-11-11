import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, toApiError } from '../api/client';

/**
 * Carga asíncrona con los tres estados que toda pantalla con red necesita.
 *
 * Antes de conectar la API, las pantallas asumían que los datos ya existían
 * cuando se renderizaban. Con una red de por medio eso deja de ser cierto, y
 * el estado pasa de uno a tres: cargando, error y datos. Este hook los tiene
 * en un solo sitio para que ninguna pantalla se invente su propia versión.
 */

/**
 * A partir de aquí se avisa de que la espera se está alargando.
 *
 * No es decoración: el plan gratuito de Render duerme el servicio y la
 * primera petición tarda unos veinte segundos. Un spinner mudo durante ese
 * rato parece una aplicación rota; decir "el servidor está despertando"
 * parece una aplicación que sabe lo que hace.
 */
const SLOW_AFTER_MS = 4000;

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** La carga lleva más de SLOW_AFTER_MS en curso. */
  slow: boolean;
  /** Vuelve a ejecutar la carga. Es lo que usa el botón de reintentar. */
  reload: () => void;
}

/**
 * @param cargar  Función que hace la petición.
 * @param deps    Cuando cambian, se vuelve a cargar.
 * @param enabled Si es false no se carga nada: para pantallas que aún no
 *                tienen los datos previos que necesita la petición.
 */
export function useAsync<T>(
  cargar: () => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [cargando, setCargando] = useState(enabled);
  const [slow, setSlow] = useState(false);
  const [intento, setIntento] = useState(0);

  /**
   * La función se guarda en una ref para que quien llame no tenga que
   * envolverla en useCallback. Las dependencias reales son `deps`, no la
   * identidad de la closure, que cambia en cada render.
   */
  const cargarRef = useRef(cargar);

  /**
   * El ref se actualiza en un efecto y NO durante el render.
   *
   * Escribir en un ref mientras se renderiza no es seguro: el render
   * concurrente de React puede empezar un render, descartarlo y volver a
   * empezar, y la escritura ya habría ocurrido. Este efecto no lleva array
   * de dependencias (corre tras cada render) y está declarado ANTES del que
   * carga, así que cuando aquel se ejecute el ref ya apunta a la función
   * nueva: los efectos se ejecutan en orden de declaración.
   */
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    /**
     * Protección contra respuestas desordenadas: si el usuario cambia de día
     * rápido, la respuesta lenta del día anterior puede llegar después de la
     * del día nuevo y sobrescribirla. Este flag descarta todo lo que venga de
     * una ejecución que ya no es la vigente.
     */
    let vigente = true;

    /*
     * La regla set-state-in-effect persigue el setState que podría haberse
     * calculado durante el render. Este no: marca el inicio de una
     * operación asíncrona, que por definición no se conoce al renderizar.
     *
     * La alternativa sin estado sería derivar "cargando" de una clave
     * construida con las dependencias y compararla con la del último
     * resultado. Funciona, pero obliga en silencio a que todas las
     * dependencias sean primitivas serializables, y eso es una trampa para
     * el siguiente que use el hook.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargando(true);
    setError(null);
    setSlow(false);

    const avisoLento = setTimeout(() => {
      if (vigente) {
        setSlow(true);
      }
    }, SLOW_AFTER_MS);

    cargarRef
      .current()
      .then((resultado) => {
        if (vigente) {
          setData(resultado);
          setError(null);
        }
      })
      .catch((fallo: unknown) => {
        if (vigente) {
          setError(toApiError(fallo));
          setData(null);
        }
      })
      .finally(() => {
        clearTimeout(avisoLento);
        if (vigente) {
          setCargando(false);
          setSlow(false);
        }
      });

    return () => {
      vigente = false;
      clearTimeout(avisoLento);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, intento]);

  const reload = useCallback(() => {
    setIntento((anterior) => anterior + 1);
  }, []);

  /**
   * `enabled && cargando` se deduce en vez de guardarse.
   *
   * Apagar el estado desde el efecto cuando la carga está deshabilitada
   * provocaba un render en cascada para expresar algo que ya se sabe sin
   * preguntar: si no hay carga habilitada, no hay nada cargando.
   */
  return { data, error, loading: enabled && cargando, slow, reload };
}
