/**
 * Pruebas de la aplicación móvil.
 *
 * El backend NO corre aquí: tiene su propio runner (Vitest) dentro de
 * server/, con una base de datos real. Los dos conviven en el mismo
 * repositorio con el mismo patrón de nombres (*.test.ts), así que hay que
 * decirle a Jest explícitamente que no entre en server/ o intentaría
 * ejecutar tests escritos para otra herramienta.
 */
module.exports = {
  preset: 'jest-expo',

  // Los tests viven en __tests__/ y no junto a las pantallas: expo-router
  // convierte en ruta cualquier archivo que encuentre dentro de app/.
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/'],
  modulePathIgnorePatterns: ['<rootDir>/server/'],

  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

  // La cobertura se mide sobre TODO el código de la app, no solo sobre los
  // archivos que algún test toca: si no, un archivo sin tests no contaría
  // como 0% sino que desaparecería del informe y el total mentiría.
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    // Solo declaran tipos: no hay código que ejecutar.
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  // lcov es el formato que lee SonarQube.
  coverageReporters: ['text-summary', 'lcov'],
};
