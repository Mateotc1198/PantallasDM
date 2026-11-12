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
    await usuario.type(screen.getByLabelText('Foto'), FOTO);
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

  it('rechaza una foto por http: en la app publicada no se vería', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Nombre'), 'Camila Ortiz');
    await usuario.type(screen.getByLabelText('Especialidad'), 'Colorimetría');
    await usuario.type(screen.getByLabelText('Foto'), 'http://ejemplo.com/camila.png');
    await usuario.press(screen.getByRole('button', { name: 'Crear barbero' }));

    // El texto exacto: la ayuda del campo también menciona https.
    expect(
      screen.getByText('La foto debe ser una URL que empiece por https://'),
    ).toBeOnTheScreen();
    expect(barbers.createBarber).not.toHaveBeenCalled();
  });

  it('la vista previa de la foto aparece solo con una dirección bien formada', async () => {
    const usuario = await abrirComoAdmin();
    await usuario.press(screen.getByRole('button', { name: 'Agregar un barbero' }));

    await usuario.type(screen.getByLabelText('Foto'), 'https');
    expect(screen.queryByText('Así se verá la foto.')).not.toBeOnTheScreen();

    await usuario.type(screen.getByLabelText('Foto'), '://ejemplo.com/camila.png');
    expect(screen.getByText('Así se verá la foto.')).toBeOnTheScreen();
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

  it('editar abre el formulario con la ficha actual y guarda por PUT', async () => {
    barbers.updateBarber.mockResolvedValue(BARBERO);
    const usuario = await abrirComoAdmin();

    await usuario.press(screen.getByRole('button', { name: 'Editar Luis Gomez' }));
    expect(screen.getByText('Editar barbero')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Luis Gomez');
    expect(screen.getByLabelText('Foto')).toHaveDisplayValue('https://ejemplo.com/luis.png');

    await usuario.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(barbers.updateBarber).toHaveBeenCalledWith('luis-gomez', {
        name: 'Luis Gomez',
        specialty: 'Especialista en fades',
        avatar: 'https://ejemplo.com/luis.png',
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

    await usuario.clear(screen.getByLabelText('Foto'));
    await usuario.type(screen.getByLabelText('Foto'), FOTO);
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
