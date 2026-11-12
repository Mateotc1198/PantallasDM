import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import * as client from '../../src/api/client';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import * as authData from '../../src/data/auth';
import type { AuthUser, LoginResponse } from '../../src/types/api';

/**
 * La sesión es lo único del frontend donde un error tiene consecuencias de
 * seguridad, así que se prueba con detalle: qué se guarda, cuándo se cree a
 * una sesión guardada y cuándo se descarta.
 *
 * El llavero es el doble en memoria de setup.ts; el login se sustituye
 * porque aquí no se está probando la API.
 */
jest.mock('../../src/data/auth');
jest.mock('../../src/api/client', () => ({
  ...jest.requireActual('../../src/api/client'),
  setAuthToken: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
}));

const CLAVE = 'zonabarber.session';
const AHORA = new Date(2026, 10, 10, 12, 0, 0).getTime();

const admin: AuthUser = { id: 'u1', username: 'admin', role: 'admin', barberId: null };
const respuestaLogin: LoginResponse = { token: 'token-de-prueba', expiresIn: 28_800, user: admin };

const loginMock = jest.mocked(authData.login);
const setAuthToken = jest.mocked(client.setAuthToken);
const setUnauthorizedHandler = jest.mocked(client.setUnauthorizedHandler);
const llavero = SecureStore as typeof SecureStore & { __reset: () => void };

async function montar() {
  const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.restoring).toBe(false));
  return result;
}

beforeEach(() => {
  llavero.__reset();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(AHORA);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('arranque', () => {
  it('sin sesión guardada termina sin usuario', async () => {
    const sesion = await montar();

    expect(sesion.current.user).toBeNull();
    expect(setAuthToken).not.toHaveBeenCalled();
  });

  it('restaura una sesión guardada que sigue vigente', async () => {
    await SecureStore.setItemAsync(
      CLAVE,
      JSON.stringify({ token: 'guardado', expiresAt: AHORA + 3_600_000, user: admin }),
    );

    const sesion = await montar();

    expect(sesion.current.user).toEqual(admin);
    expect(setAuthToken).toHaveBeenCalledWith('guardado');
  });

  it('descarta una sesión caducada y la borra del llavero', async () => {
    await SecureStore.setItemAsync(
      CLAVE,
      JSON.stringify({ token: 'viejo', expiresAt: AHORA - 1, user: admin }),
    );

    const sesion = await montar();

    expect(sesion.current.user).toBeNull();
    expect(setAuthToken).not.toHaveBeenCalled();
    await expect(SecureStore.getItemAsync(CLAVE)).resolves.toBeNull();
  });

  it('descarta una sesión a la que le quedan segundos', async () => {
    // Un token que caduca en treinta segundos alcanza para entrar al panel
    // y fallar en la primera petición: a efectos prácticos ya caducó.
    await SecureStore.setItemAsync(
      CLAVE,
      JSON.stringify({ token: 'casi', expiresAt: AHORA + 30_000, user: admin }),
    );

    const sesion = await montar();

    expect(sesion.current.user).toBeNull();
  });

  it('un valor corrupto en el llavero no rompe el arranque', async () => {
    await SecureStore.setItemAsync(CLAVE, '{esto no es json');

    const sesion = await montar();

    expect(sesion.current.user).toBeNull();
  });

  it('si el llavero falla al leer, arranca sin sesión', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('sin llavero'));

    const sesion = await montar();

    expect(sesion.current.user).toBeNull();
  });
});

describe('inicio de sesión', () => {
  it('deja al usuario dentro y activa su token', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    const sesion = await montar();

    await act(async () => {
      await sesion.current.login('admin', 'una-clave');
    });

    expect(loginMock).toHaveBeenCalledWith('admin', 'una-clave');
    expect(sesion.current.user).toEqual(admin);
    expect(setAuthToken).toHaveBeenCalledWith('token-de-prueba');
  });

  it('guarda la sesión con el instante de caducidad calculado', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    const sesion = await montar();

    await act(async () => {
      await sesion.current.login('admin', 'una-clave');
    });

    const guardado = JSON.parse((await SecureStore.getItemAsync(CLAVE)) as string);
    expect(guardado).toEqual({
      token: 'token-de-prueba',
      expiresAt: AHORA + 28_800 * 1000,
      user: admin,
    });
  });

  it('nunca guarda la contraseña', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    const sesion = await montar();

    await act(async () => {
      await sesion.current.login('admin', 'una-clave-secreta');
    });

    expect(await SecureStore.getItemAsync(CLAVE)).not.toContain('una-clave-secreta');
  });

  it('si la API rechaza las credenciales, no queda nadie dentro', async () => {
    loginMock.mockRejectedValue(new client.ApiError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS'));
    const sesion = await montar();

    await act(async () => {
      await sesion.current.login('admin', 'mala').catch(() => undefined);
    });

    expect(sesion.current.user).toBeNull();
    expect(setAuthToken).not.toHaveBeenCalled();
    await expect(SecureStore.getItemAsync(CLAVE)).resolves.toBeNull();
  });

  it('propaga el error para que la pantalla pueda mostrarlo', async () => {
    const rechazo = new client.ApiError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    loginMock.mockRejectedValue(rechazo);
    const sesion = await montar();

    await expect(sesion.current.login('admin', 'mala')).rejects.toBe(rechazo);
  });

  it('si el llavero falla al guardar, la sesión sigue activa en memoria', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('sin espacio'));
    const sesion = await montar();

    await act(async () => {
      await sesion.current.login('admin', 'una-clave');
    });

    expect(sesion.current.user).toEqual(admin);
  });
});

describe('cierre de sesión', () => {
  it('saca al usuario, retira el token y borra el llavero', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    const sesion = await montar();
    await act(async () => {
      await sesion.current.login('admin', 'una-clave');
    });

    await act(async () => {
      sesion.current.logout();
    });

    expect(sesion.current.user).toBeNull();
    expect(setAuthToken).toHaveBeenLastCalledWith(null);
    await waitFor(async () => expect(await SecureStore.getItemAsync(CLAVE)).toBeNull());
  });

  it('cuando el servidor rechaza el token, la sesión se cierra sola', async () => {
    loginMock.mockResolvedValue(respuestaLogin);
    const sesion = await montar();
    await act(async () => {
      await sesion.current.login('admin', 'una-clave');
    });

    // El cliente HTTP llama a este manejador ante un 401 con token.
    const alPerderLaSesion = setUnauthorizedHandler.mock.calls.at(-1)?.[0];
    await act(async () => {
      alPerderLaSesion?.();
    });

    expect(sesion.current.user).toBeNull();
  });

  it('al desmontarse retira el manejador para no cerrar sesiones ajenas', async () => {
    const { unmount } = await renderHook(() => useAuth(), { wrapper: AuthProvider });

    await unmount();

    expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
  });
});

describe('uso fuera del proveedor', () => {
  it('falla con un mensaje que dice qué falta', async () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useAuth())).rejects.toThrow(/AuthProvider/);

    silencio.mockRestore();
  });
});
