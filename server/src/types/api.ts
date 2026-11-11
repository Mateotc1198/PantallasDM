/**
 * Contrato público de la API v1.
 *
 * Es el mismo contrato que ya vive en el frontend (src/types/api.ts): los
 * nombres y las formas coinciden a propósito, para que conectar la app sea
 * cambiar la implementación de src/data/ y nada más.
 *
 * Solo tipos de dominio: nada de Express, nada de SQL, nada de filas de la
 * base. La traducción fila -> tipo de dominio es trabajo del repositorio.
 */

/** Disponibilidad de una franja horaria. */
export type SlotStatus = 'libre' | 'ocupado';

/** Estado de una cita. Concepto del servidor: el frontend solo lee citas activas. */
export type BookingStatus = 'activa' | 'cancelada';

export interface Review {
  id: string;
  authorName: string;
  comment: string;
  /** Entero de 1 a 5. */
  rating: number;
}

/**
 * Barbero con sus reseñas. Lo devuelve GET /barbers/:id.
 */
export interface Barber {
  id: string;
  name: string;
  specialty: string;
  /** URL absoluta del avatar. */
  avatar: string;
  /** Promedio de 0 a 5, con un decimal. Se calcula agregando reviews. */
  rating: number;
  reviewsCount: number;
  servicesCount: number;
  reviews: Review[];
}

/**
 * Barbero sin reseñas. Lo devuelve GET /barbers.
 *
 * Una colección no debe arrastrar los hijos de cada elemento: la pantalla de
 * lista solo muestra nombre, especialidad y avatar. Las reseñas llegan cuando
 * se piden de verdad, en el detalle.
 */
export type BarberSummary = Omit<Barber, 'reviews'>;

/** Franja horaria. GET /barbers/:id/slots?date=YYYY-MM-DD */
export interface Slot {
  id: string;
  /** Hora en formato 'HH:mm' 24h. El formato de presentación es cosa del cliente. */
  time: string;
  status: SlotStatus;
}

/**
 * Días de un mes con al menos una franja libre.
 * GET /barbers/:id/availability?month=YYYY-MM
 *
 * Existe para que un calendario resuelva el mes completo con una sola
 * petición en lugar de preguntar día por día.
 */
export interface MonthAvailability {
  /** El mes consultado, 'YYYY-MM'. */
  month: string;
  /** Fechas 'YYYY-MM-DD' con cupo, en orden ascendente. */
  days: string[];
}

/** Cita. POST /bookings, GET /bookings/:id */
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

/** Cuerpo de POST /bookings: id, status y createdAt los pone el servidor. */
export type CreateBookingInput = Omit<Booking, 'id' | 'status' | 'createdAt'>;

/**
 * Servicio del catalogo. GET /services
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

/**
 * Rol de una cuenta.
 *
 * admin   gestiona toda la agenda de la barbería
 * barbero entra al mismo panel, pero solo ve y cancela SUS citas
 */
export type UserRole = 'admin' | 'barbero';

/**
 * Identidad que viaja en el token y que la API expone.
 * Nunca incluye el hash de la contraseña.
 */
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
  /** Segundos que dura el token, para que el cliente sepa cuándo renovar. */
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
