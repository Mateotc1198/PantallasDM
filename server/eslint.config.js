import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Reglas del backend.
 *
 * Separadas de las de la aplicación móvil: aquí el entorno es Node y no
 * React Native, no hay JSX y no existen los hooks. Compartir una sola
 * configuración produciría falsos positivos en los dos sentidos.
 */
export default tseslint.config(
  {
    // dist es salida del compilador y coverage es un reporte: analizarlos
    // no dice nada del código que escribimos.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // El tipo de un error capturado es unknown y comprobarlo es trabajo
      // del código, no del linter; pero una variable de catch sin usar sí
      // sobra y se escribe `catch {`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
    },
  },
);
