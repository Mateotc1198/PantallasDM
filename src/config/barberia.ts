/**
 * Datos de contacto de la barbería.
 *
 * Están aquí y no repartidos por las pantallas porque son el mismo dato
 * mostrado en tres sitios: el botón flotante del inicio, la pantalla de
 * contacto y el pie de página. Tenerlos sueltos garantiza que el día que
 * cambie el número, dos de los tres se queden con el viejo.
 *
 * No viven en la base de datos a propósito. El administrador edita barberos
 * y servicios porque cambian; la dirección de la barbería no, y una tabla
 * para tres cadenas de texto no se paga sola.
 *
 * TODO: reemplazar por los datos reales de la barbería antes de publicar.
 */
export const BARBERIA = {
  nombre: 'ZonaBarber',
  lema: 'El arte del corte perfecto.',
  /** Solo dígitos, con indicativo de país y sin el signo +. */
  whatsapp: '573001112233',
  telefonoVisible: '+57 300 111 2233',
  direccion: 'Cra. 45 #67-89, Medellín',
  horarioResumen: 'Todos los días, 9:00 am a 9:00 pm',
  instagram: 'https://instagram.com/zonabarber',
} as const;

/** Abre un chat de WhatsApp con la barbería, con el mensaje ya escrito. */
export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/${BARBERIA.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Abre WhatsApp sin destinatario para que el usuario elija a quién mandar.
 * Se usa para que el cliente se autoenvíe el código de su cita.
 */
export function enlaceWhatsAppLibre(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

/** Indicativo de Colombia: los teléfonos de las citas se guardan sin él. */
const INDICATIVO_PAIS = '57';

/**
 * Abre un chat de WhatsApp con un cliente, para avisarle de un cambio en su
 * cita. El teléfono es el de la reserva: diez dígitos, sin indicativo.
 */
export function enlaceWhatsAppCliente(telefono: string, mensaje: string): string {
  return `https://wa.me/${INDICATIVO_PAIS}${telefono}?text=${encodeURIComponent(mensaje)}`;
}
