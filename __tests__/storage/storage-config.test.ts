import AsyncStorage from '@react-native-async-storage/async-storage';

import { BARBERIA, enlaceWhatsApp, enlaceWhatsAppLibre } from '../../src/config/barberia';
import {
  guardarUltimaCita,
  leerUltimaCita,
  olvidarUltimaCita,
} from '../../src/storage/lastBooking';

const almacenamiento = jest.mocked(AsyncStorage);

describe('última cita guardada en el dispositivo', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('lo que se guarda se puede leer', async () => {
    await guardarUltimaCita('abc-123');

    await expect(leerUltimaCita()).resolves.toBe('abc-123');
  });

  it('sin nada guardado devuelve null', async () => {
    await expect(leerUltimaCita()).resolves.toBeNull();
  });

  it('guardar otra reemplaza a la anterior: solo se recuerda la última', async () => {
    await guardarUltimaCita('primera');
    await guardarUltimaCita('segunda');

    await expect(leerUltimaCita()).resolves.toBe('segunda');
  });

  it('olvidar la borra', async () => {
    await guardarUltimaCita('abc-123');
    await olvidarUltimaCita();

    await expect(leerUltimaCita()).resolves.toBeNull();
  });

  // El almacenamiento es una comodidad. Si falla, la cita existe igual en el
  // servidor y el cliente puede pegar su código a mano: no es motivo para
  // romper la pantalla.
  it('si el almacenamiento falla al guardar, no lanza', async () => {
    almacenamiento.setItem.mockRejectedValueOnce(new Error('disco lleno'));

    await expect(guardarUltimaCita('abc-123')).resolves.toBeUndefined();
  });

  it('si falla al leer, se comporta como si no hubiera nada', async () => {
    almacenamiento.getItem.mockRejectedValueOnce(new Error('corrupto'));

    await expect(leerUltimaCita()).resolves.toBeNull();
  });

  it('si falla al borrar, no lanza', async () => {
    almacenamiento.removeItem.mockRejectedValueOnce(new Error('bloqueado'));

    await expect(olvidarUltimaCita()).resolves.toBeUndefined();
  });
});

describe('datos de la barbería', () => {
  it('el número de WhatsApp son solo dígitos, como exige wa.me', () => {
    expect(BARBERIA.whatsapp).toMatch(/^\d+$/);
  });

  it('enlaceWhatsApp apunta al número de la barbería', () => {
    const enlace = enlaceWhatsApp('Hola');

    expect(enlace).toBe(`https://wa.me/${BARBERIA.whatsapp}?text=Hola`);
  });

  it('codifica el mensaje: espacios, tildes y signos no rompen la URL', () => {
    const enlace = enlaceWhatsApp('¿Tienen cita mañana? & gracias');

    expect(enlace).not.toContain(' ');
    expect(enlace).not.toContain('&');
    expect(decodeURIComponent(enlace.split('text=')[1])).toBe('¿Tienen cita mañana? & gracias');
  });

  it('enlaceWhatsAppLibre no lleva destinatario: el usuario elige a quién', () => {
    expect(enlaceWhatsAppLibre('Mi código')).toBe('https://wa.me/?text=Mi%20c%C3%B3digo');
  });
});
