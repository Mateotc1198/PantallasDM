/**
 * Dobles de los módulos nativos.
 *
 * Jest corre en Node, donde no existe ni el llavero de Android, ni el
 * almacenamiento del dispositivo, ni las fuentes de iconos. Estos módulos
 * se sustituyen por versiones en memoria; todo lo demás (contextos, hooks,
 * componentes) es el código real.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

/**
 * Llavero en memoria. Se comporta como el real en lo que importa a los
 * tests: lo que se guarda se puede leer, y lo que se borra deja de estar.
 */
jest.mock('expo-secure-store', () => {
  const almacen = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (clave: string) => almacen.get(clave) ?? null),
    setItemAsync: jest.fn(async (clave: string, valor: string) => {
      almacen.set(clave, valor);
    }),
    deleteItemAsync: jest.fn(async (clave: string) => {
      almacen.delete(clave);
    }),
    __reset: () => almacen.clear(),
  };
});

/**
 * Los iconos reales cargan una fuente de forma asíncrona, lo que llena los
 * tests de avisos de act() por algo que no se está probando. Aquí cada
 * icono es un Text con su nombre, suficiente para comprobar cuál se pinta.
 */
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icono = ({ name }: { name: string }) =>
    React.createElement(Text, null, `icono:${name}`);
  return { Ionicons: Icono };
});

/**
 * Cada test arranca con el dispositivo "recién instalado".
 *
 * Sin esto, un test que cambia el tema o guarda una cita deja ese estado
 * escrito, y el siguiente arranca con él: pasa aislado y falla en grupo, que
 * es el peor tipo de fallo porque depende del orden.
 */
beforeEach(async () => {
  // El doble se exporta como módulo CommonJS: según quién lo importe llega
  // envuelto en default o no.
  const modulo = require('@react-native-async-storage/async-storage');
  await (modulo.default ?? modulo).clear();

  const llavero = require('expo-secure-store');
  llavero.__reset();
});
