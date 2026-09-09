import { meetsAcademicPolicy } from './academic-policy';
describe('Política académica por plan', () => {
  const strict = { maxSubjects: 0, maxCredits: 0, fromSemester: 1 };
  it('exige todas las materias previas por defecto', () => {
    expect(meetsAcademicPolicy([], 0, strict)).toBe(true);
    expect(meetsAcademicPolicy([{ credits: 3, semester: 8 }], 0, strict)).toBe(
      false,
    );
  });
  it('permite únicamente la tolerancia configurada en los últimos semestres', () => {
    const policy = { maxSubjects: 2, maxCredits: 6, fromSemester: 8 };
    expect(
      meetsAcademicPolicy(
        [
          { credits: 3, semester: 8 },
          { credits: 3, semester: 9 },
        ],
        0,
        policy,
      ),
    ).toBe(true);
    expect(meetsAcademicPolicy([{ credits: 3, semester: 7 }], 0, policy)).toBe(
      false,
    );
    expect(meetsAcademicPolicy([{ credits: 7, semester: 8 }], 0, policy)).toBe(
      false,
    );
    expect(
      meetsAcademicPolicy(
        [
          { credits: 1, semester: 8 },
          { credits: 1, semester: 8 },
          { credits: 1, semester: 8 },
        ],
        0,
        policy,
      ),
    ).toBe(false);
  });
  it('no presume semestre ni omite créditos optativos pendientes', () => {
    const policy = { maxSubjects: 2, maxCredits: 6, fromSemester: 8 };
    expect(
      meetsAcademicPolicy([{ credits: 3, semester: null }], 0, policy),
    ).toBe(false);
    expect(meetsAcademicPolicy([], 1, policy)).toBe(false);
  });
});
