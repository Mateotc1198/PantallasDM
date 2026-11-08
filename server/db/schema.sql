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
  services_count SMALLINT    NOT NULL DEFAULT 0 CHECK (services_count >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE barbers IS 'Barberos. El id es un slug legible, no un UUID, porque viaja en la URL.';

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

COMMIT;
