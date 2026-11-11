import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { setAuthToken, setUnauthorizedHandler } from '../api/client';
import * as authData from '../data/auth';
import type { AuthUser } from '../types/api';

/**
 * Clave del llavero.
 *
 * El token va en SecureStore y no en AsyncStorage: AsyncStorage guarda texto
 * plano en el sistema de archivos de la app, legible por cualquiera con
 * acceso al dispositivo. SecureStore se apoya en el Keystore de Android y en
 * el Keychain de iOS. Un token es una credencial: vale lo mismo que la
 * contraseña mientras no caduque.
 */
const STORAGE_KEY = 'zonabarber.session';

/**
 * Margen antes de dar por buena una sesión guardada.
 *
 * Un token al que le quedan diez segundos es, a efectos prácticos, un token
 * caducado: alcanza para entrar al panel y fallar en la primera petición.
 */
const MARGEN_MS = 60_000;

interface SesionGuardada {
  token: string;
  /** Instante de caducidad en milisegundos, calculado al iniciar sesión. */
  expiresAt: number;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** true mientras se lee la sesión guardada del llavero. */
  restoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** El llavero no existe en web: ahí la sesión simplemente no persiste. */
async function leerSesion(): Promise<SesionGuardada | null> {
  try {
    const crudo = await SecureStore.getItemAsync(STORAGE_KEY);
    return crudo === null ? null : (JSON.parse(crudo) as SesionGuardada);
  } catch {
    return null;
  }
}

async function guardarSesion(sesion: SesionGuardada): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(sesion));
  } catch {
    // Sin persistencia la sesión dura lo que la app abierta. Es peor
    // experiencia, no un fallo de seguridad.
  }
}

async function borrarSesion(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Nada que hacer: el token en memoria ya se limpió.
  }
}

/**
 * Sesión del panel.
 *
 * A diferencia del tema, aquí sí se espera a leer el almacenamiento antes de
 * decidir qué pintar. El tema mal resuelto es un parpadeo de color; la
 * sesión mal resuelta es enseñar el login y saltar al panel medio segundo
 * después, que se ve roto. Por eso existe `restoring`.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    void borrarSesion();
  }, []);

  useEffect(() => {
    let vigente = true;

    void leerSesion().then((sesion) => {
      if (!vigente) {
        return;
      }
      // La caducidad se comprueba en el reloj local antes de creerle a la
      // sesión: evita entrar al panel para que la primera petición falle.
      if (sesion !== null && sesion.expiresAt - MARGEN_MS > Date.now()) {
        setAuthToken(sesion.token);
        setUser(sesion.user);
      } else if (sesion !== null) {
        void borrarSesion();
      }
      setRestoring(false);
    });

    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Si el servidor rechaza el token, la sesión se cierra sola.
   *
   * Cubre lo que el reloj local no puede saber: un token revocado, o un
   * secreto de firma rotado en el servidor.
   */
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const respuesta = await authData.login(username, password);

    const sesion: SesionGuardada = {
      token: respuesta.token,
      expiresAt: Date.now() + respuesta.expiresIn * 1000,
      user: respuesta.user,
    };

    // El token se activa antes de guardarlo: la interfaz no tiene por qué
    // esperar al disco para poder hacer la primera petición.
    setAuthToken(sesion.token);
    setUser(sesion.user);
    void guardarSesion(sesion);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, restoring, login, logout }),
    [user, restoring, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
