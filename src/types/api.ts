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
export type BookingStatus = 'activa' | 'cancelada' | 'atendida' | 'no_asistio';

/** Cómo terminó una cita que nadie canceló. Lo marca el panel. */
export type BookingOutcome = 'atendida' | 'no_asistio';

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
export interface BarberInput {
  name: string;
  specialty: string;
  /** URL https de una foto alojada en otro sitio. */
  avatar?: string;
  /**
   * La foto misma, en base64 (JPEG o PNG), elegida de la galería.
   *
   * Va una de las dos, nunca ambas. Al crear hace falta una; al editar, si no
   * va ninguna, el servidor conserva la foto que ya tenía.
   */
  photo?: string;
}

/**
 * Cuerpo de PUT /barbers/:id/account: el acceso de un barbero al panel.
 *
 * La contraseña solo viaja en esta dirección. Ninguna respuesta de la API la
 * devuelve, ni en claro ni cifrada.
 */
export interface BarberAccountInput {
  username: string;
  password: string;
}

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

/**
 * El servicio de una cita, tal como era al reservar.
 *
 * Es una foto, no un enlace: nombre y precio son los que el cliente aceptó.
 * Editar o eliminar el servicio en el catálogo no cambia esto.
 */
export interface BookingService {
  /** Id en el catálogo actual. null si el servicio se eliminó después. */
  id: string | null;
  name: string;
  /** Pesos colombianos, entero. El precio vigente al reservar. */
  priceCop: number;
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
  /** null en las citas reservadas sin elegir servicio. */
  service: BookingService | null;
  /** ISO 8601, generado por el servidor. */
  createdAt: string;
}

/**
 * Cuerpo de POST /bookings.
 *
 * Del servicio solo viaja el id: el nombre y el precio los copia el servidor
 * del catálogo. Si la app mandara el precio, podría mandar el que quisiera.
 */
export interface CreateBookingInput {
  barberId: string;
  date: string;
  time: string;
  customerName: string;
  customerPhone: string;
  serviceId?: string | null;
}

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
