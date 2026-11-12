import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';

import { Calendar } from '../../src/components/Calendar';
import { BookingProvider, useBooking } from '../../src/context/BookingContext';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import type { BarberSummary } from '../../src/types/api';
import { renderApp } from '../helpers/render';
import { reiniciarRouter, router } from '../helpers/router';

jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);

beforeEach(() => {
  reiniciarRouter();
});

describe('Calendar', () => {
  // Martes 10 de noviembre de 2026. El calendario depende de "hoy" para
  // saber qué días ya pasaron, así que el reloj se congela.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 10, 9, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const todosDisponibles = () => true;

  function montar(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
    const onSelectDate = jest.fn();
    const onMonthChange = jest.fn();
    return renderApp(
      <Calendar
        month="2026-11"
        onMonthChange={onMonthChange}
        selectedDate={null}
        onSelectDate={onSelectDate}
        isDayAvailable={todosDisponibles}
        {...props}
      />,
    ).then(() => ({ onSelectDate, onMonthChange }));
  }

  it('titula con el mes y el año en español', async () => {
    await montar();

    expect(screen.getByText('Noviembre 2026')).toBeOnTheScreen();
  });

  it('pinta las siete columnas empezando en domingo', async () => {
    await montar();

    expect(screen.getByText('DOM')).toBeOnTheScreen();
    expect(screen.getByText('SÁB')).toBeOnTheScreen();
  });

  it('elegir un día disponible devuelve su fecha ISO', async () => {
    const { onSelectDate } = await montar();

    await fireEvent.press(screen.getByRole('button', { name: 'Día 15' }));

    expect(onSelectDate).toHaveBeenCalledWith('2026-11-15');
  });

  it('hoy se puede elegir', async () => {
    await montar();

    expect(screen.getByRole('button', { name: 'Día 10' })).toBeEnabled();
  });

  it('un día pasado está deshabilitado aunque tuviera cupo', async () => {
    await montar();

    expect(screen.getByRole('button', { name: 'Día 9' })).toBeDisabled();
  });

  it('un día sin cupo está deshabilitado aunque sea futuro', async () => {
    await montar({ isDayAvailable: (iso) => iso !== '2026-11-20' });

    expect(screen.getByRole('button', { name: 'Día 20' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Día 21' })).toBeEnabled();
  });

  it('marca el día seleccionado', async () => {
    await montar({ selectedDate: '2026-11-15' });

    expect(screen.getByRole('button', { name: 'Día 15' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Día 16' })).not.toBeSelected();
  });

  it('en el mes en curso no deja retroceder: no hay nada reservable atrás', async () => {
    await montar();

    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
  });

  it('desde un mes futuro sí deja retroceder', async () => {
    const { onMonthChange } = await montar({ month: '2026-12' });

    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));

    expect(onMonthChange).toHaveBeenCalledWith('2026-11');
  });

  it('avanzar pide el mes siguiente', async () => {
    const { onMonthChange } = await montar();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(onMonthChange).toHaveBeenCalledWith('2026-12');
  });

  it('avanzar desde diciembre cambia de año', async () => {
    const { onMonthChange } = await montar({ month: '2026-12' });

    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(onMonthChange).toHaveBeenCalledWith('2027-01');
  });

  describe('con allowPast, como lo usa la agenda', () => {
    it('los días pasados se pueden elegir', async () => {
      const { onSelectDate } = await montar({ allowPast: true });

      await fireEvent.press(screen.getByRole('button', { name: 'Día 3' }));

      expect(onSelectDate).toHaveBeenCalledWith('2026-11-03');
    });

    it('se puede retroceder a meses anteriores', async () => {
      const { onMonthChange } = await montar({ allowPast: true });

      await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));

      expect(onMonthChange).toHaveBeenCalledWith('2026-10');
    });
  });
});

describe('useBookingNavigation', () => {
  it('goHome descarta toda la pila del flujo', async () => {
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.goHome();

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('goHome sin pila que descartar reemplaza la ruta', async () => {
    // Pasa al entrar por enlace directo a un paso intermedio.
    router.canDismiss.mockReturnValue(false);
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.goHome();

    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('goBack retrocede un paso', async () => {
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.goBack();

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('goBack sin historial va al inicio en vez de no hacer nada', async () => {
    router.canGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.goBack();

    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('changeBarber vuelve al paso 1 descartando los intermedios', async () => {
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.changeBarber();

    expect(router.dismissTo).toHaveBeenCalledWith('/reserva/barbero');
  });

  it('changeBarber sin pila reemplaza por el paso 1', async () => {
    router.canDismiss.mockReturnValue(false);
    const { result } = await renderHook(() => useBookingNavigation());

    result.current.changeBarber();

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('useRequireBooking', () => {
  const barbero: BarberSummary = {
    id: 'luis-gomez',
    name: 'Luis Gomez',
    specialty: 'Fades',
    avatar: 'https://ejemplo.com/a.png',
    rating: 5,
    reviewsCount: 2,
    servicesCount: 3,
  };

  function montar(requisitos: Parameters<typeof useRequireBooking>[0]) {
    return renderHook(
      () => ({ listo: useRequireBooking(requisitos), reserva: useBooking() }),
      { wrapper: BookingProvider },
    );
  }

  it('sin barbero devuelve false y manda al paso 1', async () => {
    const { result } = await montar(['barber']);

    expect(result.current.listo).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });

  it('con lo que pide devuelve true y no redirige', async () => {
    const { result } = await montar(['barber']);
    router.replace.mockClear();

    await act(async () => {
      result.current.reserva.setBarber(barbero);
    });

    expect(result.current.listo).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('exige TODOS los requisitos, no solo el primero', async () => {
    const { result } = await montar(['barber', 'date', 'time']);

    await act(async () => {
      result.current.reserva.setBarber(barbero);
      result.current.reserva.setDate('2026-12-01');
    });

    // Falta la hora.
    expect(result.current.listo).toBe(false);
  });

  it('el requisito de cliente pide nombre y teléfono', async () => {
    const { result } = await montar(['customer']);

    await act(async () => {
      result.current.reserva.setName('Cliente Prueba');
    });
    expect(result.current.listo).toBe(false);

    await act(async () => {
      result.current.reserva.setPhone('3000000000');
    });
    expect(result.current.listo).toBe(true);
  });

  it('el requisito de cita confirmada se cumple al guardarla', async () => {
    const { result } = await montar(['booking']);
    expect(result.current.listo).toBe(false);

    await act(async () => {
      result.current.reserva.setBooking({
        id: 'abc-123',
        barberId: 'luis-gomez',
        date: '2026-12-01',
        time: '10:00',
        customerName: 'Cliente Prueba',
        customerPhone: '3000000000',
        status: 'activa',
        createdAt: '2026-11-10T10:00:00.000Z',
      });
    });

    expect(result.current.listo).toBe(true);
  });
});
