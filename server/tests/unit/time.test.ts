import { describe, expect, it } from 'vitest';

import {
  daysOfMonth,
  generateSlotTimes,
  isSlotBoundary,
  isValidISODate,
  isValidISOMonth,
  isValidTime,
  normalizeTime,
  toMinutes,
  toTimeString,
  weekdayOf,
} from '../../src/utils/time.js';

/**
 * Tests unitarios de la lógica pura de horarios.
 *
 * No tocan base de datos ni HTTP: son las reglas de las que depende toda la
 * disponibilidad, y aquí es donde se prueban los bordes.
 */

describe('toMinutes / toTimeString', () => {
  it('convierte hora a minutos y vuelve', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('19:30')).toBe(1170);
    expect(toTimeString(570)).toBe('09:30');
    expect(toTimeString(0)).toBe('00:00');
  });

  it('ignora los segundos que manda Postgres', () => {
    expect(toMinutes('09:30:00')).toBe(570);
  });
});

describe('normalizeTime', () => {
  it('recorta HH:mm:ss a HH:mm', () => {
    expect(normalizeTime('09:30:00')).toBe('09:30');
    expect(normalizeTime('19:30')).toBe('19:30');
  });
});

describe('isValidISODate', () => {
  it('acepta fechas reales en formato YYYY-MM-DD', () => {
    expect(isValidISODate('2026-07-14')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // bisiesto
  });

  it('rechaza formatos distintos', () => {
    expect(isValidISODate('14-07-2026')).toBe(false);
    expect(isValidISODate('2026-7-4')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  it('rechaza fechas que no existen aunque el formato sea correcto', () => {
    // El Date de JavaScript desborda '2026-02-31' al 3 de marzo en silencio.
    expect(isValidISODate('2026-02-31')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2025-02-29')).toBe(false); // no bisiesto
  });
});

describe('isValidTime', () => {
  it('acepta horas válidas de 24h', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });

  it('rechaza horas imposibles o mal formadas', () => {
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('09:60')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('09:30:00')).toBe(false);
  });
});

describe('weekdayOf', () => {
  it('calcula el día de la semana sin desplazarlo por zona horaria', () => {
    expect(weekdayOf('2026-07-14')).toBe(2); // martes
    expect(weekdayOf('2026-07-19')).toBe(0); // domingo
  });
});

describe('generateSlotTimes', () => {
  it('genera el horario completo de la barbería', () => {
    const slots = generateSlotTimes('09:00', '19:30', 30);

    expect(slots).toHaveLength(22);
    expect(slots[0]).toBe('09:00');
    expect(slots.at(-1)).toBe('19:30');
  });

  it('incluye la última franja: lastSlotAt es inclusivo', () => {
    expect(generateSlotTimes('09:00', '10:00', 30)).toEqual(['09:00', '09:30', '10:00']);
  });

  it('devuelve una sola franja cuando el rango es de un punto', () => {
    expect(generateSlotTimes('09:00', '09:00', 30)).toEqual(['09:00']);
  });

  it('no entra en bucle infinito con un paso inválido', () => {
    expect(() => generateSlotTimes('09:00', '19:30', 0)).toThrow(RangeError);
  });
});

describe('isSlotBoundary', () => {
  it('acepta las horas que caen exactamente en una franja', () => {
    expect(isSlotBoundary('09:00', '09:00', '19:30', 30)).toBe(true);
    expect(isSlotBoundary('10:30', '09:00', '19:30', 30)).toBe(true);
    expect(isSlotBoundary('19:30', '09:00', '19:30', 30)).toBe(true);
  });

  it('rechaza horas dentro del rango pero fuera de la rejilla', () => {
    expect(isSlotBoundary('09:17', '09:00', '19:30', 30)).toBe(false);
    expect(isSlotBoundary('10:45', '09:00', '19:30', 30)).toBe(false);
  });

  it('rechaza horas fuera del horario de atención', () => {
    expect(isSlotBoundary('08:30', '09:00', '19:30', 30)).toBe(false);
    expect(isSlotBoundary('20:00', '09:00', '19:30', 30)).toBe(false);
  });
});

describe('isValidISOMonth', () => {
  it('acepta meses bien formados', () => {
    expect(isValidISOMonth('2026-01')).toBe(true);
    expect(isValidISOMonth('2026-11')).toBe(true);
    expect(isValidISOMonth('2026-12')).toBe(true);
  });

  it('rechaza meses fuera de rango o con otro formato', () => {
    expect(isValidISOMonth('2026-00')).toBe(false);
    expect(isValidISOMonth('2026-13')).toBe(false);
    expect(isValidISOMonth('2026-1')).toBe(false);
    expect(isValidISOMonth('11-2026')).toBe(false);
    expect(isValidISOMonth('2026-11-09')).toBe(false);
    expect(isValidISOMonth('')).toBe(false);
  });
});

describe('daysOfMonth', () => {
  it('devuelve los treinta días de noviembre en orden', () => {
    const days = daysOfMonth('2026-11');

    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-11-01');
    expect(days[29]).toBe('2026-11-30');
  });

  it('rellena el día con cero a la izquierda', () => {
    expect(daysOfMonth('2026-11')[8]).toBe('2026-11-09');
  });

  it('febrero de un año bisiesto tiene 29 días', () => {
    expect(daysOfMonth('2028-02')).toHaveLength(29);
  });

  it('febrero de un año normal tiene 28', () => {
    expect(daysOfMonth('2026-02')).toHaveLength(28);
  });

  it('un año divisible por 100 pero no por 400 no es bisiesto', () => {
    // 2100 es la trampa clásica: múltiplo de 4, pero no es bisiesto.
    expect(daysOfMonth('2100-02')).toHaveLength(28);
  });
});
