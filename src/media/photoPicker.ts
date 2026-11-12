import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Una foto elegida de la galería, ya lista para subir. */
export interface FotoElegida {
  /** Archivo local, para la vista previa. */
  uri: string;
  /** La imagen en base64 (JPEG), que es lo que viaja a la API. */
  base64: string;
}

/**
 * Lado de la foto que se sube, en píxeles.
 *
 * El avatar más grande de la app se pinta a unos 100 px; 512 deja margen para
 * pantallas de alta densidad y aun así la foto pesa unos 50 KB. Una foto del
 * teléfono tal cual pesaría varios MB y el servidor la rechazaría.
 */
const LADO = 512;

/** Calidad JPEG. Por debajo de 0,6 se notan los bloques en la cara. */
const CALIDAD = 0.7;

/**
 * Abre la galería, deja recortar la foto en cuadrado y la devuelve reducida.
 *
 * Devuelve null si la persona cierra la galería sin elegir: no es un error.
 *
 * No pide permiso de fotos antes. Android 13+ e iOS 14+ abren un selector del
 * sistema que no lo necesita: la app solo recibe la foto que se elige, no
 * acceso a toda la galería. Pedirlo sería un diálogo de más y un acceso que
 * no hace falta.
 *
 * Está en un módulo propio, y no dentro de la pantalla, porque depende de
 * código nativo. Así los tests de la pantalla lo sustituyen entero y prueban
 * qué hace la interfaz con cada resultado.
 */
export async function elegirFotoDeGaleria(): Promise<FotoElegida | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // Sin comprimir aquí: se comprime una sola vez, al final, ya reducida.
    quality: 1,
  });

  const original = resultado.canceled ? undefined : resultado.assets[0];
  if (original === undefined) {
    return null;
  }

  const contexto = ImageManipulator.manipulate(original.uri);
  try {
    // Solo el ancho: el alto se calcula para no deformarla. Con el recorte
    // cuadrado de arriba, sale de 512 x 512.
    contexto.resize({ width: LADO });
    const imagen = await contexto.renderAsync();
    try {
      const guardada = await imagen.saveAsync({
        format: SaveFormat.JPEG,
        compress: CALIDAD,
        base64: true,
      });

      if (guardada.base64 === undefined) {
        throw new Error('No se pudo leer la foto elegida.');
      }
      return { uri: guardada.uri, base64: guardada.base64 };
    } finally {
      // Son objetos nativos: se liberan en cuanto no hacen falta, en vez de
      // esperar a que el recolector se acuerde de ellos.
      imagen.release();
    }
  } finally {
    contexto.release();
  }
}
