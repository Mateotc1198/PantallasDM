import * as client from '../../src/api/client';
import { login, me } from '../../src/data/auth';
import {
  createBarber,
  deleteBarber,
  getBarberById,
  getBarbers,
  updateBarber,
} from '../../src/data/barbers';
import {
  cancelBooking,
  cancelBookingAsCustomer,
  createBooking,
  getAgenda,
  getBooking,
  rescheduleBooking,
} from '../../src/data/bookings';
import { createService, deleteService, getServices, updateService } from '../../src/data/services';
import { getMonthAvailability, getSlots } from '../../src/data/slots';

/**
 * La capa de datos es la frontera entre las pantallas y la API. Lo que se
 * comprueba aquí es el contrato: a qué ruta va cada función, con qué método
 * y con qué cuerpo. Si alguien cambia una ruta sin querer, esto lo detecta
 * sin necesidad de levantar un servidor.
 */
jest.mock('../../src/api/client');

const api = jest.mocked(client);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('barberos', () => {
  it('getBarbers pide la lista', async () => {
    await getBarbers();

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/barbers');
  });

  it('getBarberById pide el detalle de ese barbero', async () => {
    await getBarberById('luis-gomez');

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/barbers/luis-gomez');
  });

  it('codifica el id: un valor con barra no puede cambiar la ruta', async () => {
    await getBarberById('a/b c');

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/barbers/a%2Fb%20c');
  });

  describe('gestión desde el panel', () => {
    const ficha = {
      name: 'Camila Ortiz',
      specialty: 'Colorimetría.',
      avatar: 'https://ejemplo.com/camila.png',
    };

    it('createBarber usa POST y no manda id: lo pone el servidor', async () => {
      await createBarber(ficha);

      expect(api.apiPost).toHaveBeenCalledWith('/api/v1/barbers', ficha);
    });

    it('updateBarber usa PUT con la ficha completa', async () => {
      await updateBarber('luis-gomez', ficha);

      expect(api.apiPut).toHaveBeenCalledWith('/api/v1/barbers/luis-gomez', ficha);
    });

    it('deleteBarber usa DELETE', async () => {
      await deleteBarber('luis-gomez');

      expect(api.apiDelete).toHaveBeenCalledWith('/api/v1/barbers/luis-gomez');
    });

    it('codifica el id también al escribir', async () => {
      await deleteBarber('a/b');

      expect(api.apiDelete).toHaveBeenCalledWith('/api/v1/barbers/a%2Fb');
    });
  });
});

describe('disponibilidad', () => {
  it('getSlots manda la fecha como parámetro de consulta', async () => {
    await getSlots('luis-gomez', '2026-12-01');

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/barbers/luis-gomez/slots', {
      date: '2026-12-01',
    });
  });

  it('getMonthAvailability manda el mes, no un día', async () => {
    await getMonthAvailability('luis-gomez', '2026-12');

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/barbers/luis-gomez/availability', {
      month: '2026-12',
    });
  });
});

describe('citas', () => {
  const entrada = {
    barberId: 'luis-gomez',
    date: '2026-12-01',
    time: '10:00',
    customerName: 'Cliente Prueba',
    customerPhone: '3000000000',
  };

  it('createBooking envía la cita completa por POST', async () => {
    await createBooking(entrada);

    expect(api.apiPost).toHaveBeenCalledWith('/api/v1/bookings', entrada);
  });

  it('getBooking consulta por id', async () => {
    await getBooking('abc-123');

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/bookings/abc-123');
  });

  it('getAgenda pasa los dos filtros', async () => {
    await getAgenda({ date: '2026-12-01', barberId: 'luis-gomez' });

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/bookings', {
      date: '2026-12-01',
      barberId: 'luis-gomez',
    });
  });

  it('getAgenda sin barbero deja ese filtro sin definir', async () => {
    await getAgenda({ date: '2026-12-01' });

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/bookings', {
      date: '2026-12-01',
      barberId: undefined,
    });
  });

  it('cancelBooking (panel) usa DELETE', async () => {
    await cancelBooking('abc-123');

    expect(api.apiDelete).toHaveBeenCalledWith('/api/v1/bookings/abc-123');
  });

  it('cancelBookingAsCustomer manda el teléfono en el CUERPO, no en la URL', async () => {
    await cancelBookingAsCustomer('abc-123', '3000000000');

    // Una query string acaba escrita en los registros del servidor.
    expect(api.apiPost).toHaveBeenCalledWith('/api/v1/bookings/abc-123/cancel', {
      customerPhone: '3000000000',
    });
  });

  it('rescheduleBooking manda teléfono, fecha y hora nuevas', async () => {
    await rescheduleBooking('abc-123', '3000000000', '2026-12-02', '15:00');

    expect(api.apiPost).toHaveBeenCalledWith('/api/v1/bookings/abc-123/reschedule', {
      customerPhone: '3000000000',
      date: '2026-12-02',
      time: '15:00',
    });
  });
});

describe('servicios', () => {
  const servicio = {
    name: 'Fade',
    description: 'Degradado.',
    priceCop: 30000,
    category: 'Cortes',
    imageUrl: null,
  };

  it('getServices pide el catálogo', async () => {
    await getServices();

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/services');
  });

  it('createService usa POST', async () => {
    await createService(servicio);

    expect(api.apiPost).toHaveBeenCalledWith('/api/v1/services', servicio);
  });

  it('updateService usa PUT con el servicio completo', async () => {
    await updateService('id-1', servicio);

    expect(api.apiPut).toHaveBeenCalledWith('/api/v1/services/id-1', servicio);
  });

  it('deleteService usa DELETE', async () => {
    await deleteService('id-1');

    expect(api.apiDelete).toHaveBeenCalledWith('/api/v1/services/id-1');
  });
});

describe('autenticación', () => {
  it('login envía usuario y contraseña por POST', async () => {
    await login('admin', 'una-clave');

    expect(api.apiPost).toHaveBeenCalledWith('/api/v1/auth/login', {
      username: 'admin',
      password: 'una-clave',
    });
  });

  it('me consulta la identidad del token', async () => {
    await me();

    expect(api.apiGet).toHaveBeenCalledWith('/api/v1/auth/me');
  });
});
