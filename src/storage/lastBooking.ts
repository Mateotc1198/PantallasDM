import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Recuerda la última cita reservada en este dispositivo.
 *
 * El cliente no tiene cuenta: su cita se identifica por un UUID que recibe
 * al reservar. Guardarlo aquí es lo que hace que "Mi cita" simplemente
 * funcione, sin que nadie tenga que copiar ni recordar un código de treinta
 * y seis caracteres.
 *
 * Va en AsyncStorage y no en SecureStore, al revés que el token del panel.
 * El UUID por sí solo no sirve para cancelar nada: hace falta además el
 * teléfono con el que se reservó. Es una comodidad, no una credencial
 * completa, y meterlo en el llavero del sistema daría a entender otra cosa.
 */
const STORAGE_KEY = 'zonabarber:ultimaCita';

export async function guardarUltimaCita(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Sin esto el cliente tendrá que pegar su código a mano. Es peor
    // experiencia, no un fallo: la cita existe igual en el servidor.
  }
}

export async function leerUltimaCita(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function olvidarUltimaCita(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que hacer. Como mucho, la pantalla intentará cargar una cita
    // cancelada y mostrará su estado real.
  }
}
