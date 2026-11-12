# ZONABARBER

[![CI](https://github.com/Mateotc1198/PantallasDM/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Mateotc1198/PantallasDM/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Mateotc1198_PantallasDM&metric=alert_status)](https://sonarcloud.io/project/overview?id=Mateotc1198_PantallasDM)
[![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=Mateotc1198_PantallasDM&metric=coverage)](https://sonarcloud.io/project/overview?id=Mateotc1198_PantallasDM)

Sistema de reservas para barbería: aplicación móvil + API REST + base de datos.

Proyecto final de Desarrollo de Dispositivos Móviles.

---

## Entrega

| Qué | Dónde |
| --- | --- |
| API desplegada | <https://pantallasdm-api.onrender.com/health> |
| APK de Android | [Releases de este repositorio](https://github.com/marianamunozch/PantallasDM/releases) |
| Análisis de calidad y cobertura | [SonarQube Cloud](https://sonarcloud.io/project/overview?id=Mateotc1198_PantallasDM) |
| Integración continua | [GitHub Actions](https://github.com/Mateotc1198/PantallasDM/actions/workflows/ci.yml) |
| Colección de Postman | [`server/postman/`](server/postman) |

> **La primera petición tarda unos 20 segundos.** El plan gratuito de Render
> duerme el servicio tras un rato sin tráfico. La app lo avisa en pantalla
> ("El servidor estaba inactivo y está despertando") en vez de quedarse en
> blanco.

> **El CI y Sonar corren en un fork.** Este repositorio es el de la entrega; las
> ejecuciones de GitHub Actions, el análisis de Sonar y el despliegue en Render
> salen de [`Mateotc1198/PantallasDM`](https://github.com/Mateotc1198/PantallasDM),
> que se sincroniza con `Develop` y `main` de este después de cada Pull Request.

Las credenciales del panel de administración no están en el repositorio: se
entregan aparte.

## Qué resuelve

Reservar un turno en una barbería hoy significa llamar, escribir por WhatsApp y
esperar a que alguien confirme. El cliente no sabe qué horas están libres y el
barbero pierde tiempo coordinando por chat.

ZONABARBER deja al cliente elegir barbero, día y hora en menos de un minuto,
viendo la disponibilidad real, y le da a la barbería un panel para gestionar la
agenda, la plantilla de barberos y el catálogo de servicios.

## Qué hace

**El cliente, sin crear cuenta:**

- Reserva en seis pasos: barbero, perfil y reseñas, servicio, día, hora y sus datos.
- Solo ve los días y las horas que de verdad están libres.
- Consulta su cita, la **aplaza** o la **cancela**, hasta dos horas antes.
- Ve el catálogo de servicios con precios e imágenes, y los datos de contacto.
- Elige tema oscuro o claro; la app recuerda la elección.

**El panel, con inicio de sesión:**

| Rol | Puede |
| --- | --- |
| `barbero` | Ver, cancelar y marcar como atendidas o "no vino" **sus propias** citas |
| `admin` | Ver, cancelar y marcar **todas** las citas; crear, editar y dar de baja barberos, con su foto desde la galería, y darles acceso al panel; crear, editar y eliminar servicios, también con su imagen desde la galería |

**Reglas de negocio que el servidor hace cumplir:**

- Dos personas no pueden reservar la misma franja, ni siquiera a la vez: lo
  impide un índice único en la base de datos, no una comprobación previa.
- No se reserva en el pasado, ni fuera del horario del barbero, ni en un día
  que no atiende.
- El cliente solo cambia su cita con el teléfono con el que la reservó, y no
  cuando faltan menos de dos horas.
- Un barbero solo ve y cancela su agenda, aunque manipule la petición.
- No se da de baja a un barbero con citas activas pendientes.
- Una cita se marca como atendida o "no vino" solo cuando ya llegó su hora, y
  una vez cerrada ya no se puede cancelar ni aplazar.
- El precio de una cita es el del catálogo en el momento de reservar: lo pone el
  servidor, y cambiar el catálogo después no altera las citas ya hechas.

## Estructura del repositorio

```
.
├── app/            Pantallas de la app móvil (expo-router, rutas por archivo)
├── src/            Componentes, estado, tipos y capa de datos del frontend
├── __tests__/      Pruebas de la app
├── server/         API REST + base de datos  ← tiene su propio README
├── assets/         Iconos y splash
├── .github/        Integración continua
└── render.yaml     Infraestructura del despliegue
```

| Capa | Tecnología |
| --- | --- |
| Móvil | React Native · Expo SDK 58 · expo-router · TypeScript strict |
| API | Node · Express 5 · TypeScript strict · zod |
| Base de datos | PostgreSQL 17 |
| Seguridad | JWT · bcrypt · helmet · límite de peticiones |
| Pruebas | Jest · Testing Library · Vitest · Supertest · Postman |
| Calidad | ESLint · SonarQube Cloud · GitHub Actions |
| Despliegue | Render (API y base de datos) · EAS Build (APK) |

El backend está organizado por capas: rutas → controladores → servicios →
repositorios. El detalle está en [`server/README.md`](server/README.md).

## Arrancar el proyecto

### App móvil

```bash
npm install
npx expo start
```

Escanear el QR con Expo Go. Recién clonada, la app habla con la API desplegada:
no hace falta levantar el backend para probarla. Para apuntarla a un backend
local, ver [`.env.example`](.env.example).

### API y base de datos

El backend tiene su guía completa en **[`server/README.md`](server/README.md)**:
puesta en marcha, endpoints, códigos HTTP, modelo de datos, Postman, tests y
cómo levantarlo en otra máquina.

Resumen:

```bash
cd server
npm install
cp .env.example .env
docker compose up -d
npm run db:setup
npm run dev
```

## La API

Veintiséis endpoints bajo `/api/v1`. La tabla completa, con quién puede usar cada
uno y sus códigos HTTP, está en [`server/README.md`](server/README.md#endpoints).

| Recurso | Qué ofrece | Acceso |
| --- | --- | --- |
| `/auth` | Iniciar sesión y consultar la identidad | público / autenticado |
| `/barbers` | Lista, detalle, foto, disponibilidad por día y por mes | público |
| `/barbers` | Crear, editar (con foto subida o por URL), dar de baja y gestionar su cuenta de acceso | **admin** |
| `/users` | Cuentas de acceso existentes | **admin** |
| `/bookings` | Reservar, consultar, aplazar y cancelar la propia cita | público |
| `/bookings` | Agenda del panel, cancelación y marcar atendida o "no vino" | **admin · barbero** |
| `/services` | Catálogo, con la imagen de cada servicio | público |
| `/services` | Crear, editar y eliminar | **admin** |

## Pruebas y calidad

```bash
npm test                    # app
cd server && npm test       # API (necesita la base de datos de pruebas)
```

| | Pruebas | Qué cubren |
| --- | --- | --- |
| App | 451 | Pantallas, componentes, navegación, sesión y capa de datos |
| API | 325 | Los 26 endpoints contra PostgreSQL real, roles y reglas de negocio |
| Postman | 55 peticiones | El flujo completo, ejecutable de corrido |

En cada cambio, GitHub Actions ejecuta el lint, la comprobación de tipos y las
pruebas de la app y de la API, compila el bundle de Android y envía la cobertura
a SonarQube Cloud. El informe es público en el enlace de arriba.

## Flujo del repositorio

Ramas por funcionalidad, un Pull Request por rama hacia `Develop`, y de ahí a
`main`. Los commits siguen el formato
[Conventional Commits](https://www.conventionalcommits.org/es/).
