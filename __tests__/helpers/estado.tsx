import { render } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, type PropsWithChildren, type ReactElement } from 'react';

import { useBooking } from '../../src/context/BookingContext';
import type { AuthUser, BarberSummary, Booking, Service } from '../../src/types/api';
import { Proveedores } from './render';

export const BARBERO: BarberSummary = {
  id: 'luis-gomez',
  name: 'Luis Gomez',
  specialty: 'Especialista en fades',
  avatar: 'https://ejemplo.com/luis.png',
  rating: 5,
  reviewsCount: 2,
  servicesCount: 3,
};

export const OTRO_BARBERO: BarberSummary = {
  ...BARBERO,
  id: 'alexander-escobar',
  name: 'Alexander Escobar',
  specialty: 'Experto en barba',
};

export const SERVICIO: Service = {
  id: 's1',
  name: 'Fade',
  description: 'Degradado a máquina.',
  priceCop: 30000,
  category: 'Cortes',
  imageUrl: null,
};

export const CITA: Booking = {
  id: '11111111-2222-4333-8444-555555555555',
  barberId: 'luis-gomez',
  date: '2026-12-01',
  time: '10:00',
  customerName: 'Cliente Prueba',
  customerPhone: '3000000000',
  status: 'activa',
  service: { id: 's1', name: 'Fade', priceCop: 30000 },
  createdAt: '2026-11-10T10:00:00.000Z',
};

export const ADMIN: AuthUser = { id: 'u1', username: 'admin', role: 'admin', barberId: null };
export const USUARIO_BARBERO: AuthUser = {
  id: 'u2',
  username: 'luis',
  role: 'barbero',
  barberId: 'luis-gomez',
};

export interface EstadoReserva {
  barber?: BarberSummary;
  /**
   * Si no se indica, con barbero elegido se siembra SERVICIO: casi todos los
   * tests necesitan uno y no hablan de él. null deja la reserva sin servicio,
   * para probar justo ese caso.
   */
  service?: Service | null;
  date?: string;
  time?: string;
  name?: string;
  phone?: string;
  booking?: Booking;
}

/**
 * Deja la reserva en un paso concreto antes de pintar la pantalla.
 *
 * Se hace llamando a los setters reales y en el orden real del flujo, no
 * inyectando un estado inventado: así el test recorre las mismas reglas de
 * invalidación que el usuario (elegir barbero borra fecha y hora).
 */
function Sembrador({ estado, children }: PropsWithChildren<{ estado: EstadoReserva }>) {
  const reserva = useBooking();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (estado.barber !== undefined) reserva.setBarber(estado.barber);
    if (estado.barber !== undefined && estado.service !== null) {
      reserva.setService(estado.service ?? SERVICIO);
    }
    if (estado.date !== undefined) reserva.setDate(estado.date);
    if (estado.time !== undefined) reserva.setTime(estado.time);
    if (estado.name !== undefined) reserva.setName(estado.name);
    if (estado.phone !== undefined) reserva.setPhone(estado.phone);
    if (estado.booking !== undefined) reserva.setBooking(estado.booking);
    // Marca que la siembra terminó. Es un ayudante de pruebas que imita una
    // acción única del usuario, no un efecto de sincronización.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListo(true);
    // Solo al montar: sembrar es una acción única, no una sincronización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return listo ? children : null;
}

export function renderConReserva(ui: ReactElement, estado: EstadoReserva) {
  return render(
    <Proveedores>
      <Sembrador estado={estado}>{ui}</Sembrador>
    </Proveedores>,
  );
}

/**
 * Deja una sesión vigente en el llavero, como si el usuario hubiera entrado
 * en una apertura anterior. AuthProvider la restaura al montar.
 */
export async function sembrarSesion(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(
    'zonabarber.session',
    JSON.stringify({ token: 'token-de-prueba', expiresAt: Date.now() + 3_600_000, user }),
  );
}
