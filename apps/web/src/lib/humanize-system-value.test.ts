import { describe, expect, it } from 'vitest';
import { humanizeSystemValue } from './humanize-system-value';

describe('humanizeSystemValue', () => {
  it('presents workflow states without technical separators', () => {
    expect(humanizeSystemValue('EN_REVISION')).toBe('En revisión');
    expect(humanizeSystemValue('PENDIENTE_PAGO')).toBe('Pendiente de pago');
  });

  it('preserves ordinary user-facing text', () => {
    expect(humanizeSystemValue('Monográfico')).toBe('Monográfico');
  });
});
