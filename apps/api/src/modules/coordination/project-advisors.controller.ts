import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ProjectAdvisorDto,
  UpdateProjectAdvisorDto,
} from './project-advisors.dto';
import { ProjectAdvisorsService } from './project-advisors.service';

@Controller('project-advisors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('COORDINACION_ACADEMICA_LEER')
export class ProjectAdvisorsController {
  constructor(private readonly service: ProjectAdvisorsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }
  @Post('projects/:projectId') create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: ProjectAdvisorDto,
  ) {
    return this.service.save(user, projectId, dto);
  }
  @Patch('projects/:projectId/:advisorId') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('advisorId') advisorId: string,
    @Body() dto: UpdateProjectAdvisorDto,
  ) {
    return this.service.save(user, projectId, dto, advisorId);
  }
}
