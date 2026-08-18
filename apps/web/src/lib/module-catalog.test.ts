import { describe, expect, it } from 'vitest';
import { allModules, canAccessModule, findModuleBySlug, moduleCatalog } from './module-catalog';

describe('module catalog', () => {
  it('keeps every planned area visible with unique routes', () => {
    expect(moduleCatalog.length).toBeGreaterThanOrEqual(9);
    expect(allModules.length).toBeGreaterThanOrEqual(35);
    expect(new Set(allModules.map((module) => module.slug)).size).toBe(allModules.length);
    expect(findModuleBySlug('facturas')?.groupLabel).toBe('Pagos y facturación');
  });

  it('separates student, teacher and treasury navigation by effective permission', () => {
    const student = {
      roles: [{ code: 'ESTUDIANTE' }],
      permissions: [
        'GENERAL_RESUMEN_LEER',
        'ESTUDIANTES_ELEGIBILIDAD_PROPIA',
        'PAGOS_PROPIOS_GESTIONAR',
      ],
    };
    const teacher = {
      roles: [{ code: 'DOCENTE' }],
      permissions: ['GENERAL_RESUMEN_LEER', 'PROYECTOS_PARTICIPAR'],
    };
    const treasury = {
      roles: [{ code: 'TESORERIA' }],
      permissions: ['GENERAL_RESUMEN_LEER', 'PAGOS_GESTIONAR'],
    };

    expect(canAccessModule('elegibilidad', student)).toBe(true);
    expect(canAccessModule('usuarios', student)).toBe(false);
    expect(canAccessModule('proyectos-grado', teacher)).toBe(true);
    expect(canAccessModule('historial-academico', teacher)).toBe(false);
    expect(canAccessModule('conciliaciones', treasury)).toBe(true);
    expect(canAccessModule('planes-estudio', treasury)).toBe(false);
  });

  it('keeps administrator access without requiring an exposed permission list', () => {
    expect(
      canAccessModule('configuraciones', {
        roles: [{ code: 'ADMIN' }],
        permissions: [],
      }),
    ).toBe(true);
  });
});
