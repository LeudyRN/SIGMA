import { academicSubjectMatches } from './academic-history-matching';
import { classifyAcademicGrade } from './academic-history-parser.service';

describe('classifyAcademicGrade', () => {
  it('interpreta AUS como retirada sin nota numérica', () => {
    expect(classifyAcademicGrade('AUS')).toEqual({
      grade: null,
      status: 'RETIRADA',
    });
  });

  it('permite que una nota posterior sea aprobada', () => {
    expect(classifyAcademicGrade('80')).toEqual({
      grade: 80,
      status: 'APROBADA',
    });
  });

  it('interpreta L23 como laboratorio aprobado sobre 30 puntos', () => {
    expect(classifyAcademicGrade('L23')).toEqual({
      grade: 23,
      status: 'APROBADA',
    });
  });

  it('reprueba el laboratorio cuando no alcanza 21 de 30', () => {
    expect(classifyAcademicGrade('L20')).toEqual({
      grade: 20,
      status: 'REPROBADA',
    });
  });
});

describe('academicSubjectMatches', () => {
  it('reconoce códigos equivalentes del plan', () => {
    expect(
      academicSubjectMatches(
        { code: 'EFI0120', name: 'Educación Física' },
        {
          code: 'EFS0120',
          equivalences: 'EFI0120, EFS0110',
          name: 'Educación Física',
        },
      ),
    ).toBe(true);
  });

  it('no convierte una materia complementaria en requisito por coincidencia parcial', () => {
    expect(
      academicSubjectMatches(
        { code: 'BIO0180', name: 'Laboratorio de Biología Básica' },
        { code: 'BIO0140', equivalences: null, name: 'Biología Básica' },
      ),
    ).toBe(false);
  });
});
