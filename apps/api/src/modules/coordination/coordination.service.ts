import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AcademicAssignmentDto,
  AcademicReviewDto,
  DesignationDto,
  MilestoneDto,
  TeacherProcessDto,
  TeacherProfileDto,
  TeacherRequestDto,
} from './coordination.dto';
import { projectProgress } from './coordination-policy';
export interface AcademicFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
export const academicAdmin = (u: AuthenticatedUser) =>
  u.roles.some((r) => ['ADMIN', 'COORDINADOR', 'ENCARGADO'].includes(r));
export const documentStaff = (u: AuthenticatedUser) =>
  academicAdmin(u) ||
  u.roles.some((r) => ['SECRETARIA', 'OFICINISTA'].includes(r));
export function academicId(value: string) {
  if (!/^[1-9]\d*$/.test(value))
    throw new BadRequestException('Identificador inválido.');
  return BigInt(value);
}
const projectInclude = {
  inscripciones: {
    include: {
      ofertas: true,
      inscripcion_estudiantes: {
        include: {
          estudiantes: {
            include: {
              usuarios: {
                select: { id_usuario: true, nombres: true, apellidos: true },
              },
            },
          },
        },
      },
    },
  },
  proyecto_docentes: {
    where: { estado: 'ACTIVO' as const },
    include: {
      docentes: {
        include: {
          usuarios: {
            select: { nombres: true, apellidos: true, id_usuario: true },
          },
        },
      },
      tipos_participacion: true,
    },
  },
  areas_investigacion: true,
} as const;
type Project = Prisma.proyectos_gradoGetPayload<{
  include: typeof projectInclude;
}>;
const submissionSelect = {
  id_entrega: true,
  id_hito: true,
  id_proyecto: true,
  nombre_archivo: true,
  created_at: true,
  estado: true,
  retroalimentacion: true,
  revisado_at: true,
  revisado_por: true,
} as const;
const teacherFileSelect = {
  id_documento: true,
  nombre_archivo: true,
  created_at: true,
  estado: true,
  observacion: true,
  revisado_at: true,
} as const;
@Injectable()
export class CoordinationService {
  constructor(private readonly db: PrismaService) {}
  private projectScope(
    user: AuthenticatedUser,
  ): Prisma.proyectos_gradoWhereInput {
    if (documentStaff(user)) return {};
    const uid = academicId(user.id);
    return {
      OR: [
        { inscripciones: { ofertas: { coordinador_id: uid } } },
        {
          proyecto_docentes: {
            some: { estado: 'ACTIVO', docentes: { id_usuario: uid } },
          },
        },
        {
          inscripciones: {
            inscripcion_estudiantes: {
              some: { estudiantes: { id_usuario: uid } },
            },
          },
        },
      ],
    };
  }
  private offerScope(user: AuthenticatedUser): Prisma.ofertasWhereInput {
    if (documentStaff(user)) return {};
    const uid = academicId(user.id);
    return {
      OR: [
        { coordinador_id: uid },
        {
          inscripciones: {
            some: {
              OR: [
                {
                  inscripcion_estudiantes: {
                    some: { estudiantes: { id_usuario: uid } },
                  },
                },
                {
                  proyectos_grado: {
                    proyecto_docentes: {
                      some: { estado: 'ACTIVO', docentes: { id_usuario: uid } },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    };
  }
  private async offer(user: AuthenticatedUser, id: string, plan = false) {
    const row = await this.db.ofertas.findFirst({
      where: { id_oferta: academicId(id), ...this.offerScope(user) },
      include: {
        recinto_carreras: { include: { carreras: true } },
        designacion_academica: {
          include: {
            docente: {
              include: {
                usuarios: { select: { nombres: true, apellidos: true } },
              },
            },
            escuela: true,
          },
        },
      },
    });
    if (!row)
      throw new NotFoundException('Curso no disponible para tu usuario.');
    if (
      plan &&
      !academicAdmin(user) &&
      row.coordinador_id !== academicId(user.id)
    )
      throw new ForbiddenException(
        'Solo la coordinación designada puede planificar este curso.',
      );
    return row;
  }
  private async project(user: AuthenticatedUser, id: string, plan = false) {
    const row = await this.db.proyectos_grado.findFirst({
      where: { id_proyecto: academicId(id), ...this.projectScope(user) },
      include: projectInclude,
    });
    if (!row)
      throw new NotFoundException('Grupo de investigación no disponible.');
    if (plan)
      await this.offer(user, row.inscripciones.id_oferta.toString(), true);
    return row;
  }
  async workspace(user: AuthenticatedUser, offerId?: string) {
    const offers = await this.db.ofertas.findMany({
      where: this.offerScope(user),
      select: { id_oferta: true, titulo: true, modalidad_ensenanza: true },
      orderBy: { created_at: 'desc' },
    });
    const selectedId = offerId ?? offers[0]?.id_oferta.toString();
    const ownTeacher = await this.db.docentes.findUnique({
      where: { id_usuario: academicId(user.id) },
      include: {
        perfil_academico: true,
        usuarios: { select: { nombres: true, apellidos: true } },
      },
    });
    const base = {
      offers: offers.map((o) => ({
        id: o.id_oferta.toString(),
        title: o.titulo,
        teachingMode: o.modalidad_ensenanza,
      })),
      ownTeacherId: ownTeacher?.id_docente.toString() ?? null,
    };
    if (!selectedId)
      return {
        ...base,
        course: null,
        projects: [],
        submissions: [],
        milestones: [],
        requests: [],
        teachers: ownTeacher
          ? [
              {
                id: ownTeacher.id_docente.toString(),
                name: `${ownTeacher.usuarios.nombres} ${ownTeacher.usuarios.apellidos}`,
                canEdit: true,
                groups: 0,
                students: 0,
                profile: ownTeacher.perfil_academico
                  ? {
                      specialties: ownTeacher.perfil_academico.especialidades,
                      availability: ownTeacher.perfil_academico.disponibilidad,
                      maxGroups: ownTeacher.perfil_academico.max_grupos,
                      maxStudents: ownTeacher.perfil_academico.max_estudiantes,
                      available: ownTeacher.perfil_academico.disponible,
                    }
                  : null,
              },
            ]
          : [],
      };
    const course = await this.offer(user, selectedId);
    const canPlan =
      academicAdmin(user) || course.coordinador_id === academicId(user.id);
    const projects = await this.db.proyectos_grado.findMany({
      where: {
        ...this.projectScope(user),
        inscripciones: { id_oferta: course.id_oferta },
        AND: [this.projectScope(user)],
      },
      include: projectInclude,
      orderBy: { created_at: 'asc' },
    });
    const projectIds = projects.map((p) => p.id_proyecto);
    const [milestones, submissions, teachers, requests] = await Promise.all([
      this.db.hitos_academicos.findMany({
        where: {
          id_oferta: course.id_oferta,
          OR: [{ id_proyecto: null }, { id_proyecto: { in: projectIds } }],
        },
        orderBy: { fecha_limite: 'asc' },
      }),
      this.db.entregas_academicas.findMany({
        where: { id_proyecto: { in: projectIds } },
        select: submissionSelect,
        orderBy: [{ created_at: 'desc' }, { id_entrega: 'desc' }],
      }),
      this.db.docentes.findMany({
        where: {
          estado: 'ACTIVO',
          usuarios: { estado: 'ACTIVO', deleted_at: null },
          ...(!(canPlan || documentStaff(user))
            ? { id_usuario: academicId(user.id) }
            : {}),
        },
        include: {
          perfil_academico: true,
          usuarios: {
            select: { nombres: true, apellidos: true, id_usuario: true },
          },
          proyecto_docentes: {
            where: {
              estado: 'ACTIVO',
              proyectos_grado: {
                estado: { notIn: ['FINALIZADO', 'CANCELADO'] },
              },
            },
            select: {
              id_proyecto: true,
              proyectos_grado: {
                select: {
                  inscripciones: {
                    select: {
                      inscripcion_estudiantes: {
                        select: { id_estudiante: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { usuarios: { apellidos: 'asc' } },
      }),
      this.db.solicitudes_docentes.findMany({
        where: {
          id_oferta: course.id_oferta,
          ...(!documentStaff(user) && !canPlan
            ? { docente: { id_usuario: academicId(user.id) } }
            : {}),
        },
        include: {
          docente: {
            include: {
              usuarios: {
                select: { nombres: true, apellidos: true, id_usuario: true },
              },
            },
          },
          documentos: {
            select: teacherFileSelect,
            orderBy: [{ created_at: 'desc' }, { id_documento: 'desc' }],
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);
    const mappedMilestones = milestones.map((h) => ({
      id: h.id_hito.toString(),
      projectId: h.id_proyecto?.toString() ?? null,
      title: h.titulo,
      type: h.tipo,
      dueAt: h.fecha_limite.toISOString(),
      instructions: h.instrucciones,
      status: h.estado,
      version: h.version,
    }));
    const mappedSubmissions = submissions.map((e) => ({
      id: e.id_entrega.toString(),
      projectId: e.id_proyecto.toString(),
      milestoneId: e.id_hito.toString(),
      filename: e.nombre_archivo,
      createdAt: e.created_at.toISOString(),
      status: e.estado,
      feedback: e.retroalimentacion,
      reviewedAt: e.revisado_at?.toISOString() ?? null,
    }));
    return {
      ...base,
      course: {
        id: selectedId,
        title: course.titulo,
        schoolId: course.recinto_carreras.carreras.id_escuela.toString(),
        canPlan,
        canDesignate: academicAdmin(user),
        canManageDocuments: documentStaff(user),
        designation: course.designacion_academica
          ? {
              teacherId: course.designacion_academica.id_docente.toString(),
              teacher: `${course.designacion_academica.docente.usuarios.nombres} ${course.designacion_academica.docente.usuarios.apellidos}`,
              school: course.designacion_academica.escuela.nombre,
              date: course.designacion_academica.fecha,
              reference: course.designacion_academica.referencia,
            }
          : null,
      },
      projects: projects.map((p) => ({
        id: p.id_proyecto.toString(),
        title: p.titulo ?? p.inscripciones.codigo,
        code: p.inscripciones.codigo,
        status: p.estado,
        area:
          p.areas_investigacion?.nombre ?? p.area_personalizada ?? 'Sin área',
        students: p.inscripciones.inscripcion_estudiantes.map((s) => ({
          name: `${s.estudiantes.usuarios.nombres} ${s.estudiantes.usuarios.apellidos}`,
          registration: s.estudiantes.matricula,
        })),
        canSubmit: p.inscripciones.inscripcion_estudiantes.some(
          (s) => s.estudiantes.id_usuario === academicId(user.id),
        ),
        canReview:
          canPlan ||
          p.proyecto_docentes.some(
            (t) => t.docentes.id_usuario === academicId(user.id),
          ),
        teachers: p.proyecto_docentes.map((t) => ({
          id: t.id_docente.toString(),
          name: `${t.docentes.usuarios.nombres} ${t.docentes.usuarios.apellidos}`,
          role: t.tipos_participacion.nombre,
          typeId: t.id_tipo_participacion.toString(),
          rationale: t.criterio_asignacion,
          complexity: t.complejidad,
        })),
        progress: projectProgress(
          p.id_proyecto.toString(),
          mappedMilestones,
          mappedSubmissions,
        ),
      })),
      milestones: mappedMilestones,
      submissions: mappedSubmissions,
      teachers: teachers.map((t) => {
        const groups = new Map(
          t.proyecto_docentes.map((p) => [
            p.id_proyecto.toString(),
            p.proyectos_grado.inscripciones.inscripcion_estudiantes.length,
          ]),
        );
        return {
          id: t.id_docente.toString(),
          name: `${t.usuarios.nombres} ${t.usuarios.apellidos}`,
          canEdit: academicAdmin(user) || t.id_usuario === academicId(user.id),
          groups: groups.size,
          students: [...groups.values()].reduce((a, b) => a + b, 0),
          profile: t.perfil_academico
            ? {
                specialties: t.perfil_academico.especialidades,
                availability: t.perfil_academico.disponibilidad,
                maxGroups: t.perfil_academico.max_grupos,
                maxStudents: t.perfil_academico.max_estudiantes,
                available: t.perfil_academico.disponible,
              }
            : null,
        };
      }),
      requests: requests.map((r) => ({
        id: r.id_solicitud.toString(),
        teacherId: r.id_docente.toString(),
        teacher: `${r.docente.usuarios.nombres} ${r.docente.usuarios.apellidos}`,
        title: r.titulo,
        purpose: r.finalidad,
        instructions: r.instrucciones,
        status: r.estado_tramite,
        reference: r.referencia_tramite,
        canUpload:
          documentStaff(user) || r.docente.id_usuario === academicId(user.id),
        files: r.documentos.map((d) => ({
          id: d.id_documento.toString(),
          filename: d.nombre_archivo,
          createdAt: d.created_at,
          status: d.estado,
          feedback: d.observacion,
        })),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
  async designate(user: AuthenticatedUser, id: string, dto: DesignationDto) {
    if (!academicAdmin(user))
      throw new ForbiddenException(
        'UCOTESIS registra la designación recibida de la Escuela.',
      );
    const course = await this.offer(user, id);
    if (
      course.recinto_carreras.carreras.id_escuela !== academicId(dto.schoolId)
    )
      throw new BadRequestException(
        'La designación debe proceder de la Escuela de esta carrera.',
      );
    const teacher = await this.activeTeacher(dto.teacherId);
    return this.db.$transaction(async (tx) => {
      const data = {
        id_escuela: academicId(dto.schoolId),
        id_docente: teacher.id_docente,
        fecha: new Date(dto.date),
        referencia: dto.reference.trim(),
        observacion: dto.observation?.trim(),
        registrado_por: academicId(user.id),
      };
      await tx.designaciones_academicas.upsert({
        where: { id_oferta: course.id_oferta },
        create: { id_oferta: course.id_oferta, ...data },
        update: data,
      });
      await tx.ofertas.update({
        where: { id_oferta: course.id_oferta },
        data: { coordinador_id: teacher.id_usuario },
      });
      await this.audit(tx, user, 'REGISTRAR_DESIGNACION', id, {
        reference: dto.reference,
        teacherId: dto.teacherId,
        schoolId: dto.schoolId,
      });
      return { saved: true };
    });
  }
  async profile(user: AuthenticatedUser, id: string, dto: TeacherProfileDto) {
    const teacher = await this.activeTeacher(id);
    if (!academicAdmin(user) && teacher.id_usuario !== academicId(user.id))
      throw new ForbiddenException(
        'Solo puedes actualizar tu propio perfil académico.',
      );
    const data = {
      especialidades: dto.specialties.trim(),
      disponibilidad: dto.availability.trim(),
      max_grupos: dto.maxGroups,
      max_estudiantes: dto.maxStudents,
      disponible: dto.available,
    };
    await this.db.perfiles_academicos.upsert({
      where: { id_docente: teacher.id_docente },
      create: { id_docente: teacher.id_docente, ...data },
      update: data,
    });
    return { saved: true };
  }
  private async activeTeacher(id: string) {
    const t = await this.db.docentes.findFirst({
      where: {
        id_docente: academicId(id),
        estado: 'ACTIVO',
        usuarios: {
          estado: 'ACTIVO',
          deleted_at: null,
          usuario_roles_usuario_roles_id_usuarioTousuarios: {
            some: {
              roles: {
                estado: 'ACTIVO',
                codigo: {
                  in: [
                    'DOCENTE',
                    'ASESOR',
                    'JURADO',
                    'COORDINADOR_MONOGRAFICO',
                  ],
                },
              },
            },
          },
        },
      },
      include: { perfil_academico: true },
    });
    if (!t)
      throw new BadRequestException(
        'Selecciona un docente activo con un rol académico.',
      );
    return t;
  }
  private async milestoneData(
    user: AuthenticatedUser,
    offerId: string,
    dto: MilestoneDto,
  ) {
    const course = await this.offer(user, offerId, true);
    if (dto.projectId) {
      const p = await this.project(user, dto.projectId, true);
      if (p.inscripciones.id_oferta !== course.id_oferta)
        throw new BadRequestException('El grupo no pertenece al curso.');
    }
    return {
      id_oferta: course.id_oferta,
      id_proyecto: dto.projectId ? academicId(dto.projectId) : null,
      titulo: dto.title.trim(),
      tipo: dto.type,
      fecha_limite: new Date(dto.dueAt),
      instrucciones: dto.instructions.trim(),
      estado: dto.status,
    };
  }
  async milestone(user: AuthenticatedUser, id: string, dto: MilestoneDto) {
    const data = await this.milestoneData(user, id, dto);
    const row = await this.db.hitos_academicos.create({
      data: { ...data, creado_por: academicId(user.id) },
    });
    return { id: row.id_hito.toString() };
  }
  async updateMilestone(
    user: AuthenticatedUser,
    id: string,
    dto: MilestoneDto,
  ) {
    const old = await this.db.hitos_academicos.findUnique({
      where: { id_hito: academicId(id) },
    });
    if (!old) throw new NotFoundException('Actividad no encontrada.');
    const data = await this.milestoneData(user, old.id_oferta.toString(), dto);
    if (old.id_proyecto !== data.id_proyecto || old.tipo !== data.tipo)
      throw new BadRequestException(
        'Conserva el grupo y el tipo de la actividad; crea otra si cambió su alcance.',
      );
    const result = await this.db.hitos_academicos.updateMany({
      where: { id_hito: old.id_hito, version: dto.version ?? 0 },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException(
        'El cronograma cambió. Actualiza antes de guardar.',
      );
    return { saved: true };
  }
  async assign(
    user: AuthenticatedUser,
    id: string,
    dto: AcademicAssignmentDto,
  ) {
    const project = await this.project(user, id, true);
    if (['FINALIZADO', 'CANCELADO'].includes(project.estado))
      throw new BadRequestException('El proyecto está cerrado.');
    const teacher = await this.activeTeacher(dto.teacherId);
    const roles = await this.db.usuario_roles.findMany({
      where: { id_usuario: teacher.id_usuario, roles: { estado: 'ACTIVO' } },
      select: { roles: { select: { codigo: true } } },
    });
    const codes = roles.map((r) => r.roles.codigo);
    if (
      !codes.some((r) => ['DOCENTE', 'COORDINADOR_MONOGRAFICO'].includes(r)) &&
      !codes.includes(dto.participation === 'JURADO' ? 'JURADO' : 'ASESOR')
    )
      throw new BadRequestException(
        'El rol del docente no es compatible con la participación seleccionada.',
      );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_docente FROM docentes WHERE id_docente=${teacher.id_docente} FOR UPDATE`;
      const profile = await tx.perfiles_academicos.findUnique({
        where: { id_docente: teacher.id_docente },
      });
      if (!profile?.disponible)
        throw new BadRequestException(
          'El docente debe completar su perfil y estar disponible.',
        );
      const assignments = await tx.proyecto_docentes.findMany({
        where: {
          id_docente: teacher.id_docente,
          estado: 'ACTIVO',
          proyectos_grado: { estado: { notIn: ['FINALIZADO', 'CANCELADO'] } },
        },
        select: {
          id_proyecto: true,
          proyectos_grado: {
            select: {
              inscripciones: {
                select: {
                  inscripcion_estudiantes: { select: { id_estudiante: true } },
                },
              },
            },
          },
        },
      });
      const groups = new Map(
        assignments.map((a) => [
          a.id_proyecto.toString(),
          a.proyectos_grado.inscripciones.inscripcion_estudiantes.length,
        ]),
      );
      groups.set(id, project.inscripciones.inscripcion_estudiantes.length);
      if (
        groups.size > profile.max_grupos ||
        [...groups.values()].reduce((a, b) => a + b, 0) >
          profile.max_estudiantes
      )
        throw new ConflictException(
          'La asignación supera la capacidad declarada de grupos o estudiantes.',
        );
      const type = await tx.tipos_participacion.upsert({
        where: { codigo: dto.participation },
        create: {
          codigo: dto.participation,
          nombre:
            dto.participation === 'JURADO'
              ? 'Jurado'
              : dto.participation === 'ASESOR'
                ? 'Asesor'
                : 'Coasesor',
        },
        update: {},
      });
      if (type.estado !== 'ACTIVO')
        throw new BadRequestException(
          'Este tipo de participación está inactivo.',
        );
      const data = {
        estado: 'ACTIVO' as const,
        removed_at: null,
        asignado_por: academicId(user.id),
        fecha_asignacion: new Date(),
        criterio_asignacion: dto.rationale.trim(),
        complejidad: dto.complexity,
        disponibilidad_confirmada: true,
      };
      await tx.proyecto_docentes.upsert({
        where: {
          id_proyecto_id_docente_id_tipo_participacion: {
            id_proyecto: project.id_proyecto,
            id_docente: teacher.id_docente,
            id_tipo_participacion: type.id_tipo_participacion,
          },
        },
        create: {
          id_proyecto: project.id_proyecto,
          id_docente: teacher.id_docente,
          id_tipo_participacion: type.id_tipo_participacion,
          ...data,
        },
        update: data,
      });
      await this.notify(
        tx,
        [teacher.id_usuario],
        'Asignación académica',
        `Se te asignó como ${type.nombre} al proyecto ${project.titulo ?? id}.`,
      );
      await this.audit(tx, user, 'ASIGNAR_PERSONAL', id, {
        teacherId: dto.teacherId,
        participation: dto.participation,
        rationale: dto.rationale,
      });
      return { saved: true };
    });
  }
  async removeAssignment(
    user: AuthenticatedUser,
    id: string,
    teacherId: string,
    typeId: string,
  ) {
    const project = await this.project(user, id, true);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_docente FROM docentes WHERE id_docente=${academicId(teacherId)} FOR UPDATE`;
      const result = await tx.proyecto_docentes.updateMany({
        where: {
          id_proyecto: project.id_proyecto,
          id_docente: academicId(teacherId),
          id_tipo_participacion: academicId(typeId),
          estado: 'ACTIVO',
        },
        data: { estado: 'REMOVIDO', removed_at: new Date() },
      });
      if (!result.count)
        throw new NotFoundException('Asignación activa no encontrada.');
      await this.audit(tx, user, 'REMOVER_PERSONAL', id, { teacherId, typeId });
      return { removed: true };
    });
  }
  async submit(
    user: AuthenticatedUser,
    id: string,
    milestoneId: string,
    file?: AcademicFile,
  ) {
    const p = await this.project(user, id);
    if (
      !p.inscripciones.inscripcion_estudiantes.some(
        (s) => s.estudiantes.id_usuario === academicId(user.id),
      )
    )
      throw new ForbiddenException(
        'Solo los integrantes del grupo pueden entregar trabajos.',
      );
    const f = academicPdf(file);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_proyecto FROM proyectos_grado WHERE id_proyecto=${p.id_proyecto} FOR UPDATE`;
      const h = await tx.hitos_academicos.findUnique({
        where: { id_hito: academicId(milestoneId) },
      });
      if (
        !h ||
        h.id_oferta !== p.inscripciones.id_oferta ||
        (h.id_proyecto && h.id_proyecto !== p.id_proyecto) ||
        h.estado !== 'PROGRAMADO' ||
        !['AVANCE', 'DEFENSA'].includes(h.tipo)
      )
        throw new BadRequestException(
          'La actividad no admite entregas de este grupo.',
        );
      const last = await tx.entregas_academicas.findFirst({
        where: { id_proyecto: p.id_proyecto, id_hito: h.id_hito },
        orderBy: { id_entrega: 'desc' },
      });
      if (
        last?.estado === 'APROBADO' ||
        ['FINALIZADO', 'CANCELADO'].includes(p.estado)
      )
        throw new ConflictException(
          'La entrega está aprobada o el proyecto está cerrado.',
        );
      const row = await tx.entregas_academicas.create({
        data: {
          id_proyecto: p.id_proyecto,
          id_hito: h.id_hito,
          ...f,
          entregado_por: academicId(user.id),
        },
      });
      await this.notify(
        tx,
        reviewerIds(p),
        'Trabajo recibido',
        `El grupo ${p.inscripciones.codigo} entregó ${h.titulo}.`,
      );
      return { id: row.id_entrega.toString() };
    });
  }
  async review(user: AuthenticatedUser, id: string, dto: AcademicReviewDto) {
    const row = await this.db.entregas_academicas.findUnique({
      where: { id_entrega: academicId(id) },
      select: submissionSelect,
    });
    if (!row) throw new NotFoundException('Entrega no encontrada.');
    const p = await this.project(user, row.id_proyecto.toString());
    if (
      !academicAdmin(user) &&
      p.inscripciones.ofertas.coordinador_id !== academicId(user.id) &&
      !p.proyecto_docentes.some(
        (t) => t.docentes.id_usuario === academicId(user.id),
      )
    )
      throw new ForbiddenException(
        'Solo el asesor, evaluador o coordinador asignado puede revisar.',
      );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_proyecto FROM proyectos_grado WHERE id_proyecto=${p.id_proyecto} FOR UPDATE`;
      const latest = await tx.entregas_academicas.findFirst({
        where: { id_proyecto: row.id_proyecto, id_hito: row.id_hito },
        orderBy: { id_entrega: 'desc' },
      });
      if (
        latest?.id_entrega !== row.id_entrega ||
        latest.estado !== 'PENDIENTE'
      )
        throw new ConflictException(
          'Revisa la última versión pendiente; las revisiones anteriores se conservan.',
        );
      await tx.entregas_academicas.update({
        where: { id_entrega: row.id_entrega },
        data: {
          estado: dto.status,
          retroalimentacion: dto.feedback.trim(),
          revisado_por: academicId(user.id),
          revisado_at: new Date(),
        },
      });
      await this.notify(
        tx,
        p.inscripciones.inscripcion_estudiantes.map(
          (s) => s.estudiantes.id_usuario,
        ),
        'Retroalimentación disponible',
        `Tu grupo ${p.inscripciones.codigo} recibió una revisión del trabajo.`,
      );
      return { saved: true };
    });
  }
  async request(user: AuthenticatedUser, id: string, dto: TeacherRequestDto) {
    const course = await this.offer(user, id);
    if (!documentStaff(user) && course.coordinador_id !== academicId(user.id))
      throw new ForbiddenException('No puedes solicitar expedientes docentes.');
    const teacher = await this.activeTeacher(dto.teacherId);
    const involved =
      teacher.id_usuario === course.coordinador_id ||
      (await this.db.proyecto_docentes.count({
        where: {
          id_docente: teacher.id_docente,
          estado: 'ACTIVO',
          proyectos_grado: { inscripciones: { id_oferta: course.id_oferta } },
        },
      })) > 0;
    if (!involved)
      throw new BadRequestException(
        'El docente debe estar designado o asignado a un grupo de este curso.',
      );
    return this.db.$transaction(async (tx) => {
      const r = await tx.solicitudes_docentes.create({
        data: {
          id_oferta: course.id_oferta,
          id_docente: teacher.id_docente,
          titulo: dto.title.trim(),
          finalidad: dto.purpose,
          instrucciones: dto.instructions.trim(),
          solicitado_por: academicId(user.id),
        },
      });
      await this.notify(
        tx,
        [teacher.id_usuario],
        'Documento docente solicitado',
        dto.title.trim(),
      );
      return { id: r.id_solicitud.toString() };
    });
  }
  private async teacherRequest(user: AuthenticatedUser, id: string) {
    const r = await this.db.solicitudes_docentes.findUnique({
      where: { id_solicitud: academicId(id) },
      include: { docente: true, oferta: true },
    });
    if (!r) throw new NotFoundException('Solicitud no encontrada.');
    if (
      !documentStaff(user) &&
      r.docente.id_usuario !== academicId(user.id) &&
      r.oferta.coordinador_id !== academicId(user.id)
    )
      throw new ForbiddenException('El expediente docente no te corresponde.');
    return r;
  }
  async teacherFile(user: AuthenticatedUser, id: string, file?: AcademicFile) {
    const r = await this.teacherRequest(user, id);
    if (!documentStaff(user) && r.docente.id_usuario !== academicId(user.id))
      throw new ForbiddenException(
        'Solo el docente titular o UCOTESIS puede archivar el documento.',
      );
    const f = academicPdf(file);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_solicitud FROM solicitudes_docentes WHERE id_solicitud=${r.id_solicitud} FOR UPDATE`;
      const current = await tx.solicitudes_docentes.findUniqueOrThrow({
        where: { id_solicitud: r.id_solicitud },
      });
      if (current.estado_tramite !== 'PENDIENTE')
        throw new ConflictException(
          'El expediente ya fue tramitado. Crea una solicitud adicional para otro documento.',
        );
      const row = await tx.documentos_docentes.create({
        data: {
          id_solicitud: r.id_solicitud,
          ...f,
          cargado_por: academicId(user.id),
        },
      });
      return { id: row.id_documento.toString() };
    });
  }
  async reviewTeacherFile(
    user: AuthenticatedUser,
    id: string,
    dto: AcademicReviewDto,
  ) {
    if (!documentStaff(user))
      throw new ForbiddenException(
        'La revisión administrativa corresponde a UCOTESIS.',
      );
    const d = await this.db.documentos_docentes.findUnique({
      where: { id_documento: academicId(id) },
    });
    if (!d) throw new NotFoundException('Documento no encontrado.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_solicitud FROM solicitudes_docentes WHERE id_solicitud=${d.id_solicitud} FOR UPDATE`;
      const latest = await tx.documentos_docentes.findFirst({
        where: { id_solicitud: d.id_solicitud },
        orderBy: { id_documento: 'desc' },
      });
      if (
        latest?.id_documento !== d.id_documento ||
        latest.estado !== 'PENDIENTE'
      )
        throw new ConflictException(
          'Solo se revisa la última versión pendiente.',
        );
      await tx.documentos_docentes.update({
        where: { id_documento: d.id_documento },
        data: {
          estado: dto.status,
          observacion: dto.feedback.trim(),
          revisado_at: new Date(),
          revisado_por: academicId(user.id),
        },
      });
      return { saved: true };
    });
  }
  async process(user: AuthenticatedUser, id: string, dto: TeacherProcessDto) {
    if (!documentStaff(user))
      throw new ForbiddenException(
        'UCOTESIS registra el trámite administrativo.',
      );
    const r = await this.teacherRequest(user, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_solicitud FROM solicitudes_docentes WHERE id_solicitud=${r.id_solicitud} FOR UPDATE`;
      const current = await tx.solicitudes_docentes.findUniqueOrThrow({
        where: { id_solicitud: r.id_solicitud },
      });
      const last = await tx.documentos_docentes.findFirst({
        where: { id_solicitud: r.id_solicitud },
        orderBy: { id_documento: 'desc' },
      });
      if (last?.estado !== 'APROBADO')
        throw new BadRequestException(
          'Aprueba el documento antes de tramitarlo.',
        );
      if (
        (dto.status === 'ENVIADO' && current.estado_tramite !== 'PENDIENTE') ||
        (dto.status === 'COMPLETADO' && current.estado_tramite !== 'ENVIADO')
      )
        throw new ConflictException(
          'El trámite debe pasar de pendiente a enviado y luego a completado.',
        );
      await tx.solicitudes_docentes.update({
        where: { id_solicitud: r.id_solicitud },
        data: {
          estado_tramite: dto.status,
          referencia_tramite: dto.reference.trim(),
        },
      });
      await this.audit(tx, user, 'TRAMITAR_EXPEDIENTE_DOCENTE', id, {
        status: dto.status,
        reference: dto.reference,
      });
      return { saved: true };
    });
  }
  async download(
    user: AuthenticatedUser,
    id: string,
    teacher: boolean,
    res: Response,
  ) {
    let file: { contenido: Uint8Array; nombre_archivo: string };
    if (teacher) {
      const d = await this.db.documentos_docentes.findUnique({
        where: { id_documento: academicId(id) },
      });
      if (!d) throw new NotFoundException('Archivo no encontrado.');
      await this.teacherRequest(user, d.id_solicitud.toString());
      file = d;
    } else {
      const d = await this.db.entregas_academicas.findUnique({
        where: { id_entrega: academicId(id) },
      });
      if (!d) throw new NotFoundException('Archivo no encontrado.');
      await this.project(user, d.id_proyecto.toString());
      file = d;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.nombre_archivo}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(file.contenido));
  }
  private async notify(
    tx: Prisma.TransactionClient,
    ids: bigint[],
    title: string,
    message: string,
  ) {
    const unique = [...new Set(ids.map(String))];
    if (unique.length)
      await tx.notificaciones.createMany({
        data: unique.map((id) => ({
          id_usuario: BigInt(id),
          tipo: 'COORDINACION',
          titulo: title,
          mensaje: message,
          url: '/app/coordinacion-academica',
          estado_envio: 'ENVIADA' as const,
          enviada_at: new Date(),
        })),
      });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    action: string,
    id: string,
    data: Prisma.InputJsonObject,
  ) {
    await tx.auditoria.create({
      data: {
        accion: action,
        entidad: 'coordinacion-academica',
        entidad_id: id,
        id_usuario: academicId(user.id),
        datos_nuevos: { ...data, outcome: 'EXITO' },
      },
    });
  }
}
export function reviewerIds(p: Project) {
  return [
    ...p.proyecto_docentes.map((t) => t.docentes.id_usuario),
    ...(p.inscripciones.ofertas.coordinador_id
      ? [p.inscripciones.ofertas.coordinador_id]
      : []),
  ];
}
export function academicPdf(file?: AcademicFile) {
  if (
    !file ||
    file.mimetype !== 'application/pdf' ||
    file.buffer.subarray(0, 5).toString() !== '%PDF-' ||
    file.buffer.length > 8 * 1024 * 1024 ||
    file.buffer.length < 8
  )
    throw new BadRequestException('Selecciona un PDF válido de hasta 8 MB.');
  return {
    nombre_archivo:
      file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180) ||
      'documento.pdf',
    contenido: new Uint8Array(file.buffer),
    hash_sha256: createHash('sha256').update(file.buffer).digest('hex'),
  };
}
