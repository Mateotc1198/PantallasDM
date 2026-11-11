-- Se ejecuta una sola vez, cuando el volumen de Postgres esta vacio.
-- Crea la base aislada que usan los tests de integracion, para que nunca
-- toquen los datos de desarrollo.
CREATE DATABASE pantallasdm_test OWNER pantallasdm;
