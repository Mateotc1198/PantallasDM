import express, { type Request, type RequestHandler } from 'express';

/**
 * Lectores del cuerpo JSON de las peticiones.
 *
 * Hay dos límites. El general es pequeño: ninguna petición de la API necesita
 * más de unos pocos KB, y un JSON gigante es una forma barata de ocupar el
 * proceso. El de las fotos es mayor porque crear o editar un barbero puede
 * llevar su foto en base64.
 */

/** Límite general: 10 KB. */
const leerJsonGeneral = express.json({ limit: '10kb' });

/**
 * Límite de las rutas con foto: 450 KB, lo justo para una imagen de 300 KB
 * en base64 más el resto de la ficha. El tamaño real de la imagen lo vuelve a
 * comprobar el servicio después de decodificarla.
 *
 * Se monta en las rutas, DESPUÉS de authenticate y authorize: así solo un
 * administrador consigue que el servidor lea un cuerpo de este tamaño. Si se
 * leyera antes, cualquiera sin sesión podría mandar 450 KB y hacer que el
 * servidor los procesara solo para responderle 401.
 */
export const leerJsonConFoto: RequestHandler = express.json({ limit: '450kb' });

/** POST /api/v1/barbers o /api/v1/services (con barra final o sin ella). */
const CREAR_CON_FOTO = /^\/api\/v1\/(barbers|services)\/?$/;

/**
 * PUT /api/v1/barbers/:id o /api/v1/services/:id, y nada por debajo: la
 * cuenta de acceso (/api/v1/barbers/:id/account) no lleva foto y sigue con el
 * límite general.
 */
const EDITAR_CON_FOTO = /^\/api\/v1\/(barbers|services)\/[^/]+\/?$/;

/** ¿Es una de las rutas que leen su cuerpo con leerJsonConFoto? */
export function llevaFoto(req: Request): boolean {
  return (
    (req.method === 'POST' && CREAR_CON_FOTO.test(req.path)) ||
    (req.method === 'PUT' && EDITAR_CON_FOTO.test(req.path))
  );
}

/**
 * Lector general para toda la aplicación, salvo las rutas con foto.
 *
 * Esas se saltan aquí para que su cuerpo lo lea después leerJsonConFoto. No
 * pueden leerse dos veces: el primer lector consume el cuerpo, y con el
 * límite de 10 KB una foto respondería 413 antes de llegar a su ruta.
 *
 * Se aplica a todo por defecto, en vez de montarse ruta por ruta, para que una
 * ruta nueva no pueda olvidarlo: lo que hay que acordarse de hacer es la
 * excepción, no la regla.
 */
export const leerJson: RequestHandler = (req, res, next) => {
  if (llevaFoto(req)) {
    next();
    return;
  }
  leerJsonGeneral(req, res, next);
};
