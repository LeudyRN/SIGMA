import { describe, expect, it } from 'vitest';
import { normalizeTechnicalCode } from './catalog-code';

describe('normalizeTechnicalCode', () => {
  it('normalizes spaces, accents and lowercase characters', () => {
    expect(normalizeTechnicalCode('Curso monográfico')).toBe('CURSO_MONOGRAFICO');
  });

  it('preserves supported separators', () => {
    expect(normalizeTechnicalCode('tesis-especial_2')).toBe('TESIS-ESPECIAL_2');
  });
});
