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
  };

  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresInSeconds,
  });

  return { token, expiresIn: env.jwtExpiresInSeconds, user: credenciales.user };
}

/**
 * Verifica la firma y la vigencia del token y reconstruye la identidad.
 *
 * Es stateless: la identidad sale del propio token, sin consultar la base en
 * cada petición. Contrapartida honesta: si a alguien se le cambia el rol o se
 * le borra la cuenta, su token sigue siendo válido hasta que expire (8 h). La
 * solución sería una lista de revocación, que para este tamaño sería
 * sobreingeniería; acortar la vigencia es el ajuste razonable.
 */
export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      barberId: payload.barberId,
    };
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
