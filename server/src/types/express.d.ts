import type { AuthUser } from './api.js';

/**
 * Extiende Request para que req.user exista y esté tipado.
 *
 * Es la alternativa correcta a castear a any en cada controlador: el middleware
 * de autenticación lo rellena y TypeScript lo conoce en toda la aplicación.
 * Es opcional a propósito: en las rutas públicas no hay usuario, y así el
 * compilador obliga a comprobarlo antes de usarlo.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
