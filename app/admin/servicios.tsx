import { CrudRow } from '../../src/components/CrudRow';
import { CrudScreen } from '../../src/components/CrudScreen';
import { FormField } from '../../src/components/FormField';
import { PhotoField } from '../../src/components/PhotoField';
import { ServiceThumb } from '../../src/components/ServiceThumb';
import { useAuth } from '../../src/context/AuthContext';
import { createService, deleteService, getServices, updateService } from '../../src/data/services';
import { useAsync } from '../../src/hooks/useAsync';
import { useCrudForm } from '../../src/hooks/useCrudForm';
import type { FotoElegida } from '../../src/media/photoPicker';
import type { Service, ServiceInput } from '../../src/types/api';
import { formatCop } from '../../src/utils/money';

/**
 * Lo que hay en el formulario.
 *
 * Los campos que se teclean son texto. La imagen puede venir de la galería o
 * de una URL, y gana lo último que se usa; además, como es opcional, se puede
 * quitar.
 */
interface Formulario {
  name: string;
  description: string;
  priceCop: string;
  category: string;
  /** URL nueva escrita a mano. Vacía = no se cambia por URL. */
  imageUrl: string;
  /** Imagen nueva de la galería, pendiente de subir. */
  foto: FotoElegida | null;
  /** La imagen que el servicio ya tiene, solo para enseñarla. */
  imagenActual: string | null;
  /** Se pidió quitar la imagen actual. */
  quitar: boolean;
}

const FORMULARIO_VACIO: Formulario = {
  name: '',
  description: '',
  priceCop: '',
  category: '',
  imageUrl: '',
  foto: null,
  imagenActual: null,
  quitar: false,
};

/** Una dirección https sin espacios. La misma regla que aplica el servidor. */
const URL_HTTPS = /^https:\/\/\S+$/i;

const TEXTOS = {
  titulo: 'Catálogo',
  agregar: 'Agregar un servicio',
  tituloNuevo: 'Nuevo servicio',
  botonCrear: 'Crear servicio',
  tituloEditar: 'Editar servicio',
  cargando: 'Cargando el catálogo...',
  vacio: 'El catálogo está vacío.',
  vacioDetalle: 'Crea el primer servicio con el botón Nuevo.',
};

function aFormulario(servicio: Service): Formulario {
  return {
    name: servicio.name,
    description: servicio.description,
    priceCop: String(servicio.priceCop),
    category: servicio.category,
    // El campo de URL es para una NUEVA: empieza vacío. Si se llenara con la
    // actual, guardar sin tocar nada la mandaría de vuelta.
    imageUrl: '',
    foto: null,
    imagenActual: servicio.imageUrl,
    quitar: false,
  };
}

/** Lo que se enseña en el cuadro de la imagen: lo último que se eligió. */
function vistaPreviaDe(form: Formulario): string | null {
  if (form.foto !== null) {
    return form.foto.uri;
  }
  const url = form.imageUrl.trim();
  if (URL_HTTPS.test(url)) {
    return url;
  }
  return form.quitar ? null : form.imagenActual;
}

/**
 * Validación del lado del cliente.
 *
 * Repite las reglas del DTO de zod a propósito, y eso no es duplicación
 * ociosa: el servidor valida porque no puede fiarse de nadie, y el cliente
 * valida para no obligar al usuario a esperar un viaje de red completo para
 * enterarse de que escribió mal el precio. La del servidor sigue mandando.
 */
function validar(form: Formulario): string | null {
  if (form.name.trim().length < 3) {
    return 'El nombre debe tener al menos 3 caracteres.';
  }
  if (form.category.trim().length < 3) {
    return 'La categoría debe tener al menos 3 caracteres.';
  }
  const precio = Number(form.priceCop);
  if (!Number.isInteger(precio) || precio < 0) {
    return 'El precio debe ser un número entero de pesos.';
  }
  const url = form.imageUrl.trim();
  if (url.length > 0 && !URL_HTTPS.test(url)) {
    return 'La URL de la imagen debe empezar por https://';
  }
  return null;
}

/**
 * Lo que viaja a la API. De la imagen va como mucho una cosa: la de la
 * galería, la URL nueva, null para quitarla, o nada, y entonces el servidor
 * conserva la que había.
 */
function aEntrada(form: Formulario): ServiceInput {
  const datos = {
    name: form.name.trim(),
    description: form.description.trim(),
    priceCop: Number(form.priceCop),
    category: form.category.trim(),
  };
  const url = form.imageUrl.trim();

  if (form.foto !== null) {
    return { ...datos, photo: form.foto.base64 };
  }
  if (url.length > 0) {
    return { ...datos, imageUrl: url };
  }
  if (form.quitar && form.imagenActual !== null) {
    return { ...datos, imageUrl: null };
  }
  return datos;
}

/**
 * Gestión del catálogo de servicios.
 *
 * La mecánica (abrir, validar, guardar, confirmar el borrado) y el armazón de
 * la pantalla son comunes a todo el panel y viven en useCrudForm y
 * CrudScreen. Aquí queda solo lo propio de un servicio: sus campos, sus
 * reglas, su imagen y cómo se pinta en la lista.
 */
export default function AdminServiciosScreen() {
  const { user } = useAuth();

  const catalogo = useAsync(() => getServices(), [], user !== null);

  const crud = useCrudForm<Service, Formulario>({
    vacio: FORMULARIO_VACIO,
    aFormulario,
    validar,
    guardar: (id, form) =>
      id === null ? createService(aEntrada(form)) : updateService(id, aEntrada(form)),
    borrar: deleteService,
    alCambiar: catalogo.reload,
    textosDeBorrado: (servicio) => ({
      titulo: 'Eliminar servicio',
      mensaje: `Se eliminará "${servicio.name}" del catálogo. Esta acción no se puede deshacer.`,
      aceptar: 'Sí, eliminar',
      tituloFallo: 'No se pudo eliminar',
    }),
  });

  const { form, setForm } = crud;
  const editable = !crud.guardando;
  const servicios = catalogo.data ?? [];

  return (
    <CrudScreen
      textos={TEXTOS}
      crud={crud}
      lista={catalogo}
      total={servicios.length}
      iconoVacio="cut-outline"
      campos={
        <>
          <FormField
            etiqueta="Nombre"
            valor={form.name}
            onChange={(name) => setForm({ ...form, name })}
            editable={editable}
          />
          <FormField
            etiqueta="Categoría"
            valor={form.category}
            onChange={(category) => setForm({ ...form, category })}
            editable={editable}
            ayuda="Cortes, Barba, Color y estilos... o una nueva."
          />
          <FormField
            etiqueta="Precio en pesos"
            valor={form.priceCop}
            onChange={(priceCop) => setForm({ ...form, priceCop: priceCop.replace(/\D/g, '') })}
            editable={editable}
            teclado="number-pad"
          />
          <FormField
            etiqueta="Descripción"
            valor={form.description}
            onChange={(description) => setForm({ ...form, description })}
            editable={editable}
            multilinea
          />
          <PhotoField
            etiqueta="Imagen (opcional)"
            forma="cuadrado"
            iconoVacio="image-outline"
            vistaPrevia={vistaPreviaDe(form)}
            hayFotoNueva={form.foto !== null}
            tieneFotoActual={form.imagenActual !== null && !form.quitar}
            editable={editable}
            // Con función: la galería tarda, y lo escrito mientras tanto no
            // se pierde.
            onElegida={(foto) =>
              setForm((actual) => ({ ...actual, foto, imageUrl: '', quitar: false }))
            }
            onQuitar={() =>
              setForm((actual) => ({ ...actual, foto: null, imageUrl: '', quitar: true }))
            }
          />
          <FormField
            etiqueta="O pega la URL de una imagen"
            valor={form.imageUrl}
            onChange={(imageUrl) =>
              setForm((actual) => {
                const escrita = imageUrl.trim().length > 0;
                return {
                  ...actual,
                  imageUrl,
                  // Escribir una URL descarta la imagen elegida y deshace "quitar".
                  foto: escrita ? null : actual.foto,
                  quitar: escrita ? false : actual.quitar,
                };
              })
            }
            editable={editable}
            teclado="url"
            textoLibre={false}
            ayuda="Opcional. Debe empezar por https://"
          />
        </>
      }
    >
      {servicios.map((servicio) => (
        <CrudRow
          key={servicio.id}
          nombre={servicio.name}
          detalle={servicio.category}
          valor={formatCop(servicio.priceCop)}
          inicio={
            servicio.imageUrl !== null ? (
              <ServiceThumb uri={servicio.imageUrl} nombre={servicio.name} size={48} />
            ) : undefined
          }
          onEditar={() => crud.abrirEdicion(servicio)}
          onEliminar={() => crud.confirmarBorrado(servicio)}
          eliminando={crud.borrandoId === servicio.id}
        />
      ))}
    </CrudScreen>
  );
}
