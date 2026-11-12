import { createElement } from 'react';
import { Text } from 'react-native';

/**
 * Doble de expo-router.
 *
 * La navegación real necesita el árbol de rutas montado por Expo. A los
 * tests les basta con saber A DÓNDE intentó ir cada pantalla, así que el
 * router es un objeto de espías y Redirect pinta su destino como texto.
 *
 * Uso, en cada archivo de test que lo necesite:
 *   jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);
 */
export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  canDismiss: jest.fn(() => true),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
};

export const usePathname = jest.fn(() => '/');
export const useLocalSearchParams = jest.fn(() => ({}));

export const expoRouterMock = {
  useRouter: () => router,
  usePathname,
  useLocalSearchParams,
  Redirect: ({ href }: { href: string }) => createElement(Text, null, `redirige:${href}`),
  Stack: () => null,
};

/** Deja los espías como nuevos entre un test y el siguiente. */
export function reiniciarRouter(): void {
  for (const espia of Object.values(router)) {
    espia.mockClear();
  }
  router.canGoBack.mockReturnValue(true);
  router.canDismiss.mockReturnValue(true);
  usePathname.mockReturnValue('/');
  useLocalSearchParams.mockReturnValue({});
}
