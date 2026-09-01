import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from './projects.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const user = (roles: string[]): AuthenticatedUser => ({
  id: '10',
  email: 'usuario@uasd.edu.do',
  matricula: roles.includes('ESTUDIANTE') ? '100000001' : '',
  codigoEmpleado: roles.includes('ESTUDIANTE') ? '' : 'EMP-10',
  roles,
  permissions: [],
  sessionId: 'session-1',
});

const dto = {
  enrollmentId: '5',
  customArea: 'Procesamiento responsable de datos',
  title: 'Sistema de apoyo académico',
  description: 'Propuesta del estudiante.',
};

describe('ProjectsService role workflow', () => {
  it('allows only students to register a project', async () => {
    const service = new ProjectsService(
      {} as PrismaService,
      {} as NotificationsService,
    );

    await expect(
      service.create(user(['COORDINADOR']), dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registers a student custom area and sends the project to review', async () => {
    let createData: Record<string, unknown> | undefined;
    const row = {
      id_proyecto: BigInt(7),
      id_inscripcion: BigInt(5),
      id_area: null,
      area_personalizada: dto.customArea,
      observacion_revision: null,
      titulo: dto.title,
      descripcion: dto.description,
      estado: 'EN_REVISION',
      fecha_inicio: null,
      fecha_finalizacion: null,
      created_at: new Date(),
      updated_at: new Date(),
      areas_investigacion: null,
      inscripciones: {
        id_inscripcion: BigInt(5),
        codigo: 'INS-5',
        ofertas: {
          titulo: 'Monográfico 2026',
          modalidades: { nombre: 'Monográfico' },
          recinto_carreras: {
            recintos: { nombre: 'UASD Santiago' },
            carreras: { nombre: 'Licenciatura en Informática' },
          },
        },
        inscripcion_estudiantes: [
          {
            es_principal: true,
            estudiantes: {
              matricula: '100000001',
              id_usuario: BigInt(10),
              usuarios: { nombres: 'Ana', apellidos: 'Pérez' },
            },
          },
        ],
      },
      proyecto_docentes: [],
    };
    const prisma = {
      inscripciones: {
        findFirst: jest.fn().mockResolvedValue({ id_inscripcion: BigInt(5) }),
      },
      proyectos_grado: {
        create: jest.fn((query: { data: Record<string, unknown> }) => {
          createData = query.data;
          return Promise.resolve(row);
        }),
      },
    } as unknown as PrismaService;
    const notifications = {
      create: jest.fn().mockResolvedValue({ created: 1 }),
    } as unknown as NotificationsService;

    const result = await new ProjectsService(prisma, notifications).create(
      user(['ESTUDIANTE']),
      dto,
    );

    expect(createData).toMatchObject({
      id_area: null,
      area_personalizada: dto.customArea,
      estado: 'EN_REVISION',
    });
    expect(result.area).toEqual({
      id: null,
      name: dto.customArea,
      custom: true,
    });
  });

  it('keeps assigned teacher projects read-only', async () => {
    const service = new ProjectsService(
      {} as PrismaService,
      {} as NotificationsService,
    );

    await expect(
      service.update(user(['DOCENTE']), '7', { title: 'Cambio no autorizado' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an explanation when coordination rejects a project', async () => {
    const update = jest.fn();
    const prisma = {
      proyectos_grado: {
        findFirst: jest.fn().mockResolvedValue({ estado: 'EN_REVISION' }),
        update,
      },
    } as unknown as PrismaService;
    const service = new ProjectsService(prisma, {} as NotificationsService);

    await expect(
      service.update(user(['COORDINADOR']), '7', { status: 'RECHAZADO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('prevents assigning an advisor user as a jury member', async () => {
    const upsert = jest.fn();
    const prisma = {
      proyectos_grado: {
        findUnique: jest.fn().mockResolvedValue({ id_proyecto: BigInt(7) }),
      },
      docentes: {
        findFirst: jest.fn().mockResolvedValue({
          id_docente: BigInt(4),
          id_usuario: BigInt(14),
          usuarios: {
            usuario_roles_usuario_roles_id_usuarioTousuarios: [
              { roles: { codigo: 'ASESOR' } },
            ],
          },
        }),
      },
      tipos_participacion: {
        findFirst: jest.fn().mockResolvedValue({
          id_tipo_participacion: BigInt(3),
          codigo: 'JURADO',
          nombre: 'Jurado',
        }),
      },
      proyecto_docentes: { upsert },
    } as unknown as PrismaService;
    const service = new ProjectsService(prisma, {} as NotificationsService);

    await expect(
      service.assignTeacher('2', '7', {
        teacherId: '4',
        participationTypeId: '3',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
