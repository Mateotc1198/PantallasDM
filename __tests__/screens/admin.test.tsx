import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import AdminBarberosScreen from '../../app/admin/barberos';
import AgendaScreen from '../../app/admin/index';
import LoginScreen from '../../app/admin/login';
import AdminServiciosScreen from '../../app/admin/servicios';
import { ApiError } from '../../src/api/client';
import * as authData from '../../src/data/auth';
import * as barbersData from '../../src/data/barbers';
import * as bookingsData from '../../src/data/bookings';
import * as servicesData from '../../src/data/services';
import * as usersData from '../../src/data/users';
import * as photoPickerModule from '../../src/media/photoPicker';
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
jest.mock('../../src/data/users');
// Con fábrica y no automock: el módulo real importa código nativo de la
// galería, que no existe en los tests.
jest.mock('../../src/media/photoPicker', () => ({ elegirFotoDeGaleria: jest.fn() }));

const auth = jest.mocked(authData);
const barbers = jest.mocked(barbersData);
const bookings = jest.mocked(bookingsData);
const services = jest.mocked(servicesData);
const users = jest.mocked(usersData);
const photoPicker = jest.mocked(photoPickerModule);

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
  reiniciarDobles(auth, barbers, bookings, services, users, photoPicker);
  jest.restoreAllMocks();
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

  barbers.getBarbers.mockResolvedValue([BARBERO, OTRO_BARBERO]);
  bookings.getAgenda.mockResolvedValue([CITA]);
  services.getServices.mockResolvedValue([FADE]);
  // Solo luis-gomez tiene cuenta; alexander-escobar no.
  users.getUsers.mockResolvedValue([ADMIN, USUARIO_BARBERO]);
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

  it('resume el día: cuántas citas hay, en singular y en plural', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByLabelText('Cita: 1')).toBeOnTheScreen();
  });

  it('hoy cuenta lo cobrado: solo las citas atendidas', async () => {
    bookings.getAgenda.mockResolvedValue([
      { ...CITA, id: 'a', date: HOY, status: 'atendida' },
      { ...CITA, id: 'b', date: HOY, time: '11:00', status: 'no_asistio' },
      { ...CITA, id: 'c', date: HOY, time: '12:00' },
    ]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByLabelText('Citas: 3')).toBeOnTheScreen();
    // 30.000 de la atendida. Ni la que no vino ni la pendiente han pagado.
    expect(screen.getByLabelText(/Cobrado: .*30\.000/)).toBeOnTheScreen();
  });

  it('un día futuro estima lo que dejarían sus citas, sin contar las que no tienen servicio', async () => {
    bookings.getAgenda.mockResolvedValue([
      { ...CITA, id: 'a', service: { id: 's1', name: 'Fade', priceCop: 30000 } },
      { ...CITA, id: 'b', time: '11:00', service: { id: 's2', name: 'Barba', priceCop: 20000 } },
      { ...CITA, id: 'c', time: '12:00', service: null },
    ]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    // Por el resumen y no por el cliente: las tres citas son del mismo.
    await screen.findByLabelText('Citas: 3');

    await userEvent.setup().press(screen.getByRole('button', { name: 'Día siguiente' }));

    expect(await screen.findByLabelText(/Estimado: .*50\.000/)).toBeOnTheScreen();
  });

  it('cuenta como pendientes las citas que nadie ha cerrado todavía', async () => {
    bookings.getAgenda.mockResolvedValue([
      { ...CITA, id: 'a', status: 'atendida' },
      { ...CITA, id: 'b', time: '11:00' },
      { ...CITA, id: 'c', time: '12:00' },
    ]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByLabelText('Pendientes: 2')).toBeOnTheScreen();
  });

  it('cada cita dice qué servicio es', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText(/Fade · .*30\.000/)).toBeOnTheScreen();
  });

  it('las flechas pasan al día siguiente y al anterior', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    await screen.findByText('Cliente Prueba');
    const usuario = userEvent.setup();
    const manana = toISODate(new Date(Date.now() + 86_400_000));

    await usuario.press(screen.getByRole('button', { name: 'Día siguiente' }));
    await waitFor(() =>
      expect(bookings.getAgenda).toHaveBeenLastCalledWith({ date: manana, barberId: undefined }),
    );

    await usuario.press(screen.getByRole('button', { name: 'Día anterior' }));
    await waitFor(() =>
      expect(bookings.getAgenda).toHaveBeenLastCalledWith({ date: HOY, barberId: undefined }),
    );
  });

  it('abre en "Hoy" con el calendario recogido, y lo despliega al tocar la fecha', async () => {
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    await screen.findByText('Cliente Prueba');

    expect(screen.getByText('Hoy')).toBeOnTheScreen();
    expect(screen.queryByText('LUN')).not.toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: /Elegir otro día/ }));

    expect(screen.getByText('LUN')).toBeOnTheScreen();
  });

  it('al barbero no se le repite su nombre en cada cita, ni se le pide la lista de barberos', async () => {
    await sembrarSesion(USUARIO_BARBERO);
    await renderApp(<AgendaScreen />);
    await screen.findByText('Cliente Prueba');

    expect(screen.queryByText('Luis Gomez')).not.toBeOnTheScreen();
    expect(barbers.getBarbers).not.toHaveBeenCalled();
  });

  it('un día sin citas lo dice', async () => {
    bookings.getAgenda.mockResolvedValue([]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByText('No hay citas para este día.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Citas: 0')).toBeOnTheScreen();
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

    expect(screen.getByText('Cortes')).toBeOnTheScreen();
    expect(screen.getByText(/30\.000/)).toBeOnTheScreen();
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

  it.each([
    ['que no es una URL', 'foto.png'],
    ['por http sin cifrar', 'http://ejemplo.com/foto.png'],
  ])('rechaza una URL de imagen %s', async (_caso, url) => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Afeitado');
    await usuario.type(screen.getByLabelText('Categoría'), 'Barba');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '32000');
    await usuario.type(screen.getByLabelText('O pega la URL de una imagen'), url);
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    expect(screen.getByText('La URL de la imagen debe empezar por https://')).toBeOnTheScreen();
    expect(services.createService).not.toHaveBeenCalled();
  });

  it('crea un servicio con el precio como número y, sin imagen, sin mandar ninguna', async () => {
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

describe('gestión de barberos', () => {
  const FOTO = 'https://ejemplo.com/camila.png';

  beforeEach(() => {
    usePathname.mockReturnValue('/admin/barberos');
  });

  async function abrirComoAdmin() {
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);
    await screen.findByText('Luis Gomez');
    return userEvent.setup();
  }

  /** Abre el formulario de alta y lo rellena con una ficha válida. */
  async function rellenarNuevo(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));
    await usuario.type(screen.getByLabelText('Nombre'), '  Camila Ortiz  ');
    await usuario.type(screen.getByLabelText('Especialidad'), 'Colorimetría');
    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), FOTO);
  }

  it('sin sesión manda al login', async () => {
    await renderApp(<AdminBarberosScreen />);

    expect(await screen.findByText('redirige:/admin/login')).toBeOnTheScreen();
  });

  it('a un barbero lo devuelve a su agenda: no gestiona la plantilla', async () => {
    await sembrarSesion(USUARIO_BARBERO);
    await renderApp(<AdminBarberosScreen />);

    expect(await screen.findByText('redirige:/admin')).toBeOnTheScreen();
  });

  it('lista cada barbero con su especialidad', async () => {
    await abrirComoAdmin();

    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
    expect(screen.getByText('Especialista en fades')).toBeOnTheScreen();
    expect(screen.getByText('Alexander Escobar')).toBeOnTheScreen();
  });

  it('sin barberos activos invita a agregar el primero', async () => {
    barbers.getBarbers.mockResolvedValue([]);
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);

    expect(await screen.findByText(/No hay barberos activos/)).toBeOnTheScreen();
  });

  it('si la lista falla ofrece reintentar', async () => {
    barbers.getBarbers.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);

    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeOnTheScreen();
  });

  it('avisa de que el barbero nuevo nace con horario', async () => {
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    expect(screen.getByText(/todos los días de 9:00 a 21:00/)).toBeOnTheScreen();
  });

  it('valida antes de enviar: un nombre corto no llega al servidor', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'ab');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(screen.getByText('El nombre debe tener al menos 3 caracteres.')).toBeOnTheScreen();
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('exige una especialidad', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Camila Ortiz');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(screen.getByText(/La especialidad debe tener/)).toBeOnTheScreen();
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('rechaza una URL por http: en la app publicada no se vería', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Camila Ortiz');
    await usuario.type(screen.getByLabelText('Especialidad'), 'Colorimetría');
    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), 'http://ejemplo.com/camila.png');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(screen.getByText('La URL de la foto debe empezar por https://')).toBeOnTheScreen();
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('un barbero nuevo necesita foto, de la galería o por URL', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Camila Ortiz');
    await usuario.type(screen.getByLabelText('Especialidad'), 'Colorimetría');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(screen.getByText('Elige una foto de la galería o pega su URL.')).toBeOnTheScreen();
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('la vista previa sale con una dirección bien formada, no a medio teclear', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    expect(screen.getByLabelText('Sin foto todavía')).toBeOnTheScreen();

    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), 'https');
    expect(screen.getByLabelText('Sin foto todavía')).toBeOnTheScreen();

    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), '://ejemplo.com/camila.png');
    expect(screen.queryByLabelText('Sin foto todavía')).not.toBeOnTheScreen();
  });

  it('crea el barbero con los textos recortados y sin mandar un id', async () => {
    barbers.createBarber.mockResolvedValue({ ...BARBERO, id: 'camila-ortiz' });
    const usuario = await abrirComoAdmin();
    await rellenarNuevo(usuario);

    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    await waitFor(() =>
      expect(barbers.createBarber).toHaveBeenCalledWith({
        name: 'Camila Ortiz',
        specialty: 'Colorimetría',
        avatar: FOTO,
      }),
    );
  });

  it('tras crear cierra el formulario y recarga la lista', async () => {
    barbers.createBarber.mockResolvedValue({ ...BARBERO, id: 'camila-ortiz' });
    const usuario = await abrirComoAdmin();
    await rellenarNuevo(usuario);

    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    await waitFor(() => expect(barbers.getBarbers).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Nuevo barbero')).not.toBeOnTheScreen();
  });

  it('si el servidor rechaza el nombre repetido, muestra SU mensaje y no cierra', async () => {
    barbers.createBarber.mockRejectedValue(
      new ApiError('Ya existe un barbero con ese nombre.', 409, 'BARBER_NAME_TAKEN'),
    );
    const usuario = await abrirComoAdmin();
    await rellenarNuevo(usuario);

    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(await screen.findByText('Ya existe un barbero con ese nombre.')).toBeOnTheScreen();
    expect(screen.getByText('Nuevo barbero')).toBeOnTheScreen();
  });

  it('sin conexión al guardar lo dice con palabras de persona', async () => {
    barbers.createBarber.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    const usuario = await abrirComoAdmin();
    await rellenarNuevo(usuario);

    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    expect(await screen.findByText(/No pudimos conectar/)).toBeOnTheScreen();
  });

  it('editar abre la ficha actual y, sin tocar la foto, no la reenvía', async () => {
    barbers.updateBarber.mockResolvedValue(BARBERO);
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));
    expect(screen.getByText('Editar barbero')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Luis Gomez');
    // El campo de URL es para una nueva: empieza vacío.
    expect(screen.getByLabelText('O pega la URL de una foto')).toHaveDisplayValue('');
    expect(screen.getByText(/se conserva la foto actual/)).toBeOnTheScreen();

    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Sin avatar ni photo: el servidor conserva la que tiene.
    await waitFor(() =>
      expect(barbers.updateBarber).toHaveBeenCalledWith('luis-gomez', {
        name: 'Luis Gomez',
        specialty: 'Especialista en fades',
      }),
    );
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('al editar no promete un horario nuevo: el barbero ya tiene el suyo', async () => {
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));

    expect(screen.queryByText(/todos los días de 9:00 a 21:00/)).not.toBeOnTheScreen();
  });

  it('cambiar la foto manda la URL nueva', async () => {
    barbers.updateBarber.mockResolvedValue(BARBERO);
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));

    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), FOTO);
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(barbers.updateBarber).toHaveBeenCalledWith(
        'luis-gomez',
        expect.objectContaining({ avatar: FOTO }),
      ),
    );
  });

  it('cancelar el formulario lo cierra sin enviar nada', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));

    await usuario.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Editar barbero')).not.toBeOnTheScreen();
    expect(barbers.updateBarber).not.toHaveBeenCalled();
  });

  it('abrir "nuevo" después de editar empieza con el formulario en blanco', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));
    await usuario.press(screen.getByRole('button', { name: 'Cancelar' }));

    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('');
  });

  describe('dar de baja', () => {
    it('pide confirmación y explica qué pasa con las citas', async () => {
      const usuario = await abrirComoAdmin();

      await usuario.press(screen.getByRole('button', { name: 'Dar de baja a Luis Gomez' }));

      expect(alerta).toHaveBeenCalledWith(
        'Dar de baja',
        expect.stringMatching(/Luis Gomez.*citas pasadas se conservan/),
        expect.any(Array),
      );
      expect(barbers.deleteBarber).not.toHaveBeenCalled();
    });

    it('decir que no deja al barbero como estaba', async () => {
      const usuario = await abrirComoAdmin();
      await usuario.press(screen.getByRole('button', { name: 'Dar de baja a Luis Gomez' }));

      await pulsarEnAlerta('No');

      expect(barbers.deleteBarber).not.toHaveBeenCalled();
    });

    it('confirmar da de baja y recarga la lista', async () => {
      barbers.deleteBarber.mockResolvedValue(undefined);
      const usuario = await abrirComoAdmin();
      await usuario.press(screen.getByRole('button', { name: 'Dar de baja a Luis Gomez' }));

      await pulsarEnAlerta('Sí, dar de baja');

      expect(barbers.deleteBarber).toHaveBeenCalledWith('luis-gomez');
      await waitFor(() => expect(barbers.getBarbers).toHaveBeenCalledTimes(2));
    });

    it('si tiene citas pendientes enseña el motivo que da el servidor', async () => {
      const motivo = 'El barbero tiene citas activas pendientes. Cancélalas antes de darlo de baja.';
      barbers.deleteBarber.mockRejectedValue(new ApiError(motivo, 409, 'BARBER_HAS_BOOKINGS'));
      const usuario = await abrirComoAdmin();
      await usuario.press(screen.getByRole('button', { name: 'Dar de baja a Luis Gomez' }));

      await pulsarEnAlerta('Sí, dar de baja');

      await waitFor(() =>
        expect(alerta).toHaveBeenLastCalledWith('No se pudo dar de baja', motivo),
      );
      // No se recargó: no cambió nada.
      expect(barbers.getBarbers).toHaveBeenCalledTimes(1);
    });
  });
});

describe('acceso de los barberos al panel', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/admin/barberos');
  });

  async function abrirComoAdmin() {
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);
    await screen.findByText('Luis Gomez');
    return userEvent.setup();
  }

  it('cada barbero dice si puede entrar al panel y con qué usuario', async () => {
    await abrirComoAdmin();

    expect(await screen.findByText('Entra como luis')).toBeOnTheScreen();
    expect(screen.getByText('Sin acceso al panel')).toBeOnTheScreen();
  });

  it('a quien no tiene cuenta se le ofrece dársela', async () => {
    const usuario = await abrirComoAdmin();

    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    expect(screen.getByText('Acceso de Alexander Escobar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dar acceso' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Quitar acceso' })).not.toBeOnTheScreen();
  });

  it('valida antes de enviar: una contraseña corta no llega al servidor', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    await usuario.type(screen.getByLabelText('Usuario'), 'alex');
    await usuario.type(screen.getByLabelText('Contraseña'), '1234567');
    await usuario.press(screen.getByRole('button', { name: 'Dar acceso' }));

    expect(screen.getByText(/al menos 8 caracteres/)).toBeOnTheScreen();
    expect(users.setBarberAccount).not.toHaveBeenCalled();
  });

  it('rechaza un usuario con espacios o símbolos', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    await usuario.type(screen.getByLabelText('Usuario'), 'alex escobar');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-segura-2026');
    await usuario.press(screen.getByRole('button', { name: 'Dar acceso' }));

    expect(screen.getByText(/de 3 a 30 letras/)).toBeOnTheScreen();
    expect(users.setBarberAccount).not.toHaveBeenCalled();
  });

  it('crea la cuenta con el usuario en minúsculas y recarga las cuentas', async () => {
    users.setBarberAccount.mockResolvedValue({
      id: 'u3',
      username: 'alex',
      role: 'barbero',
      barberId: 'alexander-escobar',
    });
    const usuario = await abrirComoAdmin();
    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    await usuario.type(screen.getByLabelText('Usuario'), '  Alex  ');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-segura-2026');
    await usuario.press(screen.getByRole('button', { name: 'Dar acceso' }));

    await waitFor(() =>
      expect(users.setBarberAccount).toHaveBeenCalledWith('alexander-escobar', {
        username: 'alex',
        password: 'clave-segura-2026',
      }),
    );
    await waitFor(() => expect(users.getUsers).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Acceso de Alexander Escobar')).not.toBeOnTheScreen();
  });

  it('la contraseña se escribe oculta', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    expect(screen.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
  });

  it('si el usuario ya está en uso muestra el motivo del servidor y no cierra', async () => {
    users.setBarberAccount.mockRejectedValue(
      new ApiError('Ese nombre de usuario ya está en uso.', 409, 'USERNAME_TAKEN'),
    );
    const usuario = await abrirComoAdmin();
    await usuario.press(
      screen.getByRole('button', { name: 'Gestionar el acceso de Alexander Escobar' }),
    );

    await usuario.type(screen.getByLabelText('Usuario'), 'admin');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-segura-2026');
    await usuario.press(screen.getByRole('button', { name: 'Dar acceso' }));

    expect(await screen.findByText('Ese nombre de usuario ya está en uso.')).toBeOnTheScreen();
    expect(screen.getByText('Acceso de Alexander Escobar')).toBeOnTheScreen();
  });

  it('a quien ya tiene cuenta le enseña su usuario, nunca su contraseña', async () => {
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Gestionar el acceso de Luis Gomez' }));

    expect(screen.getByLabelText('Usuario')).toHaveDisplayValue('luis');
    expect(screen.getByLabelText('Contraseña')).toHaveDisplayValue('');
    expect(screen.getByRole('button', { name: 'Guardar acceso' })).toBeOnTheScreen();
  });

  it('quitar el acceso pide confirmación y solo entonces lo quita', async () => {
    users.removeBarberAccount.mockResolvedValue(undefined);
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Gestionar el acceso de Luis Gomez' }));

    await usuario.press(screen.getByRole('button', { name: 'Quitar acceso' }));
    expect(users.removeBarberAccount).not.toHaveBeenCalled();

    await pulsarEnAlerta('Sí, quitar');

    expect(users.removeBarberAccount).toHaveBeenCalledWith('luis-gomez');
    await waitFor(() => expect(users.getUsers).toHaveBeenCalledTimes(2));
  });

  it('"Cerrar" recoge el formulario sin enviar nada', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Gestionar el acceso de Luis Gomez' }));

    await usuario.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByText('Acceso de Luis Gomez')).not.toBeOnTheScreen();
    expect(users.setBarberAccount).not.toHaveBeenCalled();
  });

  it('a un barbero no se le piden las cuentas: el servidor le diría 403', async () => {
    await sembrarSesion(USUARIO_BARBERO);
    await renderApp(<AdminBarberosScreen />);
    await screen.findByText('redirige:/admin');

    expect(users.getUsers).not.toHaveBeenCalled();
  });
});

describe('foto del barbero desde la galería', () => {
  const ELEGIDA = { uri: 'file:///camila.jpg', base64: 'BASE64-DE-LA-FOTO' };

  beforeEach(() => {
    usePathname.mockReturnValue('/admin/barberos');
  });

  async function abrirNuevo() {
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);
    await screen.findByText('Luis Gomez');
    const usuario = userEvent.setup();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Camila Ortiz');
    await usuario.type(screen.getByLabelText('Especialidad'), 'Colorimetría');
    return usuario;
  }

  it('crea el barbero con la foto de la galería y sin URL', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    barbers.createBarber.mockResolvedValue({ ...BARBERO, id: 'camila-ortiz' });
    const usuario = await abrirNuevo();

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    expect(await screen.findByText('Foto nueva lista. Se sube al guardar.')).toBeOnTheScreen();
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    await waitFor(() =>
      expect(barbers.createBarber).toHaveBeenCalledWith({
        name: 'Camila Ortiz',
        specialty: 'Colorimetría',
        photo: 'BASE64-DE-LA-FOTO',
      }),
    );
  });

  it('cerrar la galería sin elegir deja el formulario como estaba', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(null);
    const usuario = await abrirNuevo();

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));

    await waitFor(() => expect(photoPicker.elegirFotoDeGaleria).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Sin foto todavía')).toBeOnTheScreen();
    expect(screen.queryByText(/Foto nueva lista/)).not.toBeOnTheScreen();
  });

  it('si la foto no se puede usar lo explica, y ofrece la URL', async () => {
    photoPicker.elegirFotoDeGaleria.mockRejectedValue(new Error('formato raro'));
    const usuario = await abrirNuevo();

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith(
        'No se pudo usar esa foto',
        expect.stringMatching(/pega la URL/),
      ),
    );
  });

  it('elegir de la galería después de escribir una URL la reemplaza', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    barbers.createBarber.mockResolvedValue({ ...BARBERO, id: 'camila-ortiz' });
    const usuario = await abrirNuevo();
    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), 'https://ejemplo.com/a.png');

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);

    expect(screen.getByLabelText('O pega la URL de una foto')).toHaveDisplayValue('');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));
    await waitFor(() =>
      expect(barbers.createBarber).toHaveBeenCalledWith(
        expect.not.objectContaining({ avatar: expect.anything() }),
      ),
    );
  });

  it('escribir una URL después de elegir de la galería descarta la foto elegida', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    barbers.createBarber.mockResolvedValue({ ...BARBERO, id: 'camila-ortiz' });
    const usuario = await abrirNuevo();
    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);

    await usuario.type(screen.getByLabelText('O pega la URL de una foto'), 'https://ejemplo.com/a.png');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    await waitFor(() =>
      expect(barbers.createBarber).toHaveBeenCalledWith({
        name: 'Camila Ortiz',
        specialty: 'Colorimetría',
        avatar: 'https://ejemplo.com/a.png',
      }),
    );
  });

  it('al editar, una foto nueva de la galería viaja como photo', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    barbers.updateBarber.mockResolvedValue(BARBERO);
    await sembrarSesion(ADMIN);
    await renderApp(<AdminBarberosScreen />);
    await screen.findByText('Luis Gomez');
    const usuario = userEvent.setup();
    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(barbers.updateBarber).toHaveBeenCalledWith('luis-gomez', {
        name: 'Luis Gomez',
        specialty: 'Especialista en fades',
        photo: 'BASE64-DE-LA-FOTO',
      }),
    );
  });
});

describe('marcar cómo terminó una cita', () => {
  const AYER = toISODate(new Date(Date.now() - 86_400_000));
  /** Una cita de ayer: ya empezó, así que se puede marcar. */
  const CITA_DE_AYER = { ...CITA, date: AYER, time: '10:00' };

  async function abrirAyer() {
    bookings.getAgenda.mockResolvedValue([CITA_DE_AYER]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);
    await screen.findByText('Cliente Prueba');
    const usuario = userEvent.setup();
    await usuario.press(screen.getByRole('button', { name: 'Día anterior' }));
    await screen.findByText('Ayer');
    return usuario;
  }

  it('una cita que ya empezó y nadie marcó lo avisa', async () => {
    await abrirAyer();

    expect(await screen.findByText('Sin marcar')).toBeOnTheScreen();
  });

  it('marcar atendida la envía al servidor y recarga la agenda, sin pedir confirmación', async () => {
    bookings.setBookingStatus.mockResolvedValue({ ...CITA_DE_AYER, status: 'atendida' });
    const usuario = await abrirAyer();
    const pedidas = bookings.getAgenda.mock.calls.length;

    await usuario.press(
      await screen.findByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' }),
    );

    expect(bookings.setBookingStatus).toHaveBeenCalledWith(CITA.id, 'atendida');
    expect(alerta).not.toHaveBeenCalled();
    await waitFor(() => expect(bookings.getAgenda.mock.calls.length).toBe(pedidas + 1));
  });

  it('marcar que no vino envía no_asistio', async () => {
    bookings.setBookingStatus.mockResolvedValue({ ...CITA_DE_AYER, status: 'no_asistio' });
    const usuario = await abrirAyer();

    await usuario.press(
      await screen.findByRole('button', { name: 'Marcar que Cliente Prueba no vino' }),
    );

    expect(bookings.setBookingStatus).toHaveBeenCalledWith(CITA.id, 'no_asistio');
  });

  it('si el servidor lo rechaza, muestra su motivo', async () => {
    bookings.setBookingStatus.mockRejectedValue(
      new ApiError('Todavía no es la hora de esta cita.', 422, 'BOOKING_NOT_STARTED'),
    );
    const usuario = await abrirAyer();

    await usuario.press(
      await screen.findByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' }),
    );

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith('No se pudo marcar', 'Todavía no es la hora de esta cita.'),
    );
  });

  it('sin conexión lo dice con palabras de persona', async () => {
    bookings.setBookingStatus.mockRejectedValue(new ApiError('x', 0, 'NETWORK_ERROR'));
    const usuario = await abrirAyer();

    await usuario.press(
      await screen.findByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' }),
    );

    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith('No se pudo marcar', expect.stringMatching(/conectar/)),
    );
  });

  it('una cita de hoy que todavía no empieza ofrece cancelar, no marcar', async () => {
    bookings.getAgenda.mockResolvedValue([{ ...CITA, date: HOY, time: '23:59' }]);
    await sembrarSesion(ADMIN);
    await renderApp(<AgendaScreen />);

    expect(await screen.findByRole('button', { name: /Cancelar la cita/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Marcar/ })).not.toBeOnTheScreen();
  });
});

describe('imagen del servicio desde la galería', () => {
  const ELEGIDA = { uri: 'file:///afeitado.jpg', base64: 'BASE64-DEL-SERVICIO' };
  const CON_IMAGEN: Service = { ...FADE, imageUrl: 'https://ejemplo.com/fade.jpg' };

  beforeEach(() => {
    usePathname.mockReturnValue('/admin/servicios');
  });

  async function abrir(catalogo: Service[] = [FADE]) {
    services.getServices.mockResolvedValue(catalogo);
    await sembrarSesion(ADMIN);
    await renderApp(<AdminServiciosScreen />);
    await screen.findByText('Fade');
    return userEvent.setup();
  }

  async function rellenarNuevo(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.press(screen.getByRole('button', { name: 'Agregar un servicio' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Afeitado');
    await usuario.type(screen.getByLabelText('Categoría'), 'Barba');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '32000');
  }

  it('la lista enseña la miniatura de los servicios que tienen imagen', async () => {
    await abrir([CON_IMAGEN]);

    expect(screen.getByLabelText('Imagen de Fade')).toBeOnTheScreen();
  });

  it('sin imagen no pinta miniatura', async () => {
    await abrir();

    expect(screen.queryByLabelText('Imagen de Fade')).not.toBeOnTheScreen();
  });

  it('crea el servicio con la imagen de la galería', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    services.createService.mockResolvedValue({ ...FADE, id: 's2' });
    const usuario = await abrir();
    await rellenarNuevo(usuario);

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() =>
      expect(services.createService).toHaveBeenCalledWith({
        name: 'Afeitado',
        description: '',
        priceCop: 32000,
        category: 'Barba',
        photo: 'BASE64-DEL-SERVICIO',
      }),
    );
  });

  it('al crear, "Quitar imagen" descarta la elegida y no manda nada', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    services.createService.mockResolvedValue({ ...FADE, id: 's2' });
    const usuario = await abrir();
    await rellenarNuevo(usuario);
    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);

    await usuario.press(screen.getByRole('button', { name: 'Quitar la imagen' }));
    expect(screen.getByLabelText('Sin foto todavía')).toBeOnTheScreen();
    await usuario.press(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(services.createService).toHaveBeenCalledTimes(1));
    expect(services.createService.mock.calls[0][0]).not.toHaveProperty('photo');
    expect(services.createService.mock.calls[0][0]).not.toHaveProperty('imageUrl');
  });

  it('editar sin tocar la imagen no la reenvía: el servidor conserva la suya', async () => {
    services.updateService.mockResolvedValue(CON_IMAGEN);
    const usuario = await abrir([CON_IMAGEN]);

    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));
    expect(screen.getByText(/se conserva la foto actual/)).toBeOnTheScreen();
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(services.updateService).toHaveBeenCalledTimes(1));
    expect(services.updateService.mock.calls[0][1]).not.toHaveProperty('imageUrl');
    expect(services.updateService.mock.calls[0][1]).not.toHaveProperty('photo');
  });

  it('editar y quitar la imagen manda imageUrl en null', async () => {
    services.updateService.mockResolvedValue(FADE);
    const usuario = await abrir([CON_IMAGEN]);
    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));

    await usuario.press(screen.getByRole('button', { name: 'Quitar la imagen' }));
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(services.updateService).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ imageUrl: null }),
      ),
    );
  });

  it('sin imagen actual no ofrece quitarla', async () => {
    const usuario = await abrir();

    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));

    expect(screen.queryByRole('button', { name: 'Quitar la imagen' })).not.toBeOnTheScreen();
  });

  it('escribir una URL después de quitar la imagen la usa como nueva', async () => {
    services.updateService.mockResolvedValue(FADE);
    const usuario = await abrir([CON_IMAGEN]);
    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));
    await usuario.press(screen.getByRole('button', { name: 'Quitar la imagen' }));

    await usuario.type(
      screen.getByLabelText('O pega la URL de una imagen'),
      'https://ejemplo.com/nueva.jpg',
    );
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(services.updateService).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ imageUrl: 'https://ejemplo.com/nueva.jpg' }),
      ),
    );
  });

  it('al editar, una imagen nueva de la galería viaja como photo', async () => {
    photoPicker.elegirFotoDeGaleria.mockResolvedValue(ELEGIDA);
    services.updateService.mockResolvedValue(CON_IMAGEN);
    const usuario = await abrir([CON_IMAGEN]);
    await usuario.press(screen.getByRole('button', { name: 'Editar Fade' }));

    await usuario.press(screen.getByRole('button', { name: 'Elegir foto de la galería' }));
    await screen.findByText(/Foto nueva lista/);
    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(services.updateService).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ photo: 'BASE64-DEL-SERVICIO' }),
      ),
    );
  });
});
