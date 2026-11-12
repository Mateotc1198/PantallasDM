import { screen, userEvent } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';

import { ApiError } from '../../src/api/client';
import { AdminHeader } from '../../src/components/AdminHeader';
import { Avatar } from '../../src/components/Avatar';
import { BarberChip } from '../../src/components/BarberChip';
import { BookingRow } from '../../src/components/BookingRow';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { FooterCta } from '../../src/components/FooterCta';
import { LoadingState } from '../../src/components/LoadingState';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SlotChip } from '../../src/components/SlotChip';
import { StepHeader } from '../../src/components/StepHeader';
import { SummaryRow } from '../../src/components/SummaryRow';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { TopBar } from '../../src/components/TopBar';
import type { AuthUser, BarberSummary, Booking, Slot } from '../../src/types/api';
import { renderApp } from '../helpers/render';
import { reiniciarRouter, router, usePathname } from '../helpers/router';

jest.mock('expo-router', () => require('../helpers/router').expoRouterMock);

const barbero: BarberSummary = {
  id: 'luis-gomez',
  name: 'Luis Gomez',
  specialty: 'Fades',
  avatar: 'https://ejemplo.com/luis.png',
  rating: 5,
  reviewsCount: 2,
  servicesCount: 3,
};

const cita: Booking = {
  id: 'abc-123',
  barberId: 'luis-gomez',
  date: '2026-12-01',
  time: '09:00',
  customerName: 'Cliente Prueba',
  customerPhone: '3000000000',
  status: 'activa',
  service: { id: 's1', name: 'Fade', priceCop: 30000 },
  createdAt: '2026-11-10T10:00:00.000Z',
};

beforeEach(() => {
  reiniciarRouter();
});

describe('PrimaryButton', () => {
  it('ejecuta la acción al pulsarlo', async () => {
    const alPulsar = jest.fn();
    await renderApp(<PrimaryButton label="Confirmar cita" onPress={alPulsar} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Confirmar cita' }));

    expect(alPulsar).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado no ejecuta nada y lo anuncia', async () => {
    const alPulsar = jest.fn();
    await renderApp(<PrimaryButton label="Confirmar cita" onPress={alPulsar} disabled />);
    const boton = screen.getByRole('button', { name: 'Confirmar cita' });

    await userEvent.setup().press(boton);

    expect(alPulsar).not.toHaveBeenCalled();
    expect(boton).toBeDisabled();
  });

  it('mientras carga cambia el texto, se bloquea y se anuncia ocupado', async () => {
    // Bloquearlo evita la doble reserva por un segundo toque impaciente.
    const alPulsar = jest.fn();
    await renderApp(
      <PrimaryButton label="Confirmar cita" loadingLabel="Reservando..." loading onPress={alPulsar} />,
    );
    const boton = screen.getByRole('button', { name: 'Reservando...' });

    await userEvent.setup().press(boton);

    expect(alPulsar).not.toHaveBeenCalled();
    expect(boton).toBeBusy();
  });

  it('sin texto de carga propio conserva el de siempre', async () => {
    await renderApp(<PrimaryButton label="Guardar" loading onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeOnTheScreen();
  });
});

describe('FilterChip', () => {
  it('se anuncia como opción excluyente y marca la elegida', async () => {
    await renderApp(<FilterChip label="Todos" selected onPress={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Todos' })).toBeSelected();
  });

  it('avisa al pulsarlo', async () => {
    const alPulsar = jest.fn();
    await renderApp(<FilterChip label="Barba" selected={false} onPress={alPulsar} />);

    await userEvent.setup().press(screen.getByRole('radio', { name: 'Barba' }));

    expect(alPulsar).toHaveBeenCalledTimes(1);
  });
});

describe('SlotChip', () => {
  const libre: Slot = { id: 's1', time: '09:00', status: 'libre' };
  const ocupado: Slot = { id: 's2', time: '14:30', status: 'ocupado' };

  it('una franja libre se puede elegir y devuelve la franja entera', async () => {
    const alElegir = jest.fn();
    await renderApp(<SlotChip slot={libre} selected={false} onSelect={alElegir} />);

    await userEvent.setup().press(screen.getByRole('button', { name: '9:00 am, libre' }));

    expect(alElegir).toHaveBeenCalledWith(libre);
  });

  it('una franja ocupada NO es un botón: no hay nada que pulsar', async () => {
    await renderApp(<SlotChip slot={ocupado} selected={false} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('2:30 pm, ocupado')).toBeOnTheScreen();
  });

  it('la franja elegida lo dice con texto, no solo con color', async () => {
    await renderApp(<SlotChip slot={libre} selected onSelect={jest.fn()} />);

    expect(screen.getByText('elegido')).toBeOnTheScreen();
    expect(screen.getByRole('button')).toBeSelected();
  });
});

describe('Card', () => {
  it('sin acción es un contenedor, no un botón', async () => {
    await renderApp(
      <Card>
        <Text>Contenido</Text>
      </Card>,
    );

    expect(screen.getByText('Contenido')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('con acción es un botón con su etiqueta', async () => {
    const alPulsar = jest.fn();
    await renderApp(
      <Card onPress={alPulsar} accessibilityLabel="Elegir a Luis Gomez">
        <Text>Luis Gomez</Text>
      </Card>,
    );

    await userEvent.setup().press(screen.getByRole('button', { name: 'Elegir a Luis Gomez' }));

    expect(alPulsar).toHaveBeenCalledTimes(1);
  });
});

describe('Avatar', () => {
  it('deriva el radio del tamaño para ser siempre circular', async () => {
    await renderApp(<Avatar uri="https://ejemplo.com/a.png" size={96} />);

    expect(screen.root).toHaveStyle({ width: 96, height: 96, borderRadius: 48 });
  });

  it('con anillo añade el borde de acento', async () => {
    await renderApp(<Avatar uri="https://ejemplo.com/a.png" size={40} ring />);

    expect(screen.root).toHaveStyle({ borderWidth: 2 });
  });
});

describe('StepHeader', () => {
  it('muestra el paso actual y el total', async () => {
    await renderApp(<StepHeader step={3} label="Fecha" onBack={jest.fn()} />);

    expect(screen.getByText('Paso 3 de 6')).toBeOnTheScreen();
    expect(screen.getByText('Fecha')).toBeOnTheScreen();
  });

  it('acepta otro total', async () => {
    await renderApp(<StepHeader step={2} total={4} label="Hora" onBack={jest.fn()} />);

    expect(screen.getByText('Paso 2 de 4')).toBeOnTheScreen();
  });

  it('el botón de volver avisa a la pantalla', async () => {
    const alVolver = jest.fn();
    await renderApp(<StepHeader step={2} label="Perfil" onBack={alVolver} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver al paso anterior' }));

    expect(alVolver).toHaveBeenCalledTimes(1);
  });
});

describe('SummaryRow', () => {
  it('pinta etiqueta y valor', async () => {
    await renderApp(<SummaryRow label="Barbero" value="Luis Gomez" />);

    expect(screen.getByText('Barbero')).toBeOnTheScreen();
    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
  });
});

describe('BarberChip', () => {
  it('muestra a quién se eligió y permite cambiarlo', async () => {
    const alCambiar = jest.fn();
    await renderApp(<BarberChip barber={barbero} onChange={alCambiar} />);

    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Cambiar de barbero' }));

    expect(alCambiar).toHaveBeenCalledTimes(1);
  });
});

describe('LoadingState', () => {
  it('dice qué se está cargando', async () => {
    await renderApp(<LoadingState label="Buscando barberos..." />);

    expect(screen.getByText('Buscando barberos...')).toBeOnTheScreen();
  });

  it('por defecto no menciona al servidor', async () => {
    await renderApp(<LoadingState />);

    expect(screen.getByText('Cargando...')).toBeOnTheScreen();
    expect(screen.queryByText(/despertando/)).not.toBeOnTheScreen();
  });

  it('cuando la espera se alarga explica por qué', async () => {
    // Sin esta frase, el arranque en frío del servidor parece un cuelgue.
    await renderApp(<LoadingState slow />);

    expect(screen.getByText(/está despertando/)).toBeOnTheScreen();
  });
});

describe('ErrorState', () => {
  it('sin conexión culpa a la red, no al servidor', async () => {
    await renderApp(
      <ErrorState error={new ApiError('Network request failed', 0, 'NETWORK_ERROR')} onRetry={jest.fn()} />,
    );

    expect(screen.getByText('Sin conexión')).toBeOnTheScreen();
    expect(screen.queryByText('Network request failed')).not.toBeOnTheScreen();
  });

  it('un 500 se asume como culpa nuestra', async () => {
    await renderApp(
      <ErrorState error={new ApiError('boom', 500, 'INTERNAL_ERROR')} onRetry={jest.fn()} />,
    );

    expect(screen.getByText('El servidor falló')).toBeOnTheScreen();
    expect(screen.queryByText('boom')).not.toBeOnTheScreen();
  });

  it('un 404 dice que ya no está', async () => {
    await renderApp(
      <ErrorState error={new ApiError('x', 404, 'BOOKING_NOT_FOUND')} onRetry={jest.fn()} />,
    );

    expect(screen.getByText('No encontrado')).toBeOnTheScreen();
  });

  it('el resto de errores 4xx muestran el mensaje que escribió la API', async () => {
    await renderApp(
      <ErrorState
        error={new ApiError('El barbero no atiende ese día.', 422, 'BARBER_CLOSED_THAT_DAY')}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('El barbero no atiende ese día.')).toBeOnTheScreen();
  });

  it('reintentar avisa a la pantalla', async () => {
    const alReintentar = jest.fn();
    await renderApp(<ErrorState error={new ApiError('x', 500, 'Y')} onRetry={alReintentar} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(alReintentar).toHaveBeenCalledTimes(1);
  });
});

describe('BookingRow', () => {
  /** La fila con lo mínimo; cada test cambia solo lo que prueba. */
  function fila(props: Partial<Parameters<typeof BookingRow>[0]> = {}) {
    return (
      <BookingRow
        booking={cita}
        started={false}
        onCancel={jest.fn()}
        onOutcome={jest.fn()}
        {...props}
      />
    );
  }

  it('muestra hora en formato de 12 horas, cliente, barbero y teléfono', async () => {
    await renderApp(fila({ barberName: 'Luis Gomez' }));

    // La hora va partida: el número grande y el periodo pequeño.
    expect(screen.getByText('9:00')).toBeOnTheScreen();
    expect(screen.getByText('am')).toBeOnTheScreen();
    expect(screen.getByText('Cliente Prueba')).toBeOnTheScreen();
    expect(screen.getByText('Luis Gomez')).toBeOnTheScreen();
    expect(screen.getByText('3000000000')).toBeOnTheScreen();
  });

  it('dice qué servicio es y cuánto cuesta', async () => {
    await renderApp(fila());

    expect(screen.getByText(/Fade · .*30\.000/)).toBeOnTheScreen();
  });

  it('una cita sin servicio lo dice en vez de dejar el hueco', async () => {
    await renderApp(fila({ booking: { ...cita, service: null } }));

    expect(screen.getByText('Sin servicio indicado')).toBeOnTheScreen();
  });

  it('sin nombre de barbero no pinta esa línea: en su agenda todas son suyas', async () => {
    await renderApp(fila());

    expect(screen.queryByText('Luis Gomez')).not.toBeOnTheScreen();
  });

  it('permite escribirle al cliente por WhatsApp, con el indicativo del país', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp(fila());

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Escribir por WhatsApp a Cliente Prueba' }));

    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/573000000000\?text=/));
  });

  describe('antes de la hora de la cita', () => {
    it('ofrece cancelar, y cancelar devuelve la cita entera', async () => {
      const alCancelar = jest.fn();
      await renderApp(fila({ onCancel: alCancelar }));

      await userEvent
        .setup()
        .press(screen.getByRole('button', { name: 'Cancelar la cita de Cliente Prueba a las 9:00 am' }));

      expect(alCancelar).toHaveBeenCalledWith(cita);
    });

    it('no ofrece marcarla: todavía no se sabe cómo termina', async () => {
      await renderApp(fila());

      expect(screen.queryByRole('button', { name: /Marcar/ })).not.toBeOnTheScreen();
    });
  });

  describe('desde la hora de la cita', () => {
    it('ofrece marcar si vino o no, en vez de cancelar', async () => {
      await renderApp(fila({ started: true }));

      expect(screen.getByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Marcar que Cliente Prueba no vino' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /Cancelar la cita/ })).not.toBeOnTheScreen();
    });

    it('si nadie la ha marcado lo avisa', async () => {
      await renderApp(fila({ started: true }));

      expect(screen.getByText('Sin marcar')).toBeOnTheScreen();
    });

    it('cada botón avisa con la cita y el estado', async () => {
      const alMarcar = jest.fn();
      await renderApp(fila({ started: true, onOutcome: alMarcar }));
      const usuario = userEvent.setup();

      await usuario.press(screen.getByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' }));
      await usuario.press(screen.getByRole('button', { name: 'Marcar que Cliente Prueba no vino' }));

      expect(alMarcar).toHaveBeenNthCalledWith(1, cita, 'atendida');
      expect(alMarcar).toHaveBeenNthCalledWith(2, cita, 'no_asistio');
    });

    it('una atendida lo dice, y su botón queda marcado y sin efecto', async () => {
      const alMarcar = jest.fn();
      await renderApp(
        fila({ started: true, booking: { ...cita, status: 'atendida' }, onOutcome: alMarcar }),
      );

      const boton = screen.getByRole('button', { name: 'Marcar atendida la cita de Cliente Prueba' });
      expect(screen.getByText('Atendida')).toBeOnTheScreen();
      expect(screen.queryByText('Sin marcar')).not.toBeOnTheScreen();
      expect(boton).toBeSelected();
      await userEvent.setup().press(boton);
      expect(alMarcar).not.toHaveBeenCalled();
    });

    it('una marcada se puede corregir con el otro botón', async () => {
      const alMarcar = jest.fn();
      await renderApp(
        fila({ started: true, booking: { ...cita, status: 'atendida' }, onOutcome: alMarcar }),
      );

      await userEvent
        .setup()
        .press(screen.getByRole('button', { name: 'Marcar que Cliente Prueba no vino' }));

      expect(alMarcar).toHaveBeenCalledWith(expect.objectContaining({ id: cita.id }), 'no_asistio');
    });

    it('una no asistida lo dice', async () => {
      await renderApp(fila({ started: true, booking: { ...cita, status: 'no_asistio' } }));

      expect(screen.getByText('No vino')).toBeOnTheScreen();
    });
  });

  it('con una acción en curso no deja otro toque: ni cancelar ni marcar', async () => {
    await renderApp(fila({ busy: true }));
    expect(screen.queryByRole('button', { name: /Cancelar la cita/ })).not.toBeOnTheScreen();
  });

  it('con una acción en curso tampoco deja marcar', async () => {
    await renderApp(fila({ busy: true, started: true }));
    expect(screen.queryByRole('button', { name: /Marcar/ })).not.toBeOnTheScreen();
  });
});

describe('TopBar', () => {
  it('muestra la marca y permite cerrar', async () => {
    const alCerrar = jest.fn();
    await renderApp(<TopBar onClose={alCerrar} />);

    expect(screen.getByText('ZonaBarber')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Cerrar y volver al inicio' }));

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

describe('ThemeToggle', () => {
  it('en oscuro ofrece pasar a claro, y al pulsarlo ofrece lo contrario', async () => {
    await renderApp(<ThemeToggle />);
    const usuario = userEvent.setup();

    await usuario.press(screen.getByRole('switch', { name: 'Cambiar a tema claro' }));

    expect(screen.getByRole('switch', { name: 'Cambiar a tema oscuro' })).toBeOnTheScreen();
  });

  it('muestra el icono del tema al que se va, no del actual', async () => {
    await renderApp(<ThemeToggle />);

    expect(screen.getByText('icono:sunny-outline')).toBeOnTheScreen();
  });
});

describe('FooterCta', () => {
  it('el botón principal lleva a agendar', async () => {
    const alAgendar = jest.fn();
    await renderApp(<FooterCta onAgendar={alAgendar} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Agenda tu cita ahora' }));

    expect(alAgendar).toHaveBeenCalledTimes(1);
  });

  it('sin destino de servicios no pinta ese botón', async () => {
    // En la propia pantalla de servicios llevaría a sí misma.
    await renderApp(<FooterCta onAgendar={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Ver todos los servicios' })).not.toBeOnTheScreen();
  });

  it('con destino de servicios sí lo pinta y avisa', async () => {
    const alVerServicios = jest.fn();
    await renderApp(<FooterCta onAgendar={jest.fn()} onVerServicios={alVerServicios} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver todos los servicios' }));

    expect(alVerServicios).toHaveBeenCalledTimes(1);
  });

  it('el contacto abre WhatsApp con el número de la barbería', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderApp(<FooterCta onAgendar={jest.fn()} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Escribir por WhatsApp' }));

    expect(abrir).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/57'));
    abrir.mockRestore();
  });
});

describe('AdminHeader', () => {
  const admin: AuthUser = { id: 'u1', username: 'admin', role: 'admin', barberId: null };
  const barberoUsuario: AuthUser = {
    id: 'u2',
    username: 'luis',
    role: 'barbero',
    barberId: 'luis-gomez',
  };

  it('el administrador ve las tres pestañas', async () => {
    await renderApp(<AdminHeader user={admin} onLogout={jest.fn()} />);

    expect(screen.getByText('Hola, admin')).toBeOnTheScreen();
    expect(screen.getByText('Panel de administración')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Agenda' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Barberos' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Servicios' })).toBeOnTheScreen();
  });

  it('la pestaña de barberos lleva a su pantalla', async () => {
    usePathname.mockReturnValue('/admin');
    await renderApp(<AdminHeader user={admin} onLogout={jest.fn()} />);

    await userEvent.setup().press(screen.getByRole('tab', { name: 'Barberos' }));

    expect(router.replace).toHaveBeenCalledWith('/admin/barberos');
  });

  it('el barbero no ve pestañas: solo tiene su agenda', async () => {
    await renderApp(<AdminHeader user={barberoUsuario} onLogout={jest.fn()} />);

    expect(screen.getByText('Agenda de luis')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Servicios' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Barberos' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Agenda' })).not.toBeOnTheScreen();
  });

  it('marca como activa la pestaña de la ruta actual', async () => {
    usePathname.mockReturnValue('/admin/servicios');
    await renderApp(<AdminHeader user={admin} onLogout={jest.fn()} />);

    expect(screen.getByRole('tab', { name: 'Servicios' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Agenda' })).not.toBeSelected();
  });

  it('cambiar de pestaña reemplaza la ruta en vez de apilarla', async () => {
    usePathname.mockReturnValue('/admin');
    await renderApp(<AdminHeader user={admin} onLogout={jest.fn()} />);

    await userEvent.setup().press(screen.getByRole('tab', { name: 'Servicios' }));

    expect(router.replace).toHaveBeenCalledWith('/admin/servicios');
  });

  it('cerrar sesión avisa a la pantalla', async () => {
    const alSalir = jest.fn();
    await renderApp(<AdminHeader user={admin} onLogout={alSalir} />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(alSalir).toHaveBeenCalledTimes(1);
  });
});
