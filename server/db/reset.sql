-- ============================================================================
-- SOLO DESARROLLO Y TESTS. Este archivo BORRA todo.
--
-- Existe separado de schema.sql a proposito: schema.sql se ejecuta en cada
-- despliegue a produccion y nunca debe destruir datos. Si algun dia alguien
-- ejecuta esto contra la base real, al menos tuvo que escribirlo aparte.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS barber_schedules CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TYPE  IF EXISTS booking_status;
DROP TYPE  IF EXISTS user_role;

COMMIT;
