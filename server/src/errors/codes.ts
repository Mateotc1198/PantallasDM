/**
 * Catálogo de códigos de error de la API.
 *
 * Son estables y legibles por máquina: el cliente hace switch sobre `code`,
 * nunca sobre `message` (que puede cambiar de redacción o de idioma).
 * Tenerlos en un solo sitio evita erratas y sirve de documentación.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  /** 400 - el cuerpo no es JSON válido: ni siquiera se pudo leer. */
  MALFORMED_JSON: 'MALFORMED_JSON',
  /** 413 - el cuerpo supera el límite de tamaño. */
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  /** 401 - no sabemos quién eres. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** 403 - sabemos quién eres y no te alcanza. */
  FORBIDDEN: 'FORBIDDEN',

  BARBER_NOT_FOUND: 'BARBER_NOT_FOUND',
  BARBER_CLOSED_THAT_DAY: 'BARBER_CLOSED_THAT_DAY',
  /** 409 - ya hay un barbero con ese nombre. */
  BARBER_NAME_TAKEN: 'BARBER_NAME_TAKEN',
  /** 404 - ese barbero no tiene una foto subida. */
  BARBER_PHOTO_NOT_FOUND: 'BARBER_PHOTO_NOT_FOUND',
  /** 409 - tiene citas activas pendientes y no se puede dar de baja. */
  BARBER_HAS_BOOKINGS: 'BARBER_HAS_BOOKINGS',

  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_SLOT_TAKEN: 'BOOKING_SLOT_TAKEN',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  /** 422 - la cita está demasiado cerca para tocarla. */
  BOOKING_CHANGE_TOO_LATE: 'BOOKING_CHANGE_TOO_LATE',
  /** 403 - el teléfono no corresponde al de la cita. */
  BOOKING_PHONE_MISMATCH: 'BOOKING_PHONE_MISMATCH',

  /** 409 - ya hay una cuenta con ese nombre de usuario. */
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  /** 404 - ese barbero no tiene cuenta de acceso. */
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',

  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  /** 409 - ya hay un servicio con ese nombre. */
  SERVICE_NAME_TAKEN: 'SERVICE_NAME_TAKEN',

  DATE_IN_PAST: 'DATE_IN_PAST',
  TIME_IN_PAST: 'TIME_IN_PAST',
  TIME_NOT_IN_SCHEDULE: 'TIME_NOT_IN_SCHEDULE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
