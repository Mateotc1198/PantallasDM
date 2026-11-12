import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../src/api/client';
import { useAsync } from '../../src/hooks/useAsync';

/** Promesa que se resuelve o rechaza a mano, para controlar el orden. */
function diferida<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe('useAsync', () => {
  it('empieza cargando y termina con los datos', async () => {
    const carga = diferida<string>();
    const { result } = await renderHook(() => useAsync(() => carga.promesa, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => {
      carga.resolver('listo');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('listo');
    expect(result.current.error).toBeNull();
  });

  it('un fallo acaba en error y sin datos', async () => {
    const fallo = new ApiError('Sin conexión', 0, 'NETWORK_ERROR');
    const { result } = await renderHook(() => useAsync(() => Promise.reject(fallo), []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(fallo);
    expect(result.current.data).toBeNull();
  });

  it('convierte en ApiError lo que no lo era', async () => {
    const { result } = await renderHook(() =>
      useAsync(() => Promise.reject(new Error('algo raro')), []),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.message).toBe('algo raro');
  });

  it('deshabilitado no llama a nada ni dice que carga', async () => {
    const cargar = jest.fn(() => Promise.resolve('x'));
    const { result } = await renderHook(() => useAsync(cargar, [], false));

    expect(cargar).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('al habilitarse dispara la carga', async () => {
    const cargar = jest.fn(() => Promise.resolve('x'));
    const { result, rerender } = await renderHook(
      ({ habilitado }: { habilitado: boolean }) => useAsync(cargar, [], habilitado),
      { initialProps: { habilitado: false } },
    );

    await rerender({ habilitado: true });
    await waitFor(() => expect(result.current.data).toBe('x'));

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('vuelve a cargar cuando cambia una dependencia', async () => {
    const cargar = jest.fn((dia: string) => Promise.resolve(`horas de ${dia}`));
    const { result, rerender } = await renderHook(
      ({ dia }: { dia: string }) => useAsync(() => cargar(dia), [dia]),
      { initialProps: { dia: 'lunes' } },
    );
    await waitFor(() => expect(result.current.data).toBe('horas de lunes'));

    await rerender({ dia: 'martes' });
    await waitFor(() => expect(result.current.data).toBe('horas de martes'));

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('no vuelve a cargar si las dependencias no cambian', async () => {
    const cargar = jest.fn(() => Promise.resolve('x'));
    const { result, rerender } = await renderHook(
      ({ dia }: { dia: string }) => useAsync(cargar, [dia]),
      { initialProps: { dia: 'lunes' } },
    );
    await waitFor(() => expect(result.current.data).toBe('x'));

    await rerender({ dia: 'lunes' });

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('reload repite la carga aunque nada haya cambiado', async () => {
    let intento = 0;
    const cargar = jest.fn(() => Promise.resolve(`intento ${(intento += 1)}`));
    const { result } = await renderHook(() => useAsync(cargar, []));
    await waitFor(() => expect(result.current.data).toBe('intento 1'));

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.data).toBe('intento 2'));
  });

  it('tras un error, reload limpia el error al reintentar con éxito', async () => {
    const cargar = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new ApiError('caído', 500, 'INTERNAL_ERROR'))
      .mockResolvedValueOnce('recuperado');
    const { result } = await renderHook(() => useAsync(cargar, []));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.data).toBe('recuperado'));

    expect(result.current.error).toBeNull();
  });

  it('descarta la respuesta lenta de una petición que ya no es la vigente', async () => {
    // El caso real: el usuario toca el lunes y enseguida el martes. Si la
    // respuesta del lunes llega después, no puede pisar la del martes.
    const lunes = diferida<string>();
    const martes = diferida<string>();
    const cargas: Record<string, Promise<string>> = {
      lunes: lunes.promesa,
      martes: martes.promesa,
    };

    const { result, rerender } = await renderHook(
      ({ dia }: { dia: string }) => useAsync(() => cargas[dia], [dia]),
      { initialProps: { dia: 'lunes' } },
    );
    await rerender({ dia: 'martes' });

    await act(async () => {
      martes.resolver('horas del martes');
    });
    await act(async () => {
      lunes.resolver('horas del lunes');
    });

    expect(result.current.data).toBe('horas del martes');
  });

  it('usa siempre la última versión de la función, sin pedir useCallback', async () => {
    const { result, rerender } = await renderHook(
      ({ prefijo }: { prefijo: string }) => useAsync(() => Promise.resolve(`${prefijo}!`), []),
      { initialProps: { prefijo: 'a' } },
    );
    await waitFor(() => expect(result.current.data).toBe('a!'));

    // La función cambió pero las dependencias no: no recarga sola...
    await rerender({ prefijo: 'b' });
    expect(result.current.data).toBe('a!');

    // ...y al recargar usa la función nueva, no la del primer render.
    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.data).toBe('b!'));
  });

  describe('aviso de carga lenta', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no avisa antes de los cuatro segundos', async () => {
      const carga = diferida<string>();
      const { result } = await renderHook(() => useAsync(() => carga.promesa, []));

      await act(async () => {
        jest.advanceTimersByTime(3_900);
      });

      expect(result.current.slow).toBe(false);
    });

    it('avisa cuando la espera se alarga: el servidor está despertando', async () => {
      const carga = diferida<string>();
      const { result } = await renderHook(() => useAsync(() => carga.promesa, []));

      await act(async () => {
        jest.advanceTimersByTime(4_000);
      });

      expect(result.current.slow).toBe(true);
      expect(result.current.loading).toBe(true);
    });

    it('el aviso desaparece cuando por fin llegan los datos', async () => {
      const carga = diferida<string>();
      const { result } = await renderHook(() => useAsync(() => carga.promesa, []));
      await act(async () => {
        jest.advanceTimersByTime(4_000);
      });

      await act(async () => {
        carga.resolver('por fin');
      });

      expect(result.current.slow).toBe(false);
      expect(result.current.data).toBe('por fin');
    });
  });
});
