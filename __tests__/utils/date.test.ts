import {
  buildMonthGrid,
  compareMonths,
  currentMonthKey,
  formatDayMonthYear,
  formatMonthLabel,
  formatShortDate,
  formatTime12h,
  fromISODate,
  fromMonthKey,
  isPastDate,
  monthKeyOf,
  shiftMonth,
  startOfToday,
  toISODate,
  toMonthKey,
  WEEKDAY_COLUMNS,
} from '../../src/utils/date';

/**
 * Las funciones que dependen de "hoy" se prueban con el reloj congelado.
 * Sin eso, un test que pasa un martes puede fallar un domingo, y uno que
 * pasa en noviembre puede fallar el 31 de diciembre a medianoche.
 */
const AHORA = new Date(2026, 10, 10, 15, 30, 0); // martes 10 nov 2026, 15:30

describe('conversión entre Date e ISO', () => {
  it('rellena mes y día con cero a la izquierda', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('interpreta el ISO como fecha LOCAL a medianoche', () => {
    const fecha = fromISODate('2026-07-14');

    expect(fecha.getFullYear()).toBe(2026);
    expect(fecha.getMonth()).toBe(6);
    expect(fecha.getDate()).toBe(14);
    expect(fecha.getHours()).toBe(0);
  });

  it('ida y vuelta devuelve el mismo día', () => {
    // El caso que rompe toISOString(): en una zona al oeste de UTC, la
    // medianoche local ya es "ayer" en UTC y el día se correría.
    expect(toISODate(fromISODate('2026-12-31'))).toBe('2026-12-31');
    expect(toISODate(fromISODate('2026-01-01'))).toBe('2026-01-01');
  });
});

describe('funciones que dependen de hoy', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('startOfToday descarta la hora', () => {
    const hoy = startOfToday();

    expect(toISODate(hoy)).toBe('2026-11-10');
    expect(hoy.getHours()).toBe(0);
    expect(hoy.getMinutes()).toBe(0);
  });

  it('ayer es pasado', () => {
    expect(isPastDate('2026-11-09')).toBe(true);
  });

  it('hoy NO es pasado, aunque ya sean las tres de la tarde', () => {
    expect(isPastDate('2026-11-10')).toBe(false);
  });

  it('mañana no es pasado', () => {
    expect(isPastDate('2026-11-11')).toBe(false);
  });

  it('currentMonthKey usa meses 1-12, no los 0-11 de Date', () => {
    expect(currentMonthKey()).toBe('2026-11');
  });
});

describe('formato para mostrar', () => {
  it('formatMonthLabel recibe el mes 0-11 de Date', () => {
    expect(formatMonthLabel(2026, 6)).toBe('Julio 2026');
    expect(formatMonthLabel(2026, 0)).toBe('Enero 2026');
    expect(formatMonthLabel(2026, 11)).toBe('Diciembre 2026');
  });

  it('formatShortDate incluye el día de la semana', () => {
    // 14 de julio de 2026 es martes.
    expect(formatShortDate('2026-07-14')).toBe('Mar 14 de Jul');
  });

  it('formatShortDate en domingo', () => {
    expect(formatShortDate('2026-12-06')).toBe('Dom 6 de Dic');
  });

  it('formatDayMonthYear usa el orden día/mes/año', () => {
    expect(formatDayMonthYear('2026-07-04')).toBe('04/07/2026');
  });

  it.each([
    ['09:00', '9:00 am'],
    ['00:30', '12:30 am'],
    ['11:59', '11:59 am'],
    ['12:00', '12:00 pm'],
    ['13:05', '1:05 pm'],
    ['20:30', '8:30 pm'],
    ['23:59', '11:59 pm'],
  ])('formatTime12h convierte %s en %s', (entrada, esperado) => {
    expect(formatTime12h(entrada)).toBe(esperado);
  });
});

describe('buildMonthGrid', () => {
  it('todas las semanas tienen exactamente siete celdas', () => {
    for (let mes = 0; mes < 12; mes += 1) {
      for (const semana of buildMonthGrid(2026, mes)) {
        expect(semana).toHaveLength(7);
      }
    }
  });

  it('un mes que empieza en domingo no lleva relleno delante', () => {
    // 1 de noviembre de 2026 cae en domingo.
    const semanas = buildMonthGrid(2026, 10);

    expect(semanas[0][0]).toBe('2026-11-01');
    expect(semanas).toHaveLength(5);
  });

  it('rellena con null el final de la última semana', () => {
    const ultima = buildMonthGrid(2026, 10).at(-1);

    expect(ultima).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null]);
  });

  it('rellena con null los días previos al día 1', () => {
    // 1 de diciembre de 2026 cae en martes: dos huecos delante.
    const primera = buildMonthGrid(2026, 11)[0];

    expect(primera.slice(0, 3)).toEqual([null, null, '2026-12-01']);
  });

  it('febrero de 28 días empezando en domingo ocupa cuatro semanas exactas', () => {
    const semanas = buildMonthGrid(2026, 1);

    expect(semanas).toHaveLength(4);
    expect(semanas.flat().every((celda) => celda !== null)).toBe(true);
  });

  it('contiene todos los días del mes, una sola vez y en orden', () => {
    const dias = buildMonthGrid(2026, 11)
      .flat()
      .filter((celda): celda is string => celda !== null);

    expect(dias).toHaveLength(31);
    expect(dias[0]).toBe('2026-12-01');
    expect(dias.at(-1)).toBe('2026-12-31');
    expect([...dias].sort()).toEqual(dias);
  });
});

describe('aritmética de meses', () => {
  it('shiftMonth avanza de diciembre a enero cambiando el año', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('shiftMonth retrocede de enero a diciembre cambiando el año', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('shiftMonth dentro del mismo año', () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });

  it('compareMonths ordena aunque cambie el año', () => {
    expect(compareMonths({ year: 2026, month: 11 }, { year: 2027, month: 0 })).toBeLessThan(0);
    expect(compareMonths({ year: 2027, month: 0 }, { year: 2026, month: 11 })).toBeGreaterThan(0);
    expect(compareMonths({ year: 2026, month: 5 }, { year: 2026, month: 5 })).toBe(0);
  });
});

describe('claves de mes', () => {
  it('monthKeyOf recorta el día', () => {
    expect(monthKeyOf('2026-11-10')).toBe('2026-11');
  });

  it('toMonthKey corrige el desfase 0-11 de Date', () => {
    expect(toMonthKey(2026, 10)).toBe('2026-11');
    expect(toMonthKey(2026, 0)).toBe('2026-01');
  });

  it('fromMonthKey devuelve el mes 0-11 que espera Date', () => {
    expect(fromMonthKey('2026-11')).toEqual({ year: 2026, month: 10 });
  });

  it('ida y vuelta conserva el mes', () => {
    const { year, month } = fromMonthKey('2027-01');

    expect(toMonthKey(year, month)).toBe('2027-01');
  });
});

describe('WEEKDAY_COLUMNS', () => {
  it('tiene siete columnas y empieza en domingo, igual que getDay()', () => {
    expect(WEEKDAY_COLUMNS).toHaveLength(7);
    expect(WEEKDAY_COLUMNS[0]).toBe('DOM');
  });
});
