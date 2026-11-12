import { z } from 'zod';

/**
 * Límite de bcrypt: solo usa los primeros 72 bytes de la contraseña y
 * descarta el resto en silencio. Aceptar más sería prometer una seguridad que
 * no se da: dos contraseñas distintas a partir del byte 73 valdrían lo mismo.
 */
const BCRYPT_MAX_BYTES = 72;

const PASSWORD_MIN = 8;

/** Letras minúsculas, dígitos, punto, guion y guion bajo. */
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

/**
 * Cuerpo de PUT /barbers/:id/account.
 *
 * El usuario se normaliza igual que en el login (minúsculas, sin espacios
 * alrededor): si aquí se guardara "Luis" y el login buscara "luis", la cuenta
 * recién creada no podría entrar.
 *
 * La contraseña no se recorta ni se transforma: un espacio forma parte de
 * ella. Solo se le exige un mínimo de longitud; reglas de "una mayúscula y un
 * símbolo" empujan a contraseñas predecibles y no se piden.
 */
export const barberAccountSchema = z.object({
  username: z
    .string()
    .transform((valor) => valor.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(3, 'el usuario debe tener al menos 3 caracteres')
        .max(30, 'el usuario no puede superar 30 caracteres')
        .regex(USERNAME_PATTERN, 'solo letras, números, punto, guion y guion bajo'),
    ),
  password: z
    .string()
    .min(PASSWORD_MIN, `la contraseña debe tener al menos ${PASSWORD_MIN} caracteres`)
    .refine(
      (valor) => Buffer.byteLength(valor, 'utf8') <= BCRYPT_MAX_BYTES,
      `la contraseña no puede superar ${BCRYPT_MAX_BYTES} bytes`,
    ),
});

export type BarberAccountBody = z.infer<typeof barberAccountSchema>;
