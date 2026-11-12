import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useBooking } from '../context/BookingContext';

export type BookingRequirement = 'barber' | 'service' | 'date' | 'time' | 'customer' | 'booking';

const FIRST_STEP = '/reserva/barbero';

/**
 * Guarda de paso: si alguien entra directo a un paso sin los datos previos
 * (recarga en desarrollo o deep link), lo devuelve al paso 1.
 *
 * Devuelve false mientras faltan datos, para que la pantalla no renderice con
 * el estado incompleto durante el frame previo a la redirección.
 */
export function useRequireBooking(requirements: BookingRequirement[]): boolean {
  const router = useRouter();
  const { barber, service, date, time, name, phone, booking } = useBooking();

  const satisfied = requirements.every((requirement) => {
    switch (requirement) {
      case 'barber':
        return barber !== null;
      case 'service':
        return service !== null;
      case 'date':
        return date !== null;
      case 'time':
        return time !== null;
      case 'customer':
        return name.length > 0 && phone.length > 0;
      case 'booking':
        return booking !== null;
    }
  });

  useEffect(() => {
    if (!satisfied) {
      router.replace(FIRST_STEP);
    }
  }, [router, satisfied]);

  return satisfied;
}
