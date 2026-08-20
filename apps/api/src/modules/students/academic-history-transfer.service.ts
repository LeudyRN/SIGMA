import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extractAcademicCodes,
  normalizeAcademicText,
} from './academic-history-matching';
import {
  AcademicHistoryParserService,
  type AcademicHistoryIssue,
  type ParsedAcademicHistory,
  type ParsedAcademicHistoryRecord,
} from './academic-history-parser.service';

export interface UploadedHistoryPdf {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export type SubjectMapping =
  'EXACTA' | 'EQUIVALENCIA' | 'NOMBRE' | 'COMPLEMENTARIA';
export type ImportAction = 'CREAR' | 'ACTUALIZAR' | 'SIN_CAMBIOS';

interface PlanSubject {
  id: bigint;
  code: string;
  equivalenceCodes: Set<string>;
  name: string;
}

export interface ValidatedAcademicHistoryRecord extends ParsedAcademicHistoryRecord {
  action: ImportAction;
  mapping: SubjectMapping;
  planSubjectCode: string | null;
  planSubjectName: string | null;
  subjectExists: boolean;
}

const CAREER_INCLUDE = {
  estudiantes: { include: { usuarios: true } },
  planes_estudio: {
    include: {
      carreras: { include: { escuelas: { include: { facultades: true } } } },
      plan_estudio_asignaturas: { include: { asignaturas: true } },
    },
  },
  recinto_carreras: { include: { carreras: true, recintos: true } },
} satisfies Prisma.estudiante_carrerasInclude;

type CareerContext = Prisma.estudiante_carrerasGetPayload<{
  include: typeof CAREER_INCLUDE;
}>;

@Injectable()
export class AcademicHistoryTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: AcademicHistoryParserService,
  ) {}

  async preview(careerId: string, file: UploadedHistoryPdf) {
    this.validateFile(file);
    const [career, parsed] = await Promise.all([
      this.loadCareer(careerId),
      this.parser.parse(file.buffer),
    ]);
    const validation = await this.validate(career, parsed);

    return {
      canImport: !validation.issues.some((issue) => issue.severity === 'ERROR'),
      document: {
        career: parsed.career,
        matricula: parsed.matricula,
        school: parsed.school,
        studentName: parsed.studentName,
      },
      issues: validation.issues,
      records: validation.records,
      selectedCareer: careerSummary(career),
      summary: summarize(validation.records),
    };
  }

  async confirm(careerId: string, file: UploadedHistoryPdf) {
    const preview = await this.preview(careerId, file);
    const errors = preview.issues.filter((issue) => issue.severity === 'ERROR');

    if (errors.length) {
      throw new BadRequestException([
        'El histórico contiene errores y no puede importarse.',
        ...errors.map((issue) => issue.message),
      ]);
    }

    const careerKey = toBigInt(careerId);
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    await this.prisma.$transaction(async (database) => {
      for (const record of preview.records) {
        let subject = await database.asignaturas.findUnique({
          where: { codigo: record.courseCode },
        });

        if (!subject) {
          subject = await database.asignaturas.create({
            data: {
              codigo: record.courseCode,
              nombre: record.subjectName,
              horas_practicas: 0,
              horas_teoricas: 0,
              creditos: record.credits,
            },
          });
        }

        const key = {
          id_estudiante_carrera: careerKey,
          id_asignatura: subject.id_asignatura,
          periodo_codigo: record.periodCode,
        };
        const current = await database.historial_academico.findUnique({
          where: { id_estudiante_carrera_id_asignatura_periodo_codigo: key },
        });

        if (
          current &&
          decimalEquals(current.calificacion, record.grade) &&
          decimalEquals(
            current.calificacion_laboratorio,
            record.laboratoryGrade,
          ) &&
          current.calificacion_laboratorio_literal ===
            record.laboratoryGradeText &&
          current.estado_asignatura === record.status
        ) {
          unchanged += 1;
          continue;
        }

        await database.historial_academico.upsert({
          where: { id_estudiante_carrera_id_asignatura_periodo_codigo: key },
          update: {
            calificacion: record.grade,
            calificacion_laboratorio: record.laboratoryGrade,
            calificacion_laboratorio_literal: record.laboratoryGradeText,
            estado_asignatura: record.status!,
            fecha_actualizacion: new Date(),
            fuente: 'IMPORTACION_PDF_UASD',
          },
          create: {
            ...key,
            calificacion: record.grade,
            calificacion_laboratorio: record.laboratoryGrade,
            calificacion_laboratorio_literal: record.laboratoryGradeText,
            estado_asignatura: record.status!,
            fuente: 'IMPORTACION_PDF_UASD',
          },
        });

        if (current) updated += 1;
        else created += 1;
      }
    });

    return {
      created,
      imported: true,
      total: preview.records.length,
      unchanged,
      updated,
      warnings: preview.issues.filter((issue) => issue.severity === 'WARNING'),
    };
  }

  private async validate(career: CareerContext, parsed: ParsedAcademicHistory) {
    const issues: AcademicHistoryIssue[] = [...parsed.issues];
    const expectedStudent = career.estudiantes;
    const expectedName = normalizeAcademicText(
      `${expectedStudent.usuarios.nombres} ${expectedStudent.usuarios.apellidos}`,
    );

    if (parsed.matricula !== expectedStudent.matricula) {
      issues.push({
        code: 'STUDENT_MISMATCH',
        message: `La matrícula del PDF (${parsed.matricula}) no corresponde al estudiante seleccionado (${expectedStudent.matricula}).`,
        severity: 'ERROR',
      });
    }

    if (normalizeAcademicText(parsed.studentName) !== expectedName) {
      issues.push({
        code: 'STUDENT_NAME_DIFFERENCE',
        message:
          'El nombre del PDF difiere del perfil; se validó la identidad por matrícula.',
        severity: 'WARNING',
      });
    }

    if (!careerMatches(parsed.career, career.planes_estudio.carreras.nombre)) {
      issues.push({
        code: 'CAREER_MISMATCH',
        message: `La carrera del PDF (${parsed.career}) no corresponde a ${career.planes_estudio.carreras.nombre}.`,
        severity: 'ERROR',
      });
    }

    const planSubjects = career.planes_estudio.plan_estudio_asignaturas.map(
      (relation): PlanSubject => ({
        code: relation.asignaturas.codigo,
        equivalenceCodes: extractAcademicCodes(relation.equivalencias_texto),
        id: relation.id_asignatura,
        name: relation.asignaturas.nombre,
      }),
    );
    const codes = [
      ...new Set(parsed.records.map((record) => record.courseCode)),
    ];
    const [catalogSubjects, existingHistory] = await Promise.all([
      this.prisma.asignaturas.findMany({
        where: { codigo: { in: codes } },
      }),
      this.prisma.historial_academico.findMany({
        where: {
          id_estudiante_carrera: career.id_estudiante_carrera,
          asignaturas: { codigo: { in: codes } },
        },
        include: { asignaturas: true },
      }),
    ]);
    const catalogByCode = new Map(
      catalogSubjects.map((subject) => [subject.codigo, subject]),
    );
    const historyByKey = new Map(
      existingHistory.map((record) => [
        `${record.periodo_codigo}:${record.asignaturas.codigo}`,
        record,
      ]),
    );
    const records: ValidatedAcademicHistoryRecord[] = [];

    for (const record of parsed.records) {
      if (record.credits < 0 || record.credits > 30) {
        issues.push({
          code: 'INVALID_CREDITS',
          message: `${record.courseCode} tiene ${record.credits} créditos, fuera del rango permitido.`,
          periodCode: record.periodCode,
          severity: 'ERROR',
          subjectCode: record.courseCode,
        });
        continue;
      }

      const subjectMatch = matchPlanSubject(record, planSubjects);
      if (subjectMatch.mapping === 'COMPLEMENTARIA') {
        issues.push({
          code: 'SUPPLEMENTAL_SUBJECT',
          message: `${record.courseCode} no forma parte directa del plan; se conservará como asignatura complementaria del histórico.`,
          periodCode: record.periodCode,
          severity: 'WARNING',
          subjectCode: record.courseCode,
        });
      }

      const current = historyByKey.get(
        `${record.periodCode}:${record.courseCode}`,
      );
      const action: ImportAction = !current
        ? 'CREAR'
        : decimalEquals(current.calificacion, record.grade) &&
            decimalEquals(
              current.calificacion_laboratorio,
              record.laboratoryGrade,
            ) &&
            current.calificacion_laboratorio_literal ===
              record.laboratoryGradeText &&
            current.estado_asignatura === record.status
          ? 'SIN_CAMBIOS'
          : 'ACTUALIZAR';

      records.push({
        ...record,
        action,
        mapping: subjectMatch.mapping,
        planSubjectCode: subjectMatch.subject?.code ?? null,
        planSubjectName: subjectMatch.subject?.name ?? null,
        subjectExists: catalogByCode.has(record.courseCode),
      });
    }

    return { issues: deduplicateIssues(issues), records };
  }

  private async loadCareer(careerId: string): Promise<CareerContext> {
    const career = await this.prisma.estudiante_carreras.findUnique({
      where: { id_estudiante_carrera: toBigInt(careerId) },
      include: CAREER_INCLUDE,
    });
    if (!career) {
      throw new NotFoundException('Carrera estudiantil no encontrada.');
    }
    return career;
  }

  private validateFile(file: UploadedHistoryPdf): void {
    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo PDF.');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }
    if (!file.buffer.length) {
      throw new BadRequestException('El archivo PDF está vacío.');
    }
  }
}

function matchPlanSubject(
  record: ParsedAcademicHistoryRecord,
  subjects: PlanSubject[],
): { mapping: SubjectMapping; subject: PlanSubject | null } {
  const exact = subjects.find((subject) => subject.code === record.courseCode);
  if (exact) return { mapping: 'EXACTA', subject: exact };

  const equivalent = subjects.filter((subject) =>
    subject.equivalenceCodes.has(record.courseCode),
  );
  if (equivalent.length === 1) {
    return { mapping: 'EQUIVALENCIA', subject: equivalent[0] };
  }
  if (equivalent.length > 1) {
    const byName = equivalent.find(
      (subject) =>
        normalizeAcademicText(subject.name) ===
        normalizeAcademicText(record.subjectName),
    );
    return { mapping: 'EQUIVALENCIA', subject: byName ?? equivalent[0] };
  }

  const byName = subjects.find(
    (subject) =>
      normalizeAcademicText(subject.name) ===
      normalizeAcademicText(record.subjectName),
  );
  return byName
    ? { mapping: 'NOMBRE', subject: byName }
    : { mapping: 'COMPLEMENTARIA', subject: null };
}

function summarize(records: ValidatedAcademicHistoryRecord[]) {
  return {
    approved: records.filter((record) => record.status === 'APROBADA').length,
    approvedCredits: records
      .filter((record) =>
        ['APROBADA', 'CONVALIDADA'].includes(record.status ?? ''),
      )
      .reduce((total, record) => total + record.credits, 0),
    complementary: records.filter(
      (record) => record.mapping === 'COMPLEMENTARIA',
    ).length,
    create: records.filter((record) => record.action === 'CREAR').length,
    periods: new Set(records.map((record) => record.periodCode)).size,
    retired: records.filter((record) => record.status === 'RETIRADA').length,
    total: records.length,
    update: records.filter((record) => record.action === 'ACTUALIZAR').length,
    unchanged: records.filter((record) => record.action === 'SIN_CAMBIOS')
      .length,
  };
}

function careerSummary(career: CareerContext) {
  return {
    campus: career.recinto_carreras.recintos.nombre,
    career: career.planes_estudio.carreras.nombre,
    careerId: career.id_estudiante_carrera.toString(),
    matricula: career.estudiantes.matricula,
    plan: career.planes_estudio.nombre,
    planCode: career.planes_estudio.codigo,
    studentName:
      `${career.estudiantes.usuarios.nombres} ${career.estudiantes.usuarios.apellidos}`.trim(),
  };
}

function careerMatches(source: string, expected: string): boolean {
  const sourceWords = new Set(
    normalizeAcademicText(source).split(' ').filter(Boolean),
  );
  const expectedWords = new Set(
    normalizeAcademicText(expected).split(' ').filter(Boolean),
  );
  const ignored = new Set(['licenciatura', 'licenciado', 'en', 'info']);
  const relevantSource = [...sourceWords].filter((word) => !ignored.has(word));
  return relevantSource.some((word) => expectedWords.has(word));
}

function deduplicateIssues(
  issues: AcademicHistoryIssue[],
): AcademicHistoryIssue[] {
  const unique = new Map<string, AcademicHistoryIssue>();
  for (const issue of issues) {
    const key = `${issue.code}:${issue.periodCode ?? ''}:${issue.subjectCode ?? ''}`;
    if (!unique.has(key)) unique.set(key, issue);
  }
  return [...unique.values()];
}

function decimalEquals(
  decimal: { toNumber(): number } | null,
  value: number | null,
): boolean {
  return (decimal?.toNumber() ?? null) === value;
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador de carrera inválido.');
  }
}
