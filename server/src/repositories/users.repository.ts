import { query } from '../config/database.js';
import type { AuthUser, UserRole } from '../types/api.js';

/**
 * Acceso a las cuentas.
 *
 * El hash de la contraseña solo sale de aquí en findCredentialsByUsername, que
 * es la única operación que legítimamente lo necesita. El resto de la
 * aplicación trabaja con AuthUser, que no lo contiene: así es imposible
 * filtrarlo por accidente en una respuesta JSON.
 */

interface UserRow {
  id: string;
  username: string;
  role: UserRole;
  barber_id: string | null;
}

interface CredentialsRow extends UserRow {
  password_hash: string;
}

export interface UserCredentials {
  user: AuthUser;
  passwordHash: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    barberId: row.barber_id,
  };
}

/** Único punto donde el hash sale de la base. Solo lo usa el login. */
export async function findCredentialsByUsername(
  username: string,
): Promise<UserCredentials | null> {
  const rows = await query<CredentialsRow>(
    `SELECT id, username, role, barber_id, password_hash
     FROM users
     WHERE username = $1`,
    [username],
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return { user: toAuthUser(row), passwordHash: row.password_hash };
}

export async function findById(id: string): Promise<AuthUser | null> {
  const rows = await query<UserRow>(
    'SELECT id, username, role, barber_id FROM users WHERE id = $1',
    [id],
  );
  const row = rows[0];
  return row === undefined ? null : toAuthUser(row);
}

/**
 * Crea la cuenta o actualiza su contraseña si ya existe.
 *
 * Idempotente a propósito: el script de usuarios iniciales se ejecuta en cada
 * despliegue y no debe fallar porque la cuenta ya esté creada.
 */
export async function upsert(input: {
  username: string;
  passwordHash: string;
  role: UserRole;
  barberId: string | null;
}): Promise<AuthUser> {
  const rows = await query<UserRow>(
    `INSERT INTO users (username, password_hash, role, barber_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = EXCLUDED.role,
           barber_id     = EXCLUDED.barber_id
     RETURNING id, username, role, barber_id`,
    [input.username, input.passwordHash, input.role, input.barberId],
  );

  const row = rows[0];
  if (row === undefined) {
    throw new Error('El upsert de users no devolvió ninguna fila.');
  }
  return toAuthUser(row);
}
