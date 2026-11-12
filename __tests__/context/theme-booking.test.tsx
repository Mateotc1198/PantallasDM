import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SystemUI from 'expo-system-ui';
import { Appearance, StyleSheet } from 'react-native';

import { BookingProvider, useBooking } from '../../src/context/BookingContext';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeContext';
import { darkPalette, lightPalette, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { BarberSummary, Booking } from '../../src/types/api';

const CLAVE_TEMA = 'zonabarber:theme';

describe('tema', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('arranca en oscuro', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.name).toBe('dark');
    expect(result.current.colors).toBe(darkPalette);
  });

  it('toggle cambia a claro y entrega la otra paleta', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await act(async () => {
      result.current.toggle();
    });

    expect(result.current.name).toBe('light');
    expect(result.current.colors).toBe(lightPalette);
  });

  it('dos toggles devuelven al oscuro', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await act(async () => {
      result.current.toggle();
    });
    await act(async () => {
      result.current.toggle();
    });

    expect(result.current.name).toBe('dark');
  });

  it('guarda la preferencia para la próxima vez', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await act(async () => {
      result.current.setTheme('light');
    });

    await expect(AsyncStorage.getItem(CLAVE_TEMA)).resolves.toBe('light');
  });

  it('restaura la preferencia guardada', async () => {
    await AsyncStorage.setItem(CLAVE_TEMA, 'light');

    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

    await waitFor(() => expect(result.current.name).toBe('light'));
  });

  it('ignora un valor guardado que no es un tema válido', async () => {
    await AsyncStorage.setItem(CLAVE_TEMA, 'fucsia');

    const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.name).toBe('dark');
  });

  describe('lo que pinta el sistema sigue al tema', () => {
    const fondo = jest.mocked(SystemUI.setBackgroundColorAsync);

    beforeEach(() => {
      fondo.mockClear();
    });

    it('al arrancar, el fondo de la ventana es el del tema oscuro', async () => {
      await renderHook(() => useTheme(), { wrapper: ThemeProvider });

      expect(fondo).toHaveBeenLastCalledWith(darkPalette.bg);
    });

    it('al cambiar a claro, cambian el fondo de la ventana y el modo del sistema', async () => {
      const modo = jest.spyOn(Appearance, 'setColorScheme');
      const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });

      await act(async () => {
        result.current.toggle();
      });

      expect(fondo).toHaveBeenLastCalledWith(lightPalette.bg);
      expect(modo).toHaveBeenLastCalledWith('light');
      modo.mockRestore();
    });

    it('si el sistema no deja cambiar el fondo, la app sigue funcionando', async () => {
      fondo.mockRejectedValueOnce(new Error('no soportado'));

      const { result } = await renderHook(() => useTheme(), { wrapper: ThemeProvider });
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.name).toBe('dark');
    });
  });

  it('fuera del proveedor falla con un mensaje que dice qué falta', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useTheme())).rejects.toThrow(/ThemeProvider/);

    silencio.mockRestore();
  });
});

describe('paletas', () => {
  it('las dos paletas definen exactamente los mismos tokens', () => {
    // Si una paleta tuviera un token que la otra no, ese color sería
    // undefined al cambiar de tema y nadie lo notaría hasta verlo.
    expect(Object.keys(lightPalette).sort()).toEqual(Object.keys(darkPalette).sort());
  });

  it('el naranja de marca no cambia con el tema', () => {
    expect(lightPalette.primary).toBe(darkPalette.primary);
  });

  it('en claro el acento para texto es distinto del de relleno', () => {
    // El naranja de marca sobre blanco no alcanza el contraste mínimo.
    expect(lightPalette.primaryText).not.toBe(lightPalette.primary);
  });

  it('el texto del hero es claro en los dos temas: la foto siempre es oscura', () => {
    expect(lightPalette.heroText).toBe(darkPalette.heroText);
  });
});

describe('useThemedStyles', () => {
  const makeStyles = (colors: Palette) =>
    StyleSheet.create({ caja: { backgroundColor: colors.bg } });

  it('resuelve los estilos con la paleta activa', async () => {
    const { result } = await renderHook(() => useThemedStyles(makeStyles), {
      wrapper: ThemeProvider,
    });

    expect(result.current.caja.backgroundColor).toBe(darkPalette.bg);
  });

  it('dos componentes con la misma fábrica comparten la misma hoja', async () => {
    const primero = await renderHook(() => useThemedStyles(makeStyles), { wrapper: ThemeProvider });
    const segundo = await renderHook(() => useThemedStyles(makeStyles), { wrapper: ThemeProvider });

    // Misma referencia, no solo mismo contenido: la caché es por
    // (componente, paleta), no por instancia.
    expect(primero.result.current).toBe(segundo.result.current);
  });

  it('al cambiar de tema entrega otra hoja con los colores nuevos', async () => {
    const { result } = await renderHook(
      () => ({ estilos: useThemedStyles(makeStyles), tema: useTheme() }),
      { wrapper: ThemeProvider },
    );
    const oscuros = result.current.estilos;

    await act(async () => {
      result.current.tema.toggle();
    });

    expect(result.current.estilos).not.toBe(oscuros);
    expect(result.current.estilos.caja.backgroundColor).toBe(lightPalette.bg);
  });
});

describe('estado de la reserva', () => {
  const barbero: BarberSummary = {
    id: 'luis-gomez',
    name: 'Luis Gomez',
    specialty: 'Fades',
    avatar: 'https://ejemplo.com/a.png',
    rating: 5,
    reviewsCount: 2,
    servicesCount: 3,
  };

  const cita: Booking = {
    id: 'abc-123',
    barberId: 'luis-gomez',
    date: '2026-12-01',
    time: '10:00',
    customerName: 'Cliente Prueba',
    customerPhone: '3000000000',
    status: 'activa',
    service: null,
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  async function montar() {
    const { result } = await renderHook(() => useBooking(), { wrapper: BookingProvider });
    return result;
  }

  it('arranca vacío', async () => {
    const reserva = await montar();

    expect(reserva.current).toMatchObject({
      barber: null,
      date: null,
      time: null,
      name: '',
      phone: '',
      booking: null,
    });
  });

  it('cambiar de barbero invalida la fecha y la hora', async () => {
    // La disponibilidad depende del barbero: conservar la hora permitiría
    // confirmar una cita en un horario que el nuevo barbero no tiene.
    const reserva = await montar();
    await act(async () => {
      reserva.current.setBarber(barbero);
      reserva.current.setDate('2026-12-01');
      reserva.current.setTime('10:00');
    });

    await act(async () => {
      reserva.current.setBarber({ ...barbero, id: 'alexander-escobar' });
    });

    expect(reserva.current.date).toBeNull();
    expect(reserva.current.time).toBeNull();
  });

  it('cambiar de fecha invalida la hora pero conserva el barbero', async () => {
    const reserva = await montar();
    await act(async () => {
      reserva.current.setBarber(barbero);
      reserva.current.setDate('2026-12-01');
      reserva.current.setTime('10:00');
    });

    await act(async () => {
      reserva.current.setDate('2026-12-02');
    });

    expect(reserva.current.time).toBeNull();
    expect(reserva.current.barber).toEqual(barbero);
  });

  it('cambiar de hora no toca ni el barbero ni la fecha', async () => {
    const reserva = await montar();
    await act(async () => {
      reserva.current.setBarber(barbero);
      reserva.current.setDate('2026-12-01');
      reserva.current.setTime('10:00');
    });

    await act(async () => {
      reserva.current.setTime('11:00');
    });

    expect(reserva.current).toMatchObject({ barber: barbero, date: '2026-12-01', time: '11:00' });
  });

  it('nombre y teléfono sobreviven a un cambio de barbero', async () => {
    // Quien vuelve atrás a cambiar de barbero no debería reescribir sus datos.
    const reserva = await montar();
    await act(async () => {
      reserva.current.setName('Cliente Prueba');
      reserva.current.setPhone('3000000000');
    });

    await act(async () => {
      reserva.current.setBarber(barbero);
    });

    expect(reserva.current).toMatchObject({ name: 'Cliente Prueba', phone: '3000000000' });
  });

  it('la cita confirmada deja de valer si cambia lo que la originó', async () => {
    const reserva = await montar();
    await act(async () => {
      reserva.current.setBooking(cita);
    });
    expect(reserva.current.booking).toEqual(cita);

    await act(async () => {
      reserva.current.setTime('11:00');
    });

    expect(reserva.current.booking).toBeNull();
  });

  it('reset lo devuelve todo al estado inicial', async () => {
    const reserva = await montar();
    await act(async () => {
      reserva.current.setBarber(barbero);
      reserva.current.setDate('2026-12-01');
      reserva.current.setName('Cliente Prueba');
      reserva.current.setBooking(cita);
    });

    await act(async () => {
      reserva.current.reset();
    });

    expect(reserva.current).toMatchObject({
      barber: null,
      date: null,
      time: null,
      name: '',
      booking: null,
    });
  });

  it('fuera del proveedor falla con un mensaje que dice qué falta', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useBooking())).rejects.toThrow(/BookingProvider/);

    silencio.mockRestore();
  });
});
