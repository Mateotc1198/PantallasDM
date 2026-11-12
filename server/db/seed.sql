-- ============================================================================
-- Datos iniciales. Se ejecuta despues de schema.sql.
--
-- IDEMPOTENTE: volver a ejecutarlo no duplica nada ni pisa datos existentes,
-- porque corre en cada despliegue junto al esquema.
--
-- Los mismos dos barberos que usa el frontend en src/data/barbers.ts, para
-- que al conectar la app los datos coincidan.
-- ============================================================================

BEGIN;

-- ON CONFLICT sin columna: salta la fila si choca con CUALQUIER restriccion
-- unica, no solo con el id. Desde que el panel permite editar barberos, otro
-- podria llevar ya uno de estos nombres (barbers_nombre_unico), y un seed que
-- falla tumba el arranque.
--
-- Como la baja es logica, un barbero de aqui que el administrador dio de baja
-- conserva su fila y este INSERT no lo resucita.
INSERT INTO barbers (id, name, specialty, avatar_url) VALUES
  ('luis-gomez',
   'Luis Gomez',
   'Especialista en fades y cortes modernos.',
   'https://i.pravatar.cc/240?img=12'),
  ('alexander-escobar',
   'Alexander Escobar',
   'Experto en barba y tratamientos de hidratación capilar.',
   'https://i.pravatar.cc/240?img=33')
ON CONFLICT DO NOTHING;

-- Las reseñas no tienen clave natural para un ON CONFLICT, asi que solo se
-- siembran cuando la tabla esta vacia. Si alguien ya dejo reseñas reales, no
-- se tocan.
INSERT INTO reviews (barber_id, author_name, comment, rating)
SELECT * FROM (VALUES
  ('luis-gomez',
   'Andrés Rojas',
   'El mejor fade que me han hecho. Quedó impecable y sin una sola línea dura.',
   5::smallint),
  ('luis-gomez',
   'Camilo Restrepo',
   'Puntual, conversador y muy preciso con la máquina. Vuelvo cada dos semanas.',
   5::smallint),
  ('alexander-escobar',
   'Julián Mejía',
   'Me arregló la barba con toalla caliente y aceite. Salí como nuevo.',
   5::smallint),
  ('alexander-escobar',
   'Santiago Duque',
   'Sabe exactamente qué tratamiento necesita cada tipo de pelo. Recomendado.',
   5::smallint)
) AS datos(barber_id, author_name, comment, rating)
WHERE NOT EXISTS (SELECT 1 FROM reviews);

-- Horario de atención: de 9:00 a 21:00, en bloques de 30 minutos.
--
-- last_slot_at es la última franja RESERVABLE, no la hora de cierre: la cita
-- de las 20:30 termina a las 21:00, que es cuando cierra el local. Son 24
-- franjas por día.
--
-- La mayoría de los barberos atiende los siete días. alexander-escobar
-- descansa el domingo, y eso se expresa por AUSENCIA de fila: no hay columna
-- "cerrado" ni bandera que mantener. El horario es dato por barbero, no una
-- constante de la barbería.
--
-- DO UPDATE y no DO NOTHING: este archivo se ejecuta en cada arranque, y con
-- DO NOTHING un cambio de horario nunca llegaría a las filas que ya existen.
-- La consecuencia es que esta tabla la gobierna el seed: editar un horario a
-- mano en la base se perdería en el siguiente despliegue.
INSERT INTO barber_schedules (barber_id, weekday, first_slot_at, last_slot_at, slot_minutes)
SELECT barbers.id, weekday, TIME '09:00', TIME '20:30', 30
FROM barbers
CROSS JOIN generate_series(0, 6) AS weekday
WHERE NOT (barbers.id = 'alexander-escobar' AND weekday = 0)
ON CONFLICT (barber_id, weekday) DO UPDATE
SET first_slot_at = EXCLUDED.first_slot_at,
    last_slot_at  = EXCLUDED.last_slot_at,
    slot_minutes  = EXCLUDED.slot_minutes;

-- Si un barbero dejó de atender un día, la fila vieja seguiría ahí: el
-- INSERT de arriba no borra lo que ya no genera. Este DELETE cierra el ciclo
-- y deja la tabla como reflejo exacto del seed.
DELETE FROM barber_schedules
WHERE barber_id = 'alexander-escobar' AND weekday = 0;

-- ---------------------------------------------------------------------------
-- Catalogo inicial.
--
-- A diferencia de los horarios, esto NO se sobreescribe en cada arranque: el
-- administrador edita los servicios desde el panel y seria absurdo que el
-- siguiente despliegue le deshiciera los cambios. Solo se siembran si la
-- tabla esta vacia.
-- ---------------------------------------------------------------------------
INSERT INTO services (name, description, price_cop, category)
SELECT * FROM (VALUES
  ('Corte clasico', 'Tijera y maquina, lavado y peinado.', 25000, 'Cortes'),
  ('Fade', 'Degradado a maquina con perfilado de contornos.', 30000, 'Cortes'),
  ('Corte + barba', 'El combo completo, con toalla caliente.', 42000, 'Cortes'),
  ('Arreglo de barba', 'Perfilado, recorte y aceite.', 20000, 'Barba'),
  ('Barba con toalla caliente', 'Vapor, afeitado al ras y balsamo.', 28000, 'Barba'),
  ('Color', 'Tinte completo con productos sin amoniaco.', 60000, 'Color y estilos'),
  ('Mechas', 'Iluminacion parcial y matizado.', 75000, 'Color y estilos')
) AS iniciales(name, description, price_cop, category)
WHERE NOT EXISTS (SELECT 1 FROM services);

COMMIT;
