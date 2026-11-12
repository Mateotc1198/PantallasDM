-- ============================================================================
-- Esquema de PantallasDM
--
-- Equivalente relacional de las "colecciones": 4 tablas.
--   barbers           quien atiende
--   reviews           reseñas de clientes
--   barber_schedules  la REGLA de horario (no las franjas una por una)
--   bookings          las citas reservadas
--
-- IDEMPOTENTE Y NO DESTRUCTIVO: se puede ejecutar en cada despliegue sin
-- perder datos. Para volver a cero en desarrollo existe db/reset.sql, que
-- es el unico archivo que borra.
-- ============================================================================

BEGIN;

-- Un ENUM y no un TEXT libre: la base rechaza cualquier estado inventado.
-- CREATE TYPE no admite IF NOT EXISTS, de ahi el bloque condicional.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('activa', 'cancelada');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- barbers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barbers (
  id             TEXT PRIMARY KEY,
  name           TEXT        NOT NULL,
  specialty      TEXT        NOT NULL,
  avatar_url     TEXT        NOT NULL,
  -- OBSOLETA: ya no se lee. El catalogo es global, asi que el numero de
  -- servicios se cuenta en la tabla services. La columna se conserva (en vez
  -- de un DROP) para que un despliegue no rompa a la version anterior del
  -- codigo mientras ambas conviven unos segundos.
  services_count SMALLINT    NOT NULL DEFAULT 0 CHECK (services_count >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

COMMENT ON TABLE barbers IS 'Barberos. El id es un slug legible, no un UUID, porque viaja en la URL.';

-- BORRADO LOGICO. Dar de baja a un barbero pone deleted_at; la fila se queda.
--
-- Borrarla de verdad tendria dos problemas. Sus citas pasadas la referencian
-- (ON DELETE RESTRICT) y son el historial del negocio. Y seed.sql se ejecuta
-- en cada arranque con ON CONFLICT DO NOTHING: una fila borrada de verdad
-- resucitaria sola en el siguiente despliegue.
--
-- Las bases que ya existian no pasan por el CREATE TABLE de arriba, de ahi el
-- ALTER idempotente.
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN barbers.deleted_at IS 'Momento de la baja. NULL = barbero activo.';

-- Dos barberos activos no pueden llamarse igual: el cliente no sabria a cual
-- esta reservando. Es PARCIAL para que el nombre de alguien dado de baja
-- quede libre y se pueda volver a usar.
CREATE UNIQUE INDEX IF NOT EXISTS barbers_nombre_unico
  ON barbers (lower(name))
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- barber_photos
--
-- La foto que el administrador sube desde la galeria del telefono.
--
-- Se guarda en la base y no en disco porque el servidor no tiene disco que
-- dure: en la nube cada despliegue arranca con el sistema de archivos limpio.
-- La alternativa era un servicio de almacenamiento externo, con su cuenta y
-- sus claves; para una barberia con un punado de barberos y fotos de unos
-- 50 KB, eso seria mas piezas que moverse que problema que resolver.
--
-- Va en una tabla aparte y no como columna de barbers para que listar los
-- barberos no arrastre los bytes de todas las fotos en cada consulta.
--
-- Los dos CHECK repiten lo que valida el codigo: aunque alguien inserte a
-- mano, aqui no entra ni un formato raro ni un archivo enorme.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_photos (
  barber_id    TEXT        PRIMARY KEY REFERENCES barbers(id) ON DELETE CASCADE,
  content      BYTEA       NOT NULL CHECK (octet_length(content) <= 307200),
  content_type TEXT        NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- reviews
--
-- rating y reviewsCount NO se guardan en barbers: se calculan agregando esta
-- tabla. Evita el bug clasico de desincronizacion (borras una reseña y el
-- promedio sigue mintiendo). Trade-off: un AVG() por lectura de detalle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   TEXT        NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  author_name TEXT        NOT NULL,
  comment     TEXT        NOT NULL,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Toda lectura de reseñas filtra por barbero.
CREATE INDEX IF NOT EXISTS reviews_barber_idx ON reviews (barber_id);

-- ---------------------------------------------------------------------------
-- barber_schedules
--
-- Guarda la REGLA, no cada franja. Almacenar cada horario de cada dia futuro
-- serian miles de filas que caducan solas. Aqui una fila dice "los martes
-- atiende de 9:00 a 19:30 en bloques de 30 min" y el servicio genera las
-- franjas al vuelo.
--
-- Ausencia de fila para un weekday = ese dia no atiende. Asi "domingo cerrado"
-- deja de ser codigo hardcodeado y pasa a ser dato.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS barber_schedules (
  barber_id     TEXT     NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  weekday       SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = domingo
  first_slot_at TIME     NOT NULL,
  last_slot_at  TIME     NOT NULL,
  slot_minutes  SMALLINT NOT NULL CHECK (slot_minutes > 0),

  PRIMARY KEY (barber_id, weekday),
  CONSTRAINT horario_coherente CHECK (first_slot_at <= last_slot_at)
);

COMMENT ON COLUMN barber_schedules.last_slot_at IS 'Hora de la ULTIMA franja reservable, no la hora de cierre.';

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id      TEXT           NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
  booking_date   DATE           NOT NULL,
  booking_time   TIME           NOT NULL,
  customer_name  TEXT           NOT NULL CHECK (char_length(trim(customer_name)) >= 3),
  customer_phone TEXT           NOT NULL CHECK (customer_phone ~ '^[0-9]{10}$'),
  status         booking_status NOT NULL DEFAULT 'activa',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  cancelled_at   TIMESTAMPTZ
);

-- ===========================================================================
-- EL constraint mas importante de todo el backend.
--
-- Validar en el servicio ("¿esta libre?" -> INSERT) NO basta: dos peticiones
-- simultaneas pasan ambas la validacion y reservan el mismo horario. Es una
-- condicion de carrera TOCTOU (time-of-check to time-of-use).
--
-- Este indice unico parcial hace que la segunda insercion falle siempre, a
-- nivel de motor. El servicio captura el error 23505 y responde 409.
-- Es PARCIAL (WHERE status = 'activa') para que cancelar una cita libere el
-- horario y se pueda volver a reservar.
-- ===========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unico
  ON bookings (barber_id, booking_date, booking_time)
  WHERE status = 'activa';

-- Soporta la consulta de disponibilidad: ocupados de un barbero en un dia.
CREATE INDEX IF NOT EXISTS bookings_barber_date_idx
  ON bookings (barber_id, booking_date)
  WHERE status = 'activa';

-- ---------------------------------------------------------------------------
-- users
--
-- Dos roles que se comportan distinto de verdad:
--   admin    gestiona toda la agenda de la barberia
--   barbero  entra al mismo panel, pero solo ve y cancela SUS citas
--
-- El CHECK amarra esa regla en la base y no solo en el codigo: un barbero
-- siempre esta ligado a su ficha, un admin nunca. Si alguien inserta mal una
-- fila, Postgres la rechaza. Misma filosofia que bookings_slot_unico.
--
-- Nunca se guarda la contraseña, solo su hash bcrypt.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'barbero');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Se guarda siempre en minusculas: el login no distingue mayusculas.
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL,
  barber_id     TEXT        REFERENCES barbers(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rol_coherente CHECK (
    (role = 'barbero' AND barber_id IS NOT NULL) OR
    (role = 'admin'   AND barber_id IS NULL)
  )
);

-- Un barbero no puede tener dos cuentas.
CREATE UNIQUE INDEX IF NOT EXISTS users_barbero_unico
  ON users (barber_id)
  WHERE barber_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- services
--
-- El catalogo de la barberia: lo que se ofrece y a que precio. Es global y no
-- por barbero porque el negocio vende los mismos servicios atienda quien
-- atienda; si manana eso cambia, se agrega una tabla de union y esta no se
-- toca.
--
-- NO tiene duracion. Seria la puerta de entrada a citas de duracion variable,
-- y todo el modelo de franjas (barber_schedules.slot_minutes, el indice unico
-- de bookings) asume bloques iguales. Añadir la columna sin cambiar eso seria
-- prometer algo que el sistema no cumple.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(trim(name)) >= 3),
  description TEXT        NOT NULL DEFAULT '',
  -- Entero y en pesos: el dinero nunca en coma flotante, y el peso colombiano
  -- no usa centavos en la practica.
  price_cop   INTEGER     NOT NULL CHECK (price_cop >= 0),
  category    TEXT        NOT NULL CHECK (char_length(trim(category)) >= 3),
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- La pantalla publica agrupa por categoria.
CREATE INDEX IF NOT EXISTS services_category_idx ON services (category);

-- Sin distinguir mayusculas: "Corte clasico" y "corte clasico" son el mismo
-- servicio escrito por dos personas distintas.
CREATE UNIQUE INDEX IF NOT EXISTS services_nombre_unico ON services (lower(name));

-- ---------------------------------------------------------------------------
-- El servicio de cada cita
--
-- Va aqui, al final, y no en el CREATE TABLE de bookings, porque referencia a
-- services y esa tabla se crea despues.
--
-- Se guardan TRES cosas y no solo el id, a proposito. service_name y
-- service_price_cop son una FOTO del servicio en el momento de reservar: lo
-- que el cliente acepto pagar. Si manana el administrador sube el precio o
-- borra el servicio del catalogo, la cita sigue diciendo lo que se acordo.
-- Con solo el id, editar el catalogo reescribiria el pasado.
--
-- service_id queda como referencia al catalogo vivo, y pasa a NULL si el
-- servicio se elimina (ON DELETE SET NULL): borrar del catalogo no puede
-- llevarse por delante las citas.
--
-- Las tres columnas admiten NULL: las citas anteriores a este cambio no
-- tienen servicio.
-- ---------------------------------------------------------------------------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_price_cop INTEGER CHECK (service_price_cop >= 0);

COMMIT;
