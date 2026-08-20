import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignStudyPlanSubjectsDto,
  CreateCampusCareerDto,
  CreateCampusDto,
  CreateCareerDto,
  CreateFacultyDto,
  CreateSchoolDto,
  CreateStudyPlanDto,
  CreateSubjectDto,
  UpdateCampusCareerDto,
  UpdateCampusDto,
  UpdateCareerDto,
  UpdateFacultyDto,
  UpdateSchoolDto,
  UpdateStudyPlanDto,
  UpdateSubjectDto,
} from './dto/academic-structure.dto';

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}

  async structure() {
    const [
      campuses,
      faculties,
      schools,
      careers,
      campusCareers,
      studyPlans,
      subjects,
    ] = await Promise.all([
      this.prisma.recintos.findMany({
        include: { _count: { select: { recinto_carreras: true } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.facultades.findMany({
        include: { _count: { select: { escuelas: true } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.escuelas.findMany({
        include: {
          facultades: true,
          _count: { select: { carreras: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.carreras.findMany({
        include: {
          escuelas: { include: { facultades: true } },
          _count: { select: { planes_estudio: true, recinto_carreras: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.recinto_carreras.findMany({
        include: {
          recintos: true,
          carreras: true,
          _count: { select: { estudiante_carreras: true, ofertas: true } },
        },
        orderBy: [
          { recintos: { nombre: 'asc' } },
          { carreras: { nombre: 'asc' } },
        ],
      }),
      this.prisma.planes_estudio.findMany({
        include: {
          carreras: true,
          recinto_carrera_planes: {
            include: { recinto_carreras: true },
          },
          plan_estudio_asignaturas: {
            include: { asignaturas: true },
            orderBy: [{ semestre: 'asc' }, { asignaturas: { codigo: 'asc' } }],
          },
          _count: { select: { estudiante_carreras: true } },
        },
        orderBy: [{ carreras: { nombre: 'asc' } }, { anio_inicio: 'desc' }],
      }),
      this.prisma.asignaturas.findMany({
        include: {
          _count: {
            select: {
              plan_estudio_asignaturas: true,
              historial_academico: true,
            },
          },
        },
        orderBy: { codigo: 'asc' },
      }),
    ]);

    return {
      campuses: campuses.map((item) => ({
        id: item.id_recinto.toString(),
        code: item.codigo,
        name: item.nombre,
        address: item.direccion,
        phone: item.telefono,
        email: item.email,
        status: item.estado,
        careerCount: item._count.recinto_carreras,
      })),
      faculties: faculties.map((item) => ({
        id: item.id_facultad.toString(),
        code: item.codigo,
        name: item.nombre,
        status: item.estado,
        schoolCount: item._count.escuelas,
      })),
      schools: schools.map((item) => ({
        id: item.id_escuela.toString(),
        facultyId: item.id_facultad.toString(),
        faculty: item.facultades.nombre,
        code: item.codigo,
        name: item.nombre,
        status: item.estado,
        careerCount: item._count.carreras,
      })),
      careers: careers.map((item) => ({
        id: item.id_carrera.toString(),
        schoolId: item.id_escuela.toString(),
        school: item.escuelas.nombre,
        faculty: item.escuelas.facultades.nombre,
        code: item.codigo,
        name: item.nombre,
        academicLevel: item.nivel_academico,
        status: item.estado,
        studyPlanCount: item._count.planes_estudio,
        campusCount: item._count.recinto_carreras,
      })),
      campusCareers: campusCareers.map((item) => ({
        id: item.id_recinto_carrera.toString(),
        campusId: item.id_recinto.toString(),
        careerId: item.id_carrera.toString(),
        campus: item.recintos.nombre,
        career: item.carreras.nombre,
        status: item.estado,
        studentCount: item._count.estudiante_carreras,
        offerCount: item._count.ofertas,
      })),
      studyPlans: studyPlans.map((item) => ({
        id: item.id_plan_estudio.toString(),
        careerId: item.id_carrera.toString(),
        career: item.carreras.nombre,
        code: item.codigo,
        name: item.nombre,
        startYear: item.anio_inicio,
        endYear: item.anio_fin,
        totalCredits: item.creditos_totales?.toNumber() ?? null,
        status: item.estado,
        studentCount: item._count.estudiante_carreras,
        campusIds: [
          ...new Set(
            item.recinto_carrera_planes.map((relation) =>
              relation.recinto_carreras.id_recinto.toString(),
            ),
          ),
        ],
        subjects: item.plan_estudio_asignaturas.map((relation) => ({
          id: relation.id_asignatura.toString(),

          code: relation.asignaturas.codigo,

          name: relation.asignaturas.nombre,

          theoreticalHours: relation.asignaturas.horas_teoricas,

          practicalHours: relation.asignaturas.horas_practicas,

          semester: relation.semestre,

          mandatory: relation.obligatoria,

          type: relation.tipo,

          prerequisiteText: relation.prerrequisitos_texto,

          equivalenceText: relation.equivalencias_texto,

          order: relation.orden,

          credits:
            relation.creditos_plan?.toNumber() ??
            relation.asignaturas.creditos.toNumber(),
        })),
      })),

      subjects: subjects.map((item) => ({
        id: item.id_asignatura.toString(),

        code: item.codigo,
        name: item.nombre,

        theoreticalHours: item.horas_teoricas,

        practicalHours: item.horas_practicas,

        credits: item.creditos.toNumber(),

        status: item.estado,

        studyPlanCount: item._count.plan_estudio_asignaturas,

        historyCount: item._count.historial_academico,
      })),
    };
  }

  async createCampus(dto: CreateCampusDto) {
    try {
      const item = await this.prisma.recintos.create({
        data: {
          codigo: code(dto.code),
          nombre: dto.name.trim(),
          direccion: optional(dto.address),
          telefono: optional(dto.phone),
          email: optional(dto.email)?.toLowerCase() ?? null,
        },
      });
      return { id: item.id_recinto.toString() };
    } catch {
      throw duplicate('recinto');
    }
  }

  async updateCampus(id: string, dto: UpdateCampusDto) {
    try {
      await this.prisma.recintos.update({
        where: { id_recinto: parseId(id) },
        data: {
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.address !== undefined
            ? { direccion: optional(dto.address) }
            : {}),
          ...(dto.phone !== undefined ? { telefono: optional(dto.phone) } : {}),
          ...(dto.email !== undefined
            ? { email: optional(dto.email)?.toLowerCase() ?? null }
            : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('recinto');
    }
  }

  createFaculty(dto: CreateFacultyDto) {
    return this.createSimple('faculty', dto);
  }

  updateFaculty(id: string, dto: UpdateFacultyDto) {
    return this.updateSimple('faculty', id, dto);
  }

  async createSchool(dto: CreateSchoolDto) {
    try {
      const item = await this.prisma.escuelas.create({
        data: {
          id_facultad: parseId(dto.facultyId),
          codigo: code(dto.code),
          nombre: dto.name.trim(),
        },
      });
      return { id: item.id_escuela.toString() };
    } catch {
      throw duplicate('escuela');
    }
  }

  async updateSchool(id: string, dto: UpdateSchoolDto) {
    try {
      await this.prisma.escuelas.update({
        where: { id_escuela: parseId(id) },
        data: {
          ...(dto.facultyId ? { id_facultad: parseId(dto.facultyId) } : {}),
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('escuela');
    }
  }

  async createCareer(dto: CreateCareerDto) {
    try {
      const item = await this.prisma.carreras.create({
        data: {
          id_escuela: parseId(dto.schoolId),
          codigo: code(dto.code),
          nombre: dto.name.trim(),
          nivel_academico: dto.academicLevel?.trim().toUpperCase() || 'GRADO',
        },
      });
      return { id: item.id_carrera.toString() };
    } catch {
      throw duplicate('carrera');
    }
  }

  async updateCareer(id: string, dto: UpdateCareerDto) {
    try {
      await this.prisma.carreras.update({
        where: { id_carrera: parseId(id) },
        data: {
          ...(dto.schoolId ? { id_escuela: parseId(dto.schoolId) } : {}),
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.academicLevel
            ? { nivel_academico: dto.academicLevel.trim().toUpperCase() }
            : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('carrera');
    }
  }

  async createCampusCareer(dto: CreateCampusCareerDto) {
    try {
      const item = await this.prisma.recinto_carreras.create({
        data: {
          id_recinto: parseId(dto.campusId),
          id_carrera: parseId(dto.careerId),
        },
      });
      return { id: item.id_recinto_carrera.toString() };
    } catch {
      throw duplicate('asociación de recinto y carrera');
    }
  }

  async updateCampusCareer(id: string, dto: UpdateCampusCareerDto) {
    try {
      await this.prisma.recinto_carreras.update({
        where: { id_recinto_carrera: parseId(id) },
        data: {
          ...(dto.campusId ? { id_recinto: parseId(dto.campusId) } : {}),
          ...(dto.careerId ? { id_carrera: parseId(dto.careerId) } : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('asociación de recinto y carrera');
    }
  }

  async createStudyPlan(dto: CreateStudyPlanDto) {
    if (dto.endYear && dto.endYear < dto.startYear) {
      throw new BadRequestException(
        'El año final no puede ser menor que el inicial.',
      );
    }
    try {
      const item = await this.prisma.planes_estudio.create({
        data: {
          id_carrera: parseId(dto.careerId),
          codigo: code(dto.code),
          nombre: dto.name.trim(),
          anio_inicio: dto.startYear,
          anio_fin: dto.endYear,
          creditos_totales: dto.totalCredits,
        },
      });
      return { id: item.id_plan_estudio.toString() };
    } catch {
      throw duplicate('plan de estudio');
    }
  }

  async updateStudyPlan(id: string, dto: UpdateStudyPlanDto) {
    const current = await this.prisma.planes_estudio.findUnique({
      where: { id_plan_estudio: parseId(id) },
    });
    if (!current) throw new NotFoundException('Plan de estudio no encontrado.');
    const startYear = dto.startYear ?? current.anio_inicio;
    const endYear = dto.endYear ?? current.anio_fin;
    if (endYear && endYear < startYear) {
      throw new BadRequestException(
        'El año final no puede ser menor que el inicial.',
      );
    }
    try {
      await this.prisma.planes_estudio.update({
        where: { id_plan_estudio: current.id_plan_estudio },
        data: {
          ...(dto.careerId ? { id_carrera: parseId(dto.careerId) } : {}),
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.startYear !== undefined
            ? { anio_inicio: dto.startYear }
            : {}),
          ...(dto.endYear !== undefined ? { anio_fin: dto.endYear } : {}),
          ...(dto.totalCredits !== undefined
            ? { creditos_totales: dto.totalCredits }
            : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('plan de estudio');
    }
  }

  async assignStudyPlanSubjects(id: string, dto: AssignStudyPlanSubjectsDto) {
    const planId = parseId(id);
    const plan = await this.prisma.planes_estudio.findUnique({
      where: { id_plan_estudio: planId },
    });
    if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
    const subjectIds = dto.items.map((item) => parseId(item.subjectId));
    const available = await this.prisma.asignaturas.count({
      where: { id_asignatura: { in: subjectIds }, estado: 'ACTIVO' },
    });
    if (available !== subjectIds.length) {
      throw new BadRequestException(
        'Una o más asignaturas no existen o están inactivas.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.plan_estudio_asignaturas.deleteMany({
        where: { id_plan_estudio: planId },
      }),
      this.prisma.plan_estudio_asignaturas.createMany({
        data: dto.items.map((item) => ({
          id_plan_estudio: planId,
          id_asignatura: parseId(item.subjectId),
          semestre: item.semester,
          obligatoria: item.mandatory ?? true,
          creditos_plan: item.planCredits,
          prerrequisitos_texto: optional(item.prerequisiteText),
          equivalencias_texto: optional(item.equivalenceText),
          tipo: item.type ?? 'REGULAR',
          orden: item.order,
        })),
      }),
    ]);
    return { updated: true, id, subjects: dto.items.length };
  }

  async createSubject(dto: CreateSubjectDto) {
    try {
      const item = await this.prisma.asignaturas.create({
        data: {
          codigo: code(dto.code),
          nombre: dto.name.trim(),
          horas_teoricas: dto.theoreticalHours ?? 0,
          horas_practicas: dto.practicalHours ?? 0,
          creditos: dto.credits,
        },
      });
      return { id: item.id_asignatura.toString() };
    } catch {
      throw duplicate('asignatura');
    }
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    try {
      await this.prisma.asignaturas.update({
        where: { id_asignatura: parseId(id) },
        data: {
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.theoreticalHours !== undefined
            ? { horas_teoricas: dto.theoreticalHours }
            : {}),
          ...(dto.practicalHours !== undefined
            ? { horas_practicas: dto.practicalHours }
            : {}),
          ...(dto.credits !== undefined ? { creditos: dto.credits } : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('asignatura');
    }
  }

  deleteCampus(id: string) {
    return this.deleteEntity('campus', id);
  }
  deleteFaculty(id: string) {
    return this.deleteEntity('faculty', id);
  }
  deleteSchool(id: string) {
    return this.deleteEntity('school', id);
  }
  deleteCareer(id: string) {
    return this.deleteEntity('career', id);
  }
  deleteCampusCareer(id: string) {
    return this.deleteEntity('campusCareer', id);
  }
  deleteStudyPlan(id: string) {
    return this.deleteEntity('studyPlan', id);
  }
  deleteSubject(id: string) {
    return this.deleteEntity('subject', id);
  }

  private async createSimple(type: 'faculty', dto: CreateFacultyDto) {
    try {
      const item = await this.prisma.facultades.create({
        data: { codigo: code(dto.code), nombre: dto.name.trim() },
      });
      return { id: item.id_facultad.toString() };
    } catch {
      throw duplicate('facultad');
    }
  }

  private async updateSimple(
    type: 'faculty',
    id: string,
    dto: UpdateFacultyDto,
  ) {
    void type;
    try {
      await this.prisma.facultades.update({
        where: { id_facultad: parseId(id) },
        data: {
          ...(dto.code ? { codigo: code(dto.code) } : {}),
          ...(dto.name ? { nombre: dto.name.trim() } : {}),
          ...(dto.status ? { estado: dto.status } : {}),
        },
      });
      return { updated: true, id };
    } catch {
      throw updateFailed('facultad');
    }
  }

  private async deleteEntity(
    type:
      | 'campus'
      | 'faculty'
      | 'school'
      | 'career'
      | 'campusCareer'
      | 'studyPlan'
      | 'subject',
    id: string,
  ) {
    const parsed = parseId(id);
    try {
      switch (type) {
        case 'campus':
          await this.prisma.recintos.delete({ where: { id_recinto: parsed } });
          break;
        case 'faculty':
          await this.prisma.facultades.delete({
            where: { id_facultad: parsed },
          });
          break;
        case 'school':
          await this.prisma.escuelas.delete({ where: { id_escuela: parsed } });
          break;
        case 'career':
          await this.prisma.carreras.delete({ where: { id_carrera: parsed } });
          break;
        case 'campusCareer':
          await this.prisma.recinto_carreras.delete({
            where: { id_recinto_carrera: parsed },
          });
          break;
        case 'studyPlan':
          await this.prisma.planes_estudio.delete({
            where: { id_plan_estudio: parsed },
          });
          break;
        case 'subject':
          await this.prisma.asignaturas.delete({
            where: { id_asignatura: parsed },
          });
          break;
      }
      return { deleted: true, id };
    } catch {
      throw new ConflictException(
        'No se puede eliminar porque el registro está relacionado con información académica. Puedes marcarlo como inactivo.',
      );
    }
  }
}

function parseId(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
function code(value: string) {
  return value.trim().toUpperCase();
}
function optional(value?: string) {
  return value?.trim() || null;
}
function duplicate(entity: string) {
  return new ConflictException(
    `No se pudo crear ${entity}. Verifica códigos y relaciones únicas.`,
  );
}
function updateFailed(entity: string) {
  return new ConflictException(
    `No se pudo actualizar ${entity}. Revisa los datos y relaciones.`,
  );
}
