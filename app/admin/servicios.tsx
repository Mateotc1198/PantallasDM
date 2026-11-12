import { CrudRow } from '../../src/components/CrudRow';
import { CrudScreen } from '../../src/components/CrudScreen';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/context/AuthContext';
import { createService, deleteService, getServices, updateService } from '../../src/data/services';
import { useAsync } from '../../src/hooks/useAsync';
import { useCrudForm } from '../../src/hooks/useCrudForm';
import type { Service, ServiceInput } from '../../src/types/api';
import { formatCop } from '../../src/utils/money';

/** Lo que hay en el formulario: todo texto, porque eso es lo que se teclea. */
interface Formulario {
  name: string;
  description: string;
  priceCop: string;
  category: string;
  imageUrl: string;
}

const FORMULARIO_VACIO: Formulario = {
  name: '',
  description: '',
  priceCop: '',
  category: '',
  imageUrl: '',
};

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
    imageUrl: servicio.imageUrl ?? '',
  };
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
  if (form.imageUrl.trim().length > 0 && !/^https?:\/\/\S+$/i.test(form.imageUrl.trim())) {
    return 'La imagen debe ser una URL que empiece por http.';
  }
  return null;
}

function aEntrada(form: Formulario): ServiceInput {
  const imagen = form.imageUrl.trim();
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    priceCop: Number(form.priceCop),
    category: form.category.trim(),
    // Cadena vacía no es una URL: hacia el servidor viaja null.
    imageUrl: imagen.length > 0 ? imagen : null,
  };
}

/**
 * Gestión del catálogo de servicios.
 *
 * La mecánica (abrir, validar, guardar, confirmar el borrado) y el armazón de
 * la pantalla son comunes a todo el panel y viven en useCrudForm y
 * CrudScreen. Aquí queda solo lo propio de un servicio: sus campos, sus
 * reglas y cómo se pinta en la lista.
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
          <FormField
            etiqueta="Imagen (opcional)"
            valor={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
            editable={editable}
            teclado="url"
            textoLibre={false}
            ayuda="URL que empiece por http. El servidor no aloja archivos."
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
          onEditar={() => crud.abrirEdicion(servicio)}
          onEliminar={() => crud.confirmarBorrado(servicio)}
          eliminando={crud.borrandoId === servicio.id}
        />
      ))}
    </CrudScreen>
  );
}
