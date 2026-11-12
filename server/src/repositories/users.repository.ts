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
  session_version: number;
}

interface SessionRow extends UserRow {
  session_version: number;
}

/** Una cuenta vigente con la versión de sus credenciales. */
export interface ActiveSession {
  user: AuthUser;
  sessionVersion: number;
}

export interface UserCredentials {
  user: AuthUser;
  passwordHash: string;
  /** Va dentro del token que se emite con estas credenciales. */
  sessionVersion: number;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    barberId: row.barber_id,
  };
}

/**
 * Único punto donde el hash sale de la base. Solo lo usa el login.
 *
 * La cuenta de un barbero dado de baja no se encuentra: para el login es
 * como si no existiera. Se filtra aquí y no borrando la fila porque el script
 * de cuentas iniciales la volvería a crear en el siguiente despliegue; con el
 * filtro da igual que la fila esté o no.
 */
export async function findCredentialsByUsername(
  username: string,
): Promise<UserCredentials | null> {
  const rows = await query<CredentialsRow>(
    `SELECT u.id, u.username, u.role, u.barber_id, u.password_hash, u.session_version
     FROM users u
     LEFT JOIN barbers b ON b.id = u.barber_id
     WHERE u.username = $1
       AND (u.barber_id IS NULL OR b.deleted_at IS NULL)`,
    [username],
  );

  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    user: toAuthUser(row),
    passwordHash: row.password_hash,
    sessionVersion: row.session_version,
  };
}

/**
 * La cuenta dueña de un token, si sigue vigente.
 *
 * null si se borró o si es de un barbero dado de baja: las mismas condiciones
 * que impiden iniciar sesión impiden seguir usando una sesión abierta. Lo
 * consulta cada petición del panel; por clave primaria, es una lectura
 * barata.
 */
export async function findActiveSession(id: string): Promise<ActiveSession | null> {
  const rows = await query<SessionRow>(
    `SELECT u.id, u.username, u.role, u.barber_id, u.session_version
     FROM users u
     LEFT JOIN barbers b ON b.id = u.barber_id
     WHERE u.id = $1
       AND (u.barber_id IS NULL OR b.deleted_at IS NULL)`,
    [id],
  );

  const row = rows[0];
  return row === undefined
    ? null
    : { user: toAuthUser(row), sessionVersion: row.session_version };
}

/** Código de Postgres para violación de restricción UNIQUE. */
const UNIQUE_VIOLATION = '23505';

/** El repositorio cuenta qué pasó; el servicio decide que eso es un 409. */
export type AccountResult = { ok: true; user: AuthUser } | { ok: false; reason: 'username_taken' };

/**
 * Todas las cuentas vigentes, sin hash.
 *
 * Las de barberos dados de baja no aparecen: no pueden iniciar sesión, así
 * que para el panel no existen.
 */
export async function findAll(): Promise<AuthUser[]> {
  const rows = await query<UserRow>(
    `SELECT u.id, u.username, u.role, u.barber_id
     FROM users u
     LEFT JOIN barbers b ON b.id = u.barber_id
     WHERE u.barber_id IS NULL OR b.deleted_at IS NULL
     ORDER BY u.role, u.username`,
  );
  return rows.map(toAuthUser);
}

/**
 * Crea la cuenta de un barbero o reemplaza la que ya tenía.
 *
 * El conflicto que se resuelve actualizando es el de barber_id (un barbero,
 * una cuenta), NUNCA el de username. Esa diferencia es de seguridad: con
 * ON CONFLICT (username) DO UPDATE, pedir el usuario "admin" para un barbero
 * convertiría la cuenta del administrador en una de barbero y lo dejaría
 * fuera del panel. Aquí un usuario repetido choca contra su índice único y se
 * devuelve como rechazo.
 *
 * El rol va escrito en la consulta y no llega como parámetro: por esta
 * función no se puede crear un administrador.
 */
export async function setBarberAccount(
  barberId: string,
  username: string,
  passwordHash: string,
): Promise<AccountResult> {
  try {
    const rows = await query<UserRow>(
      `INSERT INTO users (username, password_hash, role, barber_id)
       VALUES ($1, $2, 'barbero', $3)
       ON CONFLICT (barber_id) WHERE barber_id IS NOT NULL DO UPDATE
         SET username        = EXCLUDED.username,
             password_hash   = EXCLUDED.password_hash,
             -- Credenciales nuevas: las sesiones abiertas con las viejas
             -- dejan de valer.
             session_version = users.session_version + 1
       RETURNING id, username, role, barber_id`,
      [username, passwordHash, barberId],
    );

    const row = rows[0];
    if (row === undefined) {
      throw new Error('Guardar la cuenta del barbero no devolvió ninguna fila.');
    }
    return { ok: true, user: toAuthUser(row) };
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    if (code === UNIQUE_VIOLATION) {
      return { ok: false, reason: 'username_taken' };
    }
    throw error;
  }
}

/** Borra la cuenta de un barbero. false si no tenía ninguna. */
export async function deleteByBarber(barberId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    'DELETE FROM users WHERE barber_id = $1 RETURNING id',
    [barberId],
  );
  return rows.length > 0;
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
