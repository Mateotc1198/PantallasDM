import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';

import HomeScreen from '../../app/index';
import BarberoScreen from '../../app/reserva/barbero';
import ConfirmadaScreen from '../../app/reserva/confirmada';
import DatosScreen from '../../app/reserva/datos';
import FechaScreen from '../../app/reserva/fecha';
import HoraScreen from '../../app/reserva/hora';
import PerfilScreen from '../../app/reserva/perfil';
import ServicioScreen from '../../app/reserva/servicio';
import { ApiError } from '../../src/api/client';
import * as barbersData from '../../src/data/barbers';
import * as bookingsData from '../../src/data/bookings';
import * as servicesData from '../../src/data/services';
import * as slotsData from '../../src/data/slots';
import { reiniciarDobles } from '../helpers/dobles';
import { BARBERO, CITA, OTRO_BARBERO, renderConReserva, SERVICIO } from '../helpers/estado';
import { renderApp } from '../helpers/render';
import { reiniciarRouter, router } from '../helpers/router';

/**
 * El flujo de reserva, pantalla por pantalla.
 *
 * La capa de datos se sustituye: aquí se prueba qué hace la interfaz con
 * cada respuesta posible (datos, vacío, error, conflicto), no la API, que
 * tiene sus propios tests contra una base real.
 */
jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);
jest.mock('../../src/data/barbers');
jest.mock('../../src/data/bookings');
jest.mock('../../src/data/services');
jest.mock('../../src/data/slots');

const barbers = jest.mocked(barbersData);
const bookings = jest.mocked(bookingsData);
const services = jest.mocked(servicesData);
const slots = jest.mocked(slotsData);

/**
 * Se reinician solo los dobles de la capa de datos. Un resetAllMocks global
 * también dejaría sin implementación al almacenamiento en memoria, y el
 * tema no podría arrancar.
 */
beforeEach(() => {
  reiniciarRouter();
  reiniciarDobles(barbers, bookings, services, slots);
  jest.restoreAllMocks();
});

describe('inicio', () => {
  it('"Agendar Cita" lleva al primer paso', async () => {
    await renderApp(<HomeScreen />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Agendar Cita' }));

    expect(router.push).toHaveBeenCalledWith('/reserva/barbero');
  });

  it.each([
    ['Ver nuestros servicios', '/servicios'],
    ['Ver los datos de contacto', '/contacto'],
    ['Ver, aplazar o cancelar mi cita', '/cita'],
    ['Acceder al panel de administración', '/admin'],
  ])('"%s" navega a %s', async (etiqueta, destino) => {
    await renderApp(<HomeScreen />);

    await userEvent.setup().press(screen.getByRole('button', { name: etiqueta }));

    expect(router.push).toHaveBeenCalledWith(destino);
  });

  it('el botón flotante abre WhatsApp', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp(<HomeScreen />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Escribir por WhatsApp' }));

    expect(abrir).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/'));
  });
});

describe('paso 1: barbero', () => {
  it('lista los barberos que devuelve la API', async () => {
    barbers.getBarbers.mockResolvedValue([BARBERO, OTRO_BARBERO]);
    await renderApp(<BarberoScreen />);

    expect(await screen.findByText('Luis Gomez')).toBeOnTheScreen();
    expect(screen.getByText('Alexander Escobar')).toBeOnTheScreen();
  });

  it('elegir uno avanza al perfil', async () => {
    barbers.getBarbers.mockResolvedValue([BARBERO]);
    await renderApp(<BarberoScreen />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Elegir a Luis Gomez' }));

    expect(router.push).toHaveBeenCalledWith('/reserva/perfil');
  });

  it('una lista vacía se explica en vez de dejar la pantalla en blanco', async () => {
    barbers.getBarbers.mockResolvedValue([]);
    await renderApp(<BarberoScreen />);

    expect(await screen.findByText(/No hay barberos disponibles/)).toBeOnTheScreen();
  });

  it('si la carga falla ofrece reintentar, y reintentar vuelve a pedir', async () => {
    barbers.getBarbers
      .mockRejectedValueOnce(new ApiError('x', 0, 'NETWORK_ERROR'))
      .mockResolvedValueOnce([BARBERO]);
    await renderApp(<BarberoScreen />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Luis Gomez')).toBeOnTheScreen();
    expect(barbers.getBarbers).toHaveBeenCalledTimes(2);
  });
});

describe('paso 2: perfil', () => {
  const conResenas = {
    ...BARBERO,
    reviews: [{ id: 'r1', authorName: 'Andrés Rojas', comment: 'El mejor fade.', rating: 5 }],
  };

  it('pinta la cabecera con lo que ya traía la lista y luego las reseñas', async () => {
    barbers.getBarberById.mockResolvedValue(conResenas);
    await renderConReserva(<PerfilScreen />, { barber: BARBERO });

    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
    expect(await screen.findByText('Andrés Rojas')).toBeOnTheScreen();
    expect(barbers.getBarberById).toHaveBeenCalledWith('luis-gomez');
  });

  it('sin reseñas lo dice', async () => {
    barbers.getBarberById.mockResolvedValue({ ...BARBERO, reviews: [] });
    await renderConReserva(<PerfilScreen />, { barber: BARBERO });

    expect(await screen.findByText(/todavía no tiene reseñas/)).toBeOnTheScreen();
  });

  it('si las reseñas fallan, la cabecera sigue ahí y se puede continuar', async () => {
    barbers.getBarberById.mockRejectedValue(new ApiError('x', 500, 'INTERNAL_ERROR'));
    await renderConReserva(<PerfilScreen />, { barber: BARBERO });

    expect(await screen.findByText('El servidor falló')).toBeOnTheScreen();
    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('"Continuar" avanza a elegir el servicio', async () => {
    barbers.getBarberById.mockResolvedValue(conResenas);
    await renderConReserva(<PerfilScreen />, { barber: BARBERO });

    await userEvent.setup().press(screen.getByRole('button', { name: 'Continuar' }));

    expect(router.push).toHaveBeenCalledWith('/reserva/servicio');
  });

  it('sin barbero elegido devuelve al paso 1', async () => {
    await renderApp(<PerfilScreen />);

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('paso 4: fecha', () => {
  beforeEach(() => {
    // Cada mes pedido tiene cupo solo el día 15.
    slots.getMonthAvailability.mockImplementation(async (_barbero, mes) => ({
      month: mes,
      days: [`${mes}-15`],
    }));
  });

  it('pide la disponibilidad del mes con UNA petición', async () => {
    await renderConReserva(<FechaScreen />, { barber: BARBERO });
    await screen.findByRole('button', { name: 'Mes siguiente' });

    expect(slots.getMonthAvailability).toHaveBeenCalledTimes(1);
    expect(slots.getMonthAvailability).toHaveBeenCalledWith('luis-gomez', expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it('cambiar de mes pide la disponibilidad del mes nuevo', async () => {
    await renderConReserva(<FechaScreen />, { barber: BARBERO });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    await screen.findByRole('button', { name: 'Día 15' });

    expect(slots.getMonthAvailability).toHaveBeenCalledTimes(2);
  });

  it('elegir un día con cupo avanza a la hora', async () => {
    await renderConReserva(<FechaScreen />, { barber: BARBERO });
    const usuario = userEvent.setup();

    // El mes siguiente está siempre entero en el futuro: el test no depende
    // del día en que se ejecute.
    await usuario.press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    await usuario.press(await screen.findByRole('button', { name: 'Día 15' }));

    expect(router.push).toHaveBeenCalledWith('/reserva/hora');
  });

  it('un día sin cupo no se puede elegir', async () => {
    await renderConReserva(<FechaScreen />, { barber: BARBERO });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Mes siguiente' }));

    expect(await screen.findByRole('button', { name: 'Día 16' })).toBeDisabled();
  });

  it('si no queda ningún día con cupo lo explica', async () => {
    slots.getMonthAvailability.mockResolvedValue({ month: '2026-11', days: [] });
    await renderConReserva(<FechaScreen />, { barber: BARBERO });

    expect(await screen.findByText(/No quedan días con cupo/)).toBeOnTheScreen();
  });

  it('si la disponibilidad falla ofrece reintentar', async () => {
    slots.getMonthAvailability.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    await renderConReserva(<FechaScreen />, { barber: BARBERO });

    expect(await screen.findByText('Sin conexión')).toBeOnTheScreen();
  });
});

describe('paso 5: hora', () => {
  const estado = { barber: BARBERO, date: '2026-12-01' };

  it('pinta las franjas y elegir una libre avanza a los datos', async () => {
    slots.getSlots.mockResolvedValue([
      { id: 's1', time: '09:00', status: 'libre' },
      { id: 's2', time: '09:30', status: 'ocupado' },
    ]);
    await renderConReserva(<HoraScreen />, estado);

    await userEvent.setup().press(await screen.findByRole('button', { name: '9:00 am, libre' }));

    expect(slots.getSlots).toHaveBeenCalledWith('luis-gomez', '2026-12-01');
    expect(router.push).toHaveBeenCalledWith('/reserva/datos');
  });

  it('una franja ocupada se ve pero no se puede pulsar', async () => {
    slots.getSlots.mockResolvedValue([{ id: 's2', time: '09:30', status: 'ocupado' }]);
    await renderConReserva(<HoraScreen />, estado);

    expect(await screen.findByLabelText('9:30 am, ocupado')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /9:30/ })).not.toBeOnTheScreen();
  });

  it('un día sin franjas lo dice', async () => {
    slots.getSlots.mockResolvedValue([]);
    await renderConReserva(<HoraScreen />, estado);

    expect(await screen.findByText('Sin horarios disponibles ese día.')).toBeOnTheScreen();
  });

  it('si la carga falla ofrece reintentar', async () => {
    slots.getSlots.mockRejectedValue(new ApiError('x', 500, 'INTERNAL_ERROR'));
    await renderConReserva(<HoraScreen />, estado);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });

  it('sin fecha elegida devuelve al paso 1', async () => {
    await renderConReserva(<HoraScreen />, { barber: BARBERO });

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('paso 6: datos', () => {
  const estado = { barber: BARBERO, date: '2026-12-01', time: '10:00' };

  async function rellenar(nombre: string, telefono: string) {
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Tu nombre'), nombre);
    await usuario.type(screen.getByLabelText('Tu número de celular'), telefono);
    return usuario;
  }

  it('no deja confirmar hasta que nombre y teléfono son válidos', async () => {
    await renderConReserva(<DatosScreen />, estado);
    expect(screen.getByRole('button', { name: 'Confirmar cita' })).toBeDisabled();

    await rellenar('Cliente Prueba', '300000');
    expect(screen.getByRole('button', { name: 'Confirmar cita' })).toBeDisabled();
  });

  it('el teléfono se queda solo con dígitos y como mucho diez', async () => {
    await renderConReserva(<DatosScreen />, estado);

    await userEvent.setup().type(screen.getByLabelText('Tu número de celular'), '300-000 00a00');

    expect(screen.getByLabelText('Tu número de celular')).toHaveDisplayValue('3000000000');
  });

  it('confirmar envía la reserva completa y avanza', async () => {
    bookings.createBooking.mockResolvedValue(CITA);
    await renderConReserva(<DatosScreen />, estado);
    const usuario = await rellenar('  Cliente Prueba  ', '3000000000');

    await usuario.press(screen.getByRole('button', { name: 'Confirmar cita' }));

    expect(bookings.createBooking).toHaveBeenCalledWith({
      barberId: 'luis-gomez',
      date: '2026-12-01',
      time: '10:00',
      // Sin los espacios de los extremos.
      customerName: 'Cliente Prueba',
      customerPhone: '3000000000',
      // Del servicio viaja solo el id: el precio lo pone el servidor.
      serviceId: 's1',
    });
    expect(router.replace).toHaveBeenCalledWith('/reserva/confirmada');
  });

  it('guarda el código de la cita en el dispositivo', async () => {
    bookings.createBooking.mockResolvedValue(CITA);
    await renderConReserva(<DatosScreen />, estado);
    const usuario = await rellenar('Cliente Prueba', '3000000000');

    await usuario.press(screen.getByRole('button', { name: 'Confirmar cita' }));

    await expect(AsyncStorage.getItem('zonabarber:ultimaCita')).resolves.toBe(CITA.id);
  });

  it('un 409 explica que el horario se ocupó y ofrece elegir otro', async () => {
    // La carrera que gana el índice único de la base: alguien reservó esa
    // hora mientras este usuario escribía su nombre. Reintentar no sirve.
    bookings.createBooking.mockRejectedValue(
      new ApiError('Ese horario ya está reservado.', 409, 'BOOKING_SLOT_TAKEN'),
    );
    await renderConReserva(<DatosScreen />, estado);
    const usuario = await rellenar('Cliente Prueba', '3000000000');

    await usuario.press(screen.getByRole('button', { name: 'Confirmar cita' }));

    expect(await screen.findByText('Ese horario acaba de ocuparse')).toBeOnTheScreen();
    await usuario.press(screen.getByRole('button', { name: 'Elegir otra hora' }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalledWith('/reserva/confirmada');
  });

  it('otro error muestra su mensaje y deja el formulario para reintentar', async () => {
    bookings.createBooking.mockRejectedValue(
      new ApiError('El barbero no atiende ese día.', 422, 'BARBER_CLOSED_THAT_DAY'),
    );
    await renderConReserva(<DatosScreen />, estado);
    const usuario = await rellenar('Cliente Prueba', '3000000000');

    await usuario.press(screen.getByRole('button', { name: 'Confirmar cita' }));

    expect(await screen.findByText('El barbero no atiende ese día.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Elegir otra hora' })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Confirmar cita' })).toBeEnabled();
  });

  it('sin hora elegida devuelve al paso 1', async () => {
    await renderConReserva(<DatosScreen />, { barber: BARBERO, date: '2026-12-01' });

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('confirmación', () => {
  const estado = { barber: BARBERO, date: CITA.date, time: CITA.time, booking: CITA };

  it('muestra los datos de la cita que devolvió el servidor', async () => {
    await renderConReserva(<ConfirmadaScreen />, estado);

    expect(screen.getByText('Cita confirmada')).toBeOnTheScreen();
    expect(screen.getByText('Te esperamos, Cliente Prueba.')).toBeOnTheScreen();
    expect(screen.getByText('01/12/2026')).toBeOnTheScreen();
    expect(screen.getByText('10:00 am')).toBeOnTheScreen();
  });

  it('enseña el código completo de la cita', async () => {
    await renderConReserva(<ConfirmadaScreen />, estado);

    expect(screen.getByText(CITA.id)).toBeOnTheScreen();
  });

  it('permite enviarse el código por WhatsApp', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    // El espía puede venir de un test anterior con llamadas ya registradas.
    abrir.mockClear();
    await renderConReserva(<ConfirmadaScreen />, estado);

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Enviarme el código por WhatsApp' }));

    const enlace = abrir.mock.calls[0][0];
    expect(enlace).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(enlace)).toContain(CITA.id);
  });

  it('"Ir al inicio" cierra el flujo', async () => {
    await renderConReserva(<ConfirmadaScreen />, estado);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ir al inicio ahora' }));

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });

  it('ofrece ir a gestionar la cita', async () => {
    await renderConReserva(<ConfirmadaScreen />, estado);

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Ver, aplazar o cancelar mi cita' }));

    expect(router.replace).toHaveBeenCalledWith('/cita');
  });

  it('sin cita confirmada no pinta nada y devuelve al paso 1', async () => {
    await renderConReserva(<ConfirmadaScreen />, { barber: BARBERO });

    expect(screen.queryByText('Cita confirmada')).not.toBeOnTheScreen();
    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('paso 3: servicio', () => {
  const BARBA: typeof SERVICIO = {
    id: 's2',
    name: 'Arreglo de barba',
    description: '',
    priceCop: 20000,
    category: 'Barba',
    imageUrl: null,
  };

  beforeEach(() => {
    // La API los devuelve ya ordenados por categoría y nombre.
    services.getServices.mockResolvedValue([BARBA, SERVICIO]);
  });

  it('lista el catálogo agrupado por categoría, con el precio de cada servicio', async () => {
    await renderConReserva(<ServicioScreen />, { barber: BARBERO, service: null });

    expect(await screen.findByText('Fade')).toBeOnTheScreen();
    expect(screen.getByText('Barba')).toBeOnTheScreen();
    expect(screen.getByText('Cortes')).toBeOnTheScreen();
    expect(screen.getByText(/30\.000/)).toBeOnTheScreen();
    expect(screen.getByText(/20\.000/)).toBeOnTheScreen();
  });

  it('elegir un servicio lo guarda y avanza a la fecha', async () => {
    await renderConReserva(<ServicioScreen />, { barber: BARBERO, service: null });

    await userEvent.setup().press(await screen.findByRole('button', { name: /Elegir Fade/ }));

    expect(router.push).toHaveBeenCalledWith('/reserva/fecha');
  });

  it('recuerda con qué barbero se está reservando y deja cambiarlo', async () => {
    await renderConReserva(<ServicioScreen />, { barber: BARBERO, service: null });

    expect(await screen.findByText('Luis Gomez')).toBeOnTheScreen();
  });

  it('un catálogo vacío se explica en vez de dejar la pantalla en blanco', async () => {
    services.getServices.mockResolvedValue([]);
    await renderConReserva(<ServicioScreen />, { barber: BARBERO, service: null });

    expect(await screen.findByText('Todavía no hay servicios publicados.')).toBeOnTheScreen();
  });

  it('si el catálogo falla ofrece reintentar, y reintentar vuelve a pedir', async () => {
    services.getServices.mockRejectedValueOnce(new ApiError('x', 0, 'NETWORK_ERROR'));
    await renderConReserva(<ServicioScreen />, { barber: BARBERO, service: null });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Fade')).toBeOnTheScreen();
    expect(services.getServices).toHaveBeenCalledTimes(2);
  });

  it('sin barbero elegido devuelve al paso 1', async () => {
    await renderConReserva(<ServicioScreen />, {});

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('el servicio a lo largo del flujo', () => {
  it('sin servicio elegido, la fecha devuelve al paso 1', async () => {
    await renderConReserva(<FechaScreen />, { barber: BARBERO, service: null });

    expect(router.replace).toHaveBeenCalledWith('/reserva/barbero');
  });

  it('el resumen antes de confirmar dice el servicio y su precio', async () => {
    await renderConReserva(<DatosScreen />, {
      barber: BARBERO,
      date: '2026-12-01',
      time: '10:00',
    });

    expect(await screen.findByText('Fade')).toBeOnTheScreen();
    expect(screen.getByText(/30\.000/)).toBeOnTheScreen();
  });

  it('la confirmación muestra el servicio que registró el servidor', async () => {
    await renderConReserva(<ConfirmadaScreen />, { barber: BARBERO, booking: CITA });

    expect(await screen.findByText('Fade')).toBeOnTheScreen();
    expect(screen.getByText(/30\.000/)).toBeOnTheScreen();
  });

  it('una cita antigua sin servicio se muestra sin esas dos filas', async () => {
    await renderConReserva(<ConfirmadaScreen />, {
      barber: BARBERO,
      booking: { ...CITA, service: null },
    });

    expect(await screen.findByText('Cita confirmada')).toBeOnTheScreen();
    expect(screen.queryByText('Servicio')).not.toBeOnTheScreen();
  });
});
