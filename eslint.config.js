const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * Reglas de la aplicación móvil.
 *
 * El backend NO se analiza aquí: tiene su propio tsconfig, su propio
 * entorno (Node, no React Native) y su propia configuración en
 * server/eslint.config.js. Analizar los dos con las mismas reglas daría
 * falsos positivos en ambos sentidos.
 */
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'server/*', '.expo/*', 'node_modules/*', '.verify-*/*'],
  },
  {
    // jest.mock se eleva por encima de los import, así que su fábrica solo
    // puede traer módulos con require(). La regla sigue activa en el codigo
    // de la aplicacion, donde un require() si seria un descuido.
    files: ['__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      // Avisa de dependencias mal declaradas en useEffect y useMemo. Es la
      // causa más común de datos que no se refrescan o de bucles de render.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
