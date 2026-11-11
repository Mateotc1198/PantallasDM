import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { BarberSummary, Booking } from '../types/api';

interface BookingState {
  barber: BarberSummary | null;
  date: string | null;
  time: string | null;
  name: string;
  phone: string;
  /**
   * La cita tal como la devolvió el servidor. Solo existe después de
   * confirmar, y es la única fuente de verdad de la pantalla final: lo que
   * hay en el resto del estado es lo que el usuario pidió, no lo que quedó
   * guardado.
   */
  booking: Booking | null;
}

interface BookingContextValue extends BookingState {
  setBarber: (barber: BarberSummary) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  setBooking: (booking: Booking) => void;
  reset: () => void;
}

const INITIAL_STATE: BookingState = {
  barber: null,
  date: null,
  time: null,
  name: '',
  phone: '',
  booking: null,
};

const BookingContext = createContext<BookingContextValue | null>(null);

/**
 * Estado de la reserva en curso.
 *
 * Regla de negocio: cambiar de barbero invalida la fecha y la hora, y cambiar
 * de fecha invalida la hora, porque la disponibilidad depende de ambos. Sin
 * esto se podría confirmar una cita en un horario que ese barbero no tiene.
 *
 * La cita confirmada entra en la misma cascada: si cualquiera de los datos
 * que la originaron cambia, la cita que había en memoria ya no corresponde a
 * lo que el usuario está viendo.
 *
 * Se guarda el BarberSummary y no el Barber completo porque es lo que
 * devuelve la lista. Las reseñas se piden en la pantalla de perfil, que es la
 * única que las muestra.
 */
export function BookingProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<BookingState>(INITIAL_STATE);

  const setBarber = useCallback((barber: BarberSummary) => {
    setState((current) => ({ ...current, barber, date: null, time: null, booking: null }));
  }, []);

  const setDate = useCallback((date: string) => {
    setState((current) => ({ ...current, date, time: null, booking: null }));
  }, []);

  const setTime = useCallback((time: string) => {
    setState((current) => ({ ...current, time, booking: null }));
  }, []);

  const setName = useCallback((name: string) => {
    setState((current) => ({ ...current, name }));
  }, []);

  const setPhone = useCallback((phone: string) => {
    setState((current) => ({ ...current, phone }));
  }, []);

  const setBooking = useCallback((booking: Booking) => {
    setState((current) => ({ ...current, booking }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const value = useMemo<BookingContextValue>(
    () => ({ ...state, setBarber, setDate, setTime, setName, setPhone, setBooking, reset }),
    [state, setBarber, setDate, setTime, setName, setPhone, setBooking, reset],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (context === null) {
    throw new Error('useBooking debe usarse dentro de <BookingProvider>.');
  }
  return context;
}
