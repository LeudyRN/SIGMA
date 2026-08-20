import { selectEffectiveAcademicAttempts } from './academic-history-results';

describe('selectEffectiveAcademicAttempts', () => {
  it('muestra la aprobación posterior en lugar del retiro anterior', () => {
    const attempts = [
      {
        id: 'retiro',
        id_asignatura: 10n,
        periodo_codigo: '2019-20',
        estado_asignatura: 'RETIRADA',
      },
      {
        id: 'aprobacion',
        id_asignatura: 10n,
        periodo_codigo: '2020-10',
        estado_asignatura: 'APROBADA',
      },
    ];

    expect(selectEffectiveAcademicAttempts(attempts)).toEqual([attempts[1]]);
  });

  it('conserva el intento más reciente cuando la asignatura no fue aprobada', () => {
    const attempts = [
      {
        id: 'reprobada',
        id_asignatura: 20n,
        periodo_codigo: '2020-10',
        estado_asignatura: 'REPROBADA',
      },
      {
        id: 'retirada',
        id_asignatura: 20n,
        periodo_codigo: '2021-20',
        estado_asignatura: 'RETIRADA',
      },
    ];

    expect(selectEffectiveAcademicAttempts(attempts)).toEqual([attempts[1]]);
  });
});
