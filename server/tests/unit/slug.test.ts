import { describe, expect, it } from 'vitest';

import { slugify } from '../../src/utils/slug.js';

/**
 * El id de un barbero sale de su nombre y viaja en la URL: aquí se prueban
 * los nombres raros, que son los que rompen una ruta.
 */
describe('slugify', () => {
  it('pasa a minúsculas y une las palabras con guiones', () => {
    expect(slugify('Luis Gomez')).toBe('luis-gomez');
  });

  it('quita tildes, diéresis y virgulillas', () => {
    expect(slugify('José Peña Güiza')).toBe('jose-pena-guiza');
  });

  it('colapsa cualquier tramo de símbolos o espacios en un solo guion', () => {
    expect(slugify('Ana   María -- (La Mona)')).toBe('ana-maria-la-mona');
  });

  it('no deja guiones al principio ni al final', () => {
    expect(slugify('  ¡Carlos!  ')).toBe('carlos');
  });

  it('conserva los dígitos', () => {
    expect(slugify('Barbero 2')).toBe('barbero-2');
  });

  it('usa un id genérico si el nombre no deja ninguna letra aprovechable', () => {
    expect(slugify('李小龙')).toBe('barbero');
    expect(slugify('!!!')).toBe('barbero');
  });

  it('recorta los nombres larguísimos sin dejar un guion colgando', () => {
    const slug = slugify(`${'a'.repeat(59)} segundo`);

    expect(slug).toBe('a'.repeat(59));
    expect(slug.length).toBeLessThanOrEqual(60);
  });

  it('es determinista: el mismo nombre da siempre el mismo id', () => {
    expect(slugify('Luis Gomez')).toBe(slugify('Luis Gomez'));
  });
});
