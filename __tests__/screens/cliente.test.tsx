import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import RootLayout from '../../app/_layout';
import AdminLayout from '../../app/admin/_layout';
import CitaLayout from '../../app/cita/_layout';
import AplazarScreen from '../../app/cita/aplazar';
import MiCitaScreen from '../../app/cita/index';
import ContactoLayout from '../../app/contacto/_layout';
import ContactoScreen from '../../app/contacto/index';
import ReservaLayout from '../../app/reserva/_layout';
import ServiciosLayout from '../../app/servicios/_layout';
import ServiciosScreen from '../../app/servicios/index';
import { ApiError } from '../../src/api/client';
import * as barbersData from '../../src/data/barbers';
import * as bookingsData from '../../src/data/bookings';
import * as servicesData from '../../src/data/services';
import * as slotsData from '../../src/data/slots';
import type { Service } from '../../src/types/api';
import { reiniciarDobles } from '../helpers/dobles';
import { BARBERO, CITA } from '../helpers/estado';
import { renderApp } from '../helpers/render';
import { reiniciarRouter, router, useLocalSearchParams } from '../helpers/router';

jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);
jest.mock('../../src/data/barbers');
jest.mock('../../src/data/bookings');
jest.mock('../../src/data/services');
jest.mock('../../src/data/slots');

const barbers = jest.mocked(barbersData);
const bookings = jest.mocked(bookingsData);
const services = jest.mocked(servicesData);
const slots = jest.mocked(slotsData);

const CLAVE_CITA = 'zonabarber:ultimaCita';

let abrirEnlace: jest.SpyInstance;

beforeEach(() => {
  reiniciarRouter();
  reiniciarDobles(barbers, bookings, services, slots);
  jest.restoreAllMocks();
  abrirEnlace = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  abrirEnlace.mockClear();

  barbers.getBarbers.mockResolvedValue([BARBERO]);
  bookings.getBooking.mockResolvedValue(CITA);
});

describe('mi cita', () => {
  describe('sin cita guardada en el dispositivo', () => {
    it('pide el código en vez de mostrar una pantalla vacía', async () => {
      await renderApp(<MiCitaScreen />);

      expect(await screen.findByText(/No encontramos ninguna cita/)).toBeOnTheScreen();
      expect(bookings.getBooking).not.toHaveBeenCalled();
    });

    it('no deja buscar con un código que no tiene forma de código', async () => {
      await renderApp(<MiCitaScreen />);

      await userEvent.setup().type(await screen.findByLabelText('Código de la cita'), 'abc');

      expect(screen.getByRole('button', { name: 'Buscar mi cita' })).toBeDisabled();
    });

    it('con un código completo busca la cita y lo recuerda', async () => {
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();

      await usuario.type(await screen.findByLabelText('Código de la cita'), CITA.id);
      await usuario.press(screen.getByRole('button', { name: 'Buscar mi cita' }));

      expect(await screen.findByText('Cliente Prueba')).toBeOnTheScreen();
      expect(bookings.getBooking).toHaveBeenCalledWith(CITA.id);
      await expect(AsyncStorage.getItem(CLAVE_CITA)).resolves.toBe(CITA.id);
    });
  });

  describe('con una cita guardada', () => {
    beforeEach(async () => {
      await AsyncStorage.setItem(CLAVE_CITA, CITA.id);
    });

    it('la carga sola, sin que el cliente escriba nada', async () => {
      await renderApp(<MiCitaScreen />);

      expect(await screen.findByText('Cliente Prueba')).toBeOnTheScreen();
      expect(screen.getByText('01/12/2026')).toBeOnTheScreen();
      expect(screen.getByText('10:00 am')).toBeOnTheScreen();
    });

    it('muestra el nombre del barbero, no su identificador', async () => {
      await renderApp(<MiCitaScreen />);

      expect(await screen.findByText('Luis Gomez')).toBeOnTheScreen();
    });

    it('"Aplazar" lleva a elegir fecha con el id y el barbero de la cita', async () => {
      await renderApp(<MiCitaScreen />);

      await userEvent.setup().press(await screen.findByRole('button', { name: 'Aplazar mi cita' }));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/cita/aplazar',
        params: { id: CITA.id, barberId: 'luis-gomez' },
      });
    });

    it('cancelar exige el teléfono antes de hacer nada', async () => {
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();

      await usuario.press(await screen.findByRole('button', { name: 'Cancelar mi cita' }));

      expect(screen.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
      expect(bookings.cancelBookingAsCustomer).not.toHaveBeenCalled();
    });

    it('con el teléfono cancela y vuelve a pedir la cita al servidor', async () => {
      bookings.cancelBookingAsCustomer.mockResolvedValue(undefined);
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();
      await usuario.press(await screen.findByRole('button', { name: 'Cancelar mi cita' }));
      // Tras cancelar, el servidor ya la devuelve cancelada.
      bookings.getBooking.mockResolvedValue({ ...CITA, status: 'cancelada' });

      await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3000000000');
      await usuario.press(screen.getByRole('button', { name: 'Confirmar cancelación' }));

      expect(bookings.cancelBookingAsCustomer).toHaveBeenCalledWith(CITA.id, '3000000000');
      expect(await screen.findByText('Esta cita está cancelada.')).toBeOnTheScreen();
    });

    it('con el teléfono equivocado muestra el rechazo y la cita sigue ahí', async () => {
      bookings.cancelBookingAsCustomer.mockRejectedValue(
        new ApiError('El teléfono no coincide con el de la cita.', 403, 'BOOKING_PHONE_MISMATCH'),
      );
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();
      await usuario.press(await screen.findByRole('button', { name: 'Cancelar mi cita' }));

      await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3009998877');
      await usuario.press(screen.getByRole('button', { name: 'Confirmar cancelación' }));

      expect(await screen.findByText('El teléfono no coincide con el de la cita.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Aplazar mi cita' })).toBeOnTheScreen();
    });

    it('fuera de plazo muestra la regla de negocio tal como la redacta la API', async () => {
      bookings.cancelBookingAsCustomer.mockRejectedValue(
        new ApiError(
          'Los cambios deben hacerse con al menos 2 horas de antelación. Comunícate con la barbería.',
          422,
          'BOOKING_CHANGE_TOO_LATE',
        ),
      );
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();
      await usuario.press(await screen.findByRole('button', { name: 'Cancelar mi cita' }));

      await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3000000000');
      await usuario.press(screen.getByRole('button', { name: 'Confirmar cancelación' }));

      expect(await screen.findByText(/al menos 2 horas de antelación/)).toBeOnTheScreen();
    });

    it('"Mejor no" cierra la confirmación sin cancelar', async () => {
      await renderApp(<MiCitaScreen />);
      const usuario = userEvent.setup();
      await usuario.press(await screen.findByRole('button', { name: 'Cancelar mi cita' }));

      await usuario.press(screen.getByRole('button', { name: 'Mejor no' }));

      expect(screen.getByRole('button', { name: 'Cancelar mi cita' })).toBeOnTheScreen();
      expect(bookings.cancelBookingAsCustomer).not.toHaveBeenCalled();
    });

    it('una cita ya cancelada no ofrece aplazar ni cancelar', async () => {
      bookings.getBooking.mockResolvedValue({ ...CITA, status: 'cancelada' });
      await renderApp(<MiCitaScreen />);

      expect(await screen.findByText('Esta cita está cancelada.')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Aplazar mi cita' })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Cancelar mi cita' })).not.toBeOnTheScreen();
    });

    it('"Buscar otra cita" olvida la guardada y vuelve a pedir código', async () => {
      bookings.getBooking.mockResolvedValue({ ...CITA, status: 'cancelada' });
      await renderApp(<MiCitaScreen />);

      await userEvent.setup().press(await screen.findByRole('button', { name: 'Buscar otra cita' }));

      expect(await screen.findByLabelText('Código de la cita')).toBeOnTheScreen();
      await expect(AsyncStorage.getItem(CLAVE_CITA)).resolves.toBeNull();
    });

    it('si el código guardado ya no existe permite usar otro', async () => {
      bookings.getBooking.mockRejectedValue(new ApiError('x', 404, 'BOOKING_NOT_FOUND'));
      await renderApp(<MiCitaScreen />);

      expect(await screen.findByText('No encontrado')).toBeOnTheScreen();
      await userEvent.setup().press(screen.getByRole('button', { name: 'Usar otro código' }));

      expect(await screen.findByLabelText('Código de la cita')).toBeOnTheScreen();
    });
  });

  it('la barra superior vuelve al inicio', async () => {
    await renderApp(<MiCitaScreen />);

    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Cerrar y volver al inicio' }));

    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('aplazar', () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ id: CITA.id, barberId: 'luis-gomez' });
    slots.getMonthAvailability.mockImplementation(async (_barbero, mes) => ({
      month: mes,
      days: [`${mes}-15`],
    }));
    slots.getSlots.mockResolvedValue([
      { id: 's1', time: '15:00', status: 'libre' },
      { id: 's2', time: '15:30', status: 'ocupado' },
    ]);
  });

  /** Recorre día y hora; devuelve la fecha elegida. */
  async function elegirDiaYHora() {
    const usuario = userEvent.setup();
    // El mes siguiente está entero en el futuro: no depende de qué día sea.
    await usuario.press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    await usuario.press(await screen.findByRole('button', { name: 'Día 15' }));
    await usuario.press(await screen.findByRole('button', { name: '3:00 pm, libre' }));
    const fecha = slots.getSlots.mock.calls.at(-1)?.[1] as string;
    return { usuario, fecha };
  }

  it('consulta la disponibilidad del MISMO barbero de la cita', async () => {
    await renderApp(<AplazarScreen />);
    await screen.findByRole('button', { name: 'Mes siguiente' });

    expect(slots.getMonthAvailability).toHaveBeenCalledWith('luis-gomez', expect.any(String));
  });

  it('no pide el teléfono hasta que hay día y hora', async () => {
    await renderApp(<AplazarScreen />);
    await screen.findByRole('button', { name: 'Mes siguiente' });

    expect(screen.queryByLabelText('Celular con el que reservaste')).not.toBeOnTheScreen();
  });

  it('con día, hora y teléfono aplaza y vuelve a "Mi cita"', async () => {
    bookings.rescheduleBooking.mockResolvedValue({ ...CITA, time: '15:00' });
    await renderApp(<AplazarScreen />);
    const { usuario, fecha } = await elegirDiaYHora();

    await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3000000000');
    await usuario.press(screen.getByRole('button', { name: 'Confirmar cambio' }));

    expect(bookings.rescheduleBooking).toHaveBeenCalledWith(CITA.id, '3000000000', fecha, '15:00');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/cita'));
  });

  it('sin el teléfono completo no deja confirmar', async () => {
    await renderApp(<AplazarScreen />);
    const { usuario } = await elegirDiaYHora();

    await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '300');

    expect(screen.getByRole('button', { name: 'Confirmar cambio' })).toBeDisabled();
  });

  it('si la franja se ocupó mientras elegía, recarga las horas y borra la selección', async () => {
    bookings.rescheduleBooking.mockRejectedValue(
      new ApiError('Ese horario ya está reservado.', 409, 'BOOKING_SLOT_TAKEN'),
    );
    await renderApp(<AplazarScreen />);
    const { usuario } = await elegirDiaYHora();
    const pedidasAntes = slots.getSlots.mock.calls.length;

    await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3000000000');
    await usuario.press(screen.getByRole('button', { name: 'Confirmar cambio' }));

    // Lo que había en pantalla dejó de ser cierto: se vuelve a preguntar.
    await waitFor(() => expect(slots.getSlots.mock.calls.length).toBeGreaterThan(pedidasAntes));
    expect(router.replace).not.toHaveBeenCalledWith('/cita');
  });

  it('otro rechazo muestra el mensaje de la API', async () => {
    bookings.rescheduleBooking.mockRejectedValue(
      new ApiError('El teléfono no coincide con el de la cita.', 403, 'BOOKING_PHONE_MISMATCH'),
    );
    await renderApp(<AplazarScreen />);
    const { usuario } = await elegirDiaYHora();

    await usuario.type(screen.getByLabelText('Celular con el que reservaste'), '3009998877');
    await usuario.press(screen.getByRole('button', { name: 'Confirmar cambio' }));

    expect(await screen.findByText('El teléfono no coincide con el de la cita.')).toBeOnTheScreen();
  });

  it('un día sin franjas lo dice', async () => {
    slots.getSlots.mockResolvedValue([]);
    await renderApp(<AplazarScreen />);
    const usuario = userEvent.setup();

    await usuario.press(await screen.findByRole('button', { name: 'Mes siguiente' }));
    await usuario.press(await screen.findByRole('button', { name: 'Día 15' }));

    expect(await screen.findByText('Sin horarios disponibles ese día.')).toBeOnTheScreen();
  });

  it('si la disponibilidad falla ofrece reintentar', async () => {
    slots.getMonthAvailability.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    await renderApp(<AplazarScreen />);

    expect(await screen.findByText('Sin conexión')).toBeOnTheScreen();
  });
});

describe('catálogo público', () => {
  const catalogo: Service[] = [
    { id: 's1', name: 'Arreglo de barba', description: 'Perfilado y aceite.', priceCop: 20000, category: 'Barba', imageUrl: null },
    { id: 's2', name: 'Corte clásico', description: 'Tijera y máquina.', priceCop: 25000, category: 'Cortes', imageUrl: null },
    { id: 's3', name: 'Fade', description: '', priceCop: 30000, category: 'Cortes', imageUrl: null },
  ];

  beforeEach(() => {
    services.getServices.mockResolvedValue(catalogo);
  });

  it('lista los servicios con su precio', async () => {
    await renderApp(<ServiciosScreen />);

    expect(await screen.findByText('Corte clásico')).toBeOnTheScreen();
    expect(screen.getByText(/25\.000/)).toBeOnTheScreen();
  });

  it('las categorías del filtro salen de los propios datos', async () => {
    await renderApp(<ServiciosScreen />);

    expect(await screen.findByRole('radio', { name: 'Barba' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Cortes' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeSelected();
  });

  it('filtrar por categoría esconde las demás', async () => {
    await renderApp(<ServiciosScreen />);

    await userEvent.setup().press(await screen.findByRole('radio', { name: 'Barba' }));

    expect(screen.getByText('Arreglo de barba')).toBeOnTheScreen();
    expect(screen.queryByText('Fade')).not.toBeOnTheScreen();
  });

  it('el buscador filtra por nombre sin distinguir mayúsculas', async () => {
    await renderApp(<ServiciosScreen />);

    await userEvent.setup().type(await screen.findByLabelText('Buscar un servicio'), 'FADE');

    expect(screen.getByText('Fade')).toBeOnTheScreen();
    expect(screen.queryByText('Corte clásico')).not.toBeOnTheScreen();
  });

  it('el buscador también mira la descripción', async () => {
    await renderApp(<ServiciosScreen />);

    await userEvent.setup().type(await screen.findByLabelText('Buscar un servicio'), 'tijera');

    expect(screen.getByText('Corte clásico')).toBeOnTheScreen();
    expect(screen.queryByText('Fade')).not.toBeOnTheScreen();
  });

  it('una búsqueda sin resultados lo dice', async () => {
    await renderApp(<ServiciosScreen />);

    await userEvent.setup().type(await screen.findByLabelText('Buscar un servicio'), 'zzz');

    expect(screen.getByText('No encontramos servicios con ese filtro.')).toBeOnTheScreen();
  });

  it('el botón de orden alterna entre nombre y precio', async () => {
    await renderApp(<ServiciosScreen />);
    const usuario = userEvent.setup();

    await usuario.press(await screen.findByRole('button', { name: 'Ordenar por Precio' }));

    expect(screen.getByRole('button', { name: 'Ordenar por Nombre' })).toBeOnTheScreen();
  });

  it('un catálogo vacío lo explica', async () => {
    services.getServices.mockResolvedValue([]);
    await renderApp(<ServiciosScreen />);

    expect(await screen.findByText('Todavía no hay servicios publicados.')).toBeOnTheScreen();
  });

  it('si la carga falla ofrece reintentar', async () => {
    services.getServices.mockRejectedValue(new ApiError('x', 500, 'INTERNAL_ERROR'));
    await renderApp(<ServiciosScreen />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });

  it('el pie lleva a agendar', async () => {
    await renderApp(<ServiciosScreen />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Agenda tu cita ahora' }));

    expect(router.push).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('contacto', () => {
  it('muestra los datos de la barbería sin pedir nada a la API', async () => {
    await renderApp(<ContactoScreen />);

    expect(screen.getByText('Contáctanos')).toBeOnTheScreen();
    expect(screen.getByText('Dirección')).toBeOnTheScreen();
    expect(services.getServices).not.toHaveBeenCalled();
  });

  it('el botón principal abre WhatsApp con el número de la barbería', async () => {
    await renderApp(<ContactoScreen />);

    await userEvent
      .setup()
      .press(screen.getAllByRole('button', { name: 'Escribir por WhatsApp' })[0]);

    expect(abrirEnlace).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/57'));
  });

  it('el teléfono abre el marcador', async () => {
    await renderApp(<ContactoScreen />);

    await userEvent.setup().press(screen.getByRole('button', { name: /^Teléfono:/ }));

    expect(abrirEnlace).toHaveBeenCalledWith(expect.stringMatching(/^tel:\+57/));
  });

  it('la dirección no es un botón: no hace nada al tocarla', async () => {
    await renderApp(<ContactoScreen />);

    expect(screen.queryByRole('button', { name: /^Dirección:/ })).not.toBeOnTheScreen();
  });

  it('Instagram abre el perfil', async () => {
    await renderApp(<ContactoScreen />);

    await userEvent.setup().press(screen.getByRole('button', { name: /^Instagram:/ }));

    expect(abrirEnlace).toHaveBeenCalledWith(expect.stringContaining('instagram.com'));
  });

  it('el pie ofrece ir a servicios y a agendar', async () => {
    await renderApp(<ContactoScreen />);
    const usuario = userEvent.setup();

    await usuario.press(screen.getByRole('button', { name: 'Ver todos los servicios' }));
    await usuario.press(screen.getByRole('button', { name: 'Agenda tu cita ahora' }));

    expect(router.push).toHaveBeenCalledWith('/servicios');
    expect(router.push).toHaveBeenCalledWith('/reserva/barbero');
  });
});

describe('layouts', () => {
  it('el layout raíz monta el interruptor de tema sobre todas las pantallas', async () => {
    await render(<RootLayout />);

    expect(await screen.findByRole('switch', { name: 'Cambiar a tema claro' })).toBeOnTheScreen();
  });

  it('el layout de reserva monta la barra con el cierre', async () => {
    await renderApp(<ReservaLayout />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Cerrar y volver al inicio' }));

    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['admin', AdminLayout],
    ['cita', CitaLayout],
    ['contacto', ContactoLayout],
    ['servicios', ServiciosLayout],
  ])('el layout de %s se monta sin errores', async (_nombre, Layout) => {
    await expect(renderApp(<Layout />)).resolves.toBeDefined();
  });
});

describe('orden de las categorías', () => {
  it('ordena en español: las tildes y las mayúsculas no descolocan nada', async () => {
    // Un sort() sin comparador ordena por código de carácter: dejaría
    // "Zeta" antes que "barba" y "Ácidos" al final de todo.
    const servicio = (id: string, category: string): Service => ({
      id,
      name: `Servicio ${id}`,
      description: '',
      priceCop: 1000,
      category,
      imageUrl: null,
    });
    services.getServices.mockResolvedValue([
      servicio('1', 'Zeta'),
      servicio('2', 'barba'),
      servicio('3', 'Ácidos'),
    ]);
    await renderApp(<ServiciosScreen />);
    await screen.findByText('Servicio 1');

    const nombres = screen
      .getAllByRole('radio')
      .map((opcion) => opcion.props.accessibilityLabel as string);

    expect(nombres).toEqual(['Todos', 'Ácidos', 'barba', 'Zeta']);
  });
});
