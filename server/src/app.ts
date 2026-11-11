import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import v1Routes from './api/v1/routes/index.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

/**
 * Aplicación Express sin servidor HTTP.
 *
 * Se exporta la app y no un servidor escuchando para que los tests de
 * integración puedan montarla en memoria con supertest, sin ocupar un puerto.
 */
const app = express();

// No anunciar la tecnología del servidor: menos información para un atacante.
app.disable('x-powered-by');

/**
 * La API se sirve detrás del proxy inverso de Render. Sin esto, req.ip es la
 * IP del proxy en TODAS las peticiones y express-rate-limit mete a todos los
 * usuarios en el mismo cubo: una sola persona equivocándose de contraseña
 * dejaría a los demás sin poder entrar.
 *
 * Se confía en exactamente un salto, no en `true`. Confiar en toda la cadena
 * dejaría que un cliente falsificara X-Forwarded-For y esquivara el límite
 * rotando IPs inventadas; con 1, Express lee la entrada que escribió el proxy
 * de Render, que el cliente no controla.
 *
 * En local y en los tests no hay proxy, así que req.ip es la IP real del
 * socket y no hay nada en lo que confiar.
 */
app.set('trust proxy', env.isProduction ? 1 : false);

// Cabeceras de seguridad (CSP, nosniff, frameguard, etc.).
app.use(helmet());

// Lista blanca explícita. Sin orígenes configurados no se permite ninguno,
// en vez de abrir a "*" por comodidad.
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : false,
    methods: ['GET', 'POST', 'DELETE'],
  }),
);

// Límite de tamaño: un JSON gigante es una forma barata de tumbar el proceso.
app.use(express.json({ limit: '10kb' }));

/**
 * Sonda de salud. No forma parte del contrato de negocio: existe para el
 * healthcheck de Docker y para comprobar de un vistazo que el proceso vive.
 */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', version: 'v1' });
});

app.use('/api/v1', v1Routes);

// El orden importa: primero las rutas, después el 404, y el manejador de
// errores siempre al final.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
