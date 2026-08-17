import { describe, expect, it } from 'vitest';
import { allModules, findModuleBySlug, moduleCatalog } from './module-catalog';

describe('module catalog', () => {
  it('keeps every planned area visible with unique routes', () => {
    expect(moduleCatalog.length).toBeGreaterThanOrEqual(10);
    expect(allModules.length).toBeGreaterThanOrEqual(35);
    expect(new Set(allModules.map((module) => module.slug)).size).toBe(allModules.length);
    expect(findModuleBySlug('facturas')?.groupLabel).toBe('Pagos y facturación');
  });
});
