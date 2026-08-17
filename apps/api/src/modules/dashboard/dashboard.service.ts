import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardSummary {
  activeSessions: number;
  activeUsers: number;
  approvedPayments: number;
  enrollments: number;
  generatedAt: string;
  publishedOffers: number;
  roles: number;
  students: number;
  totalUsers: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const [
      totalUsers,
      activeUsers,
      roles,
      students,
      publishedOffers,
      enrollments,
      approvedPayments,
      activeSessions,
    ] = await Promise.all([
      this.prisma.usuarios.count({ where: { deleted_at: null } }),
      this.prisma.usuarios.count({
        where: { deleted_at: null, estado: 'ACTIVO' },
      }),
      this.prisma.roles.count({ where: { estado: 'ACTIVO' } }),
      this.prisma.estudiantes.count(),
      this.prisma.ofertas.count({ where: { estado: 'PUBLICADA' } }),
      this.prisma.inscripciones.count(),
      this.prisma.pagos.count({ where: { estado: 'APROBADO' } }),
      this.prisma.sesiones.count({
        where: { expira_at: { gt: now }, revocada_at: null },
      }),
    ]);

    return {
      activeSessions,
      activeUsers,
      approvedPayments,
      enrollments,
      generatedAt: now.toISOString(),
      publishedOffers,
      roles,
      students,
      totalUsers,
    };
  }
}
