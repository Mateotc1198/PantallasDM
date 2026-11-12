import { render } from '@testing-library/react-native';
import type { PropsWithChildren, ReactElement } from 'react';

import { AuthProvider } from '../../src/context/AuthContext';
import { BookingProvider } from '../../src/context/BookingContext';
import { ThemeProvider } from '../../src/theme/ThemeContext';

/**
 * Los mismos proveedores que monta app/_layout.tsx, en el mismo orden.
 *
 * Los componentes se prueban dentro del árbol real y no con contextos
 * falsos: así un test falla si un componente deja de funcionar con el tema
 * o la sesión de verdad, que es lo que importa.
 */
export function Proveedores({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BookingProvider>{children}</BookingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export function renderApp(ui: ReactElement) {
  return render(ui, { wrapper: Proveedores });
}
