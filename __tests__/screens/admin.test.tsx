import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import AgendaScreen from '../../app/admin/index';
import LoginScreen from '../../app/admin/login';
import AdminServiciosScreen from '../../app/admin/servicios';
import { ApiError } from '../../src/api/client';
import * as authData from '../../src/data/auth';
import * as barbersData from '../../src/data/barbers';
import * as bookingsData from '../../src/data/bookings';
import * as servicesData from '../../src/data/services';
import type { Service } from '../../src/types/api';
import { toISODate } from '../../src/utils/date';
import { reiniciarDobles } from '../helpers/dobles';
import {
  ADMIN,
  BARBERO,
  CITA,
  OTRO_BARBERO,
  sembrarSesion,
  USUARIO_BARBERO,
} from '../helpers/estado';
import { renderApp } from '../helpers/render';
import { reiniciarRouter, router, usePathname } from '../helpers/router';

/**
 * El panel. Lo que más importa aquí es quién ve qué: la interfaz tiene que
 * coincidir con los permisos que el servidor ya impone.
 */
jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);
jest.mock('../../src/data/auth');
jest.mock('../../src/data/barbers');
jest.mock('../../src/data/bookings');
jest.mock('../../src/data/services');

const auth = jest.mocked(authData);
const barbers = jest.mocked(barbersData);
const bookings = jest.mocked(bookingsData);
const services = jest.mocked(servicesData);

const HOY = toISODate(new Date());

const FADE: Service = {
  id: 's1',
  name: 'Fade',
  description: 'Degradado a máquina.',
  priceCop: 30000,
  category: 'Cortes',
  imageUrl: null,
};

let alerta: jest.SpyInstance;

/** Pulsa el botón del último diálogo nativo cuyo texto coincida. */
async function pulsarEnAlerta(texto: string) {
  const botones = alerta.mock.calls.at(-1)?.[2] as AlertButton[];
  const boton = botones.find((candidato) => candidato.text === texto);
  await act(async () => {
    boton?.onPress?.();
  });
}

beforeEach(() => {
  reiniciarRouter();
  reiniciarDobles(auth, barbers, bookings, services);
  jest.restoreAllMocks();
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

  barbers.getBarbers.mockResolvedValue([BARBERO, OTRO_BARBERO]);
  bookings.getAgenda.mockResolvedValue([CITA]);
  services.getServices.mockResolvedValue([FADE]);
});

describe('inicio de sesión', () => {
  it('no deja enviar hasta que hay usuario y contraseña', async () => {
    await renderApp(<LoginScreen />);
    const boton = await screen.findByRole('button', { name: 'Ingresar' });
    expect(boton).toBeDisabled();

    await userEvent.setup().type(screen.getByLabelText('Usuario'), 'admin');

    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeDisabled();
  });

  it('con credenciales correctas entra al panel reemplazando la ruta', async () => {
    auth.login.mockResolvedValue({ token: 't', expiresIn: 28_800, user: ADMIN });
    await renderApp(<LoginScreen />);
    const usuario = userEvent.setup();

    await usuario.type(await screen.findByLabelText('Usuario'), '  admin  ');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-clave');
    await usuario.press(screen.getByRole('button', { name: 'Ingresar' }));

    // El usuario viaja sin espacios; la contraseña, intacta.
    expect(auth.login).toHaveBeenCalledWith('admin', 'una-clave');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
  });

  it('con credenciales malas muestra el mensaje de la API y vacía la contraseña', async () => {
    auth.login.mockRejectedValue(
      new ApiError('Usuario o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS'),
    );
    await renderApp(<LoginScreen />);
    const usuario = userEvent.setup();

    await usuario.type(await screen.findByLabelText('Usuario'), 'admin');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala');
    await usuario.press(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contraseña')).toHaveDisplayValue('');
    expect(router.replace).not.toHaveBeenCalledWith('/admin');
  });

  it('sin conexión lo dice con palabras de persona', async () => {
    auth.login.mockRejectedValue(new ApiError('Network request failed', 0, 'NETWORK_ERROR'));
    await renderApp(<LoginScreen />);
    const usuario = userEvent.setup();

    await usuario.type(await screen.findByLabelText('Usuario'), 'admin');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-clave');
    await usuario.press(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText(/No pudimos conectar/)).toBeOnTheScreen();
  });

  it('con una sesión ya abierta salta directo al panel', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<LoginScreen />);

    expect(await screen.findByText('redirige:/admin')).toBeOnTheScreen();
  });

  it('permite volver al inicio sin entrar', async () => {
    await renderApp(<LoginScreen />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Volver al inicio' }));

    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('agenda', () => {
  it('sin sesión manda al login', async () => {
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText('redirige:/admin/login')).toBeOnTheScreen();
  });

  it('el administrador ve las citas de hoy y el filtro de barberos', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText('Cliente Prueba')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Alexander Escobar' })).toBeOnTheScreen();
    expect(bookings.getAgenda).toHaveBeenCalledWith({ date: HOY, barberId: undefined });
  });

  it('muestra el nombre del barbero, no su id', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    await screen.findByText('Cliente Prueba');

    expect(screen.queryByText('luis-gomez')).not.toBeOnTheScreen();
  });

  it('filtrar por barbero vuelve a pedir la agenda con ese barbero', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    await userEvent
      .setup()
      .press(await screen.findByRole('radio', { name: 'Alexander Escobar' }));

    await waitFor(() =>
      expect(bookings.getAgenda).toHaveBeenLastCalledWith({
        date: HOY,
        barberId: 'alexander-escobar',
      }),
    );
  });

  it('el barbero NO tiene filtro y nunca manda un barberId', async () => {
    // El servidor ignora el filtro de un barbero y fuerza el suyo. La
    // interfaz no le ofrece un control que no controla nada.
    await sembrarSesion(USUARIO_BARBERO);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText('Agenda de luis')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Todos' })).not.toBeOnTheScreen();
    expect(bookings.getAgenda).toHaveBeenCalledWith({ date: HOY, barberId: undefined });
  });

  it('cuenta las citas en singular y en plural', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    expect(await screen.findByText('1 cita')).toBeOnTheScreen();
  });

  it('un día sin citas lo dice', async () => {
    bookings.getAgenda.mockResolvedValue([]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText('No hay citas para este día.')).toBeOnTheScreen();
    expect(screen.getByText('0 citas')).toBeOnTheScreen();
  });

  it('si la agenda falla ofrece reintentar', async () => {
    bookings.getAgenda.mockRejectedValue(new ApiError('x', 500, 'INTERNAL_ERROR'));
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });

  describe('cancelar', () => {
    const etiquetaCancelar = 'Cancelar la cita de Cliente Prueba a las 10:00 am';

    it('pide confirmación antes de tocar nada', async () => {
      await sembrarSesion(ADMIN);
      await renderApp(<AgendaScreen />);

      await userEvent.setup().press(await screen.findByRole('button', { name: etiquetaCancelar }));

      expect(alerta).toHaveBeenCalledWith('Cancelar la cita', expect.any(String), expect.any(Array));
      expect(bookings.cancelBooking).not.toHaveBeenCalled();
    });

    it('decir que no deja la cita como estaba', async () => {
      await sembrarSesion(ADMIN);
      await renderApp(<AgendaScreen />);
      await userEvent.setup().press(await screen.findByRole('button', { name: etiquetaCancelar }));

      await pulsarEnAlerta('No');

      expect(bookings.cancelBooking).not.toHaveBeenCalled();
    });

    it('confirmar cancela y vuelve a pedir la agenda', async () => {
      bookings.cancelBooking.mockResolvedValue(undefined);
      await sembrarSesion(ADMIN);
      await renderApp(<AgendaScreen />);
      await userEvent.setup().press(await screen.findByRole('button', { name: etiquetaCancelar }));
      const pedidasAntes = bookings.getAgenda.mock.calls.length;

      await pulsarEnAlerta('Sí, cancelar');

      expect(bookings.cancelBooking).toHaveBeenCalledWith(CITA.id);
      await waitFor(() =>
        expect(bookings.getAgenda.mock.calls.length).toBeGreaterThan(pedidasAntes),
      );
    });

    it('si el servidor lo rechaza, lo explica en otro diálogo', async () => {
      bookings.cancelBooking.mockRejectedValue(
        new ApiError('Solo puedes gestionar las citas de tu propia agenda.', 403, 'FORBIDDEN'),
      );
      await sembrarSesion(ADMIN);
      await renderApp(<AgendaScreen />);
      await userEvent.setup().press(await screen.findByRole('button', { name: etiquetaCancelar }));

      await pulsarEnAlerta('Sí, cancelar');

      await waitFor(() =>
        expect(alerta).toHaveBeenLastCalledWith(
          'No se pudo cancelar',
          'Solo puedes gestionar las citas de tu propia agenda.',
        ),
      );
    });
  });

  it('cerrar sesión vuelve al inicio y deja de mostrar el panel', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(router.replace).toHaveBeenCalledWith('/');
    expect(await screen.findByText('redirige:/admin/login')).toBeOnTheScreen();
  });
});

describe('gestión del catálogo', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/admin/servicios');
  });

  async function abrirComoAdmin() {
    await sembrarSesion(ADMIN);
    await renderApp(<AdminServiciosScreen />);
    await screen.findByText('Fade');
    return userEvent.setup();
  }

  it('sin sesión manda al login', async () => {
    await renderApp(<AdminServiciosScreen />);

    expect(await screen.findByText('redirige:/admin/login')).toBeOnTheScreen();
  });

  it('a un barbero lo devuelve a su agenda', async () => {
    // El servidor le respondería 403 a cualquier escritura; la interfaz ni
    // siquiera le enseña la pantalla.
    await sembrarSesion(USUARIO_BARBERO);
    await renderApp(<AdminServiciosScreen />);

    expect(await screen.findByText('redirige:/admin')).toBeOnTheScreen();
  });

  it('lista los servicios con categoría y precio', async () => {
    await abrirComoAdmin();

    expect(screen.getByText(/Cortes · \$30\.000/)).toBeOnTheScreen();
  });

  it('un catálogo vacío invita a crear el primero', async () => {
    services.getServices.mockResolvedValue([]);
    await sembrarSesion(ADMIN);
    await renderApp(<AdminServiciosScreen />);

    expect(await screen.findByText(/El catálogo está vacío/)).toBeOnTheScreen();
  });

  it('valida antes de enviar: un nombre corto no llega al servidor', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'ab');
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(screen.getByText('El nombre debe tener al menos 3 caracteres.')).toBeOnTheScreen();
    expect(services.createService).not.toHaveBeenCalled();
  });

  it('rechaza una imagen que no es una URL', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Afeitado');
    await usuario.type(screen.getByLabelText('Categoría'), 'Barba');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '32000');
    await usuario.type(screen.getByLabelText('Imagen (opcional)'), 'foto.png');
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(screen.getByText(/debe ser una URL/)).toBeOnTheScreen();
    expect(services.createService).not.toHaveBeenCalled();
  });

  it('crea un servicio con el precio como número y la imagen vacía como null', async () => {
    services.createService.mockResolvedValue({ ...FADE, id: 's2', name: 'Afeitado' });
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));

    await usuario.type(screen.getByLabelText('Nombre'), '  Afeitado  ');
    await usuario.type(screen.getByLabelText('Categoría'), 'Barba');
    // El campo descarta lo que no sea dígito.
    await usuario.type(screen.getByLabelText('Precio en pesos'), '32.000');
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() =>
      expect(services.createService).toHaveBeenCalledWith({
        name: 'Afeitado',
        description: '',
        priceCop: 32000,
        category: 'Barba',
        imageUrl: null,
      }),
    );
  });

  it('tras crear cierra el formulario y recarga el catálogo', async () => {
    services.createService.mockResolvedValue(FADE);
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Afeitado');
    await usuario.type(screen.getByLabelText('Categoría'), 'Barba');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '32000');

    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(services.getServices).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Nuevo servicio')).not.toBeOnTheScreen();
  });

  it('si el servidor rechaza el nombre repetido, muestra SU mensaje', async () => {
    services.createService.mockRejectedValue(
      new ApiError('Ya existe un servicio con ese nombre.', 409, 'SERVICE_NAME_TAKEN'),
    );
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Fade');
    await usuario.type(screen.getByLabelText('Categoría'), 'Cortes');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '30000');

    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(await screen.findByText('Ya existe un servicio con ese nombre.')).toBeOnTheScreen();
  });

  it('editar abre el formulario con los datos actuales y guarda por PUT', async () => {
    services.updateService.mockResolvedValue(FADE);
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Fade');
    expect(screen.getByLabelText('Precio en pesos')).toHaveDisplayValue('30000');

    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(services.updateService).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ name: 'Fade', priceCop: 30000 }),
      ),
    );
    expect(services.createService).not.toHaveBeenCalled();
  });

  it('cancelar el formulario lo cierra sin enviar nada', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));

    await usuario.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Nuevo servicio')).not.toBeOnTheScreen();
    expect(services.createService).not.toHaveBeenCalled();
  });

  it('eliminar pide confirmación y solo entonces borra', async () => {
    services.deleteService.mockResolvedValue(undefined);
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Eliminar Fade' }));
    expect(services.deleteService).not.toHaveBeenCalled();

    await pulsarEnAlerta('Sí, eliminar');

    expect(services.deleteService).toHaveBeenCalledWith('s1');
    await waitFor(() => expect(services.getServices).toHaveBeenCalledTimes(2));
  });

  it('si no se puede eliminar lo explica', async () => {
    services.deleteService.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Eliminar Fade' }));

    await pulsarEnAlerta('Sí, eliminar');

    await waitFor(() =>
      expect(alerta).toHaveBeenLastCalledWith('No se pudo eliminar', expect.stringMatching(/conectar/)),
    );
  });
});
