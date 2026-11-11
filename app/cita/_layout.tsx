import { Stack } from 'expo-router';

/**
 * Zona del cliente: consultar, aplazar y cancelar su propia cita.
 *
 * Separada del flujo de reserva porque no es un asistente de pasos sino un
 * sitio al que se vuelve, y separada del panel porque aquí no hay sesión:
 * la credencial es el código de la cita más el teléfono.
 */
export default function CitaLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
