import {
  evaluateAcademicRequirements,
  type EligibilitySubject,
} from './academic-eligibility';

const requirements: EligibilitySubject[] = [
  regular('INF5140', 'Lenguaje de Programación II', 4),
  slot('INFZZA0', 3),
  slot('INFZZB0', 5),
  slot('INFZZC0', 4),
  elective('ADM1120', 'Principios de Administración', 3),
  elective('INF5180', 'Lenguaje de Programación IV', 4),
  elective('INF5290', 'Inteligencia Artificial', 5),
  elective('MAT4940', 'Métodos Numéricos', 5),
];

describe('evaluateAcademicRequirements', () => {
  it('satisface los tres cupos INFZZ con varias optativas que suman 12 créditos', () => {
    const result = evaluateAcademicRequirements(requirements, [
      { code: 'INF5140', name: 'Lenguaje de Programación II' },
      { code: 'ADM1120', name: 'Principios de Administración' },
      { code: 'INF5180', name: 'Lenguaje de Programación IV' },
      { code: 'INF5290', name: 'Inteligencia Artificial' },
    ]);

    expect(result.electiveCredits).toEqual({
      completed: 12,
      earned: 12,
      pending: 0,
      required: 12,
    });
    expect(result.pendingRegular).toHaveLength(0);
    expect(result.completionPercentage).toBe(100);
  });

  it('informa únicamente los créditos optativos restantes', () => {
    const result = evaluateAcademicRequirements(requirements, [
      { code: 'INF5140', name: 'Lenguaje de Programación II' },
      { code: 'INF5180', name: 'Lenguaje de Programación IV' },
      { code: 'MAT4940', name: 'Métodos Numéricos' },
    ]);

    expect(result.electiveCredits).toEqual({
      completed: 9,
      earned: 9,
      pending: 3,
      required: 12,
    });
    expect(result.completionPercentage).toBe(87.5);
  });

  it('no aplica las optativas de un catálogo que no pertenece al plan evaluado', () => {
    const otherCareer = [regular('DER1010', 'Introducción al Derecho', 4)];
    const result = evaluateAcademicRequirements(otherCareer, [
      { code: 'INF5290', name: 'Inteligencia Artificial' },
    ]);

    expect(result.electiveCredits.required).toBe(0);
    expect(result.pendingRegular.map((subject) => subject.code)).toEqual([
      'DER1010',
    ]);
  });

  it('limita los créditos reconocidos aunque se aprueben más de 12', () => {
    const result = evaluateAcademicRequirements(requirements, [
      { code: 'ADM1120', name: 'Principios de Administración' },
      { code: 'INF5180', name: 'Lenguaje de Programación IV' },
      { code: 'INF5290', name: 'Inteligencia Artificial' },
      { code: 'MAT4940', name: 'Métodos Numéricos' },
    ]);

    expect(result.electiveCredits).toEqual({
      completed: 12,
      earned: 17,
      pending: 0,
      required: 12,
    });
  });

  it('no bloquea la inscripción cuando solo falta la tesis o curso equivalente', () => {
    const plan = [
      regular('INF5140', 'Lenguaje de Programación II', 4),
      {
        ...regular('INF7010', 'Tesis de Grado o Curso Equivalente', 8),
        order: 50,
        semester: 10,
        type: 'TESIS',
      },
    ];
    const result = evaluateAcademicRequirements(plan, [
      { code: 'INF5140', name: 'Lenguaje de Programación II' },
    ]);

    expect(result.pendingBlockingRequirements).toHaveLength(0);
    expect(
      result.pendingGraduationRequirements.map((subject) => subject.code),
    ).toEqual(['INF7010']);
  });

  it('reconoce Trabajo de Grado II como requisito terminal sin liberar Trabajo de Grado I', () => {
    const plan = [
      {
        ...regular('ARQ5120', 'Trabajo de Grado I', 6),
        order: 40,
        semester: 9,
      },
      {
        ...regular('ARQ5130', 'Trabajo de Grado II', 12),
        order: 50,
        semester: 10,
      },
    ];
    const withoutFirstStage = evaluateAcademicRequirements(plan, []);
    const readyForSecondStage = evaluateAcademicRequirements(plan, [
      { code: 'ARQ5120', name: 'Trabajo de Grado I' },
    ]);

    expect(
      withoutFirstStage.pendingBlockingRequirements.map(
        (subject) => subject.code,
      ),
    ).toEqual(['ARQ5120']);
    expect(readyForSecondStage.pendingBlockingRequirements).toHaveLength(0);
    expect(
      readyForSecondStage.pendingGraduationRequirements.map(
        (subject) => subject.code,
      ),
    ).toEqual(['ARQ5130']);
  });
});

function regular(
  code: string,
  name: string,
  credits: number,
): EligibilitySubject {
  return {
    code,
    credits,
    id: code,
    mandatory: true,
    name,
    type: 'REGULAR',
  };
}

function slot(code: string, credits: number): EligibilitySubject {
  return regular(code, 'Asignatura Optativa', credits);
}

function elective(
  code: string,
  name: string,
  credits: number,
): EligibilitySubject {
  return {
    code,
    credits,
    id: code,
    mandatory: false,
    name,
    type: 'OPTATIVA',
  };
}
