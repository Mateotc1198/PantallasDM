# PantallasDM API

API REST de reservas de barbería. **Node + Express 5 + PostgreSQL**, TypeScript en modo `strict`.

Es el backend de la app móvil que vive en la raíz de este repo. Comparten el mismo contrato de tipos.

---

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para PostgreSQL)

## Puesta en marcha

```bash
cd server
npm install
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d          # levanta PostgreSQL 17 en el puerto 5434
npm run db:setup              # crea las tablas y carga los datos (ver aviso abajo)
npm run dev                   # http://localhost:3000
```

Comprobar que responde:

```bash
curl http://localhost:3000/health
```

> **`db:setup` no borra nada.** Crea lo que falte y siembra solo si está vacío,
> así se puede ejecutar en cada despliegue. Para volver a cero en desarrollo
> está `npm run db:reset`, que sí borra.

> **Puerto 5434, no 5432.** Los puertos 5432 y 5433 ya están ocupados por otros
> contenedores de esta máquina. Se cambia con `DB_PORT` en el `.env`.

---

## Ejecutar en otra máquina

Para presentar desde un PC distinto.

### Requisitos previos

- **Node.js 20 o superior** — `node -v`
- **Docker Desktop** — en Windows necesita WSL2 activado
- **Git**
- Postman (opcional, solo para la demo de la colección)

### Pasos

```bash
git clone https://github.com/marianamunozch/PantallasDM.git
cd PantallasDM
git checkout Develop

cd server
npm ci                        # instalación exacta desde el lockfile
copy .env.example .env        # Linux/Mac: cp .env.example .env

docker compose up -d          # espera a que diga "healthy"
npm run db:setup              # crea tablas y carga datos
npm run dev                   # http://localhost:3000
```

Comprobar en otra terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/barbers
```

Para los tests, una vez más:

```bash
npm run db:setup:test
npm test
```

### Hazlo el día antes, no el mismo día

La primera ejecución en una máquina nueva necesita internet y puede tardar:

| Qué | Cuánto |
| --- | --- |
| Docker Desktop: instalación + WSL2 | puede pedir **reiniciar el equipo** |
| `docker pull postgres:17-alpine` | **424 MB** |
| `npm ci` | 163 paquetes |

Una vez descargado todo queda en caché local y el día de la presentación
arranca sin internet. Pero si llegas en frío a un salón con wifi malo, no
arranca.

Para asegurar del todo, puedes llevar la imagen en un archivo:

```bash
docker save postgres:17-alpine -o postgres17.tar   # en tu PC
docker load -i postgres17.tar                      # en el otro
```

### Si el puerto está ocupado

Cambia **dos** valores en el `.env`, y que coincidan:

```
DB_PORT=5500
DATABASE_URL=postgresql://pantallasdm:pantallasdm_dev@localhost:5500/pantallasdm
DATABASE_URL_TEST=postgresql://pantallasdm:pantallasdm_dev@localhost:5500/pantallasdm_test
```

Después `docker compose down` y `docker compose up -d`.

### Plan B: sin Docker

Si Docker no coopera, sirve cualquier PostgreSQL 13 o superior: instalado en la
máquina, o uno en la nube como Neon o Supabase. Solo cambia `DATABASE_URL` en
el `.env` y crea a mano la base de tests. El resto del flujo es idéntico:
`npm run db:setup` hace las tablas y los datos.

### Checklist de dos minutos antes de presentar

- [ ] `docker ps` muestra `pantallasdm-db` como `healthy`
- [ ] `curl http://localhost:3000/health` responde `200`
- [ ] `npm test` pasa los 49 tests
- [ ] En Postman está **seleccionado** el environment (arriba a la derecha)

### Problemas típicos

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| `No se pudo conectar a PostgreSQL` | el contenedor no está arriba | `docker compose up -d` y esperar a `healthy` |
| `port is already allocated` | otro Postgres usa ese puerto | cambiar `DB_PORT` **y** `DATABASE_URL` |
| `Variables de entorno inválidas` | falta el `.env` | copiarlo de `.env.example` |
| `Falta DATABASE_URL_TEST` al testear | `.env` incompleto | copiar de nuevo `.env.example` |
| `npm ci` → *the operation was rejected by your operating system* | un proceso `node` o `esbuild` sigue vivo bloqueando `node_modules` | cerrar la terminal que corría `npm run dev` o `npm test` y reintentar |
| Postman devuelve `ECONNREFUSED` | la API no está corriendo | `npm run dev` |
| Postman da `409` al crear cita | esa franja ya se reservó en una corrida anterior | ejecutar la petición *Cancelar cita*, o `npm run db:setup` para reiniciar |

---

## Despliegue en Render

La infraestructura está declarada en [`render.yaml`](../render.yaml) en la raíz
del repositorio: base de datos y servicio web en un solo archivo versionado, en
vez de configuración hecha a mano en un panel que nadie puede reproducir.

### Pasos

1. Subir la rama `Develop` a GitHub con `render.yaml` incluido.
2. En Render: **New → Blueprint** → conectar el repositorio → rama `Develop`.
3. Render lee el archivo y propone crear `pantallasdm-db` y `pantallasdm-api`.
4. Cuando pida **`CORS_ORIGINS`**, dejarlo vacío por ahora (la app móvil no usa
   CORS; solo hace falta si se abre la app en Expo Web).
5. **Apply** y esperar el primer build.

El primer despliegue tarda varios minutos: instala dependencias, compila
TypeScript, aplica el esquema y arranca.

### Comprobar que quedó bien

```bash
curl https://<tu-servicio>.onrender.com/health
curl https://<tu-servicio>.onrender.com/api/v1/barbers
```

El segundo debe devolver los dos barberos. Si responde pero sin datos, el
`seed` no corrió: revisar los logs del servicio en Render.

### Qué hace cada pieza del blueprint

| Ajuste | Por qué |
| --- | --- |
| `rootDir: server` | El backend vive en una subcarpeta del repo |
| `npm ci --include=dev` | TypeScript es devDependency y Render pone `NODE_ENV=production`, que por defecto las omite. Sin esto no hay build. |
| `start:prod` | Aplica el esquema y luego arranca. El esquema es idempotente, así que repetirlo en cada despliegue no rompe nada. |
| `healthCheckPath: /health` | Render reinicia el servicio si deja de responder |
| `fromDatabase` | Render inyecta la cadena de conexión interna. Cero credenciales copiadas a mano. |
| `DATABASE_SSL=false` | La URL interna va por la red privada de Render y no necesita TLS. Desde fuera sí: poner `true`. |
| `JWT_SECRET` | **Secreto.** Generarlo con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` y pegarlo en Render como variable, nunca en el repositorio. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | **Secretas.** Cuenta de administrador que crea `users:seed` en el arranque. |
| `BARBERO_USERNAME` / `BARBERO_PASSWORD` / `BARBERO_BARBER_ID` | **Secretas.** Cuenta del barbero y la ficha que gestiona. |

### Dos cosas que te van a morder

**El plan gratuito duerme el servicio.** Tras un rato sin tráfico, la primera
petición tarda cerca de un minuto en responder mientras el contenedor vuelve a
levantarse. Antes de una demostración, abrir `/health` un par de minutos antes
para despertarlo.

**La base de datos gratuita caduca.** Render pone fecha de expiración a las
bases del plan gratuito. Anotar la fecha el día que se crea y, si cae antes de
la entrega, exportar los datos o crear una nueva.

### Migraciones

`npm run db:setup` es **no destructivo**: usa `CREATE TABLE IF NOT EXISTS` y
siembra con `ON CONFLICT DO NOTHING`. Se puede ejecutar en cada despliegue sin
perder datos.

`npm run db:reset` sí borra, y por eso vive en un archivo aparte
([`db/reset.sql`](db/reset.sql)). Es solo para desarrollo y tests.

---

## Endpoints

Todos bajo `/api/v1`.

| # | Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- | --- |
| 1 | `POST` | `/auth/login` | público | Devuelve un JWT |
| 2 | `GET` | `/auth/me` | autenticado | Identidad del dueño del token |
| 3 | `GET` | `/barbers` | público | Lista de barberos (sin reseñas) |
| 4 | `GET` | `/barbers/:id` | público | Detalle con reseñas |
| 5 | `GET` | `/barbers/:id/slots?date=` | público | Disponibilidad del día |
| 6 | `GET` | `/barbers/:id/availability?month=` | público | Días del mes con cupo |
| 7 | `GET` | `/bookings?date=&barberId=` | **admin · barbero** | Agenda del panel |
| 8 | `POST` | `/bookings` | público | Crear cita |
| 9 | `GET` | `/bookings/:id` | público | Consultar cita |
| 10 | `DELETE` | `/bookings/:id` | **admin · barbero** | Cancelar desde el panel |
| 11 | `POST` | `/bookings/:id/cancel` | cliente | Cancelar su propia cita |
| 12 | `POST` | `/bookings/:id/reschedule` | cliente | Aplazar su propia cita |
| 13 | `GET` | `/services` | público | Catálogo de servicios |
| 14 | `GET` | `/services/:id` | público | Detalle de un servicio |
| 15 | `POST` | `/services` | **admin** | Crear servicio |
| 16 | `PUT` | `/services/:id` | **admin** | Editar servicio |
| 17 | `DELETE` | `/services/:id` | **admin** | Eliminar servicio |
| 18 | `POST` | `/barbers` | **admin** | Crear barbero |
| 19 | `PUT` | `/barbers/:id` | **admin** | Editar ficha y foto |
| 20 | `DELETE` | `/barbers/:id` | **admin** | Dar de baja |
| 21 | `PUT` | `/barbers/:id/account` | **admin** | Dar o cambiar el acceso al panel |
| 22 | `DELETE` | `/barbers/:id/account` | **admin** | Quitar el acceso al panel |
| 23 | `GET` | `/users` | **admin** | Cuentas de acceso existentes |
| 24 | `GET` | `/barbers/:id/photo` | público | La foto subida de un barbero (imagen, no JSON) |

Fuera del contrato de negocio: `GET /health`, sonda de infraestructura.

### Quién puede qué

| Rol | Puede |
| --- | --- |
| Público (sin cuenta) | Ver barberos y disponibilidad, **reservar**, consultar su cita por el id |
| `barbero` | Todo lo anterior, más ver y cancelar **sus propias** citas |
| `admin` | Todo lo anterior, sobre **todas** las citas. Además gestiona el catálogo de servicios, la plantilla de barberos y sus cuentas de acceso |

Reservar es público a propósito: el cliente no necesita cuenta, igual que en el
diseño. Consultar una cita por su id también, porque es el recibo del cliente y
el UUID no es adivinable.

**El filtro `barberId` de la agenda no es seguridad.** Si lo manda un barbero,
el servidor lo ignora y fuerza el suyo: basta con cambiar un parámetro en la
petición para que un filtro de interfaz deje de proteger nada.

### Códigos HTTP

| Endpoint | Éxito | Errores posibles |
| --- | --- | --- |
| `POST /auth/login` | `200` | `400` `401` `429` `500` |
| `GET /auth/me` | `200` | `401` `500` |
| `GET /barbers` | `200` | `500` |
| `GET /barbers/:id` | `200` | `404` `500` |
| `GET /barbers/:id/slots` | `200` | `400` `404` `422` `500` |
| `GET /barbers/:id/availability` | `200` | `400` `404` `500` |
| `POST /bookings` | `201` + `Location` | `400` `404` `409` `422` `429` `500` |
| `GET /bookings` | `200` | `400` `401` `403` `500` |
| `GET /bookings/:id` | `200` | `400` `404` `500` |
| `DELETE /bookings/:id` | `204` | `400` `401` `403` `404` `409` `500` |
| `POST /bookings/:id/cancel` | `204` | `400` `403` `404` `409` `422` `429` `500` |
| `POST /bookings/:id/reschedule` | `200` | `400` `403` `404` `409` `422` `429` `500` |
| `GET /services` | `200` | `500` |
| `GET /services/:id` | `200` | `400` `404` `500` |
| `POST /services` | `201` + `Location` | `400` `401` `403` `409` `500` |
| `PUT /services/:id` | `200` | `400` `401` `403` `404` `409` `500` |
| `DELETE /services/:id` | `204` | `400` `401` `403` `404` `500` |
| `POST /barbers` | `201` + `Location` | `400` `401` `403` `409` `413` `500` |
| `PUT /barbers/:id` | `200` | `400` `401` `403` `404` `409` `413` `500` |
| `GET /barbers/:id/photo` | `200` (imagen) | `404` `500` |
| `DELETE /barbers/:id` | `204` | `401` `403` `404` `409` `500` |
| `PUT /barbers/:id/account` | `200` | `400` `401` `403` `404` `409` `500` |
| `DELETE /barbers/:id/account` | `204` | `401` `403` `404` `500` |
| `GET /users` | `200` | `401` `403` `500` |

### El catálogo de servicios

Fue el primer recurso con escritura completa desde el panel, y donde `admin` y
`barbero` dejan de valer lo mismo: el barbero tiene sesión válida y aun así
recibe `403`, porque el precio de un corte es una decisión del negocio y no de
quien lo ejecuta.

El precio se guarda como **entero en pesos**. El dinero no se representa en coma
flotante —0.1 + 0.2 no es 0.3— y el peso colombiano no usa centavos en la
práctica.

La tabla **no tiene columna de duración**, y es deliberado. Sería la puerta de
entrada a citas de duración variable, y todo el modelo de franjas
(`barber_schedules.slot_minutes`, el índice único de `bookings`) asume bloques
iguales. Añadir la columna sin cambiar eso prometería algo que el sistema no
cumple.

El nombre es único sin distinguir mayúsculas, y el duplicado lo rechaza el
índice `services_nombre_unico`, no una consulta previa: dos administradores
creando a la vez pasarían ambos un control hecho en el código.

A diferencia de los horarios, el seed **no sobrescribe** el catálogo en cada
arranque. Solo siembra si la tabla está vacía, porque aquí sí manda el
administrador: sería absurdo que un despliegue le deshiciera los precios.

### La foto de los barberos

La app sube la foto en base64 dentro del mismo `POST` o `PUT` del barbero, en
el campo `photo`. Antes de enviarla la recorta en cuadrado y la reduce a 512 px,
así que pesa unos 50 KB.

| Decisión | Por qué |
| --- | --- |
| Se guarda en la base (`barber_photos`), no en disco | En la nube cada despliegue arranca con el disco limpio. Un servicio externo como Cloudinary añadiría una cuenta y unas claves; para un puñado de fotos de 50 KB no compensa. |
| Tabla aparte, no columna de `barbers` | Listar barberos no arrastra los bytes de todas las fotos. |
| El formato se lee de los **bytes**, no del cliente | Solo se aceptan JPEG y PNG, reconocidos por su firma. Un SVG es texto que puede llevar un script y no entra, aunque llegue en base64 válido. |
| Máximo 300 KB, comprobado dos veces | En el servidor tras decodificar, y en la base con un `CHECK`. |
| El cuerpo grande se lee **después** de comprobar la sesión | Esas dos rutas admiten 450 KB; el resto de la API sigue en 10 KB. Si se leyera antes, cualquiera sin sesión podría hacer que el servidor procesara 450 KB para responderle 401. |
| La URL de la foto lleva `?v=` y caché de un año | La URL cambia en cada subida, así que el teléfono nunca enseña la foto vieja. |
| El dominio del avatar sale de la petición | La misma respuesta funciona en local, en la red de casa y en producción sin configurar nada. |

Editar sin `photo` ni `avatar` conserva la foto actual. Pasar a una URL externa
borra la foto subida. Si una versión anterior de la app reenvía la URL de la
propia foto del barbero, el servidor la reconoce y la conserva.

### La gestión de barberos

El administrador crea, edita y da de baja barberos. Escribe tres cosas: nombre,
especialidad y la foto, que puede **subir desde la galería** del teléfono o dar
como una URL `https`. Todo lo demás lo decide el servidor:

- **El id sale del nombre** (`Luis Gómez` → `luis-gomez`) y no cambia nunca,
  aunque el nombre se edite: viaja en URLs y lo referencian las citas. Si ese id
  ya está ocupado, se le añade un sufijo corto al azar.
- **Nace con horario**: los siete días de 9:00 a 21:00. El barbero y sus siete
  filas de `barber_schedules` se insertan en una sola sentencia, así que no
  puede quedar un barbero visible en la app que nadie pueda reservar.
- **La calificación y los conteos se calculan**, no se escriben. `servicesCount`
  cuenta el catálogo, que es global.

**La baja es lógica** (`deleted_at`), no un `DELETE`. Dos razones: las citas
pasadas referencian al barbero y son el historial del negocio, y el seed corre
en cada arranque, así que una fila borrada de verdad resucitaría en el siguiente
despliegue. Para el cliente un barbero dado de baja no existe: desaparece de la
lista, responde `404` y su cuenta ya no puede iniciar sesión.

**No se puede dar de baja a quien tiene citas activas de hoy en adelante**
(`409 BARBER_HAS_BOOKINGS`). Cada una es un compromiso con un cliente: el
administrador las cancela primero desde la agenda. La comprobación va dentro
del mismo `UPDATE` que da la baja, no en una consulta previa.

Los horarios **no** se editan desde el panel: los gobierna el seed.

### El servicio de la cita

`POST /bookings` acepta un `serviceId` opcional, y toda cita devuelve
`service` con `id`, `name` y `priceCop` (o `null` si se reservó sin servicio).

El nombre y el precio se guardan **como una foto** del servicio en el momento de
reservar, no como un enlace al catálogo. Es lo que el cliente aceptó pagar: si
el administrador sube el precio o elimina el servicio, la cita sigue diciendo lo
que se acordó. Al eliminar un servicio, `service.id` pasa a `null` y la cita
conserva nombre y precio.

El precio **nunca viene del cliente**: del servicio solo viaja el id, y el
`INSERT` copia nombre y precio de la tabla `services` en la misma sentencia. Esa
sentencia tampoco inserta nada si el servicio no existe (`404 SERVICE_NOT_FOUND`).

`serviceId` es opcional para no romperle la reserva a quien tenga instalada una
versión anterior de la app.

### Las cuentas de los barberos

El administrador le pone usuario y contraseña a cada barbero con
`PUT /barbers/:id/account`. Un barbero tiene como mucho una cuenta; repetir la
llamada reemplaza usuario y contraseña.

| Decisión | Por qué |
| --- | --- |
| Un usuario repetido es `409`, nunca un reemplazo | Si reemplazara, pedir el usuario `admin` para un barbero convertiría la cuenta del administrador en una de barbero. El conflicto que sí se resuelve actualizando es el de `barber_id`, no el de `username`. |
| El rol va escrito en la consulta | Por este endpoint no se puede crear un administrador, se mande lo que se mande en el cuerpo. |
| Contraseña de 8 a 72 caracteres | bcrypt ignora en silencio todo lo que pase de 72 bytes: aceptar más sería prometer una seguridad que no se da. |
| Ninguna respuesta lleva la contraseña ni su hash | El tipo que devuelve la API no los contiene. |

El script de cuentas iniciales (`users:seed`) sigue creando la cuenta de barbero
de las variables de entorno, pero **solo si no existe**: desde que el panel
gestiona las cuentas, lo que el administrador haya puesto ahí manda. La del
administrador sí se actualiza en cada arranque: es la única forma de cambiar su
contraseña.

### El cliente no tiene cuenta

Cancelar y aplazar los hace el propio cliente, que nunca se registra. Su
credencial son dos cosas a la vez: el **UUID de la cita**, que no se adivina
(122 bits de entropía) y que recibe al reservar, y el **teléfono** con el que
reservó.

El teléfono no sobra. Sin él, cualquiera que viera el código de reojo en una
pantalla, o lo recibiera reenviado, podría cancelarle la cita a otro. Con él,
hace falta además saber quién reservó. Se comprueba **antes** que el plazo, para
que un intento con el teléfono equivocado no revele a qué hora es la cita.

Va en el cuerpo y no en la URL a propósito: una query string acaba escrita en
los registros del servidor y en el historial de los proxies, y esto es un dato
personal.

Por eso son `POST` y no `DELETE`: necesitan cuerpo, y `DELETE` con cuerpo está
mal soportado por buena parte de los clientes HTTP.

### La hora es la de la barbería, no la del servidor

Las fechas y horas de este dominio son **civiles**: "el 14 a las 9:00" significa
las nueve en el local. Por eso "hoy" y "ahora" se calculan en la zona horaria
de la barbería (`BUSINESS_TIMEZONE`, por defecto `America/Bogota`) y no con el
reloj de la máquina.

No es un detalle teórico. El servidor de Render corre en UTC, cinco horas por
delante de Colombia, y con su reloj a pelo:

- a las 7:00 pm ya era "mañana", y se rechazaba reservar para hoy;
- las franjas de las cinco horas siguientes se daban por pasadas;
- el plazo de cambios de dos horas se convertía en siete.

La conversión usa `Intl`, no un desfase fijo de horas, así que también es
correcta en zonas con horario de verano. La zona se valida al arrancar: una
errata detiene el despliegue en vez de reventar en la primera petición.

### El plazo de cambios

`BOOKING_CHANGE_WINDOW_HOURS` (por defecto **2**) fija con cuánta antelación
puede el cliente tocar su cita. Pasado ese punto responde `422` con
`BOOKING_CHANGE_TOO_LATE`.

Es una regla de negocio, no una constante del programa: el barbero ya reservó
ese tiempo y no puede rellenarlo con diez minutos de aviso. Que sea variable de
entorno significa que la barbería puede pasar a 24 horas sin recompilar.

El plazo se mide siempre sobre la cita **actual**, no sobre la nueva: lo que hay
que respetar es el aviso a quien ya tenía ese hueco bloqueado.

Aplazar reutiliza el mismo índice único parcial que protege la creación: un
`UPDATE` hacia una franja ocupada choca contra `bookings_slot_unico` igual que
lo haría un `INSERT`. No hay consulta previa y, por tanto, no hay ventana entre
comprobar y mover.

La distinción entre los códigos de error no es decorativa:

| Código | Significa | Ejemplo real |
| --- | --- | --- |
| `400` | No entiendo la petición (**forma**) | `date=14-07-2026`, teléfono con letras |
| `401` | No sé quién eres | sin token, token manipulado o expirado |
| `403` | Sé quién eres y no te alcanza | un barbero cancelando una cita ajena |
| `404` | El recurso no existe | barbero o cita inexistente |
| `409` | Choca con el **estado actual** | ese horario ya está reservado |
| `422` | Te entiendo, pero viola una **regla** | fecha pasada, hora fuera del horario |
| `429` | Demasiadas peticiones | más de 10 reservas por minuto |
| `500` | Fallo nuestro | la base de datos no responde |

Consultar un día cerrado devuelve **`200` con lista vacía**, no un error: es una
pregunta válida cuya respuesta es "ninguno".

### Forma de las respuestas

Éxito: el recurso directo, sin envoltorios.

```json
{ "id": "luis-gomez", "name": "Luis Gomez", "rating": 5, "reviewsCount": 2 }
```

Error: siempre la misma forma, en los 6 endpoints.

```json
{
  "error": {
    "code": "BOOKING_SLOT_TAKEN",
    "message": "Ese horario ya está reservado.",
    "details": [{ "field": "time", "issue": "ocupado" }]
  }
}
```

`code` es estable y legible por máquina: el cliente hace `switch` sobre él,
nunca sobre `message`, que puede cambiar de redacción o de idioma.

El catálogo completo está en [`src/errors/codes.ts`](src/errors/codes.ts).

---

## Arquitectura

```
src/
├─ api/v1/          Capa HTTP: routes, controllers, dto (zod)
├─ services/        Reglas de negocio
├─ repositories/    Único lugar con SQL
├─ middleware/      Validación y manejo global de errores
├─ errors/          Jerarquía de errores de dominio
├─ config/          Entorno validado y pool de PostgreSQL
├─ types/api.ts     Contrato público (el mismo que el frontend)
└─ utils/           Lógica pura de fechas y horas
```

Reglas duras:

- El **controller** no sabe SQL ni reglas de negocio. Valida, llama al servicio, responde.
- El **service** no sabe de `req` ni `res`. No puede devolver un código HTTP.
- El **repository** no sabe de reglas de negocio ni de HTTP. Consulta y traduce filas.

**¿Por qué `services/` y `repositories/` están fuera de `api/v1/`?** Porque lo
que se versiona es el *contrato HTTP*, no la lógica de negocio. Cuando exista
una `v2` con otra forma de respuesta, reutilizará los mismos servicios y solo
cambiará la capa que traduce HTTP. Meter los servicios dentro de `v1/` obligaría
a duplicarlos el día de la `v2`.

---

## Modelo de datos

| Tabla | Para qué |
| --- | --- |
| `barbers` | Quién atiende |
| `reviews` | Reseñas de clientes |
| `barber_schedules` | La **regla** de horario por día de la semana |
| `bookings` | Las citas |

Tres decisiones que conviene entender:

**Las franjas horarias no se almacenan.** Guardar cada media hora de cada día
futuro serían miles de filas que caducan solas. `barber_schedules` guarda la
regla ("los martes de 9:00 a 20:30 en bloques de 30 min") y el servicio genera
las franjas al vuelo cruzándolas con las citas activas. `last_slot_at` es la
última franja reservable, no la hora de cierre: la cita de las 20:30 termina a
las 21:00, que es cuando cierra el local.

La ausencia de fila para un día significa que ese barbero no atiende ese día.
Así "Alexander descansa los domingos" es un dato y no código, y cada barbero
puede tener su propio horario sin tocar una sola línea.

**`rating` y `reviewsCount` no son columnas**, se agregan desde `reviews` con
`AVG` y `COUNT`. Evita que el promedio quede mintiendo al borrar una reseña.

**La doble reserva la impide la base de datos, no el código:**

```sql
CREATE UNIQUE INDEX bookings_slot_unico
  ON bookings (barber_id, booking_date, booking_time)
  WHERE status = 'activa';
```

Validar en el servicio (`¿está libre?` → `INSERT`) no basta: dos peticiones
simultáneas pasan ambas la comprobación y reservan lo mismo. Es una condición de
carrera **TOCTOU** (*time-of-check to time-of-use*). El índice único hace que la
segunda inserción falle siempre; el servicio captura el error `23505` de
Postgres y responde `409`. Es **parcial** (`WHERE status = 'activa'`) para que
cancelar una cita libere la franja.

---

## Postman

En [`postman/`](postman) hay dos archivos. Importa **los dos** y selecciona el
environment arriba a la derecha.

La colección se ejecuta entera de corrido con el Collection Runner:

- La fecha y el mes de prueba **se calculan solos** en cada ejecución (siempre
  futuros), así que la colección no caduca.
- `POST /bookings` **guarda el id** de la cita creada en una variable, y las
  peticiones siguientes lo reutilizan: no hay que copiar ids a mano.
- El login **guarda el token** en una variable y las peticiones protegidas lo
  usan como `Bearer`. Tampoco hay que copiar tokens a mano.
- Las 49 peticiones llevan tests que verifican código HTTP y forma de respuesta.

El environment se versiona con las **contraseñas vacías**: una contraseña
commiteada es una contraseña publicada. Rellena `adminPassword` y
`barberoPassword` en tu copia local antes de ejecutar la colección.

También se puede ejecutar sin abrir Postman:

```bash
npx newman run postman/PantallasDM.postman_collection.json \
                -e postman/PantallasDM.postman_environment.json
```

---

## Tests

```bash
npm run db:setup:test   # una sola vez: prepara la base aislada de tests
npm test
```

- **Unitarios** (`tests/unit/`): la lógica pura de horarios y de identificadores.
  Sin base de datos.
- **Integración** (`tests/integration/`): los 24 endpoints contra PostgreSQL real
  con supertest.

Corren contra `pantallasdm_test`, una base distinta de la de desarrollo: los
tests vacían tablas y hacerlo sobre datos reales sería inaceptable.

---

## Seguridad

| Riesgo | Mitigación |
| --- | --- |
| Inyección SQL | Consultas parametrizadas (`$1`, `$2`) siempre. Cero concatenación. |
| Secretos expuestos | Todo en `.env`, que está en `.gitignore`. `.env.example` no lleva valores reales. |
| Cabeceras inseguras | `helmet` |
| CORS abierto | Lista blanca por variable de entorno. Sin orígenes configurados no se permite ninguno, en vez de abrir a `*`. |
| Fuga de información | El `500` nunca devuelve stack ni mensajes de Postgres: se quedan en el log del servidor. |
| Spam de reservas | `express-rate-limit` en `POST /bookings`: 10 por minuto. |
| Payload gigante | `express.json({ limit: '10kb' })`. Solo las dos rutas que reciben la foto admiten 450 KB, y lo leen después de comprobar que quien llama es administrador. |

### Autenticación

JWT firmado con HS256 y contraseñas hasheadas con **bcrypt a 12 rondas**. La
contraseña en claro no se guarda nunca, ni siquiera en los logs.

| Decisión | Por qué |
| --- | --- |
| `bcryptjs` y no `bcrypt` | El nativo compila en el despliegue y puede reventar el build. El puro JavaScript es más lento, pero a nadie le importan 300 ms en un login. |
| 12 rondas | Caro para quien prueba millones de contraseñas, imperceptible para quien entra una vez. |
| Mensaje de error idéntico | Decir si falló el usuario o la contraseña le regala al atacante media respuesta. |
| Hash señuelo | Si el usuario no existe se compara igual contra un hash de relleno, para que el **tiempo** de respuesta no delate qué cuentas son válidas. |
| `JWT_SECRET` de 32+ caracteres, validado al arrancar | Un secreto corto se rompe por fuerza bruta y cualquiera podría fabricarse un token de admin. |
| Límite de 10 intentos por minuto en el login | Es la puerta por la que se prueban contraseñas. |
| Sin credenciales en el repositorio | Las cuentas se crean desde variables de entorno con `npm run users:seed`. Un hash commiteado sigue siendo una credencial publicada. |

**Contrapartida honesta del diseño stateless:** la identidad sale del propio
token y no se consulta la base en cada petición. Si a alguien se le cambia el
rol o se le borra la cuenta, su token sigue siendo válido hasta que expire (8 h
por defecto). La solución sería una lista de revocación; para este tamaño sería
sobreingeniería, y acortar la vigencia es el ajuste razonable.

---

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor con recarga en caliente |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta lo compilado |
| `npm run start:prod` | Aplica el esquema y arranca. Es lo que usa Render. |
| `npm run typecheck` | `tsc --noEmit` sobre `src/` y `tests/` |
| `npm run users:seed` | Crea o actualiza las cuentas desde las variables de entorno |
| `npm run db:setup` | Esquema + datos, **sin borrar nada**. Seguro en producción. |
| `npm run db:reset` | **Borra todo** y recrea. Solo desarrollo. |
| `npm run db:setup:test` | `db:setup` sobre la base de tests |
| `npm run db:reset:test` | `db:reset` sobre la base de tests |
| `npm test` | Suite completa |
| `npm run test:coverage` | Suite + reporte de cobertura |

## Conectar el frontend (pendiente)

El contrato de `src/types/api.ts` del backend es el mismo que el del frontend.
Para conectarlos solo cambia la implementación de `src/data/` en la app:

```ts
// hoy
export function getBarbers(): Barber[] {
  return BARBERS;
}

// mañana
export async function getBarbers(): Promise<BarberSummary[]> {
  const response = await fetch(`${API_URL}/api/v1/barbers`);
  if (!response.ok) throw new Error('No se pudieron cargar los barberos');
  return response.json() as Promise<BarberSummary[]>;
}
```

Las pantallas pasarán de `useMemo` a estados de carga y error, pero los tipos no
cambian.
