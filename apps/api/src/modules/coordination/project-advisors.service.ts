import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { Prisma } from '../../generated/prisma/client';
import { academicId } from './coordination.service';
import {
  ProjectAdvisorDto,
  UpdateProjectAdvisorDto,
} from './project-advisors.dto';

const MANAGERS = ['ADMIN', 'COORDINADOR', 'ENCARGADO'];
const READERS = [
  ...MANAGERS,
  'COORDINADOR_MONOGRAFICO',
  'SECRETARIA',
  'OFICINISTA',
];
const isManager = (user: AuthenticatedUser) =>
  user.roles.some((role) => MANAGERS.includes(role));
const isSecretary = (user: AuthenticatedUser) =>
  user.roles.some((role) => ['SECRETARIA', 'OFICINISTA'].includes(role));

@Injectable()
export class ProjectAdvisorsService {
  constructor(private readonly db: PrismaService) {}

  private scope(user: AuthenticatedUser): Prisma.proyectos_gradoWhereInput {
    if (!user.roles.some((role) => READERS.includes(role)))
      throw new ForbiddenException(
        'El registro de asesores corresponde a Coordinación y Secretaría.',
      );
    return isManager(user) || isSecretary(user)
      ? {}
      : { inscripciones: { ofertas: { coordinador_id: academicId(user.id) } } };
  }

  private async editableProject(user: AuthenticatedUser, projectId: string) {
    this.scope(user);
    if (!isManager(user) && !user.roles.includes('COORDINADOR_MONOGRAFICO'))
      throw new ForbiddenException(
        'Solo la coordinación puede registrar o modificar asesores.',
      );
    const project = await this.db.proyectos_grado.findFirst({
      where: {
        id_proyecto: academicId(projectId),
        ...(!isManager(user)
          ? {
              inscripciones: {
                ofertas: { coordinador_id: academicId(user.id) },
              },
            }
          : {}),
      },
      select: { id_proyecto: true },
    });
    if (!project)
      throw new NotFoundException(
        'Proyecto no disponible para tu coordinación.',
      );
    return project;
  }

  async list(user: AuthenticatedUser) {
    const scope = this.scope(user);
    const projects = await this.db.proyectos_grado.findMany({
      where: scope,
      include: {
        inscripciones: {
          include: {
            ofertas: { select: { titulo: true, coordinador_id: true } },
          },
        },
        asesores_registrados: {
          orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        },
        proyecto_docentes: {
          where: { estado: 'ACTIVO' },
          include: {
            docentes: {
              include: {
                usuarios: {
                  select: {
                    nombres: true,
                    apellidos: true,
                    email: true,
                    telefono: true,
                  },
                },
              },
            },
            tipos_participacion: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    return {
      projects: projects.map((project) => ({
        id: project.id_proyecto.toString(),
        title: project.titulo ?? project.inscripciones.codigo,
        code: project.inscripciones.codigo,
        course: project.inscripciones.ofertas.titulo,
        canManage:
          isManager(user) ||
          (user.roles.includes('COORDINADOR_MONOGRAFICO') &&
            project.inscripciones.ofertas.coordinador_id ===
              academicId(user.id)),
        advisors: project.asesores_registrados.map((advisor) => ({
          id: advisor.id_asesor.toString(),
          name: advisor.nombre,
          email: advisor.email,
          phone: advisor.telefono,
          specialty: advisor.especialidad,
          participation: advisor.participacion,
          notes: advisor.observaciones,
          active: advisor.activo,
          version: advisor.version,
        })),
        previousAssignments: project.proyecto_docentes.map((assignment) => ({
          id: `${assignment.id_docente}-${assignment.id_tipo_participacion}`,
          name: `${assignment.docentes.usuarios.nombres} ${assignment.docentes.usuarios.apellidos}`,
          email: assignment.docentes.usuarios.email,
          phone: assignment.docentes.usuarios.telefono,
          participation: assignment.tipos_participacion.nombre,
        })),
      })),
    };
  }

  async save(
    user: AuthenticatedUser,
    projectId: string,
    dto: ProjectAdvisorDto | UpdateProjectAdvisorDto,
    advisorId?: string,
  ) {
    const project = await this.editableProject(user, projectId);
    const data = {
      nombre: dto.name.trim(),
      email: dto.email?.trim() || null,
      telefono: dto.phone?.trim() || null,
      especialidad: dto.specialty?.trim() || null,
      participacion: dto.participation,
      observaciones: dto.notes?.trim() || null,
      actualizado_por: academicId(user.id),
    };
    return this.db.$transaction(async (tx) => {
      let id: bigint;
      if (advisorId) {
        if (!('version' in dto))
          throw new ConflictException('Falta la versión del registro.');
        id = academicId(advisorId);
        const changed = await tx.asesores_proyecto.updateMany({
          where: {
            id_asesor: id,
            id_proyecto: project.id_proyecto,
            version: dto.version,
          },
          data: { ...data, activo: dto.active, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'El registro cambió o no pertenece al proyecto. Actualiza la pantalla.',
          );
      } else {
        const created = await tx.asesores_proyecto.create({
          data: {
            ...data,
            id_proyecto: project.id_proyecto,
            registrado_por: academicId(user.id),
          },
        });
        id = created.id_asesor;
      }
      await tx.auditoria.create({
        data: {
          id_usuario: academicId(user.id),
          entidad: 'asesores_proyecto',
          entidad_id: id.toString(),
          accion: advisorId
            ? 'ACTUALIZAR_ASESOR_REGISTRADO'
            : 'REGISTRAR_ASESOR_PROYECTO',
          datos_nuevos: {
            projectId,
            name: data.nombre,
            participation: dto.participation,
            active: 'active' in dto ? dto.active : true,
          },
        },
      });
      return { id: id.toString(), saved: true };
    });
  }
}
