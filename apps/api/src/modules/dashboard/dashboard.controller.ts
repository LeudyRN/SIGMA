import { InsightsService, InsightsQuery } from './insights.service';
import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ACCESS_COOKIE } from '../auth/utils/cookies';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
@ApiCookieAuth(ACCESS_COOKIE)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly insights: InsightsService,
  ) {}

  @Get('insights')
  @Permissions('GENERAL_RESUMEN_LEER')
  getInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InsightsQuery,
  ) {
    return this.insights.load(user, query);
  }

  @Get('report-insights')
  @Permissions('GENERAL_REPORTES_LEER')
  @ApiOperation({
    summary: 'Análisis por período para los reportes de UCOTESIS',
  })
  getReportInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InsightsQuery,
  ) {
    return this.insights.load(user, query);
  }

  @Get('summary')
  @Permissions('GENERAL_RESUMEN_LEER')
  @ApiOperation({ summary: 'Resumen operativo calculado desde MySQL' })
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getSummary(user);
  }

  @Get('reports')
  @Permissions('GENERAL_REPORTES_LEER')
  @ApiOperation({ summary: 'Reportes reales de uso y consumo API/DB' })
  getReports() {
    return this.dashboard.getReports();
  }
}
