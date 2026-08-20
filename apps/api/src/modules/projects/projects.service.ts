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
    const teacher = user.roles.includes('DOCENTE')
      ? await this.prisma.docentes.findUnique({
          where: { id_usuario: parseId(user.id) },
        })
      : null;
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
            where: { estado: 'ACTIVO' },
            include: { usuarios: true },
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
    if (!isManager(user) && !user.roles.includes('ESTUDIANTE'))
      throw new ForbiddenException(
        'Solo coordinación o el estudiante titular pueden registrar el proyecto.',
      );
    const enrollmentId = parseId(dto.enrollmentId);
    const enrollment = await this.prisma.inscripciones.findFirst({
      where: {
        id_inscripcion: enrollmentId,
        estados_inscripcion: { codigo: 'CONFIRMADA' },
        ...(!isManager(user) && {
          inscripcion_estudiantes: {
            some: { estudiantes: { id_usuario: parseId(user.id) } },
          },
        }),
      },
    });
    if (!enrollment)
      throw new NotFoundException('Inscripción confirmada no disponible.');
    try {
      const row = await this.prisma.proyectos_grado.create({
        data: {
          id_inscripcion: enrollmentId,
          id_area: dto.areaId ? parseId(dto.areaId) : null,
          titulo: dto.title.trim(),
          descripcion: dto.description?.trim() || null,
        },
        include: projectInclude,
      });
      return mapProject(row);
    } catch {
      throw new ConflictException(
        'La inscripción ya tiene un proyecto de grado.',
      );
    }
  }
  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    const projectId = parseId(id);
    const existing = await this.prisma.proyectos_grado.findFirst({
      where: {
        id_proyecto: projectId,
        ...(isManager(user)
          ? {}
          : user.roles.includes('ESTUDIANTE')
            ? {
                inscripciones: {
                  inscripcion_estudiantes: {
                    some: { estudiantes: { id_usuario: parseId(user.id) } },
                  },
                },
              }
            : {
                proyecto_docentes: {
                  some: {
                    docentes: { id_usuario: parseId(user.id) },
                    estado: 'ACTIVO',
                  },
                },
              }),
      },
    });
    if (!existing)
      throw new ForbiddenException('No puedes modificar este proyecto.');
    if (
      !isManager(user) &&
      dto.status &&
      !['EN_DESARROLLO', 'EN_REVISION'].includes(dto.status)
    )
      throw new ForbiddenException(
        'Ese cambio de estado requiere coordinación.',
      );
    const row = await this.prisma.proyectos_grado.update({
      where: { id_proyecto: projectId },
      data: {
        ...(dto.areaId && { id_area: parseId(dto.areaId) }),
        ...(dto.title && { titulo: dto.title.trim() }),
        ...(dto.description !== undefined && {
          descripcion: dto.description?.trim() || null,
        }),
        ...(dto.status && { estado: dto.status }),
        ...(dto.startDate && { fecha_inicio: new Date(dto.startDate) }),
        ...(dto.endDate && { fecha_finalizacion: new Date(dto.endDate) }),
      },
      include: projectInclude,
    });
    return mapProject(row);
  }
  async assignTeacher(userId: string, id: string, dto: AssignTeacherDto) {
    const projectId = parseId(id);
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
      const teacher = await this.prisma.docentes.findUnique({
        where: { id_docente: parseId(dto.teacherId) },
      });
      if (teacher)
        await this.notifications.create({
          userIds: [teacher.id_usuario.toString()],
          type: 'PROYECTO',
          title: 'Nueva asignación académica',
          message: 'Has sido asignado a un proyecto de grado.',
          url: '/app/proyectos-grado',
        });
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
      : null,
    enrollment: {
      id: x.inscripciones.id_inscripcion.toString(),
      code: x.inscripciones.codigo,
      offer: x.inscripciones.ofertas.titulo,
      modality: x.inscripciones.ofertas.modalidades.nombre,
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

function assertProjectAccess(user: AuthenticatedUser) {
  if (
    !isManager(user) &&
    !user.roles.some((role) => ['ESTUDIANTE', 'DOCENTE'].includes(role))
  )
    throw new ForbiddenException(
      'Tu rol no tiene acceso a proyectos de grado.',
    );
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
