import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { Appearance } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { palettes, type Palette, type ThemeName } from './tokens';

const STORAGE_KEY = 'zonabarber:theme';
const DEFAULT_THEME: ThemeName = 'dark';

interface ThemeContextValue {
  name: ThemeName;
  colors: Palette;
  toggle: () => void;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function esTemaValido(valor: string | null): valor is ThemeName {
  return valor === 'dark' || valor === 'light';
}

/**
 * Tema de la aplicación.
 *
 * Arranca SIEMPRE en oscuro y, si había una preferencia guardada, cambia a
 * ella en cuanto se lee. No se bloquea el primer render esperando a disco:
 * un gate de carga aquí metería una pantalla en blanco en cada arranque
 * para resolver algo que, en el peor caso, es un parpadeo de un frame.
 *
 * Esa decisión es distinta a la de la sesión, donde sí hay que esperar:
 * mostrar el login y saltar al panel medio segundo después se ve roto, y
 * además son dos pantallas distintas, no dos colores.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [name, setName] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    let vigente = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((guardado) => {
        if (vigente && esTemaValido(guardado)) {
          setName(guardado);
        }
      })
      .catch(() => {
        // Si el almacenamiento falla, el tema por defecto es una respuesta
        // perfectamente válida: no es motivo para romper el arranque.
      });

    return () => {
      vigente = false;
    };
  }, []);

  const setTheme = useCallback((siguiente: ThemeName) => {
    setName(siguiente);
    // No se espera a que termine de guardar: la interfaz ya cambió, y que
    // la preferencia no sobreviva al cierre es menos grave que un botón
    // que tarda en responder.
    void AsyncStorage.setItem(STORAGE_KEY, siguiente).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setTheme(name === 'dark' ? 'light' : 'dark');
  }, [name, setTheme]);

  /**
   * Lo que pinta el sistema, no nosotros, también tiene que seguir al tema.
   *
   * - El teclado, los diálogos de Alert y las barras de desplazamiento: se
   *   les dice en qué modo estamos o seguirían oscuros con la app en claro.
   *   Va junto con userInterfaceStyle "automatic" en app.json, que en
   *   Android solo surte efecto con expo-system-ui instalado.
   * - El fondo de la ventana nativa, que asoma detrás de la app al cambiar de
   *   pantalla o al abrirse el teclado. Sin esto, en modo claro se veía un
   *   destello oscuro en cada transición.
   *
   * Si el sistema no deja cambiar el fondo, no pasa nada grave: solo se nota
   * en las transiciones, así que no merece un error.
   */
  useEffect(() => {
    Appearance.setColorScheme(name);
    SystemUI.setBackgroundColorAsync(palettes[name].bg).catch(() => undefined);
  }, [name]);

  const value = useMemo<ThemeContextValue>(
    () => ({ name, colors: palettes[name], toggle, setTheme }),
    [name, toggle, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  }
  return context;
}
