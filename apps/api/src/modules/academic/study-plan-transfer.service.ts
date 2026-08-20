import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import type { UploadedPdfFile } from './types/uploaded-pdf-file';
import {
  ParsedStudyPlan,
  StudyPlanParserService,
} from './study-plan-parser.service';

interface PendingImport {
  createdAt: number;
  plan: ParsedStudyPlan;
}

@Injectable()
export class StudyPlanTransferService {
  private readonly pending = new Map<string, PendingImport>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: StudyPlanParserService,
  ) {}

  async preview(file: UploadedPdfFile) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo PDF.');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }

    const plan = await this.parser.parse(file.buffer);

    const existingSubjects = await this.prisma.asignaturas.findMany({
      where: {
        codigo: {
          in: plan.subjects.map((subject) => subject.code),
        },
      },
      select: {
        id_asignatura: true,
        codigo: true,
        nombre: true,
        creditos: true,
      },
    });

    const existingCodes = new Set(existingSubjects.map((item) => item.codigo));

    const career = plan.careerCode
      ? await this.prisma.carreras.findUnique({
          where: {
            codigo: plan.careerCode,
          },
          include: {
            escuelas: {
              include: {
                facultades: true,
              },
            },
          },
        })
      : null;

    const currentPlan = await this.prisma.planes_estudio.findUnique({
      where: {
        codigo: plan.planCode,
      },
    });

    const token = randomUUID();

    this.pending.set(token, {
      createdAt: Date.now(),
      plan,
    });

    this.cleanup();

    return {
      token,

      plan,

      detection: {
        careerExists: Boolean(career),
        studyPlanExists: Boolean(currentPlan),

        existingSubjects: existingSubjects.length,
        newSubjects: plan.subjects.length - existingSubjects.length,

        subjects: plan.subjects.map((subject) => ({
          ...subject,
          exists: existingCodes.has(subject.code),
        })),
      },

      matchedCareer: career
        ? {
            id: career.id_carrera.toString(),
            code: career.codigo,
            name: career.nombre,
            school: career.escuelas.nombre,
            faculty: career.escuelas.facultades.nombre,
          }
        : null,
    };
  }

  async confirm(token: string, campusIds: string[]) {
    const pending = this.pending.get(token);

    if (!pending) {
      throw new BadRequestException(
        'La previsualización expiró. Vuelve a subir el PDF.',
      );
    }

    if (!campusIds.length) {
      throw new BadRequestException('Debes seleccionar al menos un recinto.');
    }

    const { plan } = pending;

    const result = await this.prisma.$transaction(async (tx) => {
      const faculty = await tx.facultades.upsert({
        where: {
          nombre: plan.faculty,
        },
        update: {},
        create: {
          codigo: generatedCode('FAC', plan.faculty),
          nombre: plan.faculty,
        },
      });

      let school = await tx.escuelas.findFirst({
        where: {
          id_facultad: faculty.id_facultad,
          nombre: plan.school,
        },
      });

      if (!school) {
        school = await tx.escuelas.create({
          data: {
            id_facultad: faculty.id_facultad,
            codigo: generatedCode('ESC', plan.school),
            nombre: plan.school,
          },
        });
      }

      let career = await tx.carreras.findUnique({
        where: {
          codigo: plan.careerCode,
        },
      });

      if (!career) {
        career = await tx.carreras.create({
          data: {
            id_escuela: school.id_escuela,
            codigo: plan.careerCode || generatedCode('CAR', plan.career),

            nombre: plan.career,
            nivel_academico: 'GRADO',
          },
        });
      }

      let studyPlan = await tx.planes_estudio.findUnique({
        where: {
          codigo: plan.planCode,
        },
      });

      if (!studyPlan) {
        studyPlan = await tx.planes_estudio.create({
          data: {
            id_carrera: career.id_carrera,
            codigo: plan.planCode,

            nombre: `${plan.career} - Plan ${plan.planCode}`,

            anio_inicio: extractPlanYear(plan.planCode),

            creditos_totales: plan.totalCredits ?? undefined,
          },
        });
      }

      const subjectIds = new Map<string, bigint>();

      for (const subject of plan.subjects) {
        const saved = await tx.asignaturas.upsert({
          where: {
            codigo: subject.code,
          },

          update: {
            nombre: subject.name,

            horas_teoricas: subject.theoreticalHours,
            horas_practicas: subject.practicalHours,

            creditos: subject.credits,
          },

          create: {
            codigo: subject.code,
            nombre: subject.name,

            horas_teoricas: subject.theoreticalHours,
            horas_practicas: subject.practicalHours,

            creditos: subject.credits,
          },
        });

        subjectIds.set(subject.code, saved.id_asignatura);

        await tx.plan_estudio_asignaturas.upsert({
          where: {
            id_plan_estudio_id_asignatura: {
              id_plan_estudio: studyPlan.id_plan_estudio,

              id_asignatura: saved.id_asignatura,
            },
          },

          update: {
            semestre: subject.semester,
            obligatoria: subject.mandatory,

            creditos_plan: subject.credits,

            prerrequisitos_texto: subject.prerequisiteText,

            equivalencias_texto: subject.equivalenceText,

            tipo: subject.type,
            orden: subject.order,
          },

          create: {
            id_plan_estudio: studyPlan.id_plan_estudio,

            id_asignatura: saved.id_asignatura,

            semestre: subject.semester,
            obligatoria: subject.mandatory,

            creditos_plan: subject.credits,

            prerrequisitos_texto: subject.prerequisiteText,

            equivalencias_texto: subject.equivalenceText,

            tipo: subject.type,
            orden: subject.order,
          },
        });
      }

      const campuses = await tx.recintos.findMany({
        where: {
          id_recinto: {
            in: campusIds.map(toBigInt),
          },
        },
      });

      if (campuses.length !== campusIds.length) {
        throw new NotFoundException(
          'Uno o más recintos seleccionados no existen.',
        );
      }

      for (const campus of campuses) {
        const campusCareer = await tx.recinto_carreras.upsert({
          where: {
            id_recinto_id_carrera: {
              id_recinto: campus.id_recinto,
              id_carrera: career.id_carrera,
            },
          },

          update: {
            estado: 'ACTIVO',
          },

          create: {
            id_recinto: campus.id_recinto,
            id_carrera: career.id_carrera,
          },
        });

        await tx.recinto_carrera_planes.upsert({
          where: {
            id_recinto_carrera_id_plan_estudio: {
              id_recinto_carrera: campusCareer.id_recinto_carrera,

              id_plan_estudio: studyPlan.id_plan_estudio,
            },
          },

          update: {
            estado: 'ACTIVO',
          },

          create: {
            id_recinto_carrera: campusCareer.id_recinto_carrera,

            id_plan_estudio: studyPlan.id_plan_estudio,
          },
        });
      }

      return {
        studyPlanId: studyPlan.id_plan_estudio.toString(),

        careerId: career.id_carrera.toString(),

        subjects: plan.subjects.length,

        campuses: campuses.length,
      };
    });

    this.pending.delete(token);

    return {
      imported: true,
      ...result,
    };
  }

  private cleanup(): void {
    const expiration = Date.now() - 30 * 60 * 1000;

    for (const [token, entry] of this.pending) {
      if (entry.createdAt < expiration) {
        this.pending.delete(token);
      }
    }
  }
}

function generatedCode(prefix: string, name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 15);

  return `${prefix}-${slug}`;
}

function extractPlanYear(code: string): number {
  const firstFour = Number(code.slice(0, 4));

  if (Number.isInteger(firstFour) && firstFour >= 1900 && firstFour <= 2200) {
    return firstFour;
  }

  return new Date().getFullYear();
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador de recinto inválido.');
  }
}
