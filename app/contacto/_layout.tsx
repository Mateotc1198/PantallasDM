import { Stack } from 'expo-router';

/**
 * Datos de la barbería. La única pantalla sin llamadas a la API: sus datos
 * no cambian y viven en src/config/barberia.ts.
 */
export default function ContactoLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
