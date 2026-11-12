import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/codes.js';
import * as usersRepository from '../repositories/users.repository.js';
import type { AuthUser, LoginResponse, UserRole } from '../types/api.js';

/**
 * Coste del hash. 12 rondas es el equilibrio recomendado hoy: lo bastante
 * lento para que probar contraseñas por fuerza bruta sea caro, lo bastante
 * rápido para no bloquear un login.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Hash señuelo contra el que se compara cuando el usuario NO existe.
 *
 * Sin esto, un login con usuario inexistente responde al instante y uno con
 * usuario válido tarda lo que tarda bcrypt. Esa diferencia de tiempo permite
 * averiguar qué usuarios existen (enumeración por canal lateral). Comparando
 * siempre, los dos casos cuestan lo mismo.
 */
const HASH_SENUELO = bcrypt.hashSync('usuario-inexistente', BCRYPT_ROUNDS);

/** Lo que viaja firmado dentro del token. Nunca la contraseña ni su hash. */
interface TokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  barberId: string | null;
  /** Versión de las credenciales con las que se emitió. */
  sv: number;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Valida credenciales y devuelve un token.
 *
 * El mensaje de error es el mismo si el usuario no existe o si la contraseña
 * es incorrecta: decir cuál de las dos falló le regala al atacante media
 * respuesta.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const credenciales = await usersRepository.findCredentialsByUsername(username);

  const coincide = await bcrypt.compare(
    password,
    credenciales?.passwordHash ?? HASH_SENUELO,
  );

  if (credenciales === null || !coincide) {
    throw new UnauthorizedError(
      ERROR_CODES.INVALID_CREDENTIALS,
      'Usuario o contraseña incorrectos.',
    );
  }

  const payload: TokenPayload = {
    sub: credenciales.user.id,
    username: credenciales.user.username,
    role: credenciales.user.role,
    barberId: credenciales.user.barberId,
    sv: credenciales.sessionVersion,
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresInSeconds,
  });

  return { token, expiresIn: env.jwtExpiresInSeconds, user: credenciales.user };
}

/** Verifica la firma y la vigencia del token. Lanza 401 si no valen. */
function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError(
        ERROR_CODES.TOKEN_EXPIRED,
        'La sesión expiró. Vuelve a iniciar sesión.',
      );
    }
    throw new UnauthorizedError(ERROR_CODES.UNAUTHORIZED, 'Token inválido.');
  }
}

/**
 * De un token, la identidad de quien llama, comprobada contra la base.
 *
 * Que el token sea auténtico no basta. Antes la identidad salía solo del
 * token, y una sesión seguía abierta hasta 8 horas después de que el
 * administrador le quitara el acceso a un barbero, lo diera de baja o le
 * cambiara la contraseña: con el token viejo podía seguir viendo, cancelando
 * y marcando citas.
 *
 * Ahora se exige además que la cuenta siga vigente y que la versión de sus
 * credenciales sea la del token. Cuesta una lectura por clave primaria en
 * cada petición del panel; a cambio, quitar un acceso surte efecto en la
 * siguiente petición, no al cabo de horas.
 *
 * La identidad que se devuelve es la de la base, no la del token: si el rol o
 * la ficha cambiaran, manda lo actual.
 */
export async function authenticateToken(token: string): Promise<AuthUser> {
  const payload = verifyToken(token);
  const sesion = await usersRepository.findActiveSession(payload.sub);

  // Un token de antes de este cambio no lleva sv: tampoco vale, y basta con
  // volver a iniciar sesión una vez.
  if (sesion === null || sesion.sessionVersion !== payload.sv) {
    throw new UnauthorizedError(
      ERROR_CODES.SESSION_REVOKED,
      'Tu sesión ya no es válida. Vuelve a iniciar sesión.',
    );
  }
  return sesion.user;
}
