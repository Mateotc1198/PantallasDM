import { Stack } from 'expo-router';

/**
 * Catálogo público. Es la pantalla que el inicio prometía desde el primer
 * día con un botón que no hacía nada.
 */
export default function ServiciosLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
