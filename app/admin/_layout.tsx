import { Stack } from 'expo-router';

/**
 * Área de administración.
 *
 * No monta la TopBar del flujo de reserva: aquel es un asistente de cinco
 * pasos con un botón de cerrar, y esto es una herramienta de trabajo con su
 * propia cabecera y su "Cerrar sesión".
 *
 * El guard no vive aquí sino en cada pantalla, porque el login también
 * cuelga de esta ruta: un guard en el layout se redirigiría a sí mismo.
 */
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
