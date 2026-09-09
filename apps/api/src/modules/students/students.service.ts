import { meetsAcademicPolicy } from './academic-policy';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { evaluateAcademicRequirements } from './academic-eligibility';
import { selectEffectiveAcademicAttempts } from './academic-history-results';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { CreateStudentCareerDto } from './dto/create-student-career.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { UpdateStudentCareerDto } from './dto/update-student-career.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const STUDENT_ROLE_CODE = 'ESTUDIANTE';
const PASSING_STATUSES = new Set(['APROBADA', 'CONVALIDADA']);

const STUDENT_INCLUDE = {
  usuarios: {
    include: {
      usuario_roles_usuario_roles_id_usuarioTousuarios: {
        include: { roles: true },
      },
    },
  },
  estudiante_carreras: {
    include: {
      planes_estudio: { include: { carreras: true } },
      recinto_carreras: { include: { carreras: true, recintos: true } },
      _count: { select: { historial_academico: true } },
    },
    orderBy: [{ es_principal: 'desc' }, { created_at: 'desc' }],
  },
} satisfies Prisma.estudiantesInclude;

type StudentRecord = Prisma.estudiantesGetPayload<{
  include: typeof STUDENT_INCLUDE;
}>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(search?: string) {
    const term = search?.trim();
    const students = await this.prisma.estudiantes.findMany({
      where: {
        usuarios: { deleted_at: null },
        ...(term
          ? {
              OR: [
                { matricula: { contains: term } },
                { usuarios: { nombres: { contains: term } } },
                { usuarios: { apellidos: { contains: term } } },
                { usuarios: { email: { contains: term } } },
              ],
            }
          : {}),
      },
      include: STUDENT_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return { items: students.map(mapStudent), total: students.length };
  }

  async get(id: string) {
    return mapStudent(await this.findStudent(parseId(id)));
  }

  async getOwnProfile(userId: string) {
    const student = await this.findStudentByUser(parseId(userId));
    return mapStudent(student);
  }

  async getOwnHistory(userId: string, careerId?: string) {
    const student = await this.findStudentByUser(parseId(userId));
    const selected = this.selectOwnedCareer(student, careerId);
    if (!selected) return { items: [], total: 0 };
    return this.history(selected.id_estudiante_carrera.toString());
  }

  async getOwnEligibility(userId: string, careerId?: string) {
    const student = await this.findStudentByUser(parseId(userId));
    const selected = this.selectOwnedCareer(student, careerId);
    return this.eligibility(
      student.id_estudiante.toString(),
      selected?.id_estudiante_carrera.toString(),
    );
  }

  async catalogs() {
    const [studentRole, campusCareers, studyPlans, subjects, planSubjects] =
      await Promise.all([
        this.prisma.roles.findFirst({
          where: { codigo: STUDENT_ROLE_CODE, estado: 'ACTIVO' },
          select: { id_rol: true, codigo: true, nombre: true },
        }),
        this.prisma.recinto_carreras.findMany({
          where: { estado: 'ACTIVO' },
          include: { carreras: true, recintos: true },
          orderBy: [
            { recintos: { nombre: 'asc' } },
            { carreras: { nombre: 'asc' } },
          ],
        }),
        this.prisma.planes_estudio.findMany({
          where: { estado: 'ACTIVO' },
          include: { carreras: true },
          orderBy: [{ carreras: { nombre: 'asc' } }, { anio_inicio: 'desc' }],
        }),
        this.prisma.asignaturas.findMany({
          where: { estado: 'ACTIVO' },
          orderBy: [{ codigo: 'asc' }],
        }),
        this.prisma.plan_estudio_asignaturas.findMany({
          select: { id_plan_estudio: true, id_asignatura: true },
        }),
      ]);

    return {
      role: studentRole
        ? {
            id: studentRole.id_rol.toString(),
            code: studentRole.codigo,
            name: studentRole.nombre,
          }
        : null,
      campusCareers: campusCareers.map((item) => ({
        id: item.id_recinto_carrera.toString(),
        careerId: item.id_carrera.toString(),
        career: item.carreras.nombre,
        campus: item.recintos.nombre,
      })),
      studyPlans: studyPlans.map((plan) => ({
        id: plan.id_plan_estudio.toString(),
        careerId: plan.id_carrera.toString(),
        code: plan.codigo,
        name: plan.nombre,
        credits: plan.creditos_totales?.toNumber() ?? null,
      })),
      subjects: subjects.map((subject) => ({
        id: subject.id_asignatura.toString(),
        code: subject.codigo,
        name: subject.nombre,
        credits: subject.creditos.toNumber(),
      })),
      planSubjects: planSubjects.map((item) => ({
        studyPlanId: item.id_plan_estudio.toString(),
        subjectId: item.id_asignatura.toString(),
      })),
    };
  }

  async create(dto: CreateStudentDto, actorId: string) {
    const matricula = dto.matricula.trim().toUpperCase();
    const passwordHash = await this.auth.hashPassword(dto.password);

    try {
      const student = await this.prisma.$transaction(async (database) => {
        const studentRole = await database.roles.findFirst({
          where: { codigo: STUDENT_ROLE_CODE, estado: 'ACTIVO' },
          select: { id_rol: true },
        });
        if (!studentRole) {
          throw new BadRequestException(
            'El rol Estudiante no está disponible en la base de datos.',
          );
        }

        const user = await database.usuarios.create({
          data: {
            uuid: randomUUID(),
            matricula,
            codigo_empleado: null,
            nombres: dto.firstName.trim(),
            apellidos: dto.lastName.trim(),
            email: dto.email.trim().toLowerCase(),
            telefono: dto.phone?.trim() || null,
            password_hash: passwordHash,
            estado: 'ACTIVO',
          },
        });
        await database.usuario_roles.create({
          data: {
            id_usuario: user.id_usuario,
            id_rol: studentRole.id_rol,
            asignado_por: parseId(actorId),
          },
        });
        const created = await database.estudiantes.create({
          data: {
            id_usuario: user.id_usuario,
            matricula,
            whatsapp: dto.whatsapp?.trim() || null,
            fecha_nacimiento: dto.birthDate ? new Date(dto.birthDate) : null,
          },
        });
        return database.estudiantes.findUniqueOrThrow({
          where: { id_estudiante: created.id_estudiante },
          include: STUDENT_INCLUDE,
        });
      });
      return mapStudent(student);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ConflictException(
        'No se pudo crear el perfil. Verifica que matrícula y correo sean únicos.',
      );
    }
  }

  async update(id: string, dto: UpdateStudentDto) {
    const current = await this.findStudent(parseId(id));
    const matricula = dto.matricula?.trim().toUpperCase();
    try {
      await this.prisma.$transaction(async (database) => {
        await database.usuarios.update({
          where: { id_usuario: current.id_usuario },
          data: {
            ...((dto.phone !== undefined &&
              dto.phone.trim() !== current.usuarios.telefono) ||
            (dto.whatsapp !== undefined &&
              dto.whatsapp.trim() !== current.whatsapp)
              ? { whatsapp_confirmado_at: null }
              : {}),
            ...(matricula ? { matricula } : {}),
            ...(dto.firstName ? { nombres: dto.firstName.trim() } : {}),
            ...(dto.lastName ? { apellidos: dto.lastName.trim() } : {}),
            ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
            ...(dto.phone !== undefined
              ? { telefono: dto.phone.trim() || null }
              : {}),
            ...(dto.password
              ? { password_hash: await this.auth.hashPassword(dto.password) }
              : {}),
          },
        });
        await database.estudiantes.update({
          where: { id_estudiante: current.id_estudiante },
          data: {
            ...(matricula ? { matricula } : {}),
            ...(dto.whatsapp !== undefined
              ? { whatsapp: dto.whatsapp.trim() || null }
              : {}),
            ...(dto.birthDate !== undefined
              ? {
                  fecha_nacimiento: dto.birthDate
                    ? new Date(dto.birthDate)
                    : null,
                }
              : {}),
          },
        });
      });
      return this.get(id);
    } catch {
      throw new ConflictException(
        'No se pudo actualizar el perfil. Revisa los datos únicos.',
      );
    }
  }

  async deactivate(id: string) {
    const student = await this.findStudent(parseId(id));
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.sesiones.updateMany({
        where: { id_usuario: student.id_usuario, revocada_at: null },
        data: { revocada_at: now },
      }),
      this.prisma.usuarios.update({
        where: { id_usuario: student.id_usuario },
        data: { estado: 'INACTIVO', deleted_at: now },
      }),
    ]);
    return { deactivated: true, id };
  }

  async addCareer(studentId: string, dto: CreateStudentCareerDto) {
    const id = parseId(studentId);
    await this.findStudent(id);
    const campusCareerId = parseId(dto.campusCareerId);
    const studyPlanId = parseId(dto.studyPlanId);
    await this.ensureMatchingCareer(campusCareerId, studyPlanId);

    try {
      const career = await this.prisma.$transaction(async (database) => {
        if (dto.primary !== false) {
          await database.estudiante_carreras.updateMany({
            where: { id_estudiante: id },
            data: { es_principal: false },
          });
        }
        return database.estudiante_carreras.create({
          data: {
            id_estudiante: id,
            id_recinto_carrera: campusCareerId,
            id_plan_estudio: studyPlanId,
            fecha_ingreso: dto.entryDate ? new Date(dto.entryDate) : null,
            fecha_egreso: dto.graduationDate
              ? new Date(dto.graduationDate)
              : null,
            es_principal: dto.primary !== false,
          },
        });
      });
      return { id: career.id_estudiante_carrera.toString() };
    } catch {
      throw new ConflictException(
        'Esa carrera y plan ya están asociados al estudiante.',
      );
    }
  }

  async updateCareer(careerId: string, dto: UpdateStudentCareerDto) {
    const id = parseId(careerId);
    const current = await this.prisma.estudiante_carreras.findUnique({
      where: { id_estudiante_carrera: id },
    });
    if (!current)
      throw new NotFoundException('Carrera estudiantil no encontrada.');
    const campusCareerId = dto.campusCareerId
      ? parseId(dto.campusCareerId)
      : current.id_recinto_carrera;
    const studyPlanId = dto.studyPlanId
      ? parseId(dto.studyPlanId)
      : current.id_plan_estudio;
    await this.ensureMatchingCareer(campusCareerId, studyPlanId);

    await this.prisma.$transaction(async (database) => {
      if (dto.primary) {
        await database.estudiante_carreras.updateMany({
          where: { id_estudiante: current.id_estudiante },
          data: { es_principal: false },
        });
      }
      await database.estudiante_carreras.update({
        where: { id_estudiante_carrera: id },
        data: {
          id_recinto_carrera: campusCareerId,
          id_plan_estudio: studyPlanId,
          ...(dto.entryDate !== undefined
            ? { fecha_ingreso: dto.entryDate ? new Date(dto.entryDate) : null }
            : {}),
          ...(dto.graduationDate !== undefined
            ? {
                fecha_egreso: dto.graduationDate
                  ? new Date(dto.graduationDate)
                  : null,
              }
            : {}),
          ...(dto.primary !== undefined ? { es_principal: dto.primary } : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
    });
    return { updated: true, id: careerId };
  }

  async history(careerId: string) {
    const id = parseId(careerId);
    await this.ensureCareer(id);
    const records = await this.prisma.historial_academico.findMany({
      where: { id_estudiante_carrera: id },
      include: { asignaturas: true },
      orderBy: [{ periodo_codigo: 'desc' }, { asignaturas: { codigo: 'asc' } }],
    });
    const effectiveRecords = selectEffectiveAcademicAttempts(records);
    return {
      items: effectiveRecords.map(mapHistory),
      total: effectiveRecords.length,
      totalAttempts: records.length,
    };
  }

  async addHistory(careerId: string, dto: CreateAcademicRecordDto) {
    const id = parseId(careerId);
    const career = await this.ensureCareer(id);
    const subjectId = parseId(dto.subjectId);
    await this.ensureSubjectInPlan(career.id_plan_estudio, subjectId);
    try {
      const record = await this.prisma.historial_academico.create({
        data: {
          id_estudiante_carrera: id,
          id_asignatura: subjectId,
          periodo_codigo: dto.periodCode.trim().toUpperCase(),
          calificacion: dto.grade,
          calificacion_laboratorio: dto.laboratoryGrade ?? null,
          calificacion_laboratorio_literal:
            dto.laboratoryGrade == null
              ? null
              : laboratoryLiteral(dto.laboratoryGrade),
          estado_asignatura: dto.status,
          fuente: dto.source?.trim() || 'REGISTRO_SIGMA',
        },
        include: { asignaturas: true },
      });
      return mapHistory(record);
    } catch {
      throw new ConflictException(
        'Ya existe un registro de esa asignatura para el período indicado.',
      );
    }
  }

  async updateHistory(recordId: string, dto: UpdateAcademicRecordDto) {
    const id = parseId(recordId);
    const current = await this.prisma.historial_academico.findUnique({
      where: { id_historial: id },
      include: { estudiante_carreras: true },
    });
    if (!current)
      throw new NotFoundException('Registro académico no encontrado.');
    const subjectId = dto.subjectId
      ? parseId(dto.subjectId)
      : current.id_asignatura;
    await this.ensureSubjectInPlan(
      current.estudiante_carreras.id_plan_estudio,
      subjectId,
    );
    const record = await this.prisma.historial_academico.update({
      where: { id_historial: id },
      data: {
        id_asignatura: subjectId,
        ...(dto.periodCode
          ? { periodo_codigo: dto.periodCode.trim().toUpperCase() }
          : {}),
        ...(dto.grade !== undefined ? { calificacion: dto.grade } : {}),
        ...(dto.laboratoryGrade !== undefined
          ? {
              calificacion_laboratorio: dto.laboratoryGrade,
              calificacion_laboratorio_literal:
                dto.laboratoryGrade === null
                  ? null
                  : laboratoryLiteral(dto.laboratoryGrade),
            }
          : {}),
        ...(dto.status ? { estado_asignatura: dto.status } : {}),
        ...(dto.source !== undefined
          ? { fuente: dto.source.trim() || null }
          : {}),
        fecha_actualizacion: new Date(),
      },
      include: { asignaturas: true },
    });
    return mapHistory(record);
  }

  async removeHistory(recordId: string) {
    const id = parseId(recordId);
    const exists = await this.prisma.historial_academico.count({
      where: { id_historial: id },
    });
    if (!exists)
      throw new NotFoundException('Registro académico no encontrado.');
    await this.prisma.historial_academico.delete({
      where: { id_historial: id },
    });
    return { deleted: true, id: recordId };
  }

  async eligibility(studentId: string, careerId?: string) {
    const student = await this.findStudent(parseId(studentId));
    const selected = careerId
      ? student.estudiante_carreras.find(
          (career) => career.id_estudiante_carrera === parseId(careerId),
        )
      : (student.estudiante_carreras.find((career) => career.es_principal) ??
        student.estudiante_carreras[0]);
    if (!selected) {
      return {
        eligible: false,
        completionPercentage: 0,
        reason:
          'El estudiante no tiene una carrera y plan de estudio asociados.',
        pendingSubjects: [],
      };
    }

    const [requirements, history] = await Promise.all([
      this.prisma.plan_estudio_asignaturas.findMany({
        where: { id_plan_estudio: selected.id_plan_estudio },
        include: { asignaturas: true },
      }),
      this.prisma.historial_academico.findMany({
        where: { id_estudiante_carrera: selected.id_estudiante_carrera },
        include: { asignaturas: true },
        orderBy: { fecha_actualizacion: 'desc' },
      }),
    ]);
    const passedHistory = history.filter((record) =>
      PASSING_STATUSES.has(record.estado_asignatura),
    );
    const evaluation = evaluateAcademicRequirements(
      requirements.map((requirement) => ({
        code: requirement.asignaturas.codigo,
        credits:
          requirement.creditos_plan?.toNumber() ??
          requirement.asignaturas.creditos.toNumber(),
        equivalences: requirement.equivalencias_texto,
        id: requirement.id_asignatura.toString(),
        mandatory: requirement.obligatoria,
        name: requirement.asignaturas.nombre,
        order: requirement.orden,
        semester: requirement.semestre,
        type: requirement.tipo,
      })),
      passedHistory.map((record) => ({
        code: record.asignaturas.codigo,
        name: record.asignaturas.nombre,
      })),
    );
    const pendingSubjects = evaluation.pendingBlockingRequirements.map(
      (requirement) => ({
        code: requirement.code,
        credits: requirement.credits,
        id: requirement.id,
        name: requirement.name,
      }),
    );
    if (evaluation.electiveCredits.pending > 0) {
      pendingSubjects.push({
        code: 'OPTATIVAS',
        credits: evaluation.electiveCredits.pending,
        id: `elective-credits-${selected.id_plan_estudio.toString()}`,
        name: `Créditos optativos pendientes: ${evaluation.electiveCredits.pending} de ${evaluation.electiveCredits.required}`,
      });
    }
    const hasRequirements = evaluation.requiredRequirements > 0;
    const eligible =
      hasRequirements &&
      meetsAcademicPolicy(
        evaluation.pendingBlockingRequirements,
        evaluation.electiveCredits.pending,
        {
          maxSubjects: selected.planes_estudio.max_asignaturas_pendientes ?? 0,
          maxCredits: selected.planes_estudio.max_creditos_pendientes ?? 0,
          fromSemester: selected.planes_estudio.desde_semestre ?? 1,
        },
      );
    const graduationRequirements = evaluation.pendingGraduationRequirements.map(
      (requirement) => ({
        code: requirement.code,
        credits: requirement.credits,
        id: requirement.id,
        name: requirement.name,
      }),
    );

    return {
      student: { id: studentId, matricula: student.matricula },
      career: {
        id: selected.id_estudiante_carrera.toString(),
        name: selected.recinto_carreras.carreras.nombre,
        campus: selected.recinto_carreras.recintos.nombre,
        studyPlan: selected.planes_estudio.nombre,
      },
      eligible,
      completionPercentage: evaluation.completionPercentage,
      requiredSubjects: evaluation.requiredRequirements,
      completedSubjects: evaluation.completedRequirements,
      electiveCredits: evaluation.electiveCredits,
      graduationRequirements,
      pendingSubjects,
      academicPolicy: {
        maxSubjects: selected.planes_estudio.max_asignaturas_pendientes ?? 0,
        maxCredits: selected.planes_estudio.max_creditos_pendientes ?? 0,
        fromSemester: selected.planes_estudio.desde_semestre ?? 1,
      },
      reason:
        eligible && pendingSubjects.length
          ? 'Cumple la tolerancia de asignaturas y créditos de los últimos semestres configurada para este plan.'
          : !hasRequirements
            ? 'El plan de estudio no tiene asignaturas obligatorias configuradas.'
            : evaluation.pendingBlockingRequirements.length &&
                evaluation.electiveCredits.pending
              ? `Existen asignaturas obligatorias pendientes y faltan ${evaluation.electiveCredits.pending} créditos optativos.`
              : evaluation.pendingBlockingRequirements.length
                ? 'Existen asignaturas obligatorias pendientes o no aprobadas.'
                : evaluation.electiveCredits.pending
                  ? `Faltan ${evaluation.electiveCredits.pending} créditos optativos válidos del plan.`
                  : graduationRequirements.length
                    ? `Cumple los requisitos previos. Puede inscribir ${graduationRequirements.map((requirement) => requirement.name).join(', ')}.`
                    : evaluation.electiveCredits.required
                      ? `Cumple las asignaturas obligatorias y los ${evaluation.electiveCredits.required} créditos optativos del plan.`
                      : 'Cumple el 100% de las asignaturas obligatorias del plan.',
      evaluatedAt: new Date().toISOString(),
    };
  }

  private async findStudent(id: bigint) {
    const student = await this.prisma.estudiantes.findFirst({
      where: { id_estudiante: id, usuarios: { deleted_at: null } },
      include: STUDENT_INCLUDE,
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado.');
    return student;
  }

  private async findStudentByUser(userId: bigint) {
    const student = await this.prisma.estudiantes.findFirst({
      where: { id_usuario: userId, usuarios: { deleted_at: null } },
      include: STUDENT_INCLUDE,
    });
    if (!student)
      throw new NotFoundException('Perfil estudiantil no encontrado.');
    return student;
  }

  private selectOwnedCareer(student: StudentRecord, careerId?: string) {
    if (careerId) {
      const id = parseId(careerId);
      const selected = student.estudiante_carreras.find(
        (career) => career.id_estudiante_carrera === id,
      );
      if (!selected)
        throw new NotFoundException('Carrera estudiantil no encontrada.');
      return selected;
    }
    return (
      student.estudiante_carreras.find((career) => career.es_principal) ??
      student.estudiante_carreras[0]
    );
  }

  private async ensureCareer(id: bigint) {
    const career = await this.prisma.estudiante_carreras.findUnique({
      where: { id_estudiante_carrera: id },
    });
    if (!career)
      throw new NotFoundException('Carrera estudiantil no encontrada.');
    return career;
  }

  private async ensureMatchingCareer(
    campusCareerId: bigint,
    studyPlanId: bigint,
  ) {
    const [campusCareer, plan] = await Promise.all([
      this.prisma.recinto_carreras.findFirst({
        where: { id_recinto_carrera: campusCareerId, estado: 'ACTIVO' },
      }),
      this.prisma.planes_estudio.findFirst({
        where: { id_plan_estudio: studyPlanId, estado: 'ACTIVO' },
      }),
    ]);
    if (!campusCareer || !plan || campusCareer.id_carrera !== plan.id_carrera) {
      throw new BadRequestException(
        'El recinto, la carrera y el plan de estudio no son compatibles.',
      );
    }
  }

  private async ensureSubjectInPlan(studyPlanId: bigint, subjectId: bigint) {
    const exists = await this.prisma.plan_estudio_asignaturas.count({
      where: { id_plan_estudio: studyPlanId, id_asignatura: subjectId },
    });
    if (!exists) {
      throw new BadRequestException(
        'La asignatura no pertenece al plan de estudio seleccionado.',
      );
    }
  }
}

function mapStudent(student: StudentRecord) {
  return {
    id: student.id_estudiante.toString(),
    userId: student.id_usuario.toString(),
    matricula: student.matricula,
    firstName: student.usuarios.nombres,
    lastName: student.usuarios.apellidos,
    name: `${student.usuarios.nombres} ${student.usuarios.apellidos}`.trim(),
    email: student.usuarios.email,
    phone: student.usuarios.telefono,
    whatsapp: student.whatsapp,
    birthDate: student.fecha_nacimiento,
    status: student.usuarios.estado,
    role:
      student.usuarios.usuario_roles_usuario_roles_id_usuarioTousuarios
        .filter(({ roles }) => roles.codigo === STUDENT_ROLE_CODE)
        .map(({ roles }) => ({
          id: roles.id_rol.toString(),
          code: roles.codigo,
          name: roles.nombre,
        }))[0] ?? null,
    careers: student.estudiante_carreras.map((career) => ({
      id: career.id_estudiante_carrera.toString(),
      campusCareerId: career.id_recinto_carrera.toString(),
      studyPlanId: career.id_plan_estudio.toString(),
      career: career.recinto_carreras.carreras.nombre,
      campus: career.recinto_carreras.recintos.nombre,
      studyPlan: career.planes_estudio.nombre,
      entryDate: career.fecha_ingreso,
      graduationDate: career.fecha_egreso,
      status: career.estado,
      primary: career.es_principal,
      historyCount: career._count.historial_academico,
    })),
    createdAt: student.created_at,
  };
}

function mapHistory(record: {
  id_historial: bigint;
  id_asignatura: bigint;
  periodo_codigo: string;
  calificacion: Prisma.Decimal | null;
  calificacion_laboratorio: Prisma.Decimal | null;
  calificacion_laboratorio_literal: string | null;
  estado_asignatura: string;
  fuente: string | null;
  fecha_actualizacion: Date;
  asignaturas: {
    codigo: string;
    nombre: string;
    creditos: Prisma.Decimal;
  };
}) {
  return {
    id: record.id_historial.toString(),
    subjectId: record.id_asignatura.toString(),
    subjectCode: record.asignaturas.codigo,
    subjectName: record.asignaturas.nombre,
    credits: record.asignaturas.creditos.toNumber(),
    periodCode: record.periodo_codigo,
    grade: record.calificacion?.toNumber() ?? null,
    laboratoryGrade: record.calificacion_laboratorio?.toNumber() ?? null,
    laboratoryGradeText: record.calificacion_laboratorio_literal,
    status: record.estado_asignatura,
    source: record.fuente,
    updatedAt: record.fecha_actualizacion,
  };
}

function laboratoryLiteral(value: number): string {
  return `L${Number.isInteger(value) ? value : String(value).replace('.', ',')}`;
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
