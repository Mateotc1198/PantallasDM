import * as ImageManipulatorModule from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { elegirFotoDeGaleria } from '../../src/media/photoPicker';

/**
 * El selector de fotos, con la galería y el editor de imágenes sustituidos:
 * son código nativo. Lo que se prueba es qué se le pide a cada uno y qué se
 * hace con lo que devuelven.
 */
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const picker = jest.mocked(ImagePicker);
const manipulador = jest.mocked(ImageManipulatorModule.ImageManipulator);

/** Dobles de los objetos nativos del editor, con su release() espiable. */
function prepararEditor(guardada: { uri: string; base64?: string }) {
  const imagen = {
    saveAsync: jest.fn().mockResolvedValue({ width: 512, height: 512, ...guardada }),
    release: jest.fn(),
  };
  const contexto = {
    resize: jest.fn(),
    renderAsync: jest.fn().mockResolvedValue(imagen),
    release: jest.fn(),
  };
  manipulador.manipulate.mockReturnValue(
    contexto as unknown as ReturnType<typeof manipulador.manipulate>,
  );
  return { contexto, imagen };
}

function eligio(uri: string) {
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri, width: 4000, height: 3000 } as ImagePicker.ImagePickerAsset],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('elegirFotoDeGaleria', () => {
  it('abre la galería solo para imágenes, con recorte cuadrado', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await elegirFotoDeGaleria();

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }),
    );
  });

  it('cerrar la galería sin elegir no es un error: devuelve null', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(elegirFotoDeGaleria()).resolves.toBeNull();
    expect(manipulador.manipulate).not.toHaveBeenCalled();
  });

  it('reduce la foto a 512 px de ancho y la guarda como JPEG comprimido con su base64', async () => {
    eligio('file:///original.jpg');
    const { contexto, imagen } = prepararEditor({ uri: 'file:///reducida.jpg', base64: 'QUJD' });

    const foto = await elegirFotoDeGaleria();

    expect(manipulador.manipulate).toHaveBeenCalledWith('file:///original.jpg');
    expect(contexto.resize).toHaveBeenCalledWith({ width: 512 });
    expect(imagen.saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7, base64: true });
    expect(foto).toEqual({ uri: 'file:///reducida.jpg', base64: 'QUJD' });
  });

  it('libera los objetos nativos al terminar', async () => {
    eligio('file:///original.jpg');
    const { contexto, imagen } = prepararEditor({ uri: 'file:///reducida.jpg', base64: 'QUJD' });

    await elegirFotoDeGaleria();

    expect(imagen.release).toHaveBeenCalledTimes(1);
    expect(contexto.release).toHaveBeenCalledTimes(1);
  });

  it('si no consigue el base64 lo dice, y libera igual los objetos nativos', async () => {
    eligio('file:///original.jpg');
    const { contexto, imagen } = prepararEditor({ uri: 'file:///reducida.jpg' });

    await expect(elegirFotoDeGaleria()).rejects.toThrow('No se pudo leer la foto elegida.');
    expect(imagen.release).toHaveBeenCalledTimes(1);
    expect(contexto.release).toHaveBeenCalledTimes(1);
  });

  it('si el editor falla, libera el contexto y deja pasar el error', async () => {
    eligio('file:///original.jpg');
    const { contexto } = prepararEditor({ uri: 'x' });
    contexto.renderAsync.mockRejectedValue(new Error('formato no soportado'));

    await expect(elegirFotoDeGaleria()).rejects.toThrow('formato no soportado');
    expect(contexto.release).toHaveBeenCalledTimes(1);
  });
});
