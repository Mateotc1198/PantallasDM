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
      // La lista blanca de CORS se fija aquí y no se hereda del .env: cada
      // máquina tiene el suyo (y el CI no tiene ninguno), así que un test de
      // CORS que dependiera de él pasaría en un sitio y fallaría en otro.
      // dotenv no pisa una variable que ya existe, de modo que este valor
      // manda en todos los entornos.
      CORS_ORIGINS: 'https://app.ejemplo.test',
      // Los ayudantes de los tests construyen "hoy", "ayer" y "dentro de una
      // semana" con el reloj de la máquina. Para que el servidor bajo prueba
      // entienda lo mismo por "hoy", su zona de negocio es la de la máquina:
      // así la suite da igual en un portátil en Colombia y en el CI en UTC.
      // Que la conversión a otra zona funciona lo prueban, con instantes
      // fijos, los tests unitarios de wallClockIn.
      BUSINESS_TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
