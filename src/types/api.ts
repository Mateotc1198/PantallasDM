/**
 * Contrato con la API (Node + Express + PostgreSQL).
 *
 * Es el espejo exacto de server/src/types/api.ts. Cuando uno cambie, el otro
 * tiene que cambiar con él: son dos copias del mismo acuerdo, y la única
 * forma de que un monorepo sin paquete compartido no se desincronice es que
 * esa regla esté escrita.
 *
 * Solo tipos de dominio: nada de UI ni de navegación.
 */

/** Disponibilidad de un horario. */
export type SlotStatus = 'libre' | 'ocupado';

/** Estado de una cita. */
export type BookingStatus = 'activa' | 'cancelada';

/** Reseña de un cliente sobre un barbero. */
export interface Review {
  id: string;
  authorName: string;
  comment: string;
  /** Entero de 1 a 5. */
  rating: number;
}

/** Barbero con sus reseñas. Lo devuelve GET /barbers/:id. */
export interface Barber {
  id: string;
  name: string;
  specialty: string;
  /** URL absoluta del avatar. */
  avatar: string;
  /** Promedio de 0 a 5, con un decimal. */
  rating: number;
  reviewsCount: number;
  servicesCount: number;
  reviews: Review[];
}

/**
 * Barbero sin reseñas. Lo devuelve GET /barbers.
 *
 * La lista no arrastra las reseñas de cada barbero: la pantalla de selección
 * solo muestra nombre, especialidad y avatar. Quien necesite las reseñas pide
 * el detalle.
 */
export type BarberSummary = Omit<Barber, 'reviews'>;

/**
 * Cuerpo de POST y PUT /barbers: lo único que el administrador escribe.
 *
 * El id lo deriva el servidor del nombre; la calificación y los conteos se
 * calculan. Un cliente no puede fijar ninguno de los tres.
 */
export type BarberInput = Pick<Barber, 'name' | 'specialty' | 'avatar'>;

/** GET /barbers/:id/slots?date=YYYY-MM-DD */
export interface Slot {
  id: string;
  /** Hora en formato 'HH:mm' 24h. La presentación vive en src/utils/date.ts. */
  time: string;
  status: SlotStatus;
}

/**
 * Días de un mes con al menos una franja libre.
 * GET /barbers/:id/availability?month=YYYY-MM
 *
 * Permite que el calendario resuelva el mes entero con una sola petición en
 * vez de preguntar día por día.
 */
export interface MonthAvailability {
  /** El mes consultado, 'YYYY-MM'. */
  month: string;
  /** Fechas 'YYYY-MM-DD' con cupo, en orden ascendente. */
  days: string[];
}

/** POST /bookings (respuesta) · GET /bookings/:id */
export interface Booking {
  id: string;
  barberId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:mm' 24h */
  time: string;
  customerName: string;
  /** Exactamente 10 dígitos, sin separadores. */
  customerPhone: string;
  status: BookingStatus;
  /** ISO 8601, generado por el servidor. */
  createdAt: string;
}

/** Cuerpo de POST /bookings: el servidor pone id, status y createdAt. */
export type CreateBookingInput = Omit<Booking, 'id' | 'status' | 'createdAt'>;

/**
 * Servicio del catálogo. GET /services
 *
 * El precio viaja como entero en pesos y no como decimal: el dinero no se
 * representa en coma flotante, y el peso colombiano no usa centavos.
 */
export interface Service {
  id: string;
  name: string;
  description: string;
  /** Pesos colombianos, entero. */
  priceCop: number;
  category: string;
  /** URL absoluta de la imagen, o null si no tiene. */
  imageUrl: string | null;
}

/** Cuerpo de POST y PUT /services: el servidor pone el id. */
export type ServiceInput = Omit<Service, 'id'>;

/** Rol de una cuenta del panel. */
export type UserRole = 'admin' | 'barbero';

/** Identidad que expone la API. Nunca incluye la contraseña. */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  /** Ficha de barbero que gestiona. null para los administradores. */
  barberId: string | null;
}

/** Respuesta de POST /auth/login */
export interface LoginResponse {
  token: string;
  /** Segundos que dura el token. */
  expiresIn: number;
  user: AuthUser;
}

/** Forma única de todas las respuestas de error de la API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
  };
}
