import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Prisma,
  proyectos_grado_estado,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AssignTeacherDto,
  CreateProjectDto,
  UpdateProjectDto,
  UpsertParticipationTypeDto,
} from './dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
  async list(
    user: AuthenticatedUser,
    filters: { status?: string; search?: string },
  ) {
    assertProjectAccess(user);
    const staff = isManager(user);
    const teacher = hasAcademicStaffRole(user)
      ? await this.prisma.docentes.findUnique({
          where: { id_usuario: parseId(user.id) },
        })
      : null;
    if (
      !staff &&
      hasAcademicStaffRole(user) &&
      !user.roles.includes('ESTUDIANTE') &&
      !teacher
    )
      return { items: [] };
    const search = filters.search?.trim();
    const rows = await this.prisma.proyectos_grado.findMany({
      where: {
        ...(filters.status && {
          estado: filters.status.toUpperCase() as proyectos_grado_estado,
        }),
        ...(!staff &&
          user.roles.includes('ESTUDIANTE') && {
            inscripciones: {
              inscripcion_estudiantes: {
                some: { estudiantes: { id_usuario: parseId(user.id) } },
              },
            },
          }),
        ...(!staff &&
          teacher &&
          !user.roles.includes('ESTUDIANTE') && {
            proyecto_docentes: {
              some: { id_docente: teacher.id_docente, estado: 'ACTIVO' },
            },
          }),
        ...(search && {
          OR: [
            { titulo: { contains: search } },
            { inscripciones: { codigo: { contains: search } } },
            {
              inscripciones: {
                inscripcion_estudiantes: {
                  some: {
                    estudiantes: {
                      OR: [
                        { matricula: { contains: search } },
                        {
                          usuarios: {
                            OR: [
                              { nombres: { contains: search } },
                              { apellidos: { contains: search } },
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        }),
      },
      include: projectInclude,
      orderBy: { updated_at: 'desc' },
    });
    return { items: rows.map(mapProject) };
  }
  async catalogs(user: AuthenticatedUser) {
    assertProjectAccess(user);
    const manager = isManager(user);
    const student = user.roles.includes('ESTUDIANTE');
    const [areas, teachers, types] = await Promise.all([
      this.prisma.areas_investigacion.findMany({
        where: { estado: 'ACTIVO' },
        orderBy: { nombre: 'asc' },
      }),
      manager
        ? this.prisma.docentes.findMany({
            where: {
              estado: 'ACTIVO',
              usuarios: {
                estado: 'ACTIVO',
                deleted_at: null,
                usuario_roles_usuario_roles_id_usuarioTousuarios: {
                  some: {
                    roles: {
                      codigo: { in: ACADEMIC_STAFF_ROLE_CODES },
                      estado: 'ACTIVO',
                    },
                  },
                },
              },
            },
            include: {
              usuarios: {
                include: {
                  usuario_roles_usuario_roles_id_usuarioTousuarios: {
                    include: { roles: true },
                  },
                },
              },
            },
            orderBy: { usuarios: { apellidos: 'asc' } },
          })
        : [],
      this.prisma.tipos_participacion.findMany({
        where: { estado: 'ACTIVO' },
        orderBy: { nombre: 'asc' },
      }),
    ]);
    const enrollments =
      manager || student
        ? await this.prisma.inscripciones.findMany({
            where: {
              estados_inscripcion: { codigo: 'CONFIRMADA' },
              ...(student && {
                inscripcion_estudiantes: {
                  some: { estudiantes: { id_usuario: parseId(user.id) } },
                },
              }),
            },
            include: {
              ofertas: true,
              inscripcion_estudiantes: {
                include: { estudiantes: { include: { usuarios: true } } },
              },
              proyectos_grado: true,
            },
            orderBy: { fecha_confirmacion: 'desc' },
          })
        : [];
    return {
      areas: areas.map((x) => ({ id: x.id_area.toString(), name: x.nombre })),
      teachers: teachers.map((x) => ({
        id: x.id_docente.toString(),
        code: x.codigo_docente,
        name: `${x.usuarios.nombres} ${x.usuarios.apellidos}`,
        roles: x.usuarios.usuario_roles_usuario_roles_id_usuarioTousuarios
          .map(({ roles }) => roles.codigo)
          .filter((code) => ACADEMIC_STAFF_ROLE_CODES.includes(code)),
      })),
      participationTypes: types.map((x) => ({
        id: x.id_tipo_participacion.toString(),
        code: x.codigo,
        name: x.nombre,
      })),
      enrollments: enrollments
        .filter((x) => !x.proyectos_grado)
        .map((x) => ({
          id: x.id_inscripcion.toString(),
          code: x.codigo,
          offer: x.ofertas.titulo,
          students: x.inscripcion_estudiantes.map(
            (p) =>
              `${p.estudiantes.matricula} · ${p.estudiantes.usuarios.nombres} ${p.estudiantes.usuarios.apellidos}`,
          ),
        })),
    };
  }
  async create(user: AuthenticatedUser, dto: CreateProjectDto) {
    if (!user.roles.includes('ESTUDIANTE'))
      throw new ForbiddenException(
        'Solo el estudiante titular puede registrar su proyecto de grado.',
      );
    const area = resolveProjectArea(dto.areaId, dto.customArea);
    if (!area)
      throw new BadRequestException('Debes indicar el área del proyecto.');
    const enrollmentId = parseId(dto.enrollmentId);
    const enrollment = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: enrollmentId,
        estados_inscripcion: { codigo: 'CONFIRMADA' },
        inscripcion_estudiantes: {
          some: { estudiantes: { id_usuario: parseId(user.id) } },
        },
      },
    });
    if (!enrollment)
      throw new NotFoundException('Inscripción confirmada no disponible.');
    try {
      const row = await this.prisma.proyectos_grado.create({
        data: {
          id_inscripcion: enrollmentId,
          id_area: area.id,
          area_personalizada: area.custom,
          titulo: dto.title.trim(),
          descripcion: dto.description?.trim() || null,
          estado: 'EN_REVISION',
        },
        include: projectInclude,
      });
      await this.notifications
        .create({
          roleCodes: ['ADMIN', 'COORDINADOR'],
          type: 'PROYECTO',
          title: 'Proyecto pendiente de revisión',
          message: `Se registró el proyecto “${row.titulo ?? 'Sin título'}”.`,
          url: '/app/proyectos-grado',
        })
        .catch(() => undefined);
      return mapProject(row);
    } catch {
      throw new ConflictException(
        'La inscripción ya tiene un proyecto de grado.',
      );
    }
  }
  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    const projectId = parseId(id);
    const manager = isManager(user);
    const student = user.roles.includes('ESTUDIANTE');
    if (!manager && !student)
      throw new ForbiddenException(
        'Los docentes pueden consultar sus proyectos asignados, pero no modificar la propuesta.',
      );
    const existing = await this.prisma.proyectos_grado.findFirst({
      where: {
        id_proyecto: projectId,
        ...(manager
          ? {}
          : {
              inscripciones: {
                inscripcion_estudiantes: {
                  some: { estudiantes: { id_usuario: parseId(user.id) } },
                },
              },
            }),
      },
    });
    if (!existing)
      throw new ForbiddenException('No puedes modificar este proyecto.');
    if (student && !['PENDIENTE', 'RECHAZADO'].includes(existing.estado))
      throw new ForbiddenException(
        'La propuesta solo puede ajustarse mientras esté pendiente o haya sido rechazada.',
      );
    if (student && dto.status && dto.status !== 'EN_REVISION')
      throw new ForbiddenException(
        'El estudiante solo puede enviar el proyecto a revisión.',
      );
    if (manager && dto.status === 'RECHAZADO' && !dto.reviewObservation?.trim())
      throw new BadRequestException(
        'Indica los ajustes que debe realizar el estudiante antes de rechazar la propuesta.',
      );
    const area = student
      ? resolveProjectArea(dto.areaId, dto.customArea, true)
      : undefined;
    const row = await this.prisma.proyectos_grado.update({
      where: { id_proyecto: projectId },
      data: manager
        ? {
            ...(dto.status && { estado: dto.status }),
            ...(dto.startDate && { fecha_inicio: new Date(dto.startDate) }),
            ...(dto.endDate && { fecha_finalizacion: new Date(dto.endDate) }),
            ...(dto.reviewObservation !== undefined && {
              observacion_revision: dto.reviewObservation?.trim() || null,
            }),
          }
        : {
            ...(area && {
              id_area: area.id,
              area_personalizada: area.custom,
            }),
            ...(dto.title && { titulo: dto.title.trim() }),
            ...(dto.description !== undefined && {
              descripcion: dto.description?.trim() || null,
            }),
            estado: 'EN_REVISION',
            observacion_revision: null,
          },
      include: projectInclude,
    });
    if (manager) {
      await this.notifications
        .create({
          userIds: row.inscripciones.inscripcion_estudiantes.map(
            (participant) => participant.estudiantes.id_usuario.toString(),
          ),
          type: 'PROYECTO',
          title: 'Proyecto revisado',
          message: `El proyecto “${row.titulo ?? 'Sin título'}” cambió a ${row.estado.replaceAll('_', ' ').toLowerCase()}.`,
          url: '/app/proyectos-grado',
        })
        .catch(() => undefined);
    } else {
      await this.notifications
        .create({
          roleCodes: ['ADMIN', 'COORDINADOR'],
          type: 'PROYECTO',
          title: 'Ajustes enviados a revisión',
          message: `El estudiante actualizó el proyecto “${row.titulo ?? 'Sin título'}”.`,
          url: '/app/proyectos-grado',
        })
        .catch(() => undefined);
    }
    return mapProject(row);
  }
  async assignTeacher(userId: string, id: string, dto: AssignTeacherDto) {
    const projectId = parseId(id);
    const [project, teacher, participationType] = await Promise.all([
      this.prisma.proyectos_grado.findUnique({
        where: { id_proyecto: projectId },
        select: { id_proyecto: true },
      }),
      this.prisma.docentes.findFirst({
        where: {
          id_docente: parseId(dto.teacherId),
          estado: 'ACTIVO',
          usuarios: {
            estado: 'ACTIVO',
            deleted_at: null,
            usuario_roles_usuario_roles_id_usuarioTousuarios: {
              some: {
                roles: {
                  codigo: { in: ACADEMIC_STAFF_ROLE_CODES },
                  estado: 'ACTIVO',
                },
              },
            },
          },
        },
        include: {
          usuarios: {
            include: {
              usuario_roles_usuario_roles_id_usuarioTousuarios: {
                include: { roles: true },
              },
            },
          },
        },
      }),
      this.prisma.tipos_participacion.findFirst({
        where: {
          id_tipo_participacion: parseId(dto.participationTypeId),
          estado: 'ACTIVO',
        },
      }),
    ]);
    if (!project || !teacher || !participationType)
      throw new BadRequestException(
        'Selecciona un proyecto, un asesor o jurado activo y una participación disponible.',
      );
    const teacherRoles =
      teacher.usuarios.usuario_roles_usuario_roles_id_usuarioTousuarios.map(
        ({ roles }) => roles.codigo,
      );
    if (!canTakeParticipation(teacherRoles, participationType.codigo))
      throw new BadRequestException(
        `El usuario seleccionado no tiene un rol compatible con ${participationType.nombre}.`,
      );
    try {
      await this.prisma.proyecto_docentes.upsert({
        where: {
          id_proyecto_id_docente_id_tipo_participacion: {
            id_proyecto: projectId,
            id_docente: parseId(dto.teacherId),
            id_tipo_participacion: parseId(dto.participationTypeId),
          },
        },
        create: {
          id_proyecto: projectId,
          id_docente: parseId(dto.teacherId),
          id_tipo_participacion: parseId(dto.participationTypeId),
          asignado_por: parseId(userId),
        },
        update: {
          estado: 'ACTIVO',
          removed_at: null,
          asignado_por: parseId(userId),
          fecha_asignacion: new Date(),
        },
      });
      await this.notifications
        .create({
          userIds: [teacher.id_usuario.toString()],
          type: 'PROYECTO',
          title: 'Nueva asignación académica',
          message: 'Has sido asignado a un proyecto de grado.',
          url: '/app/proyectos-grado',
        })
        .catch(() => undefined);
      return { assigned: true };
    } catch {
      throw new BadRequestException(
        'Proyecto, docente o tipo de participación inválido.',
      );
    }
  }
  async removeAssignment(id: string, teacherId: string, typeId: string) {
    const result = await this.prisma.proyecto_docentes.updateMany({
      where: {
        id_proyecto: parseId(id),
        id_docente: parseId(teacherId),
        id_tipo_participacion: parseId(typeId),
        estado: 'ACTIVO',
      },
      data: { estado: 'REMOVIDO', removed_at: new Date() },
    });
    if (!result.count) throw new NotFoundException('Asignación no encontrada.');
    return { removed: true };
  }
  async createParticipationType(dto: UpsertParticipationTypeDto) {
    try {
      const row = await this.prisma.tipos_participacion.create({
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          descripcion: dto.description?.trim() || null,
        },
      });
      return { id: row.id_tipo_participacion.toString() };
    } catch {
      throw new ConflictException('El tipo de participación ya existe.');
    }
  }
}

const projectInclude = {
  areas_investigacion: true,
  inscripciones: {
    include: {
      ofertas: {
        include: {
          modalidades: true,
          recinto_carreras: { include: { recintos: true, carreras: true } },
        },
      },
      inscripcion_estudiantes: {
        include: { estudiantes: { include: { usuarios: true } } },
      },
    },
  },
  proyecto_docentes: {
    include: {
      docentes: { include: { usuarios: true } },
      tipos_participacion: true,
    },
    orderBy: { fecha_asignacion: 'asc' as const },
  },
} as const;
type ProjectRecord = Prisma.proyectos_gradoGetPayload<{
  include: typeof projectInclude;
}>;
function mapProject(x: ProjectRecord) {
  return {
    id: x.id_proyecto.toString(),
    title: x.titulo,
    description: x.descripcion,
    status: x.estado,
    startDate: x.fecha_inicio,
    endDate: x.fecha_finalizacion,
    area: x.areas_investigacion
      ? {
          id: x.areas_investigacion.id_area.toString(),
          name: x.areas_investigacion.nombre,
        }
      : x.area_personalizada
        ? { id: null, name: x.area_personalizada, custom: true }
        : null,
    customArea: x.area_personalizada,
    reviewObservation: x.observacion_revision,
    enrollment: {
      id: x.inscripciones.id_inscripcion.toString(),
      code: x.inscripciones.codigo,
      offer: x.inscripciones.ofertas.titulo,
      modality: x.inscripciones.ofertas.modalidades.nombre,
      teachingMode: x.inscripciones.ofertas.modalidad_ensenanza,
      campus: x.inscripciones.ofertas.recinto_carreras.recintos.nombre,
      career: x.inscripciones.ofertas.recinto_carreras.carreras.nombre,
    },
    students: x.inscripciones.inscripcion_estudiantes.map((p) => ({
      registration: p.estudiantes.matricula,
      name: `${p.estudiantes.usuarios.nombres} ${p.estudiantes.usuarios.apellidos}`,
      principal: p.es_principal,
    })),
    teachers: x.proyecto_docentes
      .filter((p) => p.estado === 'ACTIVO')
      .map((p) => ({
        id: p.id_docente.toString(),
        name: `${p.docentes.usuarios.nombres} ${p.docentes.usuarios.apellidos}`,
        role: p.tipos_participacion.nombre,
        typeId: p.id_tipo_participacion.toString(),
      })),
  };
}
function isManager(user: AuthenticatedUser) {
  return user.roles.some((x) => ['ADMIN', 'COORDINADOR'].includes(x));
}

function resolveProjectArea(
  areaId?: string,
  customArea?: string,
  optional = false,
) {
  const custom = customArea?.trim() || null;
  if (areaId && custom)
    throw new BadRequestException(
      'Selecciona un área institucional o escribe una propuesta propia, no ambas.',
    );
  if (areaId) return { id: parseId(areaId), custom: null };
  if (custom) return { id: null, custom };
  if (optional) return undefined;
  throw new BadRequestException(
    'Selecciona un área de investigación o utiliza la opción Otro.',
  );
}

function assertProjectAccess(user: AuthenticatedUser) {
  if (
    !isManager(user) &&
    !user.roles.some((role) =>
      ['ESTUDIANTE', ...ACADEMIC_STAFF_ROLE_CODES].includes(role),
    )
  )
    throw new ForbiddenException(
      'Tu rol no tiene acceso a proyectos de grado.',
    );
}

const ACADEMIC_STAFF_ROLE_CODES = ['DOCENTE', 'ASESOR', 'JURADO'];

function hasAcademicStaffRole(user: AuthenticatedUser) {
  return user.roles.some((role) => ACADEMIC_STAFF_ROLE_CODES.includes(role));
}

function canTakeParticipation(roleCodes: string[], participationCode: string) {
  if (roleCodes.includes('DOCENTE')) return true;
  if (participationCode === 'JURADO') return roleCodes.includes('JURADO');
  if (['ASESOR', 'COASESOR'].includes(participationCode))
    return roleCodes.includes('ASESOR');
  return false;
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
