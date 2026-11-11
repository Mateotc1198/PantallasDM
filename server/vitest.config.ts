import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Los tests de integración comparten una sola base: en paralelo se
    // pisarían las reservas entre archivos.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      // lcov es el formato que lee SonarQube; text es para la consola.
      reporter: ['text', 'lcov'],
      // Solo el código de producción: medir la cobertura de los propios
      // tests y de sus ayudantes infla el número sin decir nada.
      include: ['src/**/*.ts'],
      // Sin código ejecutable: solo declaran tipos.
      exclude: ['src/types/**'],
    },
  },
});
